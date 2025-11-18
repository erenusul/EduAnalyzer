# PDF Extractor

MEB 8. Sınıf Türkçe ders kitabından metin çıkarma ve temizleme aracı.

## Kurulum

1. Python sanal ortamı oluşturun:
```bash
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

2. Bağımlılıkları yükleyin:
```bash
pip install -r requirements.txt
```

## Kullanım

### Temel Kullanım

Varsayılan PDF dosyasını (`data/raw/turkce_8_meb.pdf`) işlemek için:

```bash
python -m pdf_extractor.src.main
```

veya

```bash
cd pdf_extractor/src
python main.py
```

### Özel Dosya Yolları

```bash
python -m pdf_extractor.src.main --pdf /path/to/your.pdf --output-json data/processed/custom.json
```

### Sadece JSON veya CSV

```bash
# Sadece JSON
python -m pdf_extractor.src.main --json-only

# Sadece CSV
python -m pdf_extractor.src.main --csv-only
```

## Çıktı Formatı

Her metin birimi şu alanları içerir:
- `id`: Benzersiz ID (örn: "page_1")
- `page`: Sayfa numarası
- `raw_text`: Ham metin
- `clean_text`: Temizlenmiş metin
- `title`: Başlık (başlangıçta null)
- `theme`: Tema (başlangıçta null)
- `text_type`: Metin türü (başlangıçta null)
- `notes`: Notlar (başlangıçta null)

## Proje Yapısı

```
pdf_extractor/
├── src/
│   ├── __init__.py
│   ├── models.py      # Veri modelleri
│   ├── parser.py      # PDF okuma
│   ├── cleaner.py     # Metin temizleme
│   ├── exporter.py    # JSON/CSV export
│   ├── config.py      # Yapılandırma
│   └── main.py        # Ana giriş noktası
├── data/
│   ├── raw/           # Ham PDF dosyaları
│   └── processed/     # İşlenmiş JSON/CSV çıktıları
├── requirements.txt
└── README.md
```

