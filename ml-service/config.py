"""
Configuration settings for ML service
Model paths, hyperparameters, and subject-topic mappings
"""
import os
from pathlib import Path
from typing import Dict, List

# Project root directory
PROJECT_ROOT = Path(__file__).parent.parent
ML_SERVICE_ROOT = Path(__file__).parent

# Data paths
DATA_DIR = PROJECT_ROOT / "pdf_extractor" / "data" / "processed"
QUESTION_DATASET_PATH = DATA_DIR / "question_dataset.json"
QUESTION_TRAINING_DATASET_PATH = DATA_DIR / "question_training_dataset.json"

# Model paths
MODELS_DIR = ML_SERVICE_ROOT / "models"
CHECKPOINTS_DIR = MODELS_DIR / "checkpoints"
CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)

# BERTurk model configuration
BERT_MODEL_NAME = "dbmdz/bert-base-turkish-cased"
MAX_SEQUENCE_LENGTH = 512

# Training hyperparameters
TRAINING_CONFIG = {
    "learning_rate": 2e-5,  # Optimal for BERTurk fine-tuning
    "batch_size": 16,  # Increased for better gradient estimates
    "epochs": 15,  # Increased for better convergence
    "warmup_steps": 100,  # Increased warmup steps
    "weight_decay": 0.01,
    "train_split": 0.7,
    "val_split": 0.15,
    "test_split": 0.15,
    "seed": 42,
    "early_stopping_patience": 5,  # Increased patience for better convergence
    "early_stopping_min_delta": 0.0001,  # Smaller delta for more sensitive stopping
}

# Subject codes and names
SUBJECTS: Dict[str, str] = {
    "turkce": "Türkçe",
    "matematik": "Matematik",
    "fen": "Fen Bilimleri",
    "inkilap": "T.C. İnkılap Tarihi ve Atatürkçülük",
    "din": "Din Kültürü ve Ahlak Bilgisi",
    "ingilizce": "İngilizce",
}

# Subject to topics mapping
# Note: Currently only Turkish topics are available in the dataset
# Other subjects will be added as data becomes available
SUBJECT_TOPICS: Dict[str, List[str]] = {
    "turkce": [
        "Cümle Türleri",
        "Fiilimsiler",
        "Noktalama İşaretleri",
        "Fiil Çatıları",
        "Yazım Kuralları",
        "Metin Türleri",
        "Söz Sanatları",
        "Öge",
        "Görsel Okuma ve Grafik Tablo",
        "Cümlede Anlam",
        "Cümlede Vurgu",
        "Deyimler ve Atasözleri",
        "Geçiş ve Bağlantı İfadeleri",
        "Metinde Anlam",
        "Sözcükler Arası Anlam İlişkileri",
        "Sözcükte Anlam",
        "Sözel Mantık",
        "Yapısal Anlatım Bozuklukları",
    ],
    "matematik": [
        "Tam Sayılar",
        "Rasyonel Sayılar",
        "Üslü İfadeler",
        "Kareköklü İfadeler",
        "Cebirsel İfadeler",
        "Denklemler",
        "Eşitsizlikler",
        "Üçgenler",
        "Dönüşüm Geometrisi",
        "Geometrik Cisimler",
        "Veri Analizi",
        "Olasılık",
    ],
    "fen": [
        "Kuvvet ve Hareket",
        "Enerji",
        "Madde ve Doğası",
        "Kimyasal Tepkimeler",
        "Canlılar ve Hayat",
        "Hücre Bölünmesi ve Kalıtım",
        "Ekosistem",
        "Dünya ve Evren",
    ],
    "inkilap": [
        "Osmanlı Devleti'nin Son Dönemi",
        "I. Dünya Savaşı",
        "Mondros Ateşkes Antlaşması",
        "Kurtuluş Savaşı",
        "Cumhuriyetin İlanı",
        "Atatürk'ün Hayatı",
        "İnkılaplar",
        "Dış Politika",
    ],
    "din": [
        "İman Esasları",
        "Namaz",
        "Oruç",
        "Zekat",
        "Hac",
        "Hz. Muhammed'in Hayatı",
        "Kuran'dan Ayetler",
        "Hadisler",
        "Ahlaki Değerler",
    ],
    "ingilizce": [
        "Tenses",
        "Modal Verbs",
        "Conditionals",
        "Passive Voice",
        "Reported Speech",
        "Relative Clauses",
        "Phrasal Verbs",
        "Word Formation",
    ],
}

# Topic to subject mapping (reverse lookup)
TOPIC_TO_SUBJECT: Dict[str, str] = {}
for subject, topics in SUBJECT_TOPICS.items():
    for topic in topics:
        TOPIC_TO_SUBJECT[topic] = subject

# All unique topics across all subjects
ALL_TOPICS: List[str] = []
for topics in SUBJECT_TOPICS.values():
    ALL_TOPICS.extend(topics)
ALL_TOPICS = sorted(list(set(ALL_TOPICS)))

# Model file names
SUBJECT_MODEL_NAME = "subject_classifier.pt"
TOPIC_MODEL_NAME = "topic_classifier.pt"
COMBINED_MODEL_NAME = "combined_classifier.pt"

# Environment variables
USE_GPU = os.getenv("USE_GPU", "false").lower() == "true"
DEVICE = "cuda" if USE_GPU else "cpu"
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Model serving configuration
MODEL_LOAD_ON_STARTUP = os.getenv("MODEL_LOAD_ON_STARTUP", "false").lower() == "true"
MODEL_CACHE_SIZE = int(os.getenv("MODEL_CACHE_SIZE", "10"))





