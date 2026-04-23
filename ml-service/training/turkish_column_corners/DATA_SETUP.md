# Veri hazırlama → etiket kontrolü → eğitim → warp doğrulama

`optical_scan.py` entegrasyonu yok. Bu dosya doğrudan uygulanabilir adımları içerir.

---

## 1) Veri klasör yapısı (nerede ne duracak)

Tüm ham veriyi **EduAnalyzer köküne** yakın tutmanız önerilir (git’e commit etmeyin):

```
EduAnalyzer/
  data/
    turkish_column_corners/
      images/                    # ham mobil fotoğraflar
      labels/                    # her görüntü için bir JSON (aynı kök adı)
      splits/                    # isteğe bağlı
        train.txt
        val.txt
```

### 5 örnek dosya adı ile dizin ağacı

```
data/turkish_column_corners/
├── images/
│   ├── scan_001.jpg
│   ├── scan_002.jpg
│   ├── scan_003.jpg
│   ├── scan_004.jpg
│   └── scan_005.jpg
├── labels/
│   ├── scan_001.json
│   ├── scan_002.json
│   ├── scan_003.json
│   ├── scan_004.json
│   └── scan_005.json
└── splits/
    ├── train.txt
    └── val.txt
```

**`train.txt` / `val.txt`:** Her satırda **uzantısız** kök ad, örn:

```
scan_001
scan_002
scan_003
```

Boş veya dosya yoksa: tüm `labels/*.json` kök adlarından otomatik `%85/%15` ayrım yapılır (`train_skeleton`).

### Annotation akışı (özet)

1. `images/scan_XXX.jpg` çekin veya kopyalayın.  
2. Aynı kök adla `labels/scan_XXX.json` oluşturun.  
3. İçerik şeması `annotations/example.json` ile aynı: `corners_pixel.order` = `["TL","TR","BR","BL"]`, `points` = dört `[x,y]` **orijinal piksel**.  
4. `verify_labels` ile QC görüntüsü üretin.  
5. Split dosyalarını doldurun (veya otomatik split kullanın).

---

## 2) Etiket kontrolü (görsel)

**Komut** (EduAnalyzer kökünden, `ml_service` import edilebilmeli):

```bash
cd /path/to/EduAnalyzer
./ml-service/.venv/bin/python -m ml_service.training.turkish_column_corners.verify_labels \
  --data-root data/turkish_column_corners \
  --out-dir ml-service/debug/turkish_column_corner_qc
```

**Çıktı:** `*_labels_qc.jpg` — yeşil çokgen + TL/TR/BR/BL renkli nokta ve etiket.

**Tek örnek:**

```bash
... verify_labels --data-root data/turkish_column_corners --stems scan_001
```

---

## 3) İlk eğitim denemesi

### Komut

```bash
cd /path/to/EduAnalyzer
./ml-service/.venv/bin/python -m ml_service.training.turkish_column_corners.train_skeleton \
  --data-root data/turkish_column_corners \
  --epochs 20 \
  --batch-size 4 \
  --lr 0.001 \
  --save ml-service/debug/corner_mvp.pt
```

### Veri yoksa ne olur?

- `labels/` yoksa veya eşleşen görüntü/etiket yoksa: script **mesaj yazıp çıkar**, model kaydetmez.

### Veri varken hangi metriklere bakılır?

- **`train_loss`:** Normalize uzayda L1 (8 köşe bileşeni). Düşmesi beklenir.  
- **`val_loss`:** Var ise genelleme; train çok düşük val yüksekse **aşırı uyum / veri azlığı**.

### Çok küçük veriyle hızlı overfit testi

1. `splits/train.txt` içine **tek satır** (örn. `scan_001`) koyun.  
2. `val.txt` boş bırakın veya aynı dosyayı train’de tutun (val boş kalır).  
3. `--epochs 80 --batch-size 1 --lr 0.003` gibi agresif ayar.  
4. **Beklenti:** Birkaç epoch içinde `train_loss` **0.01 altına** yaklaşmalı; yaklaşmıyorsa etiket/okuma hatası veya görüntü–JSON eşleşmesi şüpheli.

---

## 4) Warp doğrulama (OMR öncesi)

### A) Etiket köşeleriyle (eğitim öncesi — geometri + warp boru hattı)

```bash
./ml-service/.venv/bin/python -m ml_service.training.turkish_column_corners.verify_warp \
  --data-root data/turkish_column_corners \
  --source gt \
  --out-dir ml-service/debug/turkish_column_corner_qc
```

**Çıktı:** `*_gt_corners.jpg`, `*_gt_warp.jpg` — canonical boyut varsayılan **260×910** (`warp_helper.DEFAULT_CANONICAL_SIZE`).

### B) Eğitilmiş model ile

```bash
./ml-service/.venv/bin/python -m ml_service.training.turkish_column_corners.verify_warp \
  --data-root data/turkish_column_corners \
  --source model \
  --weights ml-service/debug/corner_mvp.pt \
  --out-dir ml-service/debug/turkish_column_corner_qc
```

**Çıktı:** `*_model_corners.jpg`, `*_model_warp.jpg`.

### Canonical boyutu değiştirmek

```bash
... verify_warp --source gt --canonical 280 950
```

---

## 5) Başarılı saymak için minimum kriterler

| Aşama | Minimum kriter |
|--------|----------------|
| **Etiket QC** | `*_labels_qc.jpg` üzerinde dört nokta gerçek sütun köşelerine oturuyor; sıra TL→TR→BR→BL saat yönünde tutarlı. |
| **GT warp** | `*_gt_warp.jpg` içinde sütun düzgün dikdörtgen, balonlar yatay hizalı görünüyor; aşırı kırpma/boşluk yok. |
| **Eğitim** | Küçik sette train_loss belirgin düşüyor; val varsa val_loss patlamıyor. |
| **Model warp** | GT’ye kıyasla köşe kayması küçük; warp’ta sütun dik ve okunaklı. |

Bunların hiçbiri sağlanmıyorsa **önce etiket ve canonical boyut**; sonra model ve veri çeşitliliği.

---

## Dosya referansı

| Dosya | Rol |
|-------|-----|
| `warp_helper.py` | `warp_column_to_canonical`, `draw_corners_labeled_overlay` |
| `verify_labels.py` | JSON köşe → overlay |
| `verify_warp.py` | GT veya model → overlay + warp |
| `train_skeleton.py` | `--data-root`, `--epochs`, `--save` |
| `annotations/example.json` | JSON şema örneği |
