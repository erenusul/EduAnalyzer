# OMRChecker şablonları (EduAnalyzer)

[`OMRChecker`](https://github.com/Udayraj123/OMRChecker) `ml-service/third_party/OMRChecker` altında vendored. Optik API şablonu: `lgs_turkish_omrchecker`.

## Kurulum

```bash
cd ml-service
pip install -r requirements-omrchecker.txt
```

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|-----------|
| `OMR_CHECKER_TEMPLATE_JSON` | OMRChecker `template.json` dosyasının **mutlak yolu** (zorunlu; yoksa dahili `lgs_turkish_212x300` okuyucu kullanılır). |
| `OMR_CHECKER_DISABLED` | `1` ise OMRChecker hiç denenmez. |

## Hazır referans şablonlar (4 px/mm)

EduAnalyzer’daki mm varsayılanlarından türetildi; **görüntünüz bu ölçekte değilse** `OLCU_REHBERI.md` içindeki ölçüleri gönderin.

| Dosya | Açıklama |
|--------|-----------|
| `lgs_turkish_a4_20q_4pxmm.json` | 212×300 mm A4, Türkçe 20×4, `q1..20` |
| `lgs_turkish_column_20q_4pxmm.json` | 26×91 mm kadraj (4 px/mm), TÜRKÇE sütun `q1..20` |
| `lgs_turkish_user_measured_993x1319.json` | Kullanıcı mm + 993×1319 px ölçümü (bkz. `KULLANICI_OLCU_993x1319.md`) |

Örnek ortam (tam yolu kendi makinenize göre düzeltin):

```bash
export OMR_CHECKER_TEMPLATE_JSON=/Users/.../EduAnalyzer/ml-service/omr_templates/lgs_turkish_a4_20q_4pxmm.json
```

## Şablon üretme / ince ayar

1. Ölçü listesi: **`OLCU_REHBERI.md`** (hangi piksel değerlerini vermeniz gerektiği).
2. OMRChecker örnekleri: `third_party/OMRChecker/samples/`.
3. İnteraktif hizalama: `python main.py --setLayout` (OMRChecker wiki).
4. CSV’de soru sütunları `q1`, `q2`, … olmalı (`fieldLabels`: `q1..20`).

## Lisans

OMRChecker MIT lisanslıdır; kaynak: https://github.com/Udayraj123/OMRChecker
