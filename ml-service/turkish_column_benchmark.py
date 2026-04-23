"""
Türkçe dar sütun grid hizalama parametre sweep ve ölçüm (API dışı yardımcılar).

detect_turkish_column_crop_aligned sözleşmesini değiştirmez; ortam değişkenleri ile
kalibrasyon denemeleri yapılır.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field
from itertools import product
from typing import Any


@contextmanager
def env_override(updates: Mapping[str, str]) -> Iterator[None]:
    """Geçici env değerleri; sweep sonrası eski haline döner."""
    prev: dict[str, str | None] = {}
    try:
        for k, v in updates.items():
            prev[k] = os.environ.get(k)
            os.environ[k] = v
        yield
    finally:
        for k, old in prev.items():
            if old is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = old


def parse_float_csv(s: str) -> list[float]:
    return [float(x.strip()) for x in s.split(",") if x.strip()]


# Varsayılan sweep sırası (tablo sütunları ile uyumlu)
DEFAULT_SWEEP_ORDER: list[tuple[str, list[str]]] = [
    ("OPTICAL_TR_COL_ALIGN_PLATEAU_TAU", ["1.0", "1.5", "2.0"]),
    ("OPTICAL_TR_COL_ALIGN_SNAP_EPS", ["0.22", "0.32", "0.42"]),
    ("OPTICAL_TR_COL_READ_SLACK_HALF_WHEN_REFINE_OFF", ["0.48", "0.56", "0.64"]),
]


def iter_param_combinations(
    sweep: dict[str, Sequence[str]] | None = None,
) -> Iterator[tuple[dict[str, str], tuple[str, ...]]]:
    """
    Her kombinasyon için (env_dict, değerler tuple) üretir.
    """
    if sweep is None:
        keys = [t[0] for t in DEFAULT_SWEEP_ORDER]
        value_lists = [list(t[1]) for t in DEFAULT_SWEEP_ORDER]
    else:
        keys = sorted(sweep.keys())
        value_lists = [list(sweep[k]) for k in keys]
    for combo in product(*value_lists):
        env = {keys[i]: str(combo[i]) for i in range(len(keys))}
        yield env, combo


@dataclass
class BenchmarkRow:
    """Tek görüntü + tek parametre kombinasyonu satırı."""

    image_id: str
    plateau_tau: float
    snap_eps: float
    read_slack_half: float
    chosen_dx: float
    chosen_dy: float
    correct_count: int
    wrong_count: int
    ambiguous_count: int
    empty_count: int
    confidence_mean: float
    alignment_score: float
    margin_separation: float
    global_max_margin: float
    plateau_candidate_count: int
    selection_rule_tr: str
    rejected: bool = False
    error: str = ""
    extra: dict[str, Any] = field(default_factory=dict)


def _norm_ans(a: str) -> str:
    return (a or "").strip().upper()


def count_vs_labels(
    predicted: Sequence[str],
    expected: Sequence[str],
) -> tuple[int, int]:
    """(correct, wrong) — birebir eşleşme; boş-boş doğru sayılır."""
    n = min(len(predicted), len(expected))
    correct = 0
    wrong = 0
    for i in range(n):
        p, e = _norm_ans(predicted[i]), _norm_ans(expected[i])
        if p == e:
            correct += 1
        else:
            wrong += 1
    return correct, wrong


def run_benchmark_case(
    gray: np.ndarray,
    *,
    image_id: str,
    question_count: int,
    option_count: int,
    refine_row_y: bool,
    use_vertical_slack: bool,
    expected: Sequence[str] | None,
    env_updates: Mapping[str, str],
) -> BenchmarkRow:
    """
    Tek ortam kombinasyonunda detect + hizalama analizi.
    """
    from ml_service.turkish_column_align_read import (
        detect_turkish_column_crop_aligned,
        run_turkish_alignment_grid_search,
    )
    from ml_service.api.routes.optical_scan import OpticalScanRejected

    plateau = float(env_updates.get("OPTICAL_TR_COL_ALIGN_PLATEAU_TAU", "1.5"))
    snap = float(env_updates.get("OPTICAL_TR_COL_ALIGN_SNAP_EPS", "0.32"))
    rslack = float(env_updates.get("OPTICAL_TR_COL_READ_SLACK_HALF_WHEN_REFINE_OFF", "0.56"))

    with env_override(dict(env_updates)):
        from ml_service.api.routes import optical_scan as op

        binary = op._prepare_binary_lgs(gray)
        peak = run_turkish_alignment_grid_search(
            gray, binary, question_count=question_count, option_count=option_count
        )

        try:
            reads, meta = detect_turkish_column_crop_aligned(
                gray,
                question_count,
                option_count,
                refine_row_y=refine_row_y,
                use_vertical_slack=use_vertical_slack,
            )
        except OpticalScanRejected as ex:
            return BenchmarkRow(
                image_id=image_id,
                plateau_tau=plateau,
                snap_eps=snap,
                read_slack_half=rslack,
                chosen_dx=float(peak.get("chosen_dx", 0.0)),
                chosen_dy=float(peak.get("chosen_dy", 0.0)),
                correct_count=0,
                wrong_count=len(expected or ()),
                ambiguous_count=0,
                empty_count=0,
                confidence_mean=0.0,
                alignment_score=0.0,
                margin_separation=float(peak.get("chosen_margin", 0.0))
                - float(peak.get("second_best_margin", 0.0)),
                global_max_margin=float(peak.get("global_max_margin", 0.0)),
                plateau_candidate_count=int(peak.get("plateau_candidate_count", 0)),
                selection_rule_tr=str(peak.get("selection_rule_tr", "")),
                rejected=True,
                error=str(ex),
                extra={"peak": {k: v for k, v in peak.items() if k != "_ctx"}},
            )

    preds = [getattr(r, "answer", "") or "" for r in reads[:question_count]]
    tc = meta.get("turkish_column") or {}
    al = tc.get("alignment") or {}
    conf_mean = float(tc.get("confidence_mean") or 0.0)
    amb_c = int(tc.get("ambiguous_count") or 0)
    align_sc = float(al.get("alignment_score") or 0.0)

    empty_c = sum(
        1 for r in reads[:question_count] if (r.status or "").strip().lower() == "empty"
    )

    if expected is not None:
        correct, wrong = count_vs_labels(preds, expected)
    else:
        correct, wrong = 0, 0

    margin_sep = float(peak["chosen_margin"]) - float(peak["second_best_margin"])

    return BenchmarkRow(
        image_id=image_id,
        plateau_tau=plateau,
        snap_eps=snap,
        read_slack_half=rslack,
        chosen_dx=float(peak["chosen_dx"]),
        chosen_dy=float(peak["chosen_dy"]),
        correct_count=correct,
        wrong_count=wrong,
        ambiguous_count=amb_c,
        empty_count=empty_c,
        confidence_mean=conf_mean,
        alignment_score=align_sc,
        margin_separation=margin_sep,
        global_max_margin=float(peak["global_max_margin"]),
        plateau_candidate_count=int(peak["plateau_candidate_count"]),
        selection_rule_tr=str(peak["selection_rule_tr"]),
        extra={
            "peak": {k: v for k, v in peak.items() if k != "_ctx"},
            "predicted": preds,
        },
    )


def row_to_dict(r: BenchmarkRow) -> dict[str, Any]:
    d: dict[str, Any] = {
        "image_id": r.image_id,
        "plateau_tau": r.plateau_tau,
        "snap_eps": r.snap_eps,
        "read_slack_half": r.read_slack_half,
        "chosen_dx": r.chosen_dx,
        "chosen_dy": r.chosen_dy,
        "correct_count": r.correct_count,
        "wrong_count": r.wrong_count,
        "ambiguous_count": r.ambiguous_count,
        "empty_count": r.empty_count,
        "confidence_mean": r.confidence_mean,
        "alignment_score": r.alignment_score,
        "margin_separation": r.margin_separation,
        "global_max_margin": r.global_max_margin,
        "plateau_candidate_count": r.plateau_candidate_count,
        "selection_rule_tr": r.selection_rule_tr,
        "rejected": r.rejected,
        "error": r.error,
    }
    if r.extra:
        d["extra"] = r.extra
    return d


def suggest_diagnostic_composite(r: BenchmarkRow) -> float:
    """
    Üretim alignment_score yerine geçmez; tabloda karşılaştırma için kaba birleşik gösterge.
    margin ayrımı + plato kalabalığı + snap öncesi küresel tepe sapması cezası.
    """
    ms = max(0.0, r.margin_separation)
    crowd = max(0.0, float(r.plateau_candidate_count) - 1.0)
    # Küresel tepe ile seçilen fark (run_turkish_alignment_grid_search sonrası)
    peak = r.extra.get("peak") or {}
    gdx = float(peak.get("global_max_dx", r.chosen_dx))
    gdy = float(peak.get("global_max_dy", r.chosen_dy))
    mismatch = abs(gdx - r.chosen_dx) + abs(gdy - r.chosen_dy)
    penalty = 0.02 * crowd + 0.15 * mismatch + 0.05 * r.ambiguous_count
    raw = ms * (1.0 + 0.1 * r.alignment_score)
    return float(max(0.0, raw - penalty))
