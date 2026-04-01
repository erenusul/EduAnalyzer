# Ölçüden üretilen şablon: `lgs_turkish_user_measured_993x1319.json`

## Verdiğiniz değerler

| Öğe | Değer |
|-----|--------|
| Mod | Tam sayfa |
| Görüntü | 993 × 1319 px |
| Daire çapı (kağıt) | 3 mm |
| A–B merkez (kağıt) | 4.5 mm |
| 1A–2A merkez (kağıt) | 4.5 mm |
| Pembe iç sol → 1A merkez | 17.5 mm |
| **Sayfa en üstünden** → 1A merkez | **171 mm** |
| **Sayfa en üstünden** → 20A merkez | **254 mm** |
| **Görüntü en üstünden** → 1A merkez (piksel) | **650 px** (ölçülen) |
| A–B merkez (ekran) | 44 px |

## Ölçek

`k = 44 / 4.5 ≈ 9.778` px/mm.

- `bubbleDimensions`: **29** px (3 mm × k)
- `bubblesGap`: **44** px (A–B merkez aralığı, yatay)
- `labelsGap`: **42.71** px (satır merkezleri aralığı; aşağıdaki mm ölçüsünden)
- Yatay: pembe iç sol → 1A: 17.5 × k ≈ **171 px** (merkez x); `origin[0]` ≈ **157** (merkez − yarım kutu)

## Görüntüde dikey konum (piksel)

Bilgisayarda ölçülen: görüntü **en üstünden** 1. soru **A merkezine** **650 px**.

OMRChecker `origin` = A kutusunun **sol üst köşesi**; kutu **29×29** px → merkezden sol üste **14,5 px**:

- `origin_y = 650 − 14,5 ≈ 635` → JSON’da **origin** = **[157, 635]**

Farklı bir çekimde sadece **y**’yi yeniden ölçüp `origin_y = cy − 14.5` uygulayın.

### Satır aralığı (20A mm ölçüsü)

1A ile 20A merkezleri kağıtta **sayfa üstüne** göre **171 mm** ve **254 mm** → aradaki fark **83 mm**, **19** satır aralığı:

- Kağıt: `83 / 19 ≈ 4.37` mm (satır merkezi → sonraki satır merkezi)
- Piksel: `(83 / 19) × (44 / 4.5) ≈ **42.71**` → JSON’da `labelsGap`: **42.71**

Görüntüde 20A merkezinin **y**’si (1A merkezi 650 px ise): `650 + 83 × (44 / 4.5) ≈ **1462**` px. Görüntü yüksekliği **1319** ise bu, kadrajın tüm optik alanı göstermediğini veya dikey ölçeğin yataydan farklı olduğunu düşündürür; okuma sapması olursa **20A merkezinin piksel y** değerini ölçüp `labelsGap = (y₂₀ − y₁) / 19` ile doğrulayın.

Kağıt üstü–kırpma için mm tarafı: 1A merkezi kağıtta sayfa üstünden **171 mm**; üst kırpma varsa `cy ≈ (171 − t₀) × (44 / 4.5)` ile teorik piksel de bulunabilir (`t₀` = kağıt üstünden görüntü üstüne mm).

## Pembe / sayfa hizası (yatay)

Yatay hâlâ **pembe iç sol** referansına göre. Görüntü solu pembe iç sol ile aynı değilse `origin[0]`’a ofset ekleyin (px).

## Sunucu

```bash
export OMR_CHECKER_TEMPLATE_JSON=/tam/yol/ml-service/omr_templates/lgs_turkish_user_measured_993x1319.json
```

API şablonu: `lgs_turkish_omrchecker`
