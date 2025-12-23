"""
Hyperparameter tuning for question classification model
"""
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple
import itertools

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import torch
from torch.utils.data import DataLoader, random_split

from ml_service.config import (
    TRAINING_CONFIG,
    CHECKPOINTS_DIR,
    DEVICE,
    MAX_SEQUENCE_LENGTH,
)
from ml_service.data.dataset import (
    load_question_dataset,
    create_topic_dataset,
)
from ml_service.models.classifier import BERTurkClassifier
from ml_service.models.trainer import Trainer
from transformers import AutoTokenizer


def grid_search_hyperparameters(
    texts: List[str],
    topics: List[str],
    param_grid: Dict,
    max_combinations: int = 20,
) -> List[Dict]:
    """
    Perform grid search for hyperparameter optimization
    
    Args:
        texts: List of question texts
        topics: List of topic labels
        param_grid: Dictionary of parameter ranges
        max_combinations: Maximum number of combinations to try
        
    Returns:
        List of results sorted by validation accuracy
    """
    print("Starting hyperparameter tuning...")
    print(f"Parameter grid: {param_grid}")
    
    # Generate all combinations
    keys = param_grid.keys()
    values = param_grid.values()
    combinations = list(itertools.product(*values))
    
    # Limit combinations
    if len(combinations) > max_combinations:
        print(f"Limiting {len(combinations)} combinations to {max_combinations}")
        import random
        random.seed(42)
        combinations = random.sample(combinations, max_combinations)
    
    print(f"Testing {len(combinations)} combinations...")
    
    results = []
    tokenizer = AutoTokenizer.from_pretrained("dbmdz/bert-base-turkish-cased")
    
    for idx, combination in enumerate(combinations):
        params = dict(zip(keys, combination))
        print(f"\n{'='*60}")
        print(f"Combination {idx + 1}/{len(combinations)}")
        print(f"Parameters: {params}")
        print(f"{'='*60}")
        
        try:
            # Create dataset
            dataset = create_topic_dataset(texts, topics, tokenizer)
            
            # Split dataset
            train_size = int(0.7 * len(dataset))
            val_size = int(0.15 * len(dataset))
            test_size = len(dataset) - train_size - val_size
            
            train_dataset, val_dataset, test_dataset = random_split(
                dataset,
                [train_size, val_size, test_size],
                generator=torch.Generator().manual_seed(42),
            )
            
            # Create data loaders
            train_loader = DataLoader(
                train_dataset,
                batch_size=params["batch_size"],
                shuffle=True,
            )
            val_loader = DataLoader(val_dataset, batch_size=params["batch_size"])
            test_loader = DataLoader(test_dataset, batch_size=params["batch_size"])
            
            # Initialize model
            num_labels = len(dataset.unique_labels)
            model = BERTurkClassifier(num_labels=num_labels)
            
            # Create config
            config = TRAINING_CONFIG.copy()
            config.update({
                "learning_rate": params["learning_rate"],
                "batch_size": params["batch_size"],
                "epochs": params["epochs"],
                "weight_decay": params.get("weight_decay", config["weight_decay"]),
                "warmup_steps": params.get("warmup_steps", config["warmup_steps"]),
            })
            
            # Train
            trainer = Trainer(model, train_loader, val_loader, test_loader, config)
            history = trainer.train()
            
            # Get best validation accuracy
            best_val_acc = max(history["val_accuracy"]) if history["val_accuracy"] else 0
            best_val_f1 = max(history["val_f1"]) if history["val_f1"] else 0
            
            result = {
                "parameters": params,
                "best_val_accuracy": best_val_acc,
                "best_val_f1": best_val_f1,
                "test_accuracy": history.get("test_accuracy", 0),
                "test_f1": history.get("test_f1", 0),
                "history": history,
            }
            
            results.append(result)
            
            print(f"Best Val Accuracy: {best_val_acc:.4f}, Best Val F1: {best_val_f1:.4f}")
            
        except Exception as e:
            print(f"Error with combination {idx + 1}: {e}")
            continue
    
    # Sort by validation accuracy
    results.sort(key=lambda x: x["best_val_accuracy"], reverse=True)
    
    return results


def main():
    """
    Main hyperparameter tuning function
    """
    print("Loading dataset...")
    questions, subjects, topics = load_question_dataset()
    
    texts = [q["question_text"] for q in questions]
    
    # Parameter grid (reduced for faster tuning)
    param_grid = {
        "learning_rate": [1e-5, 2e-5, 3e-5],
        "batch_size": [4, 8],
        "epochs": [8, 10],
        "weight_decay": [0.01, 0.05],
    }
    
    # Perform grid search
    results = grid_search_hyperparameters(
        texts,
        topics,
        param_grid,
        max_combinations=12,  # Limit to 12 combinations
    )
    
    # Save results
    results_path = CHECKPOINTS_DIR / "hyperparameter_results.json"
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*60}")
    print("Hyperparameter Tuning Results")
    print(f"{'='*60}")
    print(f"\nTop 3 combinations:")
    for i, result in enumerate(results[:3]):
        print(f"\n{i+1}. Parameters: {result['parameters']}")
        print(f"   Val Accuracy: {result['best_val_accuracy']:.4f}")
        print(f"   Val F1: {result['best_val_f1']:.4f}")
        print(f"   Test Accuracy: {result.get('test_accuracy', 0):.4f}")
        print(f"   Test F1: {result.get('test_f1', 0):.4f}")
    
    print(f"\nResults saved to: {results_path}")
    
    # Update config with best parameters
    if results:
        best_params = results[0]["parameters"]
        print(f"\nBest parameters: {best_params}")
        print("Update TRAINING_CONFIG in config.py with these values")


if __name__ == "__main__":
    main()


































