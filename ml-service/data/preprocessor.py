"""
Text preprocessing utilities for question classification
"""
import re
from typing import List, Optional

from ml_service.data.turkish_nlp import TurkishNLP


class TextPreprocessor:
    """
    Text preprocessing class for cleaning and normalizing Turkish question texts
    """

    def __init__(self, remove_stop_words: bool = False, stem_words: bool = False):
        """
        Initialize preprocessor
        
        Args:
            remove_stop_words: Whether to remove stop words
            stem_words: Whether to stem words
        """
        self.remove_stop_words = remove_stop_words
        self.stem_words = stem_words
        self.turkish_nlp = TurkishNLP()

    @staticmethod
    def clean_text(text: str) -> str:
        """
        Clean and normalize text for better model performance
        
        Args:
            text: Raw text input
            
        Returns:
            Cleaned text
        """
        if not text:
            return ""
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove special characters that might interfere (keep Turkish characters)
        # Keep: letters, numbers, Turkish characters, punctuation, spaces
        text = re.sub(r'[^\w\s\.,;:!?()\[\]{}"\'-]', '', text)
        
        # Normalize quotes
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace("'", "'").replace("'", "'")
        
        # Remove multiple consecutive punctuation marks (keep single)
        text = re.sub(r'([.,;:!?])\1+', r'\1', text)
        
        # Strip leading/trailing whitespace
        text = text.strip()
        
        return text

    @staticmethod
    def normalize_text(text: str) -> str:
        """
        Normalize text for consistent processing
        
        Args:
            text: Input text
            
        Returns:
            Normalized text
        """
        if not text:
            return ""
        
        # Convert to lowercase for consistency (optional, BERTurk handles casing)
        # Actually, we keep original casing as BERTurk is cased model
        text = text.strip()
        
        # Remove zero-width characters
        text = re.sub(r'[\u200b-\u200f\u202a-\u202e]', '', text)
        
        # Normalize line breaks
        text = re.sub(r'\r\n|\r|\n', ' ', text)
        
        return text

    @staticmethod
    def preprocess(text: str) -> str:
        """
        Static preprocessing method (main method, no recursion)
        
        Args:
            text: Raw input text
            
        Returns:
            Preprocessed text ready for tokenization
        """
        if not text:
            return ""
        
        # Apply normalization first
        text = TextPreprocessor.normalize_text(text)
        
        # Then apply cleaning
        text = TextPreprocessor.clean_text(text)
        
        return text

    def preprocess_with_options(self, text: str) -> str:
        """
        Instance method with optional features (stop words, stemming)
        
        Args:
            text: Raw input text
            
        Returns:
            Preprocessed text ready for tokenization
        """
        if not text:
            return ""
        
        # Start with basic preprocessing
        text = TextPreprocessor.preprocess(text)
        
        # Optional: Remove stop words (usually not recommended for BERT)
        if self.remove_stop_words:
            text = self.turkish_nlp.remove_stop_words(text, keep_question_words=True)
        
        # Optional: Stem words (usually not recommended for BERT)
        if self.stem_words:
            words = text.split()
            stemmed_words = [self.turkish_nlp.simple_stem(word) for word in words]
            text = " ".join(stemmed_words)
        
        return text

    @staticmethod
    def truncate_text(text: str, max_length: int = 512) -> str:
        """
        Truncate text to maximum length if needed
        
        Args:
            text: Input text
            max_length: Maximum character length
            
        Returns:
            Truncated text
        """
        if len(text) <= max_length:
            return text
        
        # Truncate and add ellipsis
        return text[:max_length - 3] + "..."

    @staticmethod
    def batch_preprocess(texts: List[str]) -> List[str]:
        """
        Preprocess a batch of texts
        
        Args:
            texts: List of raw text inputs
            
        Returns:
            List of preprocessed texts
        """
        return [TextPreprocessor.preprocess(text) for text in texts]
