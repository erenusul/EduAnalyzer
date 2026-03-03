#!/bin/bash
# EduAnalyzer - Tüm servisleri sorunsuz başlat
# Kullanım: ./start-all.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# set -e KAPALI - hatalar scripti durdurmaz, devam ederiz
set +e

echo "=== EduAnalyzer Servisleri Başlatılıyor ==="

# 1. Önce tüm eski servisleri temizle
echo "[0/4] Eski servisler durduruluyor..."
"$ROOT/stop-all.sh" 2>/dev/null || {
  for port in 5131 8000 5173 5174; do
    lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
  done
  pkill -f "dotnet.*EduAnalyzer" 2>/dev/null || true
  pkill -f "vite" 2>/dev/null || true
  pkill -f "uvicorn.*8000" 2>/dev/null || true
  sleep 2
}

# 2. Backend
echo "[1/4] Backend hazırlanıyor..."
cd "$ROOT/backend"
dotnet restore -q 2>/dev/null || echo "     (restore atlandı, önbellek kullanılacak)"
if dotnet build src/EduAnalyzer.Api/EduAnalyzer.Api.csproj -c Release -q 2>/dev/null; then
  echo "     Build başarılı."
else
  echo "     İlk build başarısız, obj/bin temizlenip tekrar deneniyor..."
  for dir in src/EduAnalyzer.Domain src/EduAnalyzer.Application src/EduAnalyzer.Infrastructure src/EduAnalyzer.Api; do
    rm -rf "$dir/obj" "$dir/bin" 2>/dev/null || true
  done
  if dotnet build src/EduAnalyzer.Api/EduAnalyzer.Api.csproj -c Release -q 2>/dev/null; then
    echo "     Build başarılı (temiz derleme)."
  else
    echo "     Build atlandı, mevcut derleme kullanılacak."
  fi
fi
echo "     Backend başlatılıyor (port 5131)..."
dotnet run --project src/EduAnalyzer.Api --no-build -c Release &
BACKEND_PID=$!
cd "$ROOT"
sleep 4

# Backend hazır mı kontrol et
for i in 1 2 3 4 5; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:5131/api/health 2>/dev/null | grep -q "200"; then
    echo "     Backend hazır."
    break
  fi
  [ $i -lt 5 ] && sleep 2
done

# 3. ML Service
echo "[2/4] ML servisi başlatılıyor (port 8000)..."
if [ -f "$ROOT/ml-service/venv/bin/activate" ]; then
  source "$ROOT/ml-service/venv/bin/activate"
  cd "$ROOT"
  python -m uvicorn ml_service.api.main:app --host 0.0.0.0 --port 8000 &
  sleep 3
  if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo "     ML servisi hazır."
  fi
else
  echo "     UYARI: ml-service/venv bulunamadı. python -m venv ml-service/venv ile oluşturun."
fi
cd "$ROOT"

# 4. Frontend
echo "[3/4] Frontend başlatılıyor (port 5173)..."
cd "$ROOT/viewer-app"
if [ -d "node_modules" ]; then
  npm run dev &
  sleep 3
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null | grep -q "200"; then
    echo "     Frontend hazır."
  fi
else
  echo "     node_modules yok, npm install çalıştırılıyor..."
  npm install 2>/dev/null && npm run dev &
  sleep 5
fi
cd "$ROOT"

echo ""
echo "[4/4] == Tüm servisler başlatıldı ==="
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:5131"
echo "  ML API:    http://localhost:8000"
echo ""
echo "  Demo giriş: ogretmen@demo.com / demo123"
echo ""
echo "  Durdurmak için: ./stop-all.sh"
echo ""

wait
