"""
PDF okuma ve metin çıkarma modülü
"""
import fitz  # PyMuPDF
from pathlib import Path
from typing import List
from .models import TextItem
from .config import DEFAULT_PDF_PATH, get_subject_from_filename, SUBJECTS


def extract_text_from_pdf(pdf_path: Path = None, subject: str = None) -> List[TextItem]:
    """
    PDF dosyasından sayfa sayfa metin çıkarır.
    
    Args:
        pdf_path: PDF dosyasının yolu. None ise varsayılan yol kullanılır.
        subject: Ders kodu (turkce, matematik, vb.). None ise dosya adından çıkarılır.
    
    Returns:
        TextItem listesi (her sayfa için bir TextItem)
    """
    if pdf_path is None:
        pdf_path = DEFAULT_PDF_PATH
    
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF dosyası bulunamadı: {pdf_path}")
    
    # Ders kodunu belirle
    if subject is None:
        subject = get_subject_from_filename(pdf_path.name)
    
    # Ders adını al
    subject_name = SUBJECTS.get(subject, "Türkçe")
    
    text_items = []
    
    try:
        doc = fitz.open(pdf_path)
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            raw_text = page.get_text()
            
            # Her sayfa için bir TextItem oluştur
            text_item = TextItem(
                id=f"{subject}_page_{page_num + 1}",
                page=page_num + 1,
                raw_text=raw_text,
                clean_text=raw_text  # Temizleme işlemi cleaner.py'de yapılacak
            )
            text_items.append(text_item)
        
        doc.close()
        
    except Exception as e:
        raise Exception(f"PDF okuma hatası: {str(e)}")
    
    return text_items

