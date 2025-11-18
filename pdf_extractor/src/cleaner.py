"""
Metin temizleme fonksiyonları
"""
import re
from typing import List
from .models import TextItem


def clean_text(text: str) -> str:
    """
    Metni temizler:
    - Fazla boşlukları kaldırır
    - Sayfa numaralarını temizler (basit pattern)
    - Satır sonlarını normalize eder
    
    Args:
        text: Ham metin
    
    Returns:
        Temizlenmiş metin
    """
    if not text:
        return ""
    
    # Çoklu boşlukları tek boşluğa çevir
    text = re.sub(r'\s+', ' ', text)
    
    # Satır başı/sonu karakterlerini normalize et
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Çoklu satır sonlarını tek satır sonuna çevir (max 2)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Başlangıç ve bitiş boşluklarını temizle
    text = text.strip()
    
    return text


def remove_page_numbers(text: str, page_num: int) -> str:
    """
    Sayfa numaralarını ve altbilgileri temizler (basit pattern).
    İleride daha gelişmiş pattern matching eklenebilir.
    
    Args:
        text: Metin
        page_num: Sayfa numarası
    
    Returns:
        Sayfa numarası temizlenmiş metin
    """
    # Sayfa numarasını kaldır (örnek: "8" veya "Sayfa 8" gibi)
    patterns = [
        rf'\b{page_num}\b',  # Tek başına sayfa numarası
        rf'Sayfa\s*{page_num}',
        rf'Page\s*{page_num}',
    ]
    
    for pattern in patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    
    return text.strip()


def clean_text_items(text_items: List[TextItem]) -> List[TextItem]:
    """
    TextItem listesindeki tüm metinleri temizler.
    
    Args:
        text_items: Temizlenmemiş TextItem listesi
    
    Returns:
        Temizlenmiş TextItem listesi
    """
    cleaned_items = []
    
    for item in text_items:
        # Önce sayfa numarasını temizle
        cleaned_raw = remove_page_numbers(item.raw_text, item.page)
        
        # Sonra genel temizleme yap
        cleaned_text = clean_text(cleaned_raw)
        
        # Yeni TextItem oluştur
        cleaned_item = TextItem(
            id=item.id,
            page=item.page,
            raw_text=item.raw_text,
            clean_text=cleaned_text,
            title=item.title,
            theme=item.theme,
            text_type=item.text_type,
            notes=item.notes
        )
        cleaned_items.append(cleaned_item)
    
    return cleaned_items

