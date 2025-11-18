"""
Veri modelleri - TextItem dataclass tanımları
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TextItem:
    """PDF'ten çıkarılan her bir metin birimi için veri modeli"""
    id: str
    page: int
    raw_text: str
    clean_text: str
    title: Optional[str] = None
    theme: Optional[str] = None
    text_type: Optional[str] = None
    notes: Optional[str] = None

    def to_dict(self) -> dict:
        """Dict'e dönüştür (JSON export için)"""
        return {
            "id": self.id,
            "page": self.page,
            "raw_text": self.raw_text,
            "clean_text": self.clean_text,
            "title": self.title,
            "theme": self.theme,
            "text_type": self.text_type,
            "notes": self.notes
        }

