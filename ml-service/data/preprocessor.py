"""
Text preprocessing utilities for question classification
"""
import re
from typing import List, Optional, Dict, Tuple

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
    def preprocess(text: str, enhance_visuals: bool = True) -> str:
        """
        Static preprocessing method (main method, no recursion)
        
        Args:
            text: Raw input text
            enhance_visuals: Whether to enhance visual content
            
        Returns:
            Preprocessed text ready for tokenization
        """
        if not text:
            return ""
        
        # Enhance visual content first (before normalization)
        if enhance_visuals and TextPreprocessor.detect_visual_markers(text):
            text = TextPreprocessor.enhance_visual_text(text)
        
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
    
    @staticmethod
    def detect_visual_markers(text: str) -> bool:
        """
        Detect if text contains visual markers
        
        Args:
            text: Question text
            
        Returns:
            True if visual markers detected
        """
        visual_markers = [
            "[GRAFİK]", "[TABLO]", "[ŞEKİL]", "[RESİM]", "[GÖRSEL]",
            "[GÖRSEL METNİ:", "[grafik]", "[tablo]", "[şekil]"
        ]
        return any(marker in text for marker in visual_markers)
    
    @staticmethod
    def extract_visual_text(text: str) -> Optional[str]:
        """
        Extract OCR text from visual markers
        
        Args:
            text: Question text with visual markers
            
        Returns:
            Extracted visual text or None
        """
        import re
        # Extract text from [GÖRSEL METNİ: ...] pattern
        pattern = r'\[GÖRSEL METNİ:\s*([^\]]+)\]'
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return None
    
    @staticmethod
    def enhance_visual_text(text: str) -> str:
        """
        Enhance visual text for better model understanding
        
        Args:
            text: Question text with visual markers
            
        Returns:
            Enhanced text
        """
        # Extract visual OCR text if exists
        visual_text = TextPreprocessor.extract_visual_text(text)
        
        if visual_text:
            # Add visual text to keywords for better classification
            # Format: "GÖRSEL İÇERİK: [extracted text] Soru metni"
            visual_prefix = f"GÖRSEL İÇERİK: {visual_text}"
            
            # Remove the [GÖRSEL METNİ: ...] marker and add enhanced version
            import re
            text = re.sub(r'\[GÖRSEL METNİ:[^\]]+\]\s*', '', text, flags=re.IGNORECASE)
            text = f"{visual_prefix} {text}"
        
        # Enhance visual markers
        visual_marker_replacements = {
            "[GRAFİK]": "GRAFİK GÖSTERİMİ",
            "[TABLO]": "TABLO GÖSTERİMİ",
            "[ŞEKİL]": "ŞEKİL GÖSTERİMİ",
            "[RESİM]": "RESİM GÖSTERİMİ",
            "[GÖRSEL]": "GÖRSEL İÇERİK",
        }
        
        for marker, replacement in visual_marker_replacements.items():
            text = text.replace(marker, replacement)
            text = text.replace(marker.lower(), replacement)
        
        return text
    
    @staticmethod
    def extract_question_context(text: str) -> Dict[str, str]:
        """
        Extract contextual information from question text
        
        Args:
            text: Question text
            
        Returns:
            Dictionary with extracted context information
        """
        context = {
            "question_number": None,
            "has_options": False,
            "question_type": "unknown",
            "keywords": [],
        }
        
        # Extract question number (e.g., "1-", "2.", "10-")
        question_num_match = re.search(r'^(\d+)[-\.]\s*', text)
        if question_num_match:
            context["question_number"] = question_num_match.group(1)
        
        # Check for options (A), B), C), D))
        has_options = bool(re.search(r'([ABCD])\)\s*', text))
        context["has_options"] = has_options
        
        # Check for visual content first
        if TextPreprocessor.detect_visual_markers(text):
            context["question_type"] = "görsel_okuma"
            context["keywords"].append("görsel okuma")
            visual_text = TextPreprocessor.extract_visual_text(text)
            if visual_text:
                context["keywords"].append("görsel metin")
        
        # Determine question type based on patterns
        text_lower = text.lower()
        
        if re.search(r'hangi\s+(söz\s+)?sanat', text_lower):
            context["question_type"] = "söz_sanatı"
            context["keywords"].append("söz sanatı")
        elif re.search(r'cümle\s+türü', text_lower):
            context["question_type"] = "cümle_türü"
            context["keywords"].append("cümle türü")
        elif re.search(r'fiilimsi', text_lower):
            context["question_type"] = "fiilimsi"
            context["keywords"].append("fiilimsi")
        elif re.search(r'noktalama', text_lower):
            context["question_type"] = "noktalama"
            context["keywords"].append("noktalama")
        elif re.search(r'fiil\s+çatı', text_lower):
            context["question_type"] = "fiil_çatısı"
            context["keywords"].append("fiil çatısı")
        elif re.search(r'yazım', text_lower):
            context["question_type"] = "yazım"
            context["keywords"].append("yazım")
        elif re.search(r'metin\s+türü', text_lower):
            context["question_type"] = "metin_türü"
            context["keywords"].append("metin türü")
        elif re.search(r'öge', text_lower):
            context["question_type"] = "öge"
            context["keywords"].append("öge")
        elif re.search(r'görsel|grafik|tablo|şekil', text_lower):
            if context["question_type"] != "görsel_okuma":
                context["question_type"] = "görsel_okuma"
                context["keywords"].append("görsel okuma")
        
        # Extract common question patterns
        if re.search(r'aşağıdakilerden\s+hangisi', text_lower):
            context["keywords"].append("aşağıdakilerden hangisi")
        if re.search(r'bu\s+bilgiye\s+göre', text_lower):
            context["keywords"].append("bilgiye göre")
        if re.search(r'numaralanmış', text_lower):
            context["keywords"].append("numaralanmış")
        
        return context
    
    @staticmethod
    def preprocess_with_context(text: str, use_context: bool = True) -> str:
        """
        Preprocess text with context-aware extraction
        
        Args:
            text: Raw input text
            use_context: Whether to use context extraction
            
        Returns:
            Preprocessed text optimized for classification
        """
        # Basic preprocessing first
        processed_text = TextPreprocessor.preprocess(text)
        
        if use_context:
            # Extract context
            context = TextPreprocessor.extract_question_context(text)
            
            # Enhance text with context keywords if question type is identified
            if context["question_type"] != "unknown" and context["keywords"]:
                # Add keywords at the beginning to help model focus
                keywords_str = " ".join(context["keywords"])
                # Only add if not already present
                if keywords_str.lower() not in processed_text.lower():
                    processed_text = f"{keywords_str} {processed_text}"
        
        return processed_text
    
    @staticmethod
    def extract_question_text_only(text: str) -> str:
        """
        Extract only the question text, removing question numbers and options
        
        Args:
            text: Full question text with number and options
            
        Returns:
            Clean question text
        """
        # Remove question number at the start
        text = re.sub(r'^\d+[-\.]\s*', '', text)
        
        # Remove options (A), B), C), D))
        text = re.sub(r'([ABCD])\)\s*[^\n]*', '', text)
        
        # Clean up extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
