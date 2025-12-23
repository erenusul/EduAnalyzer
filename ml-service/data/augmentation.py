"""
Data augmentation utilities for question classification
Various techniques to increase dataset size and diversity
"""
import random
from typing import List, Dict
import re

# Turkish synonym dictionary (simplified - can be expanded)
TURKISH_SYNONYMS = {
    "hangisi": ["hangi", "hangisidir", "hangisinde"],
    "aşağıdakilerden": ["aşağıdaki", "verilenlerden", "bunlardan"],
    "soru": ["soruda", "soruda", "sorunun"],
    "cümle": ["tümce", "ifade"],
    "metin": ["yazı", "paragraf", "pasaj"],
    "anlam": ["mana", "mefhum"],
    "kelime": ["sözcük", "söz"],
    "tür": ["çeşit", "tip"],
    "kural": ["kaide", "prensip"],
    "işaret": ["sembol", "gösterge"],
}

# Question reformulation patterns
QUESTION_PATTERNS = [
    ("hangisi", "hangisidir"),
    ("hangisidir", "hangisi"),
    ("aşağıdakilerden hangisi", "verilenlerden hangisi"),
    ("verilenlerden hangisi", "aşağıdakilerden hangisi"),
    ("bu bilgiye göre", "bu bilgiden hareketle"),
    ("bu bilgiden hareketle", "bu bilgiye göre"),
]


class DataAugmenter:
    """
    Data augmentation class for Turkish questions
    """

    def __init__(self, augmentation_factor: int = 2):
        """
        Initialize augmenter
        
        Args:
            augmentation_factor: How many times to augment each sample
        """
        self.augmentation_factor = augmentation_factor

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
            if word.lower() in TURKISH_SYNONYMS
        ]
        
        if not replaceable_indices:
            return text
        
        # Randomly select words to replace
        num_to_replace = min(num_replacements, len(replaceable_indices))
        indices_to_replace = random.sample(replaceable_indices, num_to_replace)
        
        for idx in indices_to_replace:
            word = words[idx].lower()
            if word in TURKISH_SYNONYMS:
                synonyms = TURKISH_SYNONYMS[word]
                replacement = random.choice(synonyms)
                # Preserve capitalization
                if words[idx][0].isupper():
                    replacement = replacement.capitalize()
                augmented_words[idx] = replacement
        
        return " ".join(augmented_words)

    def question_reformulation(self, text: str) -> str:
        """
        Reformulate question structure
        
        Args:
            text: Input text
            
        Returns:
            Reformulated text
        """
        augmented_text = text
        
        # Apply pattern replacements
        for pattern, replacement in QUESTION_PATTERNS:
            if pattern in augmented_text.lower():
                # Randomly decide whether to replace
                if random.random() > 0.5:
                    augmented_text = re.sub(
                        pattern,
                        replacement,
                        augmented_text,
                        flags=re.IGNORECASE,
                    )
        
        return augmented_text

    def random_insertion(self, text: str, num_insertions: int = 1) -> str:
        """
        Insert random words (contextually appropriate)
        
        Args:
            text: Input text
            num_insertions: Number of insertions
            
        Returns:
            Augmented text
        """
        words = text.split()
        if len(words) < 3:
            return text
        
        # Contextual filler words
        fillers = ["bu", "şu", "o", "bir", "her"]
        
        for _ in range(num_insertions):
            if random.random() > 0.7:  # 30% chance
                filler = random.choice(fillers)
                insert_pos = random.randint(0, len(words))
                words.insert(insert_pos, filler)
        
        return " ".join(words)

    def random_deletion(self, text: str, deletion_prob: float = 0.1) -> str:
        """
        Randomly delete words (with low probability)
        
        Args:
            text: Input text
            deletion_prob: Probability of deleting each word
            
        Returns:
            Augmented text
        """
        words = text.split()
        if len(words) < 5:
            return text  # Don't delete from short texts
        
        # Keep words with probability (1 - deletion_prob)
        filtered_words = [
            word for word in words
            if random.random() > deletion_prob
        ]
        
        # Ensure at least 3 words remain
        if len(filtered_words) < 3:
            return text
        
        return " ".join(filtered_words)

    def contextual_augmentation(self, text: str) -> str:
        """
        Contextual augmentation using simple heuristics
        
        Args:
            text: Input text
            
        Returns:
            Augmented text
        """
        # Combine multiple techniques
        augmented = text
        
        # Apply synonym replacement (50% chance)
        if random.random() > 0.5:
            augmented = self.synonym_replacement(augmented, num_replacements=1)
        
        # Apply question reformulation (30% chance)
        if random.random() > 0.7:
            augmented = self.question_reformulation(augmented)
        
        return augmented

    def augment_text(self, text: str, method: str = "random") -> List[str]:
        """
        Augment a single text using specified method
        
        Args:
            text: Input text
            method: Augmentation method ("synonym", "reformulation", "contextual", "random")
            
        Returns:
            List of augmented texts
        """
        augmented_texts = []
        
        for _ in range(self.augmentation_factor):
            if method == "synonym":
                augmented = self.synonym_replacement(text)
            elif method == "reformulation":
                augmented = self.question_reformulation(text)
            elif method == "contextual":
                augmented = self.contextual_augmentation(text)
            else:  # random
                # Randomly choose a method
                methods = [
                    self.synonym_replacement,
                    self.question_reformulation,
                    self.contextual_augmentation,
                ]
                augment_func = random.choice(methods)
                augmented = augment_func(text)
            
            # Only add if different from original
            if augmented != text and len(augmented.strip()) > 10:
                augmented_texts.append(augmented)
        
        # Always include original
        return [text] + augmented_texts

    def augment_dataset(
        self,
        texts: List[str],
        labels: List[str],
        method: str = "random",
    ) -> tuple[List[str], List[str]]:
        """
        Augment entire dataset
        
        Args:
            texts: List of texts
            labels: List of labels
            method: Augmentation method
            
        Returns:
            Tuple of (augmented_texts, augmented_labels)
        """
        augmented_texts = []
        augmented_labels = []
        
        for text, label in zip(texts, labels):
            augmented = self.augment_text(text, method=method)
            augmented_texts.extend(augmented)
            augmented_labels.extend([label] * len(augmented))
        
        return augmented_texts, augmented_labels









