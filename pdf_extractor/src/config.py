"""
Yapılandırma sabitleri - dosya yolları ve varsayılan değerler
"""
from pathlib import Path
import re

# Proje kök dizini
PROJECT_ROOT = Path(__file__).parent.parent

# Veri dizinleri
DATA_DIR = PROJECT_ROOT / "data"
RAW_PDF_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

# Ders listesi
SUBJECTS = {
    "turkce": "Türkçe",
    "matematik": "Matematik",
    "fen": "Fen Bilimleri",
    "inkilap": "T.C. İnkılap Tarihi ve Atatürkçülük",
    "din": "Din Kültürü ve Ahlak Bilgisi",
    "ingilizce": "İngilizce"
}

# PDF dosya adından ders adını çıkarma mapping
PDF_TO_SUBJECT_MAP = {
    "türkçe": "turkce",
    "matematik": "matematik",
    "fen bilimleri": "fen",
    "fen": "fen",
    "inkılap": "inkilap",
    "inkilap": "inkilap",
    "t.c": "inkilap",
    "din kültürü": "din",
    "din": "din",
    "ingilizce": "ingilizce",
    "english": "ingilizce"
}

def get_subject_from_filename(filename: str) -> str:
    """
    PDF dosya adından ders kodunu çıkarır.
    
    Args:
        filename: PDF dosya adı
    
    Returns:
        Ders kodu (turkce, matematik, vb.)
    """
    filename_lower = filename.lower()
    
    # Türkçe karakterleri normalize et
    filename_lower = filename_lower.replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c")
    
    for key, subject_code in PDF_TO_SUBJECT_MAP.items():
        if key in filename_lower:
            return subject_code
    
    # Varsayılan olarak turkce döndür
    return "turkce"

def get_output_filename(subject_code: str) -> str:
    """
    Ders kodundan çıktı dosya adını oluşturur.
    
    Args:
        subject_code: Ders kodu (turkce, matematik, vb.)
    
    Returns:
        Çıktı dosya adı (turkce_8_dataset.json)
    """
    return f"{subject_code}_8_dataset"

# Varsayılan dosya yolları
DEFAULT_PDF_PATH = RAW_PDF_DIR / "turkce_8_meb.pdf"
DEFAULT_OUTPUT_JSON = PROCESSED_DIR / "turkce_8_dataset.json"
DEFAULT_OUTPUT_CSV = PROCESSED_DIR / "turkce_8_dataset.csv"

# Çıktı dizinlerini oluştur
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
RAW_PDF_DIR.mkdir(parents=True, exist_ok=True)

