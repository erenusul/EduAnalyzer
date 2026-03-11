#!/usr/bin/env python3
"""
Veri seti doğrulama scripti.
JSON formatını, eksik alanları ve geçersiz değerleri kontrol eder.
Kullanım: python scripts/validate_dataset.py [dataset_path]
"""
import argparse
import json
import sys
from pathlib import Path

# Proje kökü için path
SCRIPT_DIR = Path(__file__).resolve().parent
ML_SERVICE_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = ML_SERVICE_ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT))

REQUIRED_FIELDS = ["question_text", "topic"]
OPTIONAL_FIELDS = ["question_id", "subject", "source"]


def validate_dataset(dataset_path: Path) -> bool:
    """Veri setini doğrula, hata/uyarı sayısını döndür."""
    if not dataset_path.exists():
        print(f"HATA: Dosya bulunamadı: {dataset_path}")
        return False

    with open(dataset_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"HATA: Geçersiz JSON: {e}")
            return False

    if not isinstance(data, dict):
        print("HATA: Kök eleman dict olmalı.")
        return False

    questions = data.get("questions", [])
    if not isinstance(questions, list):
        print("HATA: 'questions' alanı bir liste olmalı.")
        return False

    errors = 0
    warnings = 0

    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            print(f"  [{i}] HATA: Soru dict olmalı.")
            errors += 1
            continue

        for field in REQUIRED_FIELDS:
            val = q.get(field)
            if val is None or (isinstance(val, str) and not val.strip()):
                print(f"  [{i}] HATA: Eksik veya boş alan: {field}")
                errors += 1

        question_text = q.get("question_text", "")
        if question_text and len(question_text.strip()) < 10:
            print(f"  [{i}] UYARI: question_text çok kısa ({len(question_text)} karakter)")
            warnings += 1

    print(f"\nÖzet: {len(questions)} soru, {errors} hata, {warnings} uyarı")
    return errors == 0


def main():
    parser = argparse.ArgumentParser(description="Veri seti doğrulama")
    parser.add_argument(
        "dataset_path",
        nargs="?",
        default=PROJECT_ROOT / "pdf_extractor" / "data" / "processed" / "question_dataset.json",
        type=Path,
        help="Veri seti JSON dosya yolu",
    )
    args = parser.parse_args()

    print(f"Doğrulanıyor: {args.dataset_path}")
    ok = validate_dataset(args.dataset_path)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
