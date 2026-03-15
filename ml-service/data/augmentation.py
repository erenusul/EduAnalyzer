"""
Data augmentation utilities for question classification
"""
import random
import re
from typing import List, Tuple


class TextAugmenter:
    """
    Text augmentation for Turkish question texts
    Implements various augmentation strategies to improve model generalization
    """
    
    def __init__(self, seed: int = 42):
        """
        Initialize text augmenter
        
        Args:
            seed: Random seed for reproducibility
        """
        self.seed = seed
        random.seed(seed)
        
        # Turkish synonym dictionary (common words in educational context)
        self.synonyms = {
            "hangi": ["hangisi", "hangi", "hangisidir"],
            "aşağıdakilerden": ["aşağıdakilerden", "aşağıdakilerden hangisi"],
            "hangisi": ["hangi", "hangisi", "hangisidir"],
            "doğru": ["doğru", "yanlış", "doğru olan"],
            "yanlış": ["yanlış", "doğru", "yanlış olan"],
            "cümle": ["cümle", "tümce"],
            "soru": ["soru", "soru cümlesi"],
            "metin": ["metin", "yazı", "parça"],
            "anlam": ["anlam", "mana", "anlamı"],
            "kelime": ["kelime", "sözcük"],
            "sözcük": ["sözcük", "kelime"],
            "türkçe": ["Türkçe", "türkçe"],
            "türkçenin": ["Türkçenin", "türkçenin"],
            "bilgiye": ["bilgiye", "verilere", "bilgilere"],
            "göre": ["göre", "göre", "bakılırsa"],
            "numaralanmış": ["numaralanmış", "numaralandırılmış"],
            "verilen": ["verilen", "sunulan", "belirtilen"],
            "paragraf": ["paragraf", "bölüm", "parça"],
        }
        
        # Question rephrasing patterns
        self.rephrasing_patterns = [
            # Pattern: (original_pattern, replacement_pattern)
            (r"aşağıdakilerden hangisi", r"aşağıdakilerden hangisi"),
            (r"bu bilgiye göre", r"bu bilgilere göre"),
            (r"verilen", r"sunulan"),
            (r"numaralanmış", r"numaralandırılmış"),
        ]
    
    def synonym_replacement(self, text: str, num_replacements: int = 2) -> str:
        """
        Replace words with synonyms
        
        Args:
            text: Input text
            num_replacements: Number of words to replace
            
        Returns:
            Augmented text
        """
        words = text.split()
        augmented_words = words.copy()
        
        # Find words that have synonyms
        replaceable_indices = [
            i for i, word in enumerate(words)
            if word.lower() in self.synonyms
        ]
        
        if not replaceable_indices:
            return text
        
        # Randomly select words to replace
        num_to_replace = min(num_replacements, len(replaceable_indices))
        indices_to_replace = random.sample(replaceable_indices, num_to_replace)
        
        for idx in indices_to_replace:
            word = words[idx].lower()
            if word in self.synonyms:
                synonyms = self.synonyms[word]
                # Don't replace with the same word
                synonyms = [s for s in synonyms if s.lower() != word]
                if synonyms:
                    replacement = random.choice(synonyms)
                    # Preserve original case
                    if words[idx][0].isupper():
                        replacement = replacement.capitalize()
                    augmented_words[idx] = replacement
        
        return " ".join(augmented_words)
    
    def question_rephrasing(self, text: str) -> str:
        """
        Rephrase question using pattern matching
        
        Args:
            text: Input text
            
        Returns:
            Rephrased text
        """
        augmented_text = text
        
        # Apply rephrasing patterns randomly
        for pattern, replacement in self.rephrasing_patterns:
            if random.random() < 0.3:  # 30% chance to apply each pattern
                augmented_text = re.sub(
                    pattern,
                    replacement,
                    augmented_text,
                    flags=re.IGNORECASE
                )
        
        return augmented_text
    
    def add_noise(self, text: str, noise_prob: float = 0.1) -> str:
        """
        Add small random noise (typos simulation)
        
        Args:
            text: Input text
            noise_prob: Probability of adding noise to each character
            
        Returns:
            Text with noise
        """
        if random.random() > noise_prob:
            return text
        
        # Simple noise: randomly swap adjacent characters (simulating typos)
        chars = list(text)
        num_swaps = max(1, int(len(chars) * 0.01))  # Swap ~1% of characters
        
        for _ in range(num_swaps):
            if len(chars) < 2:
                break
            idx = random.randint(0, len(chars) - 2)
            # Only swap if both are letters
            if chars[idx].isalpha() and chars[idx + 1].isalpha():
                chars[idx], chars[idx + 1] = chars[idx + 1], chars[idx]
        
        return "".join(chars)
    
    def augment(self, text: str, methods: List[str] = None) -> str:
        """
        Apply augmentation methods to text
        
        Args:
            text: Input text
            methods: List of augmentation methods to apply
                    Options: 'synonym', 'rephrase', 'noise'
                    If None, applies all methods randomly
            
        Returns:
            Augmented text
        """
        if methods is None:
            methods = ['synonym', 'rephrase']
        
        augmented_text = text
        
        # Apply synonym replacement
        if 'synonym' in methods and random.random() < 0.7:
            augmented_text = self.synonym_replacement(augmented_text, num_replacements=random.randint(1, 3))
        
        # Apply rephrasing
        if 'rephrase' in methods and random.random() < 0.5:
            augmented_text = self.question_rephrasing(augmented_text)
        
        # Apply noise (less frequently)
        if 'noise' in methods and random.random() < 0.2:
            augmented_text = self.add_noise(augmented_text, noise_prob=0.05)
        
        return augmented_text
    
    def augment_batch(self, texts: List[str], ratio: float = 0.3) -> List[str]:
        """
        Augment a batch of texts
        
        Args:
            texts: List of input texts
            ratio: Ratio of texts to augment (0.0-1.0)
            
        Returns:
            List of augmented texts (same length as input)
        """
        num_to_augment = int(len(texts) * ratio)
        indices_to_augment = random.sample(range(len(texts)), num_to_augment)
        
        augmented_texts = []
        for i, text in enumerate(texts):
            if i in indices_to_augment:
                augmented_texts.append(self.augment(text))
            else:
                augmented_texts.append(text)
        
        return augmented_texts


def augment_dataset_topic_aware(
    texts: List[str],
    labels: List[str],
    base_ratio: float = 0.3,
    low_support_threshold: int = 100,
    low_support_ratio: float = 0.5,
    seed: int = 42,
) -> Tuple[List[str], List[str]]:
    """
    Augment dataset with higher ratio for low-support topics.
    Topics with fewer samples get more augmentation to balance the dataset.
    """
    from collections import Counter
    label_counts = Counter(labels)
    total = len(texts)

    augmented_texts = []
    augmented_labels = []
    augmenter = TextAugmenter(seed=seed)
    random.seed(seed)

    for i, (text, label) in enumerate(zip(texts, labels)):
        augmented_texts.append(text)
        augmented_labels.append(label)
        count = label_counts[label]
        ratio = low_support_ratio if count < low_support_threshold else base_ratio
        if random.random() < ratio:
            augmented_texts.append(augmenter.augment(text))
            augmented_labels.append(label)

    return augmented_texts, augmented_labels


def augment_dataset(
    texts: List[str],
    labels: List[str],
    augmentation_ratio: float = 0.3,
    seed: int = 42,
) -> Tuple[List[str], List[str]]:
    """
    Augment dataset by creating new examples
    
    Args:
        texts: List of question texts
        labels: List of labels
        augmentation_ratio: Ratio of data to augment (0.0-1.0)
        seed: Random seed
        
    Returns:
        Tuple of (augmented_texts, augmented_labels)
    """
    if augmentation_ratio <= 0.0:
        return texts.copy(), labels.copy()
    
    augmenter = TextAugmenter(seed=seed)
    
    num_to_augment = max(1, int(len(texts) * augmentation_ratio))
    if num_to_augment > len(texts):
        num_to_augment = len(texts)
    
    indices_to_augment = random.sample(range(len(texts)), num_to_augment)
    
    augmented_texts = []
    augmented_labels = []
    
    # Add original data
    augmented_texts.extend(texts)
    augmented_labels.extend(labels)
    
    # Add augmented data
    for idx in indices_to_augment:
        augmented_text = augmenter.augment(texts[idx])
        augmented_texts.append(augmented_text)
        augmented_labels.append(labels[idx])
    
    return augmented_texts, augmented_labels
