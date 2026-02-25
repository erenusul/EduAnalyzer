# EduAnalyzer Backend

.NET 8 Web API - Öğretmen, öğrenci ve veli rolleri için eğitim analiz backend servisi.

## Mimari

```
backend/
├── src/
│   ├── EduAnalyzer.Api/          # Web API, Controllers, Auth
│   ├── EduAnalyzer.Application/   # Services, DTOs, Interfaces
│   ├── EduAnalyzer.Domain/        # Entities, Enums, ValueObjects
│   └── EduAnalyzer.Infrastructure/# EF Core, Repositories, ML Client
└── EduAnalyzer.sln
```

**Clean Architecture** prensiplerine uygun katmanlı yapı:
- **Domain**: İş kurallarından bağımsız entity'ler
- **Application**: Use case'ler, DTO'lar, servis arayüzleri
- **Infrastructure**: Veritabanı, harici servisler (ML API)
- **Api**: HTTP endpoint'leri, JWT auth, CORS

## Gereksinimler

- .NET 8 SDK
- ML servisi (Python FastAPI) - `http://localhost:8000`

## Kurulum

```bash
cd backend
dotnet restore
dotnet build
```

## Çalıştırma

1. ML servisini başlatın (proje kökünden):
   ```bash
   cd ml-service && python -m uvicorn ml_service.api.main:app --reload --port 8000
   ```

2. Backend API'yi başlatın:
   ```bash
   cd backend
   dotnet run --project src/EduAnalyzer.Api
   ```

3. Swagger: `https://localhost:7xxx/swagger` veya `http://localhost:5xxx/swagger`

## Demo Giriş

- **E-posta**: `ogretmen@demo.com`
- **Şifre**: `demo123`

İlk çalıştırmada demo öğretmen ve örnek sınıf/öğrenci verileri otomatik oluşturulur.

## API Özeti

| Endpoint | Açıklama |
|----------|----------|
| `POST /api/auth/login` | Giriş (JWT döner) |
| `GET /api/health` | Sağlık kontrolü (ML servisi dahil) |
| `GET /api/students` | Öğrenci listesi |
| `GET /api/students/{id}/results` | Öğrenci sınav sonuçları |
| `GET /api/classes` | Sınıf listesi |
| `GET /api/exams` | Sınav listesi |
| `PUT /api/exams/{id}/answer-key` | Cevap anahtarını kaydet |
| `POST /api/exams/{id}/results/scan` | Optik tarama sonucu gönder, karşılaştır, kaydet |
| `POST /api/exams/results` | Sınav sonucu ekle (optik/manuel) |
| `GET /api/analyses` | Analiz geçmişi |
| `POST /api/analyses/pdf` | PDF yükle → ML analizi → kayıt |

## Konfigürasyon (appsettings.json)

```json
{
  "ConnectionStrings": {
    "Default": "Data Source=eduanalyzer.db"
  },
  "Jwt": {
    "Secret": "En az 32 karakter güçlü secret",
    "Issuer": "EduAnalyzer",
    "Audience": "EduAnalyzer",
    "ExpirationMinutes": 60
  },
  "MlService": {
    "BaseUrl": "http://localhost:8000",
    "TimeoutSeconds": 600
  }
}
```

## Veritabanı

SQLite kullanılır (`eduanalyzer.db`). İlk çalıştırmada otomatik oluşturulur.

**Şema güncellemesi:** Yeni sütunlar eklendiyse (örn. `AnswerKeyJson`), mevcut `eduanalyzer.db` dosyasını silip uygulamayı yeniden başlatın. Veritabanı yeniden oluşturulacaktır.

Production için PostgreSQL'e geçmek için:
- `Npgsql.EntityFrameworkCore.PostgreSQL` paketi ekleyin
- `UseSqlite` → `UseNpgsql` değiştirin
- Connection string güncelleyin

## Web / Mobil Entegrasyonu

- **CORS**: Tüm origin'lere izin verilir (production'da kısıtlayın)
- **JWT**: `Authorization: Bearer <token>` header'ı ile isteklerde gönderin
- **Base URL**: `https://localhost:7xxx` veya deploy edilen adres
