# PostgreSQL Geçiş Rehberi

EduAnalyzer backend varsayılan olarak SQLite kullanır. Production ortamında PostgreSQL'e geçmek için connection string'i güncellemeniz yeterlidir.

**Npgsql paketi** zaten projeye eklenmiştir. Connection string `Host=` içerdiğinde otomatik olarak PostgreSQL kullanılır.

## Otomatik Seçim

`Program.cs` connection string'e göre veritabanı sağlayıcısını seçer:
- `Host=` içeriyorsa → PostgreSQL (Npgsql)
- Aksi halde → SQLite

## Connection String

`appsettings.Production.json` içindeki `ConnectionStrings:Default` değerini güncelleyin veya environment variable kullanın:

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=eduanalyzer;Username=postgres;Password=YOUR_PASSWORD"
  }
}
```

Environment variable ile:
```bash
export ConnectionStrings__Default="Host=localhost;Database=eduanalyzer;Username=postgres;Password=secret"
```

## 4. Migration

EF Core migration'ları kullanıyorsanız:

```bash
cd backend
dotnet ef migrations add InitialPostgres --project src/EduAnalyzer.Infrastructure --startup-project src/EduAnalyzer.Api
dotnet ef database update --project src/EduAnalyzer.Infrastructure --startup-project src/EduAnalyzer.Api
```

Mevcut projede migration yoksa, SQLite'tan PostgreSQL'e geçerken:
- `eduanalyzer.db` dosyasındaki verileri export edip import etmeniz gerekebilir
- Veya temiz bir veritabanı ile başlayıp demo verileri seed ile oluşturabilirsiniz

## 5. Notlar

- SQLite ile PostgreSQL arasında bazı tip farkları olabilir (ör. `DateTime` vs `timestamp with time zone`)
- `UseNpgsql` için `Npgsql.EntityFrameworkCore.PostgreSQL` paketi gerekir
- Production'da connection string'i güvenli şekilde yönetin (secrets, env vars)
