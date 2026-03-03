"""
Text preprocessing utilities for question classification.
"""
import re
from typing import Dict, List, Optional

from ml_service.config import ALL_TOPICS
from ml_service.data.turkish_nlp import TurkishNLP


class TextPreprocessor:
    """
    Text preprocessing class for cleaning and normalizing Turkish question texts.
    """

    def __init__(self, remove_stop_words: bool = False, stem_words: bool = False):
        self.remove_stop_words = remove_stop_words
        self.stem_words = stem_words
        self.turkish_nlp = TurkishNLP()

    @staticmethod
    def clean_text(text: str) -> str:
        if not text:
            return ""

        text = text.replace("\u00A0", " ")
        text = text.replace("\u200b", "")
        text = text.replace("\u200c", "")
        text = text.replace("\u200d", "")
        text = text.replace("\ufeff", "")
        text = text.replace("\u00ad", "")

        text = text.replace("“", '"').replace("”", '"').replace("‟", '"')
        text = text.replace("‘", "'").replace("’", "'")
        text = text.replace("–", "-").replace("—", "-")

        text = re.sub(r"\r\n|\r|\n", " ", text)
        text = re.sub(r"\s+", " ", text)
        text = re.sub(r"[^\w\s\.,;:!?()\[\]{}\"'\/\\-]", "", text)
        text = re.sub(r"([.,;:!?])\1+", r"\1", text)

        return text.strip()

    @staticmethod
    def normalize_text(text: str) -> str:
        if not text:
            return ""

        text = text.strip()
        text = re.sub(r"[\u200b-\u200f\u202a-\u202e]", "", text)
        text = re.sub(r"\r\n|\r|\n", " ", text)
        text = text.replace("\u00ad", "").replace("\ufeff", "")
        text = re.sub(r"\s+", " ", text).strip()
        return text

    @staticmethod
    def extract_question_text_only(text: str) -> str:
        if not text:
            return ""

        text = re.sub(r"^\s*\d+[\)\.\-]\s*", "", text)
        text = re.sub(r"(?mi)^\s*[A-Da-d]\s*[\)\.\-]\s*.*$", "", text)
        text = re.sub(r"\([A-Da-d]\)\s*[^.!?]*$", "", text)
        text = re.sub(r"\s+[A-Da-d]\)\s*[^\n]*", " ", text)
        text = re.sub(r"\b[ABCDabcd]\b\s*$", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    @staticmethod
    def preprocess_for_classification(text: str, use_context: bool = True) -> str:
        if not text:
            return ""

        source_text = text
        text = TextPreprocessor.extract_question_text_only(text)
        text = TextPreprocessor.preprocess(text)

        if not text.strip():
            text = TextPreprocessor.preprocess(source_text)

        if not use_context:
            return text

        context = TextPreprocessor.extract_question_context(text)
        if context["question_type"] != "unknown" and context["keywords"]:
            keywords = " ".join(context["keywords"])
            if keywords.lower() not in text.lower():
                text = f"{keywords} {text}"

        return text.strip()

    @staticmethod
    def preprocess(text: str, enhance_visuals: bool = True) -> str:
        if not text:
            return ""

        if enhance_visuals and TextPreprocessor.detect_visual_markers(text):
            text = TextPreprocessor.enhance_visual_text(text)

        text = TextPreprocessor.normalize_text(text)
        text = TextPreprocessor.clean_text(text)
        return text

    def preprocess_with_options(self, text: str) -> str:
        if not text:
            return ""

        text = TextPreprocessor.preprocess_for_classification(text)

        if self.remove_stop_words:
            text = self.turkish_nlp.remove_stop_words(
                text,
                keep_question_words=True,
            )

        if self.stem_words:
            words = text.split()
            stemmed_words = [self.turkish_nlp.simple_stem(word) for word in words]
            text = " ".join(stemmed_words)

        return text

    @staticmethod
    def truncate_text(text: str, max_length: int = 512) -> str:
        if len(text) <= max_length:
            return text
        return text[:max_length - 3] + "..."

    @staticmethod
    def batch_preprocess(texts: List[str]) -> List[str]:
        return [TextPreprocessor.preprocess_for_classification(text) for text in texts]

    @staticmethod
    def detect_visual_markers(text: str) -> bool:
        visual_markers = [
            "[GRAFİK]", "[TABLO]", "[ŞEKİL]", "[RESİM]", "[GÖRSEL]",
            "[GÖRSEL METNİ:", "[grafik]", "[tablo]", "[şekil]"
        ]
        return any(marker in text for marker in visual_markers)

    @staticmethod
    def extract_visual_text(text: str) -> Optional[str]:
        pattern = r"\[GÖRSEL METNİ:\s*([^\]]+)\]"
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return None

    @staticmethod
    def enhance_visual_text(text: str) -> str:
        visual_text = TextPreprocessor.extract_visual_text(text)

        if visual_text:
            visual_prefix = f"GÖRSEL İÇERİK: {visual_text}"
            text = re.sub(r"\[GÖRSEL METNİ:[^\]]+\]\s*", "", text, flags=re.IGNORECASE)
            text = f"{visual_prefix} {text}"

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
        context = {
            "question_number": None,
            "has_options": False,
            "question_type": "unknown",
            "keywords": [],
        }

        question_num_match = re.search(r"^(\d+)[-\.\)]\s*", text)
        if question_num_match:
            context["question_number"] = question_num_match.group(1)

        context["has_options"] = bool(re.search(r"([ABCD])\)\s*", text))

        if TextPreprocessor.detect_visual_markers(text):
            context["question_type"] = "görsel_okuma"
            context["keywords"].append("görsel okuma")
            visual_text = TextPreprocessor.extract_visual_text(text)
            if visual_text:
                context["keywords"].append("görsel metin")

        text_lower = text.lower()

        if re.search(r"hangi\s+(söz\s+)?sanat", text_lower):
            context["question_type"] = "söz_sanatı"
            context["keywords"].append("söz sanatı")
        elif re.search(r"cümle\s+türü", text_lower):
            context["question_type"] = "cümle_türü"
            context["keywords"].append("cümle türü")
        elif re.search(r"fiilimsi", text_lower):
            context["question_type"] = "fiilimsi"
            context["keywords"].append("fiilimsi")
        elif re.search(r"noktalama", text_lower):
            context["question_type"] = "noktalama"
            context["keywords"].append("noktalama")
        elif re.search(r"fiil\s+çatı", text_lower):
            context["question_type"] = "fiil_çatısı"
            context["keywords"].append("fiil çatısı")
        elif re.search(r"yazım", text_lower):
            context["question_type"] = "yazım"
            context["keywords"].append("yazım")
        elif re.search(r"metin\s+türü", text_lower):
            context["question_type"] = "metin_türü"
            context["keywords"].append("metin türü")
        elif re.search(r"öge", text_lower):
            context["question_type"] = "öge"
            context["keywords"].append("öge")
        elif re.search(r"görsel|grafik|tablo|şekil", text_lower):
            if context["question_type"] != "görsel_okuma":
                context["question_type"] = "görsel_okuma"
                context["keywords"].append("görsel okuma")

        if re.search(r"aşağıdakilerden\s+hangisi", text_lower):
            context["keywords"].append("aşağıdakilerden hangisi")
        if re.search(r"bu\s+bilgiye\s+göre", text_lower):
            context["keywords"].append("bilgiye göre")
        if re.search(r"numaralanmış", text_lower):
            context["keywords"].append("numaralanmış")

        return context

    @staticmethod
    def preprocess_with_context(text: str, use_context: bool = True) -> str:
        return TextPreprocessor.preprocess_for_classification(text, use_context=use_context)

    @staticmethod
    def normalize_for_keyword_matching(text: str) -> str:
        text = TextPreprocessor.normalize_text(text)
        text = TextPreprocessor.clean_text(text)
        text = text.lower()
        return TextPreprocessor.extract_question_text_only(text)

    @staticmethod
    def canonical_topics() -> List[str]:
        return ALL_TOPICS
