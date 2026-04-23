# Türkçe sütun — 4 köşe tahmini (MVP iskeleti)

**Uygulanabilir veri → QC → eğitim → warp adımları:** [DATA_SETUP.md](./DATA_SETUP.md)

Dar `lgs_turkish_column_crop` için perspektif düzeltmeden önce **4 köşe regresyonu** prototipi.  
**Not:** `optical_scan.py` entegrasyonu bu aşamada yok; önce veri + eğitim + inference sözleşmesi.

## 1) Veri klasör yapısı (öneri)

Repoda ham görüntüleri commit etmeyin; yerel veya `data/turkish_column_corners/` altında tutun:

```
data/turkish_column_corners/
  images/              # *.jpg / *.png — ham mobil kareler
  labels/              # images ile aynı kök ada (*.json)
  splits/
    train.txt          # her satır: dosya kök adı (uzantısız), örn: img_001
    val.txt
```

Örnek:

```
data/turkish_column_corners/images/img_001.jpg
data/turkish_column_corners/labels/img_001.json
data/turkish_column_corners/splits/train.txt   → içinde: img_001
```

## 2) Köşe sırası (zorunlu)

Görüntü koordinatında piksel `(x, y)`; `x` sağa, `y` aşağı.

| Sıra | Kod | Anlamı |
|------|-----|--------|
| 0 | **TL** | Sol üst — Türkçe sütun dörtgeninin sol-üst köşesi |
| 1 | **TR** | Sağ üst |
| 2 | **BR** | Sağ alt |
| 3 | **BL** | Sol alt |

Perspektif warp hedef dikdörtgenine giderken aynı sıra hedef köşelerle eşleştirilir.

## 3) Annotation JSON şeması

`labels/<stem>.json`:

```json
{
  "schema_version": 1,
  "image_file": "img_001.jpg",
  "image_size": { "width": 1200, "height": 1600 },
  "corners_pixel": {
    "order": ["TL", "TR", "BR", "BL"],
    "points": [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]
  }
}
```

- `points` sırası **mutlaka** TL, TR, BR, BL.
- Koordinatlar **orijinal piksel** uzayında (resize öncesi).

Örnek dosya: `annotations/example.json`.

## 4) Normalize koordinat

Model girişi `input_w × input_h` (ör. 256×256) olunca köşeler de ölçeklenir:

`xn = x_pixel / orig_w`, `yn = y_pixel / orig_h` → **[0, 1]** (kenar taşması clamp ile kırpılabilir).

Çıktı: 8 skaler `[TLx, TLy, TRx, TRy, BRx, BRy, BLx, BLy]` ∈ ℝ⁸, pratikte **sigmoid** ile [0,1] (bkz. `model.py`).

## 5) Bu paketin dosyaları

| Dosya | Rol |
|-------|-----|
| `dataset.py` | JSON + görüntü okuma, split, tensör |
| `transforms.py` | Resize, augment (iskelet), köşe ölçekleme |
| `model.py` | Küçük CNN + 8 çıkış |
| `metrics.py` | Loss (L1/L2), val metrikleri |
| `inference.py` | Görüntü → 4 köşe (piksel); warp ile bağlantı dokümantasyonu |
| `train_skeleton.py` | Eğitim döngüsü iskeleti (tam çalıştırma sonraki adım) |

## 6) ml-service ile ilişki (ileride)

- **Eğitim:** `training/turkish_column_corners/` (bu klasör).
- **Runtime (sonra):** `ml_service/alignment/turkish_column_corner_inference.py` gibi ince bir sarmalayıcı bu modüldeki `predict` mantığını tekrar kullanabilir; şimdilik **kopya/refactor yok**.

## 7) Şimdilik kasıtlı olarak eksik

- ONNX export, `optical_scan` çağrısı, env bayrakları.
- Gerçek eğitim verisi repo içinde yok.

## 8) Kodlama stratejisi (dosya haritası)

| Konum | Açıklama |
|-------|----------|
| `training/turkish_column_corners/README.md` | Veri formatı + bu tablo |
| `training/turkish_column_corners/annotations/example.json` | Örnek etiket |
| `training/turkish_column_corners/dataset.py` | Loader + split |
| `training/turkish_column_corners/transforms.py` | Köşe dönüşümleri, hafif augment |
| `training/turkish_column_corners/model.py` | `TinyCornerCNN` + `build_model` |
| `training/turkish_column_corners/metrics.py` | L1 loss, metrik iskeleti |
| `training/turkish_column_corners/inference.py` | `TurkishColumnCornerInference`, warp ile bağlantı notu |
| `training/turkish_column_corners/train_skeleton.py` | Eğitim döngüsü iskeleti |

**Eğitim tarafı:** `training/turkish_column_corners/*` (bu klasör).  
**ml-service API:** Şimdilik **dokunulmadı**; ileride ince bir `ml_service/alignment/...` sarmalayıcı veya doğrudan `inference` import edilebilir.  
**Veri:** Tercihen `EduAnalyzer/data/turkish_column_corners/` (git’e ham görüntü koymayın; `train_skeleton` varsayılan kökü bu).

## 9) Çalıştırma

EduAnalyzer kökünden (Python path `ml_service` paketini görür):

```bash
python -m ml_service.training.turkish_column_corners.train_skeleton
```

Önkoşul: `torch` kurulu sanal ortam (`ml-service/requirements.txt`).
