# EduAnalyzer

MEB 8. Sınıf Türkçe sınav sorularının ders ve konu tahminini yapan, öğretmen/öğrenci/veli rolleriyle çalışan eğitim analiz platformu.

## Proje Yapısı

```
EduAnalyzer/
├── backend/                # .NET 8 Web API - Ana backend (auth, CRUD, ML proxy)
├── ml-service/             # Python FastAPI - ML tahmin servisi
├── pdf_extractor/          # PDF işleme modülü
│   ├── src/
│   │   ├── models.py      # Veri modelleri
│   │   ├── parser.py       # PDF okuma
│   │   ├── cleaner.py      # Metin temizleme
│   │   ├── exporter.py     # JSON/CSV export
│   │   ├── config.py       # Yapılandırma
│   │   └── main.py         # Ana giriş noktası
│   ├── data/
│   │   ├── raw/            # Ham PDF dosyaları
│   │   └── processed/      # İşlenmiş JSON/CSV çıktıları
│   └── requirements.txt
│
└── viewer-app/             # Frontend - React + TypeScript
    ├── src/
    │   ├── components/     # UI bileşenleri
    │   ├── pages/          # Sayfalar
    │   ├── types/          # TypeScript tip tanımları
    │   ├── hooks/          # Custom React hooks
    │   └── utils/          # Yardımcı fonksiyonlar
    └── public/             # Statik dosyalar (JSON verisi buraya kopyalanır)
```

## Hızlı Başlangıç

### Tüm Servisleri Çalıştır (Önerilen)

```bash
# Tek komutla Backend + ML + Frontend + Student App baslat
./start-all.sh

# Durdurmak için
./stop-all.sh
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5131
- **ML API:** http://localhost:8000
- **Student App (Expo):** varsayilan Metro portu `8081`
- **Demo giriş:** ogretmen@demo.com / demo123

İlk çalıştırmada: `cd backend && dotnet restore`, `cd viewer-app && npm install` ve `cd ml-service && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt` gerekebilir.

### Student App (Expo)

`./start-all.sh` komutu artik mobil uygulamayi da baslatir. Ayrica tek basina calistirmak istersen:

```bash
cd student-app
npm install
npx expo start
```

- Fiziksel cihazda `EXPO_PUBLIC_BACKEND_URL=http://<yerel-ip>:5131` kullanın veya `.env` dosyasini bos birakip otomatik algilamayi deneyin.
- Android emulator icin `http://10.0.2.2:5131`, iOS simulator icin `http://localhost:5131` kullanin.
- Expo Go surumu, projedeki Expo SDK surumu ile uyumlu olmali.

## Özellikler

### Backend (.NET 8 Web API)
- ✅ JWT tabanlı kimlik doğrulama (Öğretmen, Öğrenci, Veli)
- ✅ Öğrenci, sınıf, sınav, analiz CRUD
- ✅ PDF analizi (ML servisi entegrasyonu)
- ✅ Optik tarama ve manuel sınav sonucu girişi
- ✅ SQLite veritabanı (PostgreSQL'e geçiş desteklenir)

### Frontend (viewer-app)
- ✅ Öğretmen paneli: Öğrenci takibi, PDF analizi, tek soru tahmini
- ✅ Sınıf yönetimi, analiz geçmişi, raporlar
- ✅ Öğrenci paneli: Kendi sınav sonuçları
- ✅ Veli paneli: Bağlı öğrencilerin sonuçları
- ✅ Bootstrap + Metronic tema, dark/light mod

### ML Servisi (Python FastAPI)
- ✅ BERTurk tabanlı ders ve konu sınıflandırma
- ✅ PDF'ten soru çıkarma ve toplu tahmin
- ✅ Tek soru tahmin API

## Mimari Dokümantasyonu

`docs/architecture/` klasöründe detaylı mimari dokümantasyonu bulunur:
- [eduanalyzer_eksikler_raporu.md](docs/eduanalyzer_eksikler_raporu.md) - Eksik özellikler ve yapılacaklar
- [student_react_native_plan.md](docs/student_react_native_plan.md) - React Native öğrenci mobil uygulaması planı
- [overview.md](docs/architecture/overview.md) - Genel mimari ve veri akışı
- [backend.md](docs/architecture/backend.md) - Backend Clean Architecture
- [frontend.md](docs/architecture/frontend.md) - Frontend sayfa yapısı ve context'ler
- [ml.md](docs/architecture/ml.md) - ML model pipeline

## Geliştirme

Detaylı bilgi için her modülün kendi README dosyasına bakın:
- [backend/README.md](backend/README.md) - .NET API, auth, veritabanı
- [pdf_extractor/README.md](pdf_extractor/README.md)
- [viewer-app/README.md](viewer-app/README.md)

