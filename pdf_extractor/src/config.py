"""
Yapılandırma sabitleri - dosya yolları ve varsayılan değerler
"""
from pathlib import Path

# Proje kök dizini
PROJECT_ROOT = Path(__file__).parent.parent

# Veri dizinleri
DATA_DIR = PROJECT_ROOT / "data"
RAW_PDF_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

# Varsayılan dosya yolları
DEFAULT_PDF_PATH = RAW_PDF_DIR / "turkce_8_meb.pdf"
DEFAULT_OUTPUT_JSON = PROCESSED_DIR / "turkce8_dataset.json"
DEFAULT_OUTPUT_CSV = PROCESSED_DIR / "turkce8_dataset.csv"

# Çıktı dizinlerini oluştur
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
RAW_PDF_DIR.mkdir(parents=True, exist_ok=True)

