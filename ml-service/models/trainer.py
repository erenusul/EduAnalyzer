"""
Model training script for question classification
"""
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Add ml-service directory to path for imports
ml_service_path = Path(__file__).parent.parent
sys.path.insert(0, str(ml_service_path.parent))

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, classification_report, f1_score
from torch.utils.data import DataLoader, random_split
from transformers import AutoTokenizer, get_linear_schedule_with_warmup

# Import from ml_service module
import importlib.util
spec = importlib.util.spec_from_file_location("config", ml_service_path / "config.py")
config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config)

spec = importlib.util.spec_from_file_location("dataset", ml_service_path / "data" / "dataset.py")
dataset_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dataset_module)

spec = importlib.util.spec_from_file_location("classifier", ml_service_path / "models" / "classifier.py")
classifier_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(classifier_module)

# Use imported modules
TRAINING_CONFIG = config.TRAINING_CONFIG
CHECKPOINTS_DIR = config.CHECKPOINTS_DIR
DEVICE = config.DEVICE
SUBJECTS = config.SUBJECTS
SUBJECT_TOPICS = config.SUBJECT_TOPICS
SUBJECT_MODEL_NAME = config.SUBJECT_MODEL_NAME
TOPIC_MODEL_NAME = config.TOPIC_MODEL_NAME
MAX_SEQUENCE_LENGTH = config.MAX_SEQUENCE_LENGTH

load_question_dataset = dataset_module.load_question_dataset
create_subject_dataset = dataset_module.create_subject_dataset
create_topic_dataset = dataset_module.create_topic_dataset
BERTurkClassifier = classifier_module.BERTurkClassifier


class Trainer:
    """
    Trainer class for BERTurk classifier
    """

    def __init__(
        self,
        model: nn.Module,
        train_loader: DataLoader,
        val_loader: DataLoader,
        test_loader: Optional[DataLoader] = None,
        config: Optional[Dict] = None,
    ):
        """
        Initialize trainer
        
        Args:
            model: BERTurk classifier model
            train_loader: Training data loader
            val_loader: Validation data loader
            test_loader: Optional test data loader
            config: Training configuration dictionary
        """
        self.model = model.to(DEVICE)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.test_loader = test_loader
        self.config = config or TRAINING_CONFIG
        
        # Class weights for imbalanced dataset
        self.class_weights = self._compute_class_weights()
        
        # Optimizer
        self.optimizer = torch.optim.AdamW(
            self.model.parameters(),
            lr=self.config["learning_rate"],
            weight_decay=self.config["weight_decay"],
        )
        
        # Learning rate scheduler - improved with cosine annealing
        total_steps = len(train_loader) * self.config["epochs"]
        # Use cosine annealing with warm restarts for better convergence
        from transformers import get_cosine_schedule_with_warmup
        self.scheduler = get_cosine_schedule_with_warmup(
            self.optimizer,
            num_warmup_steps=self.config["warmup_steps"],
            num_training_steps=total_steps,
            num_cycles=0.5,  # Cosine annealing cycles
        )
        
        # Training history
        self.history = {
            "train_loss": [],
            "val_loss": [],
            "val_accuracy": [],
            "val_f1": [],
        }
        
        # Early stopping
        self.best_val_loss = float("inf")
        self.patience_counter = 0
    
    def _compute_class_weights(self) -> Optional[torch.Tensor]:
        """
        Compute class weights for imbalanced dataset
        
        Returns:
            Class weights tensor or None
        """
        try:
            # Collect all labels from training dataset
            all_labels = []
            for batch in self.train_loader:
                labels = batch["labels"]
                all_labels.extend(labels.cpu().numpy())
            
            # Count occurrences of each class
            from collections import Counter
            label_counts = Counter(all_labels)
            
            # Compute inverse frequency weights
            total_samples = len(all_labels)
            num_classes = len(label_counts)
            
            weights = torch.zeros(num_classes, dtype=torch.float32)
            for label_idx, count in label_counts.items():
                # Inverse frequency weighting
                weights[label_idx] = total_samples / (num_classes * count)
            
            # Normalize weights
            weights = weights / weights.sum() * num_classes
            
            print(f"Computed class weights: {weights.tolist()}", flush=True)
            print(f"Label distribution: {dict(label_counts)}", flush=True)
            
            return weights.to(DEVICE)
        except Exception as e:
            print(f"Warning: Could not compute class weights: {e}", flush=True)
        return None

    def train_epoch(self) -> float:
        """
        Train for one epoch
        
        Returns:
            Average training loss
        """
        self.model.train()
        total_loss = 0
        num_batches = len(self.train_loader)
        accumulation_steps = 2  # Gradient accumulation steps
        
        self.optimizer.zero_grad()  # Zero gradients at start
        
        for batch_idx, batch in enumerate(self.train_loader):
            input_ids = batch["input_ids"].to(DEVICE)
            attention_mask = batch["attention_mask"].to(DEVICE)
            labels = batch["labels"].to(DEVICE)
            
            # Forward pass
            outputs = self.model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels,
            )
            loss = outputs["loss"]
            
            # Apply class weights if available
            if self.class_weights is not None:
                # Get logits and compute weighted loss manually
                logits = outputs["logits"]
                loss_fn = nn.CrossEntropyLoss(weight=self.class_weights, reduction='mean')
                loss = loss_fn(logits, labels)
            
            # Scale loss for gradient accumulation
            loss = loss / accumulation_steps
            
            # Backward pass
            loss.backward()
            
            # Gradient accumulation
            if (batch_idx + 1) % accumulation_steps == 0 or (batch_idx + 1) == num_batches:
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                self.optimizer.step()
                self.scheduler.step()
                self.optimizer.zero_grad()
            
            total_loss += loss.item() * accumulation_steps  # Scale back for reporting
            
            # Show progress every 10 batches
            if (batch_idx + 1) % 10 == 0 or (batch_idx + 1) == num_batches:
                print(f"  Batch {batch_idx + 1}/{num_batches} - Loss: {loss.item() * accumulation_steps:.4f}", flush=True)
        
        return total_loss / len(self.train_loader)

    def evaluate(self, loader: DataLoader) -> Tuple[float, float, Dict]:
        """
        Evaluate model on a dataset
        
        Args:
            loader: Data loader
            
        Returns:
            Tuple of (loss, accuracy, classification_report_dict)
        """
        self.model.eval()
        total_loss = 0
        all_predictions = []
        all_labels = []
        
        with torch.no_grad():
            for batch in loader:
                input_ids = batch["input_ids"].to(DEVICE)
                attention_mask = batch["attention_mask"].to(DEVICE)
                labels = batch["labels"].to(DEVICE)
                
                outputs = self.model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    labels=labels,
                )
                loss = outputs["loss"]
                logits = outputs["logits"]
                
                total_loss += loss.item()
                
                predictions = torch.argmax(logits, dim=-1)
                all_predictions.extend(predictions.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
        
        avg_loss = total_loss / len(loader)
        accuracy = accuracy_score(all_labels, all_predictions)
        f1 = f1_score(all_labels, all_predictions, average="weighted")
        
        # Classification report
        report = classification_report(
            all_labels,
            all_predictions,
            output_dict=True,
            zero_division=0,
        )
        
        return avg_loss, accuracy, f1, report

    def train(self) -> Dict:
        """
        Train the model
        
        Returns:
            Training history dictionary
        """
        print("Starting training...", flush=True)
        print(f"Device: {DEVICE}", flush=True)
        print(f"Training samples: {len(self.train_loader.dataset)}", flush=True)
        print(f"Validation samples: {len(self.val_loader.dataset)}", flush=True)
        
        for epoch in range(self.config["epochs"]):
            print(f"\nEpoch {epoch + 1}/{self.config['epochs']}", flush=True)
            print("Training...", flush=True)
            # Train
            train_loss = self.train_epoch()
            
            print("Validating...", flush=True)
            # Validate
            val_loss, val_accuracy, val_f1, val_report = self.evaluate(self.val_loader)
            
            # Update history
            self.history["train_loss"].append(train_loss)
            self.history["val_loss"].append(val_loss)
            self.history["val_accuracy"].append(val_accuracy)
            self.history["val_f1"].append(val_f1)
            
            print(
                f"Epoch {epoch + 1}/{self.config['epochs']} - "
                f"Train Loss: {train_loss:.4f}, "
                f"Val Loss: {val_loss:.4f}, "
                f"Val Acc: {val_accuracy:.4f} ({val_accuracy*100:.2f}%), "
                f"Val F1: {val_f1:.4f}",
                flush=True
            )
            
            # Print per-class metrics for first and last epoch
            if epoch == 0 or epoch == self.config['epochs'] - 1:
                print("\nPer-class metrics:", flush=True)
                for label_name, metrics in val_report.items():
                    if isinstance(metrics, dict) and 'precision' in metrics:
                        print(
                            f"  {label_name}: "
                            f"Precision={metrics['precision']:.3f}, "
                            f"Recall={metrics['recall']:.3f}, "
                            f"F1={metrics['f1-score']:.3f}, "
                            f"Support={metrics['support']}",
                            flush=True
                        )
                print("", flush=True)
            
            # Early stopping check
            if val_loss < self.best_val_loss - self.config["early_stopping_min_delta"]:
                self.best_val_loss = val_loss
                self.patience_counter = 0
            else:
                self.patience_counter += 1
                if self.patience_counter >= self.config["early_stopping_patience"]:
                    print(f"Early stopping at epoch {epoch + 1}", flush=True)
                    break
        
        # Evaluate on test set if available
        if self.test_loader:
            test_loss, test_accuracy, test_f1, test_report = self.evaluate(self.test_loader)
            print(f"\nTest Results - Loss: {test_loss:.4f}, Acc: {test_accuracy:.4f}, F1: {test_f1:.4f}", flush=True)
            self.history["test_loss"] = test_loss
            self.history["test_accuracy"] = test_accuracy
            self.history["test_f1"] = test_f1
        
        return self.history

    def save_checkpoint(
        self,
        filepath: Path,
        labels: List[str],
        additional_info: Optional[Dict] = None,
    ) -> None:
        """
        Save model checkpoint
        
        Args:
            filepath: Path to save checkpoint
            labels: List of label names
            additional_info: Additional information to save
        """
        checkpoint = {
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "history": self.history,
            "labels": labels,
            "config": self.config,
        }
        
        if additional_info:
            checkpoint.update(additional_info)
        
        filepath.parent.mkdir(parents=True, exist_ok=True)
        torch.save(checkpoint, filepath)
        print(f"Checkpoint saved to {filepath}", flush=True)


def train_subject_classifier(
    texts: List[str],
    subjects: List[str],
    output_dir: Optional[Path] = None,
) -> Path:
    """
    Train subject classification model
    
    Args:
        texts: List of question texts
        subjects: List of subject labels
        output_dir: Output directory for checkpoint
        
    Returns:
        Path to saved checkpoint
    """
    if output_dir is None:
        output_dir = CHECKPOINTS_DIR
    
    # Initialize tokenizer
    print("Initializing tokenizer...", flush=True)
    tokenizer = AutoTokenizer.from_pretrained("dbmdz/bert-base-turkish-cased")
    print("Tokenizer ready.", flush=True)
    
    # Create dataset
    print(f"Creating dataset from {len(texts)} texts (this may take a while)...", flush=True)
    dataset = create_subject_dataset(texts, subjects, tokenizer)
    print(f"Dataset created: {len(dataset)} samples", flush=True)
    
    # Split dataset
    train_size = int(TRAINING_CONFIG["train_split"] * len(dataset))
    val_size = int(TRAINING_CONFIG["val_split"] * len(dataset))
    test_size = len(dataset) - train_size - val_size
    
    train_dataset, val_dataset, test_dataset = random_split(
        dataset,
        [train_size, val_size, test_size],
        generator=torch.Generator().manual_seed(TRAINING_CONFIG["seed"]),
    )
    
    # Create data loaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=TRAINING_CONFIG["batch_size"],
        shuffle=True,
    )
    val_loader = DataLoader(val_dataset, batch_size=TRAINING_CONFIG["batch_size"])
    test_loader = DataLoader(test_dataset, batch_size=TRAINING_CONFIG["batch_size"])
    
    # Initialize model
    num_labels = len(dataset.unique_labels)
    model = BERTurkClassifier(num_labels=num_labels)
    
    # Train
    trainer = Trainer(model, train_loader, val_loader, test_loader)
    trainer.train()
    
    # Save checkpoint
    checkpoint_path = output_dir / SUBJECT_MODEL_NAME
    trainer.save_checkpoint(checkpoint_path, dataset.unique_labels)
    
    return checkpoint_path


def train_topic_classifier(
    texts: List[str],
    topics: List[str],
    output_dir: Optional[Path] = None,
) -> Path:
    """
    Train topic classification model
    
    Args:
        texts: List of question texts
        topics: List of topic labels
        output_dir: Output directory for checkpoint
        
    Returns:
        Path to saved checkpoint
    """
    if output_dir is None:
        output_dir = CHECKPOINTS_DIR
    
    # Initialize tokenizer
    print("Initializing tokenizer...", flush=True)
    tokenizer = AutoTokenizer.from_pretrained("dbmdz/bert-base-turkish-cased")
    print("Tokenizer ready.", flush=True)
    
    # Create dataset
    print(f"Creating dataset from {len(texts)} texts (this may take a while)...", flush=True)
    dataset = create_topic_dataset(texts, topics, tokenizer)
    print(f"Dataset created: {len(dataset)} samples", flush=True)
    
    # Split dataset
    train_size = int(TRAINING_CONFIG["train_split"] * len(dataset))
    val_size = int(TRAINING_CONFIG["val_split"] * len(dataset))
    test_size = len(dataset) - train_size - val_size
    
    train_dataset, val_dataset, test_dataset = random_split(
        dataset,
        [train_size, val_size, test_size],
        generator=torch.Generator().manual_seed(TRAINING_CONFIG["seed"]),
    )
    
    # Create data loaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=TRAINING_CONFIG["batch_size"],
        shuffle=True,
    )
    val_loader = DataLoader(val_dataset, batch_size=TRAINING_CONFIG["batch_size"])
    test_loader = DataLoader(test_dataset, batch_size=TRAINING_CONFIG["batch_size"])
    
    # Initialize model
    print("Initializing model...", flush=True)
    num_labels = len(dataset.unique_labels)
    model = BERTurkClassifier(num_labels=num_labels)
    print(f"Model initialized with {num_labels} labels.", flush=True)
    
    # Train
    trainer = Trainer(model, train_loader, val_loader, test_loader)
    trainer.train()
    
    # Save checkpoint
    checkpoint_path = output_dir / TOPIC_MODEL_NAME
    trainer.save_checkpoint(checkpoint_path, dataset.unique_labels)
    
    return checkpoint_path


def main():
    """
    Main training function
    """
    print("Loading dataset...", flush=True)
    questions, subjects, topics = load_question_dataset()
    
    print(f"Loaded {len(questions)} questions", flush=True)
    print(f"Subjects: {set(subjects)}", flush=True)
    print(f"Topics: {set(topics)}", flush=True)
    
    # Skip subject classifier training since all data is Turkish
    # Subject will always be predicted as "turkce"
    print("\n" + "=" * 50, flush=True)
    print("Skipping Subject Classifier (all data is Turkish)", flush=True)
    print("=" * 50, flush=True)
    print("Subject will always be predicted as 'turkce'", flush=True)
    
    # Train topic classifier with improved settings
    print("\n" + "=" * 50, flush=True)
    print("Training Topic Classifier", flush=True)
    print("=" * 50, flush=True)
    topic_checkpoint = train_topic_classifier(
        [q["question_text"] for q in questions],
        topics,
    )
    print(f"Topic model saved to: {topic_checkpoint}", flush=True)


if __name__ == "__main__":
    main()

