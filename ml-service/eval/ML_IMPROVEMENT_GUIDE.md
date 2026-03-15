# ML Model İyileştirme Rehberi

Bu rehber, `priority_fix_plan_v2.md` içindeki aksiyonları uygulayarak model kalitesini artırmak için adım adım yol gösterir.

## Mevcut Durum

- **Top-1 doğruluk:** 0.8858
- **En kritik karışımlar:** Yazım Kuralları ↔ Noktalama İşaretleri, vb.

## İyileştirme Döngüsü

### 1. Karışım Raporunu Oluştur

```bash
cd /Users/erenusul/Desktop/EduAnalyzer
./ml-service/scripts/retrain_and_evaluate.sh
```

Rapor: `ml-service/eval/topic_confusions.json`

### 2. Örnek Temizliği (Manuel)

**Etiket doğrulama raporu oluşturma:**
```bash
./ml-service/venv/bin/python ml-service/scripts/export_label_review_report.py
```
Rapor: `ml-service/eval/label_review_report.md`

Her kritik çift için:
1. `label_review_report.md` veya `topic_confusions.json` içindeki yanlış örnekleri inceleyin
2. `question_dataset.json` ve `question_training_dataset.json` içinde ilgili örnekleri bulun
3. Etiket doğruluğunu kontrol edin; hatalı etiketleri düzeltin veya belirsiz örnekleri çıkarın

**Öncelikli çiftler:**
- Yazım Kuralları -> Noktalama İşaretleri (25 örnek)
- Noktalama İşaretleri -> Metin Türleri (21 örnek)
- Yazım Kuralları -> Sözcükte Anlam (16 örnek)

### 3. Yeniden Eğitim ve Değerlendirme

Veri temizliği sonrası:

```bash
./ml-service/scripts/retrain_and_evaluate.sh
```

### 4. Karşılaştırma

Yeni `topic_confusions.json` ile önceki raporu karşılaştırın. Karışım sayılarının düştüğünü doğrulayın.

## Örnek Çıkarma (Opsiyonel)

Belirli bir karışım çifti için örnekleri görmek için:

```bash
cd /Users/erenusul/Desktop/EduAnalyzer
HF_HUB_OFFLINE=1 ./ml-service/venv/bin/python ml-service/scripts/analyze_topic_model.py \
  --output ml-service/eval/topic_confusions.json \
  --top-k 5 \
  --limit-per-topic 10 \
  --min-count 1 \
  --examples-per-pair 20
```

## Notlar

- Her çift için en az 3 yanlış örneği el ile temizleyin
- Yazım Kuralları ve Noktalama İşaretleri benzer sorularda sık karıştığı için bu çift özellikle dikkat gerektirir
- Veri temizliği sonrası mutlaka `retrain_and_evaluate.sh` çalıştırın
