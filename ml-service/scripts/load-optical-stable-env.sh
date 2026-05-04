#!/usr/bin/env bash
# ml-service: .env.optical_stable içindeki değerleri yalnızca o anahtar shell'de
# hâlâ set edilmemişse uygular (mevcut process env / export öncelikli; dosya fallback).
# shellcheck disable=SC2034,SC2163

# shellcheck source=/dev/null
if [[ -z "${_ML_OPTICAL_STABLE_SOURCED:-}" ]]; then
  _ML_OPTICAL_STABLE_SOURCED=1
fi

# Argüman: .env dosya yolu (mutlak tercih edilir)
ml_optical_apply_stable_env_file() {
  local envfile="${1:-}"
  [[ -n "$envfile" && -f "$envfile" ]] || return 0

  while IFS= read -r raw || [[ -n "$raw" ]]; do
    # Yorum / boş satır
    [[ "$raw" =~ ^[[:space:]]*# ]] && continue
    # CRLF
    raw="${raw%$'\r'}"
    # trim (bash/zsh güvenli; xargs yok, özel değerler basit)
    local line
    line="$(printf '%s' "$raw" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [[ -z "$line" ]] && continue

    local key="${line%%=*}"
    key="$(printf '%s' "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    # KEY= yok veya sadece KEY
    if [[ ! "$line" == *"="* ]]; then
      continue
    fi
    local val="${line#*=}"
    # Val içinde sondaki yorumu burada kesmıyoruz; .env sade
    if [[ -z "$key" ]]; then
      continue
    fi
    # Mevcut env varsa (boş dâhil set edildiyse) override etme
    if [[ -n ${!key+x} ]]; then
      continue
    fi
    export "${key}=${val}"
  done < "$envfile"
}

# start-all / test script için kısa log (yanlış config yakalamak)
ml_optical_log_startup_banner() {
  # Kısa isim + gerçek etkili değer (export sonrası)
  local m="${OPTICAL_TR_COL_MULTI_VARIANT_READ:-}"
  local x="${OPTICAL_TR_COL_BUBBLE_X_SEARCH_PX:-}"
  local a="${OPTICAL_TR_COL_AI_ALIGN:-}"
  local s="${OPTICAL_TR_COL_MIN_BEST_SCORE:-}"
  echo "[OPTICAL CONFIG]"
  echo "MULTI_VARIANT_READ=${m}"
  echo "BUBBLE_X_SEARCH_PX=${x}"
  echo "AI_ALIGN=${a}"
  echo "MIN_BEST_SCORE=${s}"
}
