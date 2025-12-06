"""
PyTorch Dataset classes for question classification
"""
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import torch
from torch.utils.data import Dataset
from transformers import AutoTokenizer

from ml_service.config import (
    QUESTION_DATASET_PATH,
    QUESTION_TRAINING_DATASET_PATH,
    BERT_MODEL_NAME,
    MAX_SEQUENCE_LENGTH,
    SUBJECTS,
    SUBJECT_TOPICS,
    TOPIC_TO_SUBJECT,
)
from ml_service.data.preprocessor import TextPreprocessor


class QuestionDataset(Dataset):
    """
    PyTorch Dataset for question classification
    Supports both subject and topic classification
    """

    def __init__(
        self,
        texts: List[str],
        labels: List[str],
        tokenizer: AutoTokenizer,
        max_length: int = MAX_SEQUENCE_LENGTH,
        preprocessor: Optional[TextPreprocessor] = None,
        show_progress: bool = True,
    ):
        """
        Initialize dataset
        
        Args:
            texts: List of question texts
            labels: List of labels (subject or topic)
            tokenizer: BERTurk tokenizer
            max_length: Maximum sequence length
            preprocessor: Optional text preprocessor
            show_progress: Whether to show progress during initialization
        """
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length
        # Preprocessor not stored - we use static method directly to avoid recursion
        
        # Create label to index mapping
        self.unique_labels = sorted(list(set(labels)))
        self.label_to_idx = {label: idx for idx, label in enumerate(self.unique_labels)}
        self.idx_to_label = {idx: label for label, idx in self.label_to_idx.items()}
        self.num_classes = len(self.unique_labels)
        
        # Show progress if requested
        if show_progress and len(texts) > 50:
            print(f"Processing {len(texts)} texts...", flush=True)

    def __len__(self) -> int:
        return len(self.texts)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        """
        Get a single item from the dataset
        
        Args:
            idx: Index of the item
            
        Returns:
            Dictionary with input_ids, attention_mask, and labels
        """
        text = self.texts[idx]
        label = self.labels[idx]
        
        # Preprocess text (use static method to avoid recursion)
        text = TextPreprocessor.preprocess(text)
        
        # Tokenize
        encoding = self.tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=self.max_length,
            return_tensors="pt",
        )
        
        # Convert label to index
        label_idx = self.label_to_idx[label]
        
        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "labels": torch.tensor(label_idx, dtype=torch.long),
        }


def load_question_dataset(
    dataset_path: Optional[Path] = None,
) -> Tuple[List[Dict], List[str], List[str]]:
    """
    Load question dataset from JSON file
    
    Args:
        dataset_path: Path to question dataset JSON file
        
    Returns:
        Tuple of (questions, subjects, topics)
    """
    if dataset_path is None:
        dataset_path = QUESTION_DATASET_PATH
    
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset file not found: {dataset_path}")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    questions = data.get("questions", [])
    
    # Extract texts, subjects, and topics
    texts = []
    subjects = []
    topics = []
    
    for question in questions:
        question_text = question.get("question_text", "")
        topic = question.get("topic", "")
        
        if not question_text or not topic:
            continue
        
        # Determine subject from topic
        subject = TOPIC_TO_SUBJECT.get(topic, "turkce")  # Default to Turkish
        
        texts.append(question_text)
        subjects.append(subject)
        topics.append(topic)
    
    return questions, subjects, topics


def load_training_dataset(
    dataset_path: Optional[Path] = None,
) -> Tuple[List[str], List[str]]:
    """
    Load training dataset (simplified format)
    
    Args:
        dataset_path: Path to training dataset JSON file
        
    Returns:
        Tuple of (texts, labels)
    """
    if dataset_path is None:
        dataset_path = QUESTION_TRAINING_DATASET_PATH
    
    if not dataset_path.exists():
        raise FileNotFoundError(f"Training dataset file not found: {dataset_path}")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    texts = []
    labels = []
    
    for item in data:
        text = item.get("text", "")
        label = item.get("label", "")
        
        if text and label:
            texts.append(text)
            labels.append(label)
    
    return texts, labels


def create_subject_dataset(
    texts: List[str],
    subjects: List[str],
    tokenizer: AutoTokenizer,
    max_length: int = MAX_SEQUENCE_LENGTH,
) -> QuestionDataset:
    """
    Create dataset for subject classification
    
    Args:
        texts: List of question texts
        subjects: List of subject labels
        tokenizer: BERTurk tokenizer
        max_length: Maximum sequence length
        
    Returns:
        QuestionDataset configured for subject classification
    """
    return QuestionDataset(texts, subjects, tokenizer, max_length)


def create_topic_dataset(
    texts: List[str],
    topics: List[str],
    tokenizer: AutoTokenizer,
    max_length: int = MAX_SEQUENCE_LENGTH,
) -> QuestionDataset:
    """
    Create dataset for topic classification
    
    Args:
        texts: List of question texts
        topics: List of topic labels
        tokenizer: BERTurk tokenizer
        max_length: Maximum sequence length
        
    Returns:
        QuestionDataset configured for topic classification
    """
    return QuestionDataset(texts, topics, tokenizer, max_length)

