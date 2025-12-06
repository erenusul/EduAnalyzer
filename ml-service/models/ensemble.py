"""
Ensemble methods for combining multiple models
"""
import torch
import torch.nn as nn
from typing import List, Dict, Tuple, Optional
from pathlib import Path

from ml_service.models.classifier import QuestionClassifier, BERTurkClassifier
from ml_service.config import CHECKPOINTS_DIR, DEVICE


class EnsembleClassifier:
    """
    Ensemble classifier combining multiple models
    """

    def __init__(
        self,
        model_paths: List[Path],
        model_type: str = "topic",
        device: Optional[str] = None,
    ):
        """
        Initialize ensemble
        
        Args:
            model_paths: List of paths to model checkpoints
            model_type: Type of models ("subject" or "topic")
            device: Device to run on
        """
        self.device = device or DEVICE
        self.model_type = model_type
        self.models: List[nn.Module] = []
        self.labels: List[str] = []
        
        # Load all models
        for model_path in model_paths:
            if model_path.exists():
                classifier = QuestionClassifier()
                classifier.load_model(model_path.parent, model_type)
                
                if model_type == "topic":
                    if classifier.topic_model:
                        self.models.append(classifier.topic_model)
                        if not self.labels:
                            self.labels = classifier.topic_labels
                elif model_type == "subject":
                    if classifier.subject_model:
                        self.models.append(classifier.subject_model)
                        if not self.labels:
                            self.labels = classifier.subject_labels
        
        if not self.models:
            raise ValueError("No models loaded for ensemble")
        
        print(f"Ensemble initialized with {len(self.models)} models")

    def predict_averaging(
        self,
        text: str,
        tokenizer,
        top_k: int = 1,
    ) -> List[Tuple[str, float]]:
        """
        Predict using model averaging
        
        Args:
            text: Input text
            tokenizer: Tokenizer instance
            top_k: Number of top predictions
            
        Returns:
            List of (label, confidence) tuples
        """
        from ml_service.config import MAX_SEQUENCE_LENGTH
        from ml_service.data.preprocessor import TextPreprocessor
        
        text = TextPreprocessor.preprocess(text)
        
        # Tokenize
        encoding = tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=MAX_SEQUENCE_LENGTH,
            return_tensors="pt",
        )
        
        input_ids = encoding["input_ids"].to(self.device)
        attention_mask = encoding["attention_mask"].to(self.device)
        
        # Get predictions from all models
        all_probs = []
        with torch.no_grad():
            for model in self.models:
                model.eval()
                outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                logits = outputs["logits"]
                probs = torch.softmax(logits, dim=-1)
                all_probs.append(probs)
        
        # Average probabilities
        avg_probs = torch.mean(torch.stack(all_probs), dim=0)[0]
        
        # Get top k
        top_probs, top_indices = torch.topk(avg_probs, k=min(top_k, len(self.labels)))
        
        results = [
            (self.labels[idx.item()], prob.item())
            for prob, idx in zip(top_probs, top_indices)
        ]
        
        return results

    def predict_voting(
        self,
        text: str,
        tokenizer,
        top_k: int = 1,
    ) -> List[Tuple[str, float]]:
        """
        Predict using majority voting
        
        Args:
            text: Input text
            tokenizer: Tokenizer instance
            top_k: Number of top predictions
            
        Returns:
            List of (label, confidence) tuples
        """
        from ml_service.config import MAX_SEQUENCE_LENGTH
        from ml_service.data.preprocessor import TextPreprocessor
        
        text = TextPreprocessor.preprocess(text)
        
        # Tokenize
        encoding = tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=MAX_SEQUENCE_LENGTH,
            return_tensors="pt",
        )
        
        input_ids = encoding["input_ids"].to(self.device)
        attention_mask = encoding["attention_mask"].to(self.device)
        
        # Get predictions from all models
        votes = []
        confidences = []
        
        with torch.no_grad():
            for model in self.models:
                model.eval()
                outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                logits = outputs["logits"]
                probs = torch.softmax(logits, dim=-1)
                
                # Get top prediction
                pred_idx = torch.argmax(probs[0]).item()
                confidence = probs[0][pred_idx].item()
                
                votes.append(pred_idx)
                confidences.append(confidence)
        
        # Count votes
        from collections import Counter
        vote_counts = Counter(votes)
        
        # Sort by vote count and confidence
        results = []
        for label_idx, count in vote_counts.most_common():
            # Average confidence for this label
            label_confidences = [
                conf for idx, conf in zip(votes, confidences) if idx == label_idx
            ]
            avg_confidence = sum(label_confidences) / len(label_confidences)
            
            # Weight by vote count
            weighted_confidence = avg_confidence * (count / len(self.models))
            
            results.append((self.labels[label_idx], weighted_confidence))
        
        # Sort by confidence
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results[:top_k]

