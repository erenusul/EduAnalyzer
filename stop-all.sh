#!/bin/bash
# EduAnalyzer - Tüm servisleri durdur
# Kullanım: ./stop-all.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "=== EduAnalyzer servisleri durduruluyor ==="

WAIT_SECONDS=8
stopped_any=0

terminate_processes() {
  local pids="$1"
  if [ -z "$pids" ]; then
    return 0
  fi

  local pid
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done

  local waited=0
  local still_running=""
  while [ "$waited" -lt "$WAIT_SECONDS" ]; do
    still_running=""
    for pid in $pids; do
      if kill -0 "$pid" 2>/dev/null; then
        still_running="$still_running $pid"
      fi
    done

    if [ -z "$still_running" ]; then
      return 0
    fi

    sleep 1
    waited=$((waited + 1))
  done

  for pid in $pids; do
    kill -9 "$pid" 2>/dev/null || true
  done
}

release_port() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    echo "  Uyarı: lsof bulunamadı. Port $port için yalnızca süreç filtreleriyle durdurma yapılacak."
    return 0
  fi

  local pids
  pids="$(lsof -iTCP:"$port" -sTCP:LISTEN -n -P -t 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "  Port $port kapatılıyor: $pids"
    terminate_processes "$pids"
    stopped_any=1
  fi
}

for port in 5131 8000 5173 5174; do
  release_port "$port"
done

if command -v pkill >/dev/null 2>&1; then
  if pkill -f "dotnet.*EduAnalyzer.Api" 2>/dev/null; then
    stopped_any=1
  fi
  if pkill -f "vite" 2>/dev/null; then
    stopped_any=1
  fi
  if pkill -f "uvicorn.*ml_service" 2>/dev/null; then
    stopped_any=1
  fi
  if pkill -f "uvicorn.*8000" 2>/dev/null; then
    stopped_any=1
  fi
fi

sleep 1
if [ $WAIT_SECONDS -gt 0 ]; then
  elapsed=0
  pending=1
  while [ "$elapsed" -lt "$WAIT_SECONDS" ] && [ "$pending" -eq 1 ]; do
    pending=0
    for port in 5131 8000 5173 5174; do
      if command -v lsof >/dev/null 2>&1; then
        pids="$(lsof -iTCP:"$port" -sTCP:LISTEN -n -P -t 2>/dev/null || true)"
        if [ -n "$pids" ]; then
          pending=1
          break
        fi
      fi
    done

    if [ "$pending" -eq 0 ]; then
      break
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  if [ "$pending" -eq 1 ] && command -v lsof >/dev/null 2>&1; then
    for port in 5131 8000 5173 5174; do
      pids="$(lsof -iTCP:"$port" -sTCP:LISTEN -n -P -t 2>/dev/null || true)"
      if [ -n "$pids" ]; then
        echo "  Uyarı: Port $port kapatılamadı -> $pids"
        stopped_any=1
      fi
    done
  fi
fi

if [ $stopped_any -eq 1 ]; then
  echo "=== Tüm servisler durduruldu ==="
else
  echo "=== Durdurulacak aktif servis bulunamadı ==="
fi
