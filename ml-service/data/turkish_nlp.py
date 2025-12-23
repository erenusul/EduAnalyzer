"""
Turkish NLP utilities for preprocessing
"""
import re
from typing import List

# Turkish stop words
TURKISH_STOP_WORDS = {
    "ve", "ile", "bir", "bu", "şu", "o", "de", "da", "ki", "mi", "mı", "mu", "mü",
    "için", "gibi", "kadar", "daha", "çok", "en", "var", "yok", "ise", "ise",
    "olan", "olarak", "göre", "gibi", "kadar", "daha", "çok", "en", "var", "yok",
    "a", "an", "the", "ve", "ile", "bir", "bu", "şu", "o", "de", "da", "ki",
    "mi", "mı", "mu", "mü", "için", "gibi", "kadar", "daha", "çok", "en",
}

# Common Turkish question words (should NOT be removed)
QUESTION_WORDS = {
    "hangisi", "hangi", "hangisidir", "hangisinde", "neden", "niçin", "nasıl",
    "ne", "nerede", "nereden", "nereye", "kim", "kime", "kimi", "kaç", "kaçıncı",
}


class TurkishNLP:
    """
    Turkish NLP utilities
    """

    @staticmethod
    def remove_stop_words(text: str, keep_question_words: bool = True) -> str:
        """
        Remove Turkish stop words
        
        Args:
            text: Input text
            keep_question_words: Keep question words even if they're stop words
            
        Returns:
            Text without stop words
        """
        words = text.split()
        filtered_words = []
        
        for word in words:
            word_lower = word.lower().strip(".,!?;:")
            if word_lower in TURKISH_STOP_WORDS:
                if keep_question_words and word_lower in QUESTION_WORDS:
                    filtered_words.append(word)
                # Skip stop word
                continue
            filtered_words.append(word)
        
        return " ".join(filtered_words)

    @staticmethod
    def simple_stem(word: str) -> str:
        """
        Simple Turkish stemming (removes common suffixes)
        
        Args:
            word: Input word
            
        Returns:
            Stemmed word
        """
        # Common Turkish suffixes
        suffixes = [
            "lar", "ler", "ların", "lerin", "lara", "lere",
            "dan", "den", "tan", "ten", "da", "de", "ta", "te",
            "ın", "in", "un", "ün", "ı", "i", "u", "ü",
            "a", "e", "ya", "ye",
            "m", "n", "sı", "si", "su", "sü",
        ]
        
        word_lower = word.lower()
        for suffix in sorted(suffixes, key=len, reverse=True):
            if word_lower.endswith(suffix) and len(word_lower) > len(suffix) + 2:
                return word_lower[:-len(suffix)]
        
        return word_lower

    @staticmethod
    def normalize_turkish_chars(text: str) -> str:
        """
        Normalize Turkish characters
        
        Args:
            text: Input text
            
        Returns:
            Normalized text
        """
        # Normalize common variations
        replacements = {
            "İ": "i",
            "ı": "i",
            "I": "ı",
            "ş": "s",
            "Ş": "s",
            "ğ": "g",
            "Ğ": "g",
            "ü": "u",
            "Ü": "u",
            "ö": "o",
            "Ö": "o",
            "ç": "c",
            "Ç": "c",
        }
        
        # Actually, we should NOT normalize Turkish chars for BERTurk
        # BERTurk expects proper Turkish characters
        return text

    @staticmethod
    def extract_question_type(text: str) -> str:
        """
        Detect question type
        
        Args:
            text: Question text
            
        Returns:
            Question type ("multiple_choice", "open_ended", "unknown")
        """
        text_lower = text.lower()
        
        # Multiple choice indicators
        mc_indicators = [
            "aşağıdakilerden hangisi",
            "hangisi",
            "verilenlerden hangisi",
            "seçeneklerden hangisi",
            "a)", "b)", "c)", "d)",
        ]
        
        # Open-ended indicators
        oe_indicators = [
            "neden", "niçin", "nasıl", "ne", "açıklayınız",
            "yazınız", "söyleyiniz", "belirtiniz",
        ]
        
        for indicator in mc_indicators:
            if indicator in text_lower:
                return "multiple_choice"
        
        for indicator in oe_indicators:
            if indicator in text_lower:
                return "open_ended"
        
        return "unknown"

    @staticmethod
    def extract_key_terms(text: str, max_terms: int = 5) -> List[str]:
        """
        Extract key terms from question
        
        Args:
            text: Question text
            max_terms: Maximum number of terms to extract
            
        Returns:
            List of key terms
        """
        # Remove punctuation and split
        words = re.findall(r'\b\w+\b', text.lower())
        
        # Filter out stop words and question words
        key_terms = [
            word for word in words
            if word not in TURKISH_STOP_WORDS
            and word not in QUESTION_WORDS
            and len(word) > 3
        ]
        
        # Return most frequent terms
        from collections import Counter
        term_counts = Counter(key_terms)
        return [term for term, _ in term_counts.most_common(max_terms)]









