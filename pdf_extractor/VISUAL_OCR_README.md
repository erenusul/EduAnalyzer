# Görsel ve OCR Desteği

Bu modül, PDF'lerdeki görsel içerikli soruları tespit eder ve OCR ile görsel metinlerini çıkarır.

## Özellikler

### 1. Görsel Tespiti (Hızlı Çözüm)
- Görsel içeren soruları otomatik tespit eder
- Görsel tipini belirler (grafik, tablo, şekil, resim)
- Soru metnine görsel açıklaması ekler: `[GRAFİK]`, `[TABLO]`, vb.

**Kullanım:**
```python
from pdf_extractor.src.visual_detector import VisualDetector

detector = VisualDetector()
enhanced_text, visual_info = detector.enhance_question_text(question_text)
```

### 2. OCR Desteği (Tam Çözüm)
- PDF'teki görsellerden metin çıkarır
- EasyOCR kullanarak Türkçe ve İngilizce metinleri tanır
- Görsel metinlerini soru metnine ekler

**Kurulum:**
```bash
pip install easyocr
```

**Kullanım:**
```bash
# OCR ile dataset oluştur
USE_OCR=true python -m pdf_extractor.src.create_question_dataset
```

## Beklenen İyileştirmeler

- **Görsel Tespiti**: %3-5 doğruluk artışı
- **OCR Desteği**: %5-10 doğruluk artışı (görsel içeren sorularda)
- **Toplam**: Görsel içeren sorularda %8-15 doğruluk artışı

## Model Eğitimi

Görsel açıklamalarıyla eğitilmiş model:
- Görsel içeren soruları daha iyi anlar
- "Görsel Okuma ve Grafik Tablo" konusunda daha yüksek doğruluk
- Yeni nesil soruları daha iyi sınıflandırır

## Test

```bash
python pdf_extractor/test_visual_detection.py
```
