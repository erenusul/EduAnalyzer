# Viewer App

Türkçe 8. Sınıf ders kitabı verilerini görüntüleme, filtreleme ve düzenleme arayüzü.

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

## Geliştirme

Geliştirme sunucusunu başlatmak için:
```bash
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini açın.

## Build

Production build oluşturmak için:
```bash
npm run build
```

Build çıktısı `dist/` klasöründe olacaktır.

## Önemli Not

Uygulama `public/turkce8_dataset.json` dosyasını yükler. Bu dosyayı oluşturmak için önce `pdf_extractor` modülünü çalıştırın ve çıktı JSON dosyasını `viewer-app/public/` klasörüne kopyalayın.

## Özellikler

- ✅ Veri filtreleme (tema, metin türü, sayfa aralığı, arama)
- ✅ Tablo görünümünde veri listeleme
- ✅ Metin detay görünümü
- ✅ Tema, metin türü ve notlar düzenleme
- ✅ JSON ve CSV export

