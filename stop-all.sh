#!/bin/bash
# EduAnalyzer - Tüm servisleri durdur
# Kullanım: ./stop-all.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "=== EduAnalyzer servisleri durduruluyor ==="

# Port bazlı temizlik (daha güvenilir)
for port in 5131 8000 5173 5174; do
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
      echo "  Port $port kapatılıyor..."
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  fi
done

# Süreç bazlı yedek temizlik
pkill -f "dotnet.*EduAnalyzer" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "uvicorn.*ml_service" 2>/dev/null || true
pkill -f "uvicorn.*8000" 2>/dev/null || true

sleep 2
echo "=== Tüm servisler durduruldu ==="
