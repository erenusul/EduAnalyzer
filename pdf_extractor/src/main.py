"""
Ana giriş noktası - PDF çıkarma pipeline'ı
"""
import argparse
from pathlib import Path
from .config import DEFAULT_PDF_PATH, DEFAULT_OUTPUT_JSON, DEFAULT_OUTPUT_CSV
from .parser import extract_text_from_pdf
from .cleaner import clean_text_items
from .exporter import export_to_json, export_to_csv


def main():
    """Komut satırından çalıştırılabilen ana fonksiyon"""
    parser = argparse.ArgumentParser(
        description="MEB 8. Sınıf Türkçe ders kitabından metin çıkarma aracı"
    )
    parser.add_argument(
        '--pdf',
        type=str,
        default=str(DEFAULT_PDF_PATH),
        help=f'PDF dosyası yolu (varsayılan: {DEFAULT_PDF_PATH})'
    )
    parser.add_argument(
        '--output-json',
        type=str,
        default=str(DEFAULT_OUTPUT_JSON),
        help=f'JSON çıktı dosyası yolu (varsayılan: {DEFAULT_OUTPUT_JSON})'
    )
    parser.add_argument(
        '--output-csv',
        type=str,
        default=str(DEFAULT_OUTPUT_CSV),
        help=f'CSV çıktı dosyası yolu (varsayılan: {DEFAULT_OUTPUT_CSV})'
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
    output_json = Path(args.output_json)
    output_csv = Path(args.output_csv)
    
    try:
        print(f"📖 PDF okunuyor: {pdf_path}")
        text_items = extract_text_from_pdf(pdf_path)
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
        
        print("\n✅ İşlem tamamlandı!")
        
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

