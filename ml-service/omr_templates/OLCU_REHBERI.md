# OMRChecker şablonu — ne ölçmelisiniz?

Referans JSON dosyaları **`optical_template_mm.py` ile aynı mm varsayılanlarından** türetildi; ölçek **4 piksel / 1 mm** (örnek: 212 mm genişlik → 848 px).

Görüntünüz farklı çözünürlükte veya `CropPage` sonrası boyut değiştiyse şablon **uymaz**; aşağıdaki ölçüleri kendi fotoğrafınızdan verin, piksel cinsinden güncelleriz.

## Her iki mod için ortak

1. **Sayfa / kırpıntı boyutu (piksel)**  
   Optik okumaya **girdiğiniz** görüntünün genişlik × yükseklik (ör. tam sayfa warp sonrası veya yalnızca TÜRKÇE sütunu kırpıntısı).  
   → `pageDimensions`: `[genişlik, yükseklik]`

2. **Bir daire kutusu (piksel)**  
   Tek bir şık dairesini içine alan kare (OMRChecker `bubbleDimensions`).  
   Cetvel / zoom ile yaklaşık **kenar uzunluğu** (px).  
   → `bubbleDimensions`: `[w, h]`

3. **1. soru — A şıkkının sol üst köşesi (piksel)**  
   OMRChecker’da `origin`, **yatay MCQ4** için **A balonunun sol üst köşesi** (x, y).  
   Eğer **merkez** ölçtüyseniz: `origin_x = merkez_x - w/2`, `origin_y = merkez_y - h/2`.

4. **A–D merkezleri arası (piksel)**  
   Aynı satırda komşu şık merkezleri arası yatay mesafe (A→B, B→C, C→D aynı ise tek değer).  
   → `bubblesGap` (OMRChecker’da balon **referans noktaları** arası mesafe; genelde merkezler arası mesafe ile aynı kabul edilir)

5. **1. soru A ile 2. soru A merkezleri arası dikey mesafe (piksel)**  
   → `labelsGap`

6. **(İsteğe bağlı) mm ile doğrulama**  
   Cetvelle PDF veya baskı üzerinde:  
   - A4 tam sayfa: sayfa **212 × 300 mm** mi?  
   - TÜRKÇE sütun kırpıntısı: **26 × 91 mm** kadraj (pembe çerçeve 26×85 ile `optical_template_mm` / env ile hizalayın)

## Bana şu formatta yazın (kopyala-doldur)

**Mod:** Tam sayfa A4 / Sadece TÜRKÇE sütunu  

**Görüntü:** genişlik = ? px, yükseklik = ? px  

**Daire kutusu:** kare kenar ≈ ? px  

**1. soru A:** merkez (x, y) = (?, ?) px **veya** sol üst (?, ?) px  

**A→B merkez mesafesi:** ? px  

**1. soru A merkezinden 2. soru A merkezine:** ? px (dikey)

İsterseniz ekran görüntüsü üzerinde bu noktaları işaretleyip ölçüleri yazmanız yeterli.

## Dosya eşlemesi

| Kullanım | Referans dosya |
|----------|----------------|
| Tam A4 (212×300 mm @ 4 px/mm) | `lgs_turkish_a4_20q_4pxmm.json` |
| Dar sütun (26×91 mm @ 4 px/mm) | `lgs_turkish_column_20q_4pxmm.json` |

Sunucu:

```bash
export OMR_CHECKER_TEMPLATE_JSON=/tam/yol/ml-service/omr_templates/lgs_turkish_a4_20q_4pxmm.json
```

API şablonu: `lgs_turkish_omrchecker`
