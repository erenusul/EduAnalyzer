# Viewer App

EduAnalyzer öğretmen paneli - Öğrenci takibi, sınav analizi ve ML destekli soru sınıflandırma arayüzü.

## Gereksinimler

- Node.js 18+
- Backend API (http://localhost:5131)
- ML servisi (http://localhost:8000) - PDF analizi ve tek soru tahmini için

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Ortam değişkenlerini ayarlayın (opsiyonel):
```bash
cp .env.example .env.development
# .env.development dosyasını düzenleyin
```

## Geliştirme

Geliştirme sunucusunu başlatmak için:
```bash
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini açın.

**Tüm servisleri birlikte başlatmak için** (proje kökünden):
```bash
./start-all.sh
```

## Demo Giriş

- **E-posta:** ogretmen@demo.com
- **Şifre:** demo123

İlk çalıştırmada backend otomatik olarak demo öğretmen ve örnek verileri oluşturur.

## Build

Production build oluşturmak için:
```bash
npm run build
```

Build çıktısı `dist/` klasöründe olacaktır.

## Ortam Değişkenleri

| Değişken | Açıklama | Varsayılan |
|----------|----------|------------|
| VITE_BACKEND_URL | Backend API adresi | http://localhost:5131 |
| VITE_API_URL | ML Prediction API adresi | Vite proxy (geliştirme) |

Detaylar için `.env.example` dosyasına bakın.

## Sayfalar

| Rota | Açıklama |
|------|----------|
| /login | Giriş sayfası |
| /dashboard | Öğretmen ana panel |
| /dashboard/ogrenci-takibi | Öğrenci listesi ve arama |
| /dashboard/ogrenci/:id | Öğrenci detayı |
| /dashboard/sinav-analizi | PDF yükleme ve ML analizi |
| /dashboard/tek-soru | Tek soru tahmin |
| /dashboard/siniflar | Sınıf yönetimi |
| /dashboard/analiz-gecmisi | Analiz geçmişi |
| /dashboard/olusturulan-sinavlar | Oluşturulan sınavlar |
| /dashboard/sinif-analizi | Sınıf bazlı analiz |
| /dashboard/raporlar | Raporlar |

## Özellikler

- JWT tabanlı kimlik doğrulama
- Backend API entegrasyonu (öğrenci, sınıf, sınav, analiz CRUD)
- ML servisi ile PDF analizi ve soru tahmini
- Öğrenci takibi ve sınav sonuçları
- Sınıf yönetimi
- Analiz geçmişi ve detay görünümü
- Bootstrap + Metronic tema, dark/light mod desteği
