#!/usr/bin/env python3
"""
PDF'den metin çıkarma test scripti.
Kullanım: python test-pdf-extract.py "dosya_yolu.pdf"
Çıkarılan metnin ilk 3000 karakterini ve soru sayısını gösterir.
"""
import sys
from pathlib import Path

# Proje kökünü path'e ekle
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

def main():
    if len(sys.argv) < 2:
        print("Kullanım: python test-pdf-extract.py <PDF_dosyası>")
        print("Örnek: python test-pdf-extract.py '8. Sınıf Türkçe Yaprak Test_Ornek.pdf'")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"Hata: Dosya bulunamadı: {pdf_path}")
        sys.exit(1)

    try:
        from pdf_extractor.src.question_parser import extract_questions_from_pdf
    except ImportError:
        sys.path.insert(0, str(ROOT / "pdf_extractor" / "src"))
        import question_parser
        extract_questions_from_pdf = question_parser.extract_questions_from_pdf

    print(f"PDF: {pdf_path.name}")
    print("=" * 60)

    # Ham metin çıkar (PyMuPDF ile)
    import fitz
    doc = fitz.open(pdf_path)
    all_text = ""
    for i in range(min(3, len(doc))):  # İlk 3 sayfa
        all_text += doc[i].get_text() + "\n\n"
    doc.close()

    print(f"İlk 3 sayfadan çıkarılan metin ({len(all_text)} karakter):")
    print("-" * 60)
    print(all_text[:3000] or "(Boş - PDF taranmış olabilir, OCR gerekli)")
    print("-" * 60)

    # Soru çıkarma dene
    print("\nSoru çıkarma testi...")
    try:
        questions = extract_questions_from_pdf(pdf_path, use_ocr=False)
        print(f"✓ {len(questions)} soru bulundu")
        if questions:
            print("\nİlk soru örneği:")
            q = questions[0]
            print(f"  Metin: {q.question_text[:200]}...")
            print(f"  Seçenek sayısı: {len(q.options)}")
    except Exception as e:
        print(f"✗ Hata: {e}")

if __name__ == "__main__":
    main()
