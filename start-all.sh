#!/bin/bash
# EduAnalyzer - Tüm servisleri sorunsuz başlat
# Kullanım: ./start-all.sh [--offline]
#   --offline : Ağ kullanmadan, sadece global NuGet cache ile build dene

ROOT="$(cd "$(dirname "$0")" && pwd)"
OFFLINE_MODE=0
for arg in "$@"; do
  if [ "$arg" = "--offline" ]; then
    OFFLINE_MODE=1
    break
  fi
done
[ -n "$NUGET_OFFLINE" ] && [ "$NUGET_OFFLINE" = "1" ] && OFFLINE_MODE=1
cd "$ROOT"

# Hataları kontrol ederek ilerliyoruz, kritik bir adım başarısızsa script durur.
set -o errexit
set -o pipefail

BACKEND_PROJECT="src/EduAnalyzer.Api/EduAnalyzer.Api.csproj"
HEALTH_TIMEOUT_SECONDS=30
PORT_FREE_WAIT_SECONDS=10
HEALTH_CHECK_STEP_SECONDS=2
BACKEND_READY=0
ML_READY=0
FRONTEND_READY=0
STUDENT_APP_READY=0
BACKEND_PID=""
ML_PID=""
FRONTEND_PID=""
STUDENT_APP_PID=""
BACKEND_BUILD_CONFIG="${BACKEND_BUILD_CONFIG:-Debug}"
BACKEND_OUTPUT_DIR="$ROOT/backend/src/EduAnalyzer.Api/bin/$BACKEND_BUILD_CONFIG/net8.0"
BACKEND_APPHOST="$BACKEND_OUTPUT_DIR/EduAnalyzer.Api"
BACKEND_DLL="$BACKEND_OUTPUT_DIR/EduAnalyzer.Api.dll"
STUDENT_APP_PORT="${STUDENT_APP_PORT:-8081}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "HATA: '$1' bulunamadı. Lütfen kurun."
    exit 1
  fi
}

fail_and_stop_all() {
  local message="$1"
  echo "$message"
  echo "     Tüm servisleri güvenli durdurup çıkılıyor..."
  "$ROOT/stop-all.sh" 2>/dev/null || true
  exit 1
}

verify_http_ready() {
  local service_name="$1"
  local url="$2"
  local expected_codes="$3"

  if wait_for_http "$url" "$expected_codes" "$HEALTH_TIMEOUT_SECONDS"; then
    echo "     $service_name hazır."
    return 0
  fi

  echo "HATA: $service_name istenen sürede hazır olmadı."
  return 1
}

verify_port_ready() {
  local service_name="$1"
  local port="$2"

  if wait_for_port "$port" "$HEALTH_TIMEOUT_SECONDS"; then
    echo "     $service_name hazır."
    return 0
  fi

  echo "HATA: $service_name istenen sürede port dinlemeye başlamadı."
  return 1
}

start_ml_service() {
  echo "     ML servisi başlatılıyor (port 8000)..."
  if [ -f "$ROOT/ml-service/venv/bin/activate" ]; then
    source "$ROOT/ml-service/venv/bin/activate"
    cd "$ROOT"
    release_port 8000 "ML API"
    # Optik okuma: start-all ML servisini de başlatır. Tam sayfa ve Türkçe sütunu için
    # varsayılan OMRChecker şablonlarını yükle; yoksa ML dahili okuyucuya düşer.
    if [ -z "${OMR_CHECKER_TEMPLATE_JSON:-}" ] && [ -f "$ROOT/ml-service/omr_templates/lgs_turkish_user_measured_993x1319.json" ]; then
      export OMR_CHECKER_TEMPLATE_JSON="$ROOT/ml-service/omr_templates/lgs_turkish_user_measured_993x1319.json"
    fi
    if [ -z "${OMR_CHECKER_COLUMN_TEMPLATE_JSON:-}" ] && [ -f "$ROOT/ml-service/omr_templates/lgs_turkish_column_20q_4pxmm.json" ]; then
      export OMR_CHECKER_COLUMN_TEMPLATE_JSON="$ROOT/ml-service/omr_templates/lgs_turkish_column_20q_4pxmm.json"
    fi
    "$PYTHON_CMD" -m uvicorn ml_service.api.main:app --host 0.0.0.0 --port 8000 &
    ML_PID=$!
    if [ -z "$ML_PID" ] || ! kill -0 "$ML_PID" 2>/dev/null; then
      cd "$ROOT"
      fail_and_stop_all "HATA: ML servisi başlatılamadı."
    fi
    cd "$ROOT"
  else
    fail_and_stop_all "HATA: ml-service/venv bulunamadı."
  fi
}

start_frontend_service() {
  echo "     Frontend başlatılıyor (port 5173)..."
  cd "$ROOT/viewer-app"
  if [ -d "node_modules" ]; then
    release_port 5173 "Frontend"
    "$NPM_CMD" run dev -- --host 0.0.0.0 &
    FRONTEND_PID=$!
    if [ -z "$FRONTEND_PID" ] || ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      fail_and_stop_all "HATA: Frontend başlatılamadı."
    fi
  else
    echo "     node_modules yok, npm install çalıştırılıyor..."
    if [ -f "package-lock.json" ]; then
      "$NPM_CMD" ci --no-audit --no-fund >/dev/null
    else
      "$NPM_CMD" install --no-audit --no-fund >/dev/null
    fi
    "$NPM_CMD" run dev -- --host 0.0.0.0 &
    FRONTEND_PID=$!
    if [ -z "$FRONTEND_PID" ] || ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      fail_and_stop_all "HATA: Frontend başlatılamadı."
    fi
  fi
  cd "$ROOT"
}

start_student_app_service() {
  echo "     Student app başlatılıyor (port $STUDENT_APP_PORT)..."
  cd "$ROOT/student-app"
  if [ -d "node_modules" ]; then
    release_port "$STUDENT_APP_PORT" "Student App"
    CI=false EXPO_NO_TELEMETRY=1 "$NPM_CMD" run start -- --port "$STUDENT_APP_PORT" --host lan &
    STUDENT_APP_PID=$!
    if [ -z "$STUDENT_APP_PID" ] || ! kill -0 "$STUDENT_APP_PID" 2>/dev/null; then
      fail_and_stop_all "HATA: Student app başlatılamadı."
    fi
  else
    echo "     student-app node_modules yok, npm install çalıştırılıyor..."
    if [ -f "package-lock.json" ]; then
      "$NPM_CMD" ci --no-audit --no-fund >/dev/null
    else
      "$NPM_CMD" install --no-audit --no-fund >/dev/null
    fi
    CI=false EXPO_NO_TELEMETRY=1 "$NPM_CMD" run start -- --port "$STUDENT_APP_PORT" --host lan &
    STUDENT_APP_PID=$!
    if [ -z "$STUDENT_APP_PID" ] || ! kill -0 "$STUDENT_APP_PID" 2>/dev/null; then
      fail_and_stop_all "HATA: Student app başlatılamadı."
    fi
  fi
  cd "$ROOT"
}

start_backend_service() {
  echo "     Backend başlatılıyor (port 5131)..."

  if [ -x "$BACKEND_APPHOST" ]; then
    ASPNETCORE_ENVIRONMENT=Development \
    DOTNET_ENVIRONMENT=Development \
    ASPNETCORE_URLS="http://0.0.0.0:5131" \
    Jwt__Secret="EduAnalyzer-SuperSecretKey-ChangeInProduction-Min32Chars" \
      "$BACKEND_APPHOST" &
  elif [ -f "$BACKEND_DLL" ]; then
    ASPNETCORE_ENVIRONMENT=Development \
    DOTNET_ENVIRONMENT=Development \
    ASPNETCORE_URLS="http://0.0.0.0:5131" \
    Jwt__Secret="EduAnalyzer-SuperSecretKey-ChangeInProduction-Min32Chars" \
      dotnet "$BACKEND_DLL" &
  else
    fail_and_stop_all "HATA: Backend build çıktısı bulunamadı."
  fi

  BACKEND_PID=$!
  if [ -z "$BACKEND_PID" ] || ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    fail_and_stop_all "HATA: Backend başlatılamadı."
  fi
}

echo "=== EduAnalyzer Servisleri Başlatılıyor ==="
echo "Backend build konfigurasyonu: $BACKEND_BUILD_CONFIG"

wait_for_http() {
  local url="$1"
  local expected_codes="$2"
  local max_seconds="${3:-$HEALTH_TIMEOUT_SECONDS}"
  local step="$HEALTH_CHECK_STEP_SECONDS"
  local elapsed=0

  while [ "$elapsed" -lt "$max_seconds" ]; do
    local code
    code="$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")"
    if echo "$code" | grep -Eq "^($expected_codes)$"; then
      return 0
    fi
    sleep "$step"
    elapsed=$((elapsed + step))
  done
  return 1
}

wait_for_port() {
  local port="$1"
  local max_seconds="${2:-$HEALTH_TIMEOUT_SECONDS}"
  local step="$HEALTH_CHECK_STEP_SECONDS"
  local elapsed=0

  while [ "$elapsed" -lt "$max_seconds" ]; do
    if command -v lsof >/dev/null 2>&1; then
      if lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
        return 0
      fi
    else
      return 0
    fi
    sleep "$step"
    elapsed=$((elapsed + step))
  done
  return 1
}

release_port() {
  local port="$1"
  local label="$2"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  local pids
  pids="$(lsof -iTCP:"$port" -sTCP:LISTEN -n -P -t 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    return 0
  fi

  echo "     $label için port $port dolu. Süreçler sonlandırılıyor: $pids"
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done

  local elapsed=0
  while [ "$elapsed" -lt "$PORT_FREE_WAIT_SECONDS" ]; do
    pids="$(lsof -iTCP:"$port" -sTCP:LISTEN -n -P -t 2>/dev/null || true)"
    [ -z "$pids" ] && { echo "     $label portu serbest." ; return 0; }
    sleep 1
    elapsed=$((elapsed + 1))
  done

  for pid in $pids; do
    kill -9 "$pid" 2>/dev/null || true
  done
  return 0
}

restore_backend() {
  if [ $OFFLINE_MODE -eq 1 ]; then
    echo "     [Offline mod] Global NuGet cache kullanılıyor..."
    dotnet restore "$BACKEND_PROJECT" \
      --source "$HOME/.nuget/packages" \
      --verbosity minimal
  else
    dotnet restore "$BACKEND_PROJECT" --verbosity minimal
  fi
}

require_command dotnet
require_command curl
if command -v npm >/dev/null 2>&1; then
  NPM_CMD="npm"
else
  fail_and_stop_all "HATA: 'npm' bulunamadı."
fi
if command -v python >/dev/null 2>&1; then
  PYTHON_CMD="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_CMD="python3"
else
  fail_and_stop_all "HATA: 'python' veya 'python3' bulunamadı."
fi

# 1. Önce tüm eski servisleri temizle
echo "[0/4] Eski servisler durduruluyor..."
"$ROOT/stop-all.sh" 2>/dev/null || {
  for port in 5131 8000 5173 5174 8081 8082 8083; do
    lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
  done
  pkill -f "dotnet.*EduAnalyzer" 2>/dev/null || true
  pkill -f "vite" 2>/dev/null || true
  pkill -f "uvicorn.*8000" 2>/dev/null || true
  pkill -f "expo start" 2>/dev/null || true
  pkill -f "@expo/cli" 2>/dev/null || true
  sleep 2
}

# 2. Backend
echo "[1/4] Backend hazırlanıyor..."
cd "$ROOT/backend"
release_port 5131 "Backend"
restore_status=0
backend_built=0
if [ -f "src/EduAnalyzer.Api/obj/project.assets.json" ]; then
  echo "     Mevcut restore var, doğrudan --no-restore build deneniyor..."
  if dotnet build "$BACKEND_PROJECT" -c "$BACKEND_BUILD_CONFIG" --no-restore --verbosity minimal; then
    restore_status=0
    backend_built=1
  else
    restore_status=1
  fi
else
  restore_status=1
fi

if [ $restore_status -ne 0 ]; then
  echo "     Restore/Build ön deneme başarısız, temiz restore ile yeniden deneniyor..."
  if ! restore_backend; then
    restore_status=$?
    echo "     Restore ilk deneme başarısız, bir kez daha deneniyor..."
    if ! restore_backend; then
      restore_status=$?
    else
      restore_status=0
    fi
  fi
fi

if [ $restore_status -eq 0 ] && [ $backend_built -eq 0 ]; then
  if dotnet build "$BACKEND_PROJECT" -c "$BACKEND_BUILD_CONFIG" --no-restore --verbosity minimal; then
    echo "     Build başarılı."
    backend_built=1
  else
    restore_status=1
  fi
fi

if [ $restore_status -ne 0 ]; then
  echo "     Restore/Build başarısız, obj/bin temizlenip tekrar deneniyor..."
  for dir in src/EduAnalyzer.Api src/EduAnalyzer.Application src/EduAnalyzer.Infrastructure src/EduAnalyzer.Domain; do
    rm -rf "$dir/bin" "$dir/obj" 2>/dev/null || true
  done

  if restore_backend; then
    dotnet build "$BACKEND_PROJECT" -c "$BACKEND_BUILD_CONFIG" --no-restore --verbosity minimal
  else
    dotnet build "$BACKEND_PROJECT" -c "$BACKEND_BUILD_CONFIG" --verbosity minimal
  fi
  restore_status=$?
  backend_built=1
fi

if [ $restore_status -eq 0 ]; then
  start_backend_service
  cd "$ROOT"
  if verify_http_ready "Backend" "http://localhost:5131/api/health" "200"; then
    BACKEND_READY=1
  else
    fail_and_stop_all "HATA: Backend sağlıklı başlamadı."
  fi
fi

# 3/4 Servisleri paralel başlat
echo "[2/4] ML, Frontend ve Student app paralel başlatılıyor..."
start_ml_service
start_frontend_service
start_student_app_service

if verify_http_ready "ML API" "http://localhost:8000/health" "200|405"; then
  ML_READY=1
else
  fail_and_stop_all "HATA: ML servisi sağlıklı başlamadı."
fi

if verify_http_ready "Frontend" "http://localhost:5173" "200"; then
  FRONTEND_READY=1
else
  fail_and_stop_all "HATA: Frontend sağlıklı başlamadı."
fi

if verify_port_ready "Student App" "$STUDENT_APP_PORT"; then
  STUDENT_APP_READY=1
else
  fail_and_stop_all "HATA: Student app sağlıklı başlamadı."
fi

echo ""
echo "[4/4] == Tüm servisler başlatıldı ==="
echo ""
if [ $BACKEND_READY -eq 1 ] && [ $ML_READY -eq 1 ] && [ $FRONTEND_READY -eq 1 ] && [ $STUDENT_APP_READY -eq 1 ]; then
  echo "  Durum: Tam başarı"
else
  fail_and_stop_all "HATA: Bazı servisler hazır olamadı."
fi
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:5131"
echo "  ML API:    http://localhost:8000"
echo "  Student:   exp://<yerel-ip>:$STUDENT_APP_PORT"
echo ""
echo "  Demo giriş: ogretmen@demo.com / demo123"
echo ""
echo "  Durdurmak için: ./stop-all.sh"
echo ""

wait
