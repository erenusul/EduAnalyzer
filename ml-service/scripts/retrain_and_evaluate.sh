#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

TOPIC_CHECKPOINT="${TOPIC_CHECKPOINT:-$ROOT_DIR/ml-service/models/checkpoints/topic_classifier.pt}"
DATASET_PATH="${DATASET_PATH:-$ROOT_DIR/ml-service/data/processed/question_dataset.json}"
EVAL_OUTPUT="${EVAL_OUTPUT:-$ROOT_DIR/ml-service/eval/topic_confusions.json}"
TOPIC_TOP_K="${TOPIC_TOP_K:-5}"
TOPIC_LIMIT_PER_TOPIC="${TOPIC_LIMIT_PER_TOPIC:-30}"
TOPIC_MIN_COUNT="${TOPIC_MIN_COUNT:-1}"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

log "Project root: $ROOT_DIR"
log "Python: $PYTHON_BIN"

cd "$ROOT_DIR"

log "Step 1/3: Training topic classifier"
$PYTHON_BIN ml-service/models/trainer.py

if [ ! -f "$TOPIC_CHECKPOINT" ]; then
  log "ERROR: Topic checkpoint not found at $TOPIC_CHECKPOINT"
  exit 1
fi

log "Step 2/3: Evaluating topic confusion matrix"
mkdir -p "$(dirname "$EVAL_OUTPUT")"
$PYTHON_BIN ml-service/scripts/analyze_topic_model.py \
  --checkpoint "$TOPIC_CHECKPOINT" \
  --dataset "$DATASET_PATH" \
  --top-k "$TOPIC_TOP_K" \
  --limit-per-topic "$TOPIC_LIMIT_PER_TOPIC" \
  --min-count "$TOPIC_MIN_COUNT" \
  --output "$EVAL_OUTPUT"

log "Step 3/3: Done"
log "Evaluation report: $EVAL_OUTPUT"
