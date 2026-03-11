# Optik Form Şablonu

Kullanılacak örnek form dosyası:

- `docs/optik_form_sablonu.svg`

Bu şablon, mevcut OCR Faz 1 algoritmasındaki oranlarla uyumludur:

- Köşe marker'ları: 4 siyah kare
- Grid alanı: tek sütunda 20 soru
- Şıklar: `A / B / C / D / E`
- Yazdırma hedefi: A4, dikey, `%100` ölçek

## Baskı Kuralları

1. Formu PDF'e dönüştürmeden doğrudan SVG olarak veya PDF'e çevirip `%100` ölçekte yazdırın.
2. Yazıcı ayarlarında `fit to page`, `scale to printable area`, `shrink to fit` gibi seçenekleri kapatın.
3. Köşelerdeki siyah marker'lar tam görünmeli; kesilmemeli.
4. Siyah-beyaz veya yüksek kontrastlı baskı tercih edin.

## Öğrenci Kullanım Kuralları

1. Her soru için yalnızca tek bir şık işaretlenmeli.
2. İşaretleme koyu ve balonun merkezine yakın olmalı.
3. Birden fazla şık işaretlenirse sonuç belirsizleşebilir.
4. Çok silik işaretleme OCR doğruluğunu düşürür.

## Mobil Kamera Kuralları

1. Telefon kağıda paralel tutulmalı.
2. Dört köşe marker kadraj içinde görünmeli.
3. Form çerçeveye tam oturtulmalı.
4. Gölge, parlama ve eğik çekimden kaçınılmalı.

## Teknik Not

Mevcut OCR şu varsayımla çalışır:

- Marker'lar algılanır.
- Perspektif düzeltilir.
- Cevap alanı sabit şablon oranlarıyla okunur.

Bu yüzden şablonun yerleşimini değiştirmeyin:

- marker boyutları
- baloncuk merkezleri
- grid genişliği ve yüksekliği

Eğer farklı soru sayıları veya farklı form düzenleri eklenecekse, OCR tarafında yeni bir şablon profili tanımlanmalıdır.
