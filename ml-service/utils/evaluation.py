"""
Advanced evaluation utilities for model performance analysis
"""
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import numpy as np
from collections import Counter

from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    classification_report,
)


class ModelEvaluator:
    """
    Comprehensive model evaluator with detailed metrics
    """

    def __init__(self, labels: List[str]):
        """
        Initialize evaluator
        
        Args:
            labels: List of label names
        """
        self.labels = labels
        self.label_to_idx = {label: idx for idx, label in enumerate(labels)}
        self.idx_to_label = {idx: label for label, idx in self.label_to_idx.items()}

    def evaluate(
        self,
        y_true: List[int],
        y_pred: List[int],
        y_probs: Optional[np.ndarray] = None,
    ) -> Dict:
        """
        Comprehensive evaluation
        
        Args:
            y_true: True labels
            y_pred: Predicted labels
            y_probs: Prediction probabilities (optional)
            
        Returns:
            Dictionary with all metrics
        """
        # Basic metrics
        accuracy = accuracy_score(y_true, y_pred)
        
        # Per-class metrics
        precision, recall, f1, support = precision_recall_fscore_support(
            y_true, y_pred, average=None, zero_division=0
        )
        
        # Weighted averages
        precision_weighted, recall_weighted, f1_weighted, _ = precision_recall_fscore_support(
            y_true, y_pred, average='weighted', zero_division=0
        )
        
        # Macro averages
        precision_macro, recall_macro, f1_macro, _ = precision_recall_fscore_support(
            y_true, y_pred, average='macro', zero_division=0
        )
        
        # Confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        
        # Per-class details
        per_class_metrics = {}
        for idx, label in enumerate(self.labels):
            if idx < len(precision):
                per_class_metrics[label] = {
                    "precision": float(precision[idx]),
                    "recall": float(recall[idx]),
                    "f1": float(f1[idx]),
                    "support": int(support[idx]),
                }
        
        # Classification report
        report = classification_report(
            y_true,
            y_pred,
            target_names=self.labels,
            output_dict=True,
            zero_division=0,
        )
        
        results = {
            "accuracy": float(accuracy),
            "precision_weighted": float(precision_weighted),
            "recall_weighted": float(recall_weighted),
            "f1_weighted": float(f1_weighted),
            "precision_macro": float(precision_macro),
            "recall_macro": float(recall_macro),
            "f1_macro": float(f1_macro),
            "per_class": per_class_metrics,
            "confusion_matrix": cm.tolist(),
            "classification_report": report,
        }
        
        # Confidence calibration (if probabilities provided)
        if y_probs is not None:
            results["confidence_stats"] = self._compute_confidence_stats(y_probs, y_true, y_pred)
        
        return results

    def _compute_confidence_stats(
        self,
        y_probs: np.ndarray,
        y_true: List[int],
        y_pred: List[int],
    ) -> Dict:
        """
        Compute confidence statistics
        
        Args:
            y_probs: Prediction probabilities
            y_true: True labels
            y_pred: Predicted labels
            
        Returns:
            Confidence statistics
        """
        # Get max probabilities (confidence scores)
        confidences = np.max(y_probs, axis=1)
        
        # Confidence for correct predictions
        correct_mask = np.array(y_true) == np.array(y_pred)
        correct_confidences = confidences[correct_mask]
        incorrect_confidences = confidences[~correct_mask]
        
        return {
            "mean_confidence": float(np.mean(confidences)),
            "mean_correct_confidence": float(np.mean(correct_confidences)) if len(correct_confidences) > 0 else 0.0,
            "mean_incorrect_confidence": float(np.mean(incorrect_confidences)) if len(incorrect_confidences) > 0 else 0.0,
            "min_confidence": float(np.min(confidences)),
            "max_confidence": float(np.max(confidences)),
        }

    def print_summary(self, results: Dict):
        """
        Print evaluation summary
        
        Args:
            results: Evaluation results dictionary
        """
        print("\n" + "=" * 60)
        print("Model Evaluation Summary")
        print("=" * 60)
        print(f"\nOverall Metrics:")
        print(f"  Accuracy: {results['accuracy']:.4f}")
        print(f"  Precision (weighted): {results['precision_weighted']:.4f}")
        print(f"  Recall (weighted): {results['recall_weighted']:.4f}")
        print(f"  F1 Score (weighted): {results['f1_weighted']:.4f}")
        print(f"  F1 Score (macro): {results['f1_macro']:.4f}")
        
        print(f"\nPer-Class Metrics:")
        for label, metrics in results['per_class'].items():
            print(f"  {label}:")
            print(f"    Precision: {metrics['precision']:.4f}")
            print(f"    Recall: {metrics['recall']:.4f}")
            print(f"    F1: {metrics['f1']:.4f}")
            print(f"    Support: {metrics['support']}")
        
        if "confidence_stats" in results:
            stats = results["confidence_stats"]
            print(f"\nConfidence Statistics:")
            print(f"  Mean Confidence: {stats['mean_confidence']:.4f}")
            print(f"  Mean Correct Confidence: {stats['mean_correct_confidence']:.4f}")
            print(f"  Mean Incorrect Confidence: {stats['mean_incorrect_confidence']:.4f}")

    def save_results(self, results: Dict, filepath: Path):
        """
        Save evaluation results to JSON
        
        Args:
            results: Evaluation results
            filepath: Path to save results
        """
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\nResults saved to {filepath}")







