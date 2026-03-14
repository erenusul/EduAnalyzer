"""
PyTorch Dataset classes for question classification
"""
import json
import re
import unicodedata
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
    ALL_TOPICS,
    SUBJECTS,
    SUBJECT_TOPICS,
    TOPIC_TO_SUBJECT,
    TRAINING_CONFIG,
)
from ml_service.data.preprocessor import TextPreprocessor


def _normalize_topic(topic: str) -> str:
    topic = unicodedata.normalize("NFKD", (topic or "")).strip().lower()
    replacements = {
        "ı": "i",
        "ğ": "g",
        "ü": "u",
        "ö": "o",
        "ş": "s",
        "ç": "c",
        "İ": "i",
        "Ğ": "g",
        "Ü": "u",
        "Ö": "o",
        "Ş": "s",
        "Ç": "c",
    }
    for old, new in replacements.items():
        topic = topic.replace(old, new)
    topic = "".join(ch for ch in topic if not unicodedata.combining(ch))
    topic = re.sub(r"[^a-z0-9 ]+", "", topic)
    topic = re.sub(r"\s+", " ", topic).strip()
    return topic


def _canonicalize_topic(topic: str) -> str:
    normalized = _normalize_topic(topic)
    aliases = {
        "paragraf": "Paragraf Bilgisi",
        "paragraf bilgisi": "Paragraf Bilgisi",
        "paragraf ana fikir": "Paragraf Bilgisi",
        "paragraf anafikir": "Paragraf Bilgisi",
        "paragraf baslik": "Paragraf Bilgisi",
        "paragraf konu": "Paragraf Bilgisi",
        "paragraf yardimci fikir": "Paragraf Bilgisi",
        "paragraf paragraf tamamlama": "Paragraf Bilgisi",
        "paragraf paragraf olusturma ve siralama": "Paragraf Bilgisi",
        "paragraf bilgisi ana fikir": "Paragraf Bilgisi",
        "paragraf bilgisi anafikir": "Paragraf Bilgisi",
        "paragraf bilgisi baslik": "Paragraf Bilgisi",
        "paragraf bilgisi konu": "Paragraf Bilgisi",
        "paragraf bilgisi yardimci fikir": "Paragraf Bilgisi",
        "paragraf bilgisi paragraf tamamlama": "Paragraf Bilgisi",
        "paragraf bilgisi paragraf olusturma ve siralama": "Paragraf Bilgisi",
        "anlatim bicimleri": "Anlatım Biçimleri",
        "dusunceyi gelistirme yollari": "Düşünceyi Geliştirme Yolları",
        "anlatim bozuklugu": "Anlatım Bozuklukları",
        "anlatim bozukluklari": "Anlatım Bozuklukları",
        "yapisal anlatim bozukluklari": "Anlatım Bozuklukları",
        "noktalama": "Noktalama İşaretleri",
        "noktalamaisaretleri": "Noktalama İşaretleri",
        "cumlede anlam": "Cümlede Anlam",
        "cumlede vurgu": "Cümlede Vurgu",
        "cumle turleri": "Cümle Türleri",
        "soz sanatlari": "Söz Sanatları",
        "sozsanatlari": "Söz Sanatları",
        "deyimler ve atasozleri": "Deyimler ve Atasözleri",
        "degimler ve atasozleri": "Deyimler ve Atasözleri",
        "deyimler": "Deyimler ve Atasözleri",
        "atasozleri": "Deyimler ve Atasözleri",
        "gecis ve baglanti ifadeleri": "Geçiş ve Bağlantı İfadeleri",
        "sozcukler arasi anlam iliskileri": "Sözcükler Arası Anlam İlişkileri",
        "gorsel okuma ve grafik tablo": "Görsel Okuma ve Grafik Tablo",
        "cumlenin ogeleri": "Öge",
    }
    if normalized in aliases:
        return aliases[normalized]
    for canonical in ALL_TOPICS:
        if _normalize_topic(canonical) == normalized:
            return canonical
    return topic


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
        text = TextPreprocessor.preprocess_for_classification(text)
        
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
    filtered_questions = []
    seen_samples = set()
    
    for question in questions:
        question_text = question.get("question_text", "")
        topic = _canonicalize_topic(question.get("topic", ""))
        if topic and topic not in ALL_TOPICS:
            continue

        question_text = TextPreprocessor.extract_question_text_only(question_text)
        
        if not question_text or not topic:
            continue

        sample_key = (
            question.get("question_id", ""),
            question_text,
            topic,
        )
        if sample_key in seen_samples:
            continue
        seen_samples.add(sample_key)
        
        # Determine subject from topic
        subject = TOPIC_TO_SUBJECT.get(topic, "turkce")  # Default to Turkish
        cleaned_question = dict(question)
        cleaned_question["question_text"] = question_text
        cleaned_question["topic"] = topic
        
        texts.append(question_text)
        subjects.append(subject)
        topics.append(topic)
        filtered_questions.append(cleaned_question)
    
    return filtered_questions, subjects, topics


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
    apply_augmentation: bool = None,
) -> QuestionDataset:
    """
    Create dataset for subject classification
    
    Args:
        texts: List of question texts
        subjects: List of subject labels
        tokenizer: BERTurk tokenizer
        max_length: Maximum sequence length
        apply_augmentation: Whether to apply data augmentation (None = use config)
        
    Returns:
        QuestionDataset configured for subject classification
    """
    # Apply augmentation if enabled
    if apply_augmentation is None:
        apply_augmentation = TRAINING_CONFIG.get("augmentation_enabled", False)
    
    if apply_augmentation:
        from ml_service.data.augmentation import augment_dataset
        augmentation_ratio = TRAINING_CONFIG.get("augmentation_ratio", 0.3)
        seed = TRAINING_CONFIG.get("seed", 42)
        
        print(f"Applying data augmentation (ratio={augmentation_ratio})...", flush=True)
        texts, subjects = augment_dataset(
            texts,
            subjects,
            augmentation_ratio=augmentation_ratio,
            seed=seed,
        )
        print(f"Augmented dataset size: {len(texts)} samples", flush=True)
    
    return QuestionDataset(texts, subjects, tokenizer, max_length)


def create_topic_dataset(
    texts: List[str],
    topics: List[str],
    tokenizer: AutoTokenizer,
    max_length: int = MAX_SEQUENCE_LENGTH,
    apply_augmentation: bool = None,
) -> QuestionDataset:
    """
    Create dataset for topic classification
    
    Args:
        texts: List of question texts
        topics: List of topic labels
        tokenizer: BERTurk tokenizer
        max_length: Maximum sequence length
        apply_augmentation: Whether to apply data augmentation (None = use config)
        
    Returns:
        QuestionDataset configured for topic classification
    """
    # Apply augmentation if enabled
    if apply_augmentation is None:
        apply_augmentation = TRAINING_CONFIG.get("augmentation_enabled", False)
    
    if apply_augmentation:
        from ml_service.data.augmentation import augment_dataset
        augmentation_ratio = TRAINING_CONFIG.get("augmentation_ratio", 0.3)
        seed = TRAINING_CONFIG.get("seed", 42)
        
        print(f"Applying data augmentation (ratio={augmentation_ratio})...", flush=True)
        texts, topics = augment_dataset(
            texts,
            topics,
            augmentation_ratio=augmentation_ratio,
            seed=seed,
        )
        print(f"Augmented dataset size: {len(texts)} samples", flush=True)
    
    return QuestionDataset(texts, topics, tokenizer, max_length)

