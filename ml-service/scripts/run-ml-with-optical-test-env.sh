#!/usr/bin/env bash
# Lokal / regresyon: optik testleri için ml-service başlatma — PRODUCTION BUNU KULLANMAZ.
# Production: ./start-all.sh (ml-service/.env.optical_stable otomatik yüklenir).
# Bu betik, stabil profili yükledikten sonra teşhis için OPTICAL_TR_COL_DEBUG_ARTIFACTS=1 yazar
# (stabil dosyadaki 0'ı ezer; kapatmak için aşağıdaki export satırını yorumlayın).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export PATH="${ROOT}/ml-service/venv/bin:${PATH}"

# shellcheck source=load-optical-stable-env.sh
# shellcheck disable=SC1090
source "$ROOT/ml-service/scripts/load-optical-stable-env.sh"
ml_optical_apply_stable_env_file "$ROOT/ml-service/.env.optical_stable"

if [ -z "${OMR_CHECKER_TEMPLATE_JSON:-}" ] && [ -f "$ROOT/ml-service/omr_templates/lgs_turkish_user_measured_993x1319.json" ]; then
  export OMR_CHECKER_TEMPLATE_JSON="$ROOT/ml-service/omr_templates/lgs_turkish_user_measured_993x1319.json"
fi
if [ -z "${OMR_CHECKER_COLUMN_TEMPLATE_JSON:-}" ] && [ -f "$ROOT/ml-service/omr_templates/lgs_turkish_column_20q_4pxmm.json" ]; then
  export OMR_CHECKER_COLUMN_TEMPLATE_JSON="$ROOT/ml-service/omr_templates/lgs_turkish_column_20q_4pxmm.json"
fi

export OPTICAL_TR_COL_DESKEW="${OPTICAL_TR_COL_DESKEW:-1}"
# Regresyon: last_turkish_* artefaktları (production'da .env.optical_stable → 0)
export OPTICAL_TR_COL_DEBUG_ARTIFACTS=1

export PYTHONPATH="${ROOT}"
( ml_optical_log_startup_banner; echo "  (test betiği: DEBUG_ARTIFACTS=1, production stable dosyası 0)"; echo "=== uvicorn: 0.0.0.0:8000 ==="; exec python3 -m uvicorn ml_service.api.main:app --host 0.0.0.0 --port 8000 )
