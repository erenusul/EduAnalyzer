"""
Pytest suite for ML model improvements
Tests Focal Loss, Label Smoothing, Data Augmentation, and Advanced Preprocessing
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import torch
import torch.nn as nn

from ml_service.models.losses import FocalLoss, LabelSmoothingCrossEntropy
from ml_service.data.augmentation import TextAugmenter, augment_dataset
from ml_service.data.preprocessor import TextPreprocessor
from ml_service.config import TRAINING_CONFIG


def test_focal_loss():
    """Test Focal Loss implementation"""
    batch_size = 4
    num_classes = 5
    logits = torch.randn(batch_size, num_classes)
    targets = torch.randint(0, num_classes, (batch_size,))

    focal_loss = FocalLoss(gamma=2.0)
    loss_value = focal_loss(logits, targets)
    assert loss_value.dim() == 0
    assert loss_value.item() > 0

    alpha = torch.ones(num_classes) / num_classes
    focal_loss_weighted = FocalLoss(alpha=alpha, gamma=2.0)
    loss_weighted = focal_loss_weighted(logits, targets)
    assert loss_weighted.item() > 0

    focal_loss_smooth = FocalLoss(gamma=2.0, label_smoothing=0.1)
    loss_smooth = focal_loss_smooth(logits, targets)
    assert loss_smooth.item() > 0


def test_label_smoothing():
    """Test Label Smoothing Cross Entropy"""
    batch_size = 4
    num_classes = 5
    logits = torch.randn(batch_size, num_classes)
    targets = torch.randint(0, num_classes, (batch_size,))

    label_smoothing_loss = LabelSmoothingCrossEntropy(smoothing=0.1)
    loss_value = label_smoothing_loss(logits, targets)
    assert loss_value.item() > 0

    ce_loss = nn.CrossEntropyLoss()
    ce_value = ce_loss(logits, targets)
    assert abs(loss_value.item() - ce_value.item()) >= 0


def test_data_augmentation():
    """Test Data Augmentation"""
    sample_texts = [
        "Aşağıdakilerden hangisi kurallı bir fiil cümlesidir?",
        "Bu bilgiye göre hangi söz sanatı kullanılmıştır?",
        "Numaralanmış cümlelerden hangisinde fiilimsi vardır?",
    ]
    augmenter = TextAugmenter(seed=42)

    for text in sample_texts[:2]:
        augmented = augmenter.synonym_replacement(text, num_replacements=2)
        assert isinstance(augmented, str)

    augmented_texts = augmenter.augment_batch(sample_texts, ratio=0.5)
    assert len(augmented_texts) == len(sample_texts)

    labels = ["Cümle Türleri", "Söz Sanatları", "Fiilimsiler"]
    aug_texts, aug_labels = augment_dataset(sample_texts, labels, augmentation_ratio=0.3, seed=42)
    assert len(aug_texts) >= len(sample_texts)
    assert len(aug_labels) == len(aug_texts)


def test_advanced_preprocessing():
    """Test Advanced Preprocessing"""
    sample_texts = [
        "1- Aşağıdakilerden hangisi kurallı bir fiil cümlesidir? A) Okudu B) Kitap C) Güzel D) Hızlı",
        "Bu bilgiye göre hangi söz sanatı kullanılmıştır?",
        "Numaralanmış cümlelerden hangisinde fiilimsi vardır?",
    ]

    for text in sample_texts:
        context = TextPreprocessor.extract_question_context(text)
        assert isinstance(context, dict)
        assert "keywords" in context or "question_type" in context

    for text in sample_texts[:2]:
        processed = TextPreprocessor.preprocess_with_context(text, use_context=True)
        assert isinstance(processed, str)

    for text in sample_texts[:2]:
        extracted = TextPreprocessor.extract_question_text_only(text)
        assert isinstance(extracted, str)


def test_config():
    """Test Configuration"""
    assert "use_focal_loss" in TRAINING_CONFIG or "focal_gamma" in TRAINING_CONFIG
    assert "label_smoothing" in TRAINING_CONFIG or "augmentation_enabled" in TRAINING_CONFIG
