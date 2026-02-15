"""
Test script for ML model improvements
Tests Focal Loss, Label Smoothing, Data Augmentation, and Advanced Preprocessing
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import torch
import torch.nn as nn
from transformers import AutoTokenizer

from ml_service.models.losses import FocalLoss, LabelSmoothingCrossEntropy
from ml_service.data.augmentation import TextAugmenter, augment_dataset
from ml_service.data.preprocessor import TextPreprocessor
from ml_service.config import TRAINING_CONFIG


def test_focal_loss():
    """Test Focal Loss implementation"""
    print("=" * 60)
    print("Testing Focal Loss")
    print("=" * 60)
    
    # Create dummy data
    batch_size = 4
    num_classes = 5
    logits = torch.randn(batch_size, num_classes)
    targets = torch.randint(0, num_classes, (batch_size,))
    
    # Test Focal Loss
    focal_loss = FocalLoss(gamma=2.0)
    loss_value = focal_loss(logits, targets)
    
    print(f"✓ Focal Loss computed successfully: {loss_value.item():.4f}")
    
    # Test with alpha
    alpha = torch.ones(num_classes) / num_classes
    focal_loss_weighted = FocalLoss(alpha=alpha, gamma=2.0)
    loss_weighted = focal_loss_weighted(logits, targets)
    print(f"✓ Weighted Focal Loss computed successfully: {loss_weighted.item():.4f}")
    
    # Test with label smoothing
    focal_loss_smooth = FocalLoss(gamma=2.0, label_smoothing=0.1)
    loss_smooth = focal_loss_smooth(logits, targets)
    print(f"✓ Focal Loss with label smoothing computed successfully: {loss_smooth.item():.4f}")
    
    print()


def test_label_smoothing():
    """Test Label Smoothing Cross Entropy"""
    print("=" * 60)
    print("Testing Label Smoothing Cross Entropy")
    print("=" * 60)
    
    # Create dummy data
    batch_size = 4
    num_classes = 5
    logits = torch.randn(batch_size, num_classes)
    targets = torch.randint(0, num_classes, (batch_size,))
    
    # Test Label Smoothing
    label_smoothing_loss = LabelSmoothingCrossEntropy(smoothing=0.1)
    loss_value = label_smoothing_loss(logits, targets)
    
    print(f"✓ Label Smoothing Loss computed successfully: {loss_value.item():.4f}")
    
    # Compare with standard Cross Entropy
    ce_loss = nn.CrossEntropyLoss()
    ce_value = ce_loss(logits, targets)
    print(f"✓ Standard Cross Entropy Loss: {ce_value.item():.4f}")
    print(f"  Difference: {abs(loss_value.item() - ce_value.item()):.4f}")
    
    print()


def test_data_augmentation():
    """Test Data Augmentation"""
    print("=" * 60)
    print("Testing Data Augmentation")
    print("=" * 60)
    
    # Sample questions
    sample_texts = [
        "Aşağıdakilerden hangisi kurallı bir fiil cümlesidir?",
        "Bu bilgiye göre hangi söz sanatı kullanılmıştır?",
        "Numaralanmış cümlelerden hangisinde fiilimsi vardır?",
    ]
    
    augmenter = TextAugmenter(seed=42)
    
    # Test synonym replacement
    print("Testing synonym replacement:")
    for text in sample_texts[:2]:
        augmented = augmenter.synonym_replacement(text, num_replacements=2)
        print(f"  Original: {text}")
        print(f"  Augmented: {augmented}")
        print()
    
    # Test question rephrasing
    print("Testing question rephrasing:")
    for text in sample_texts[:2]:
        augmented = augmenter.question_rephrasing(text)
        print(f"  Original: {text}")
        print(f"  Augmented: {augmented}")
        print()
    
    # Test full augmentation
    print("Testing full augmentation:")
    augmented_texts = augmenter.augment_batch(sample_texts, ratio=0.5)
    for orig, aug in zip(sample_texts, augmented_texts):
        if orig != aug:
            print(f"  Original: {orig}")
            print(f"  Augmented: {aug}")
            print()
    
    # Test augment_dataset function
    labels = ["Cümle Türleri", "Söz Sanatları", "Fiilimsiler"]
    aug_texts, aug_labels = augment_dataset(sample_texts, labels, augmentation_ratio=0.3, seed=42)
    print(f"✓ Dataset augmentation: {len(sample_texts)} -> {len(aug_texts)} samples")
    print()


def test_advanced_preprocessing():
    """Test Advanced Preprocessing"""
    print("=" * 60)
    print("Testing Advanced Preprocessing")
    print("=" * 60)
    
    sample_texts = [
        "1- Aşağıdakilerden hangisi kurallı bir fiil cümlesidir? A) Okudu B) Kitap C) Güzel D) Hızlı",
        "Bu bilgiye göre hangi söz sanatı kullanılmıştır?",
        "Numaralanmış cümlelerden hangisinde fiilimsi vardır?",
    ]
    
    # Test context extraction
    print("Testing context extraction:")
    for text in sample_texts:
        context = TextPreprocessor.extract_question_context(text)
        print(f"  Text: {text[:50]}...")
        print(f"  Context: {context}")
        print()
    
    # Test preprocessing with context
    print("Testing preprocessing with context:")
    for text in sample_texts[:2]:
        processed = TextPreprocessor.preprocess_with_context(text, use_context=True)
        print(f"  Original: {text[:60]}...")
        print(f"  Processed: {processed[:80]}...")
        print()
    
    # Test question text extraction
    print("Testing question text extraction:")
    for text in sample_texts[:2]:
        extracted = TextPreprocessor.extract_question_text_only(text)
        print(f"  Original: {text}")
        print(f"  Extracted: {extracted}")
        print()


def test_config():
    """Test Configuration"""
    print("=" * 60)
    print("Testing Configuration")
    print("=" * 60)
    
    print("Training Config:")
    print(f"  use_focal_loss: {TRAINING_CONFIG.get('use_focal_loss', False)}")
    print(f"  focal_gamma: {TRAINING_CONFIG.get('focal_gamma', 2.0)}")
    print(f"  label_smoothing: {TRAINING_CONFIG.get('label_smoothing', 0.0)}")
    print(f"  augmentation_enabled: {TRAINING_CONFIG.get('augmentation_enabled', False)}")
    print(f"  augmentation_ratio: {TRAINING_CONFIG.get('augmentation_ratio', 0.3)}")
    print()


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("ML Model Improvements Test Suite")
    print("=" * 60 + "\n")
    
    try:
        test_focal_loss()
        test_label_smoothing()
        test_data_augmentation()
        test_advanced_preprocessing()
        test_config()
        
        print("=" * 60)
        print("✓ All tests completed successfully!")
        print("=" * 60)
        print("\nTo enable improvements, update TRAINING_CONFIG in config.py:")
        print("  - Set 'use_focal_loss': True for Focal Loss")
        print("  - Set 'label_smoothing': 0.1 for Label Smoothing")
        print("  - Set 'augmentation_enabled': True for Data Augmentation")
        print()
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
