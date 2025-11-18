# EduAnalyzer

MEB 8. Sınıf Türkçe ders kitabından metin çıkarma, temizleme ve görüntüleme projesi.

## Proje Yapısı

```
EduAnalyzer/
├── pdf_extractor/          # Backend - PDF işleme modülü
│   ├── src/
│   │   ├── models.py      # Veri modelleri
│   │   ├── parser.py       # PDF okuma
│   │   ├── cleaner.py      # Metin temizleme
│   │   ├── exporter.py     # JSON/CSV export
│   │   ├── config.py       # Yapılandırma
│   │   └── main.py         # Ana giriş noktası
│   ├── data/
│   │   ├── raw/            # Ham PDF dosyaları
│   │   └── processed/      # İşlenmiş JSON/CSV çıktıları
│   └── requirements.txt
│
└── viewer-app/             # Frontend - React + TypeScript
    ├── src/
    │   ├── components/     # UI bileşenleri
    │   ├── pages/          # Sayfalar
    │   ├── types/          # TypeScript tip tanımları
    │   ├── hooks/          # Custom React hooks
    │   └── utils/          # Yardımcı fonksiyonlar
    └── public/             # Statik dosyalar (JSON verisi buraya kopyalanır)
```

## Hızlı Başlangıç

### 1. PDF Çıkarma (Backend)

```bash
# PDF dosyasını doğru konuma kopyalayın
cp "Türkçe 8. Sınıf.pdf" pdf_extractor/data/raw/turkce_8_meb.pdf

# Sanal ortam oluşturun
cd pdf_extractor
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Bağımlılıkları yükleyin
pip install -r requirements.txt

# PDF'ten metin çıkarın
python -m src.main

# Çıktı: pdf_extractor/data/processed/turkce8_dataset.json
```

### 2. Veri Görüntüleme (Frontend)

```bash
# JSON dosyasını public klasörüne kopyalayın
cp pdf_extractor/data/processed/turkce8_dataset.json viewer-app/public/

# Bağımlılıkları yükleyin
cd viewer-app
npm install

# Geliştirme sunucusunu başlatın
npm run dev

# Tarayıcıda http://localhost:5173 adresini açın
```

## Özellikler

### Backend (pdf_extractor)
- ✅ PDF'ten sayfa sayfa metin çıkarma
- ✅ Metin temizleme (boşluklar, sayfa numaraları)
- ✅ JSON ve CSV export
- ✅ Komut satırı arayüzü

### Frontend (viewer-app)
- ✅ Veri filtreleme (tema, metin türü, sayfa aralığı, arama)
- ✅ Tablo görünümünde veri listeleme
- ✅ Metin detay görünümü
- ✅ Tema, metin türü ve notlar düzenleme
- ✅ JSON ve CSV export

## Veri Modeli

Her metin birimi şu alanları içerir:
- `id`: Benzersiz ID (örn: "page_1")
- `page`: Sayfa numarası
- `raw_text`: Ham metin
- `clean_text`: Temizlenmiş metin
- `title`: Başlık (düzenlenebilir)
- `theme`: Tema (düzenlenebilir)
- `text_type`: Metin türü (düzenlenebilir)
- `notes`: Notlar (düzenlenebilir)

## Geliştirme

Detaylı bilgi için her modülün kendi README dosyasına bakın:
- [pdf_extractor/README.md](pdf_extractor/README.md)
- [viewer-app/README.md](viewer-app/README.md)

