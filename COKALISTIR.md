# EduAnalyzer - Nasıl Çalıştırılır

## Tek komutla tüm servisler

```bash
cd /Users/erenusul/Desktop/EduAnalyzer
./start-all.sh
```

Bu komut **Backend + ML + Frontend + Student App** dordunu birden baslatir.

---

## Sadece frontend çalışıyorsa (şu anki durum)

"Demo girişi başarısız. Backend çalışıyor mu?" hatası alıyorsanız backend kapalıdır.

**Çözüm:** Yeni bir terminal açın ve:

```bash
cd /Users/erenusul/Desktop/EduAnalyzer
./start-all.sh
```

Veya sadece backend'i başlatın:

```bash
cd /Users/erenusul/Desktop/EduAnalyzer/backend
dotnet run --project src/EduAnalyzer.Api
```

---

## Servis adresleri

| Servis   | Port | Adres                    |
|----------|------|---------------------------|
| Frontend | 5173 | http://localhost:5173    |
| Backend  | 5131 | http://localhost:5131    |
| ML API   | 8000 | http://localhost:8000    |
| Student App | 8081 | exp://<yerel-ip>:8081 |

**Demo giriş:** ogretmen@demo.com / demo123

Student App icin telefonunda Expo Go guncel olmali. Gercek cihazda backend erisimi icin `student-app/.env` icinde `EXPO_PUBLIC_BACKEND_URL=http://<yerel-ip>:5131` tanimlayabilir veya otomatik algilamayi kullanabilirsin.

---

## ML kalite döngüsü (önerilen)

Sadece ML modelini sıfırdan eğitip, konu karışma raporunu almak için:

```bash
cd /Users/erenusul/Desktop/EduAnalyzer
./ml-service/scripts/retrain_and_evaluate.sh
```

Rapor dosyası:
`ml-service/eval/topic_confusions.json`

Not: Rapor içinde artık en kritik karışımlar için örnek sorular da bulunur:

```bash
cd /Users/erenusul/Desktop/EduAnalyzer
HF_HUB_OFFLINE=1 ./ml-service/venv/bin/python ml-service/scripts/analyze_topic_model.py \
  --output ml-service/eval/topic_confusions.json \
  --top-k 5 \
  --limit-per-topic 10 \
  --min-count 1 \
  --examples-per-pair 20
```
