"""
Ana giriş noktası - PDF çıkarma pipeline'ı
"""
import argparse
from pathlib import Path
from .config import DEFAULT_PDF_PATH, DEFAULT_OUTPUT_JSON, DEFAULT_OUTPUT_CSV, get_subject_from_filename, get_output_filename, PROCESSED_DIR
from .parser import extract_text_from_pdf
from .cleaner import clean_text_items
from .exporter import export_to_json, export_to_csv


def main():
    """Komut satırından çalıştırılabilen ana fonksiyon"""
    parser = argparse.ArgumentParser(
        description="MEB 8. Sınıf ders kitaplarından metin çıkarma aracı"
    )
    parser.add_argument(
        '--pdf',
        type=str,
        default=str(DEFAULT_PDF_PATH),
        help=f'PDF dosyası yolu (varsayılan: {DEFAULT_PDF_PATH})'
    )
    parser.add_argument(
        '--subject',
        type=str,
        default=None,
        help='Ders kodu (turkce, matematik, fen, inkilap, din, ingilizce). Belirtilmezse dosya adından çıkarılır.'
    )
    parser.add_argument(
        '--output-json',
        type=str,
        default=None,
        help='JSON çıktı dosyası yolu. Belirtilmezse otomatik oluşturulur.'
    )
    parser.add_argument(
        '--output-csv',
        type=str,
        default=None,
        help='CSV çıktı dosyası yolu. Belirtilmezse otomatik oluşturulur.'
    )
    parser.add_argument(
        '--json-only',
        action='store_true',
        help='Sadece JSON çıktısı oluştur'
    )
    parser.add_argument(
        '--csv-only',
        action='store_true',
        help='Sadece CSV çıktısı oluştur'
    )
    
    args = parser.parse_args()
    
    pdf_path = Path(args.pdf)
    
    # Ders kodunu belirle
    subject = args.subject
    if subject is None:
        subject = get_subject_from_filename(pdf_path.name)
    
    # Çıktı dosya yollarını belirle
    if args.output_json:
        output_json = Path(args.output_json)
    else:
        output_filename = get_output_filename(subject)
        output_json = PROCESSED_DIR / f"{output_filename}.json"
    
    if args.output_csv:
        output_csv = Path(args.output_csv)
    else:
        output_filename = get_output_filename(subject)
        output_csv = PROCESSED_DIR / f"{output_filename}.csv"
    
    try:
        print(f"📖 PDF okunuyor: {pdf_path}")
        print(f"📚 Ders: {subject}")
        text_items = extract_text_from_pdf(pdf_path, subject)
        print(f"✓ {len(text_items)} sayfa okundu")
        
        print("🧹 Metinler temizleniyor...")
        cleaned_items = clean_text_items(text_items)
        print(f"✓ {len(cleaned_items)} metin birimi temizlendi")
        
        # JSON export
        if not args.csv_only:
            export_to_json(cleaned_items, output_json)
        
        # CSV export
        if not args.json_only:
            export_to_csv(cleaned_items, output_csv)
        
        print(f"\n✅ İşlem tamamlandı! Çıktı: {output_json.name}")
        
    except FileNotFoundError as e:
        print(f"❌ Hata: {e}")
        return 1
    except Exception as e:
        print(f"❌ Beklenmeyen hata: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())

