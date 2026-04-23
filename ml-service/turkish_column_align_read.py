"""
Türkçe dar sütun (lgs_turkish_column_crop) için crop sonrası grid hizalama ve toleranslı okuma.

Nominal mm şablonuna göre küresel (dx, dy) araması + satır başına ince ayar; şık merkezlerinde
yatay arama penceresi. optical_scan ile döngüsel import yok: yardımcılar çağrı içinde yüklenir.
"""

from __future__ import annotations

import os
from typing import Any, List, Tuple

import numpy as np

from ml_service.optical_template_mm import get_turkish_column_crop_template_mm


def _env_int(name: str, default: int) -> int:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_flag_true(name: str, default: bool = True) -> bool:
    raw = (os.environ.get(name) or "").strip().lower()
    if not raw:
        return default
    if raw in ("0", "false", "no", "off"):
        return False
    if raw in ("1", "true", "yes", "on"):
        return True
    return default


def _turkish_narrow_lower_rows_y_correction_px(row_index: int, row_step_px: float) -> float:
    if row_index < 13:
        return 0.0
    lower_idx = min(row_index - 13, 6)
    correction_ratio = 0.06 + lower_idx * 0.03
    return -row_step_px * correction_ratio


def _confidence_from_margin(best: float, second: float, scale: float = 0.08) -> float:
    gap = max(0.0, best - second)
    return min(1.0, max(0.0, 0.2 + 0.8 * min(1.0, gap / max(scale, 1e-6))))


def _row_read_lgs_with_scores(
    option_scores: list[float],
    options: list[str],
    *,
    row_index: int | None = None,
    question_count: int | None = None,
) -> Tuple[Any, float, float, dict[str, Any]]:
    """optical_scan şık kararı + ikinci/birinci skor + decision_detail (tanılama)."""
    from ml_service.api.routes.optical_scan import QuestionRead, _evaluate_turkish_column_lgs_row

    if not option_scores:
        return (
            QuestionRead("", "empty", 0.0, second_score=0.0, fill_ratio_best=0.0),
            0.0,
            0.0,
            {"decision_code": "no_scores"},
        )

    sorted_scores = sorted(option_scores, reverse=True)
    best_score = sorted_scores[0]
    second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    base, detail = _evaluate_turkish_column_lgs_row(
        option_scores,
        options,
        row_index=row_index,
        question_count=question_count,
    )
    return (
        QuestionRead(
            base.answer,
            base.status,
            base.confidence,
            second_score=second_score,
            fill_ratio_best=best_score,
        ),
        second_score,
        best_score,
        detail,
    )


def _prepare_binary_align_projection(gray: np.ndarray) -> np.ndarray:
    """
    Projeksiyon / üst çizgi tespiti için hafif farklı ön-işleme (isteğe bağlı env).
    """
    import cv2

    if _env_flag_true("OPTICAL_TR_COL_ALIGN_PREPROCESS", False):
        g = cv2.GaussianBlur(gray, (5, 5), 0)
        binary = cv2.adaptiveThreshold(
            g,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            41,
            11,
        )
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, k, iterations=1)
    return None


def compute_turkish_row_drift_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Teşhis: üstten alta delta_y eğilimi, şık marjı istatistikleri (ground truth olmadan).
    """
    if not rows:
        return {"error": "empty_rows"}

    import numpy as np

    deltas_y: list[float] = []
    margins: list[float] = []
    low_margin_rows: list[int] = []

    for r in rows:
        qidx = int(r.get("question_index", r.get("row", 0)))
        dy = float(r.get("delta_y_px", 0.0))
        deltas_y.append(dy)
        sc = r.get("scores") or {}
        vals = sorted((float(v) for v in sc.values()), reverse=True)
        if len(vals) >= 2:
            m = vals[0] - vals[1]
            margins.append(m)
            if m < 0.035:
                low_margin_rows.append(qidx)

    idx = np.arange(len(deltas_y), dtype=float)
    slope = 0.0
    intercept = float(deltas_y[0]) if deltas_y else 0.0
    if len(deltas_y) >= 3:
        slope, intercept = np.polyfit(idx, np.array(deltas_y, dtype=float), 1)

    return {
        "delta_y_per_row_px": [round(x, 4) for x in deltas_y],
        "delta_y_linear_drift_px_per_row": round(float(slope), 6),
        "delta_y_mean_px": round(float(np.mean(deltas_y)), 4) if deltas_y else 0.0,
        "delta_y_std_px": round(float(np.std(deltas_y)), 4) if deltas_y else 0.0,
        "margin_best_minus_second_mean": round(float(np.mean(margins)), 4) if margins else 0.0,
        "margin_best_minus_second_min": round(float(np.min(margins)), 4) if margins else 0.0,
        "rows_with_low_margin": low_margin_rows[:40],
        "interpretation_hints": {
            "uniform_offset": bool(float(np.std(deltas_y)) < 1.5) if len(deltas_y) > 2 else False,
            "vertical_drift_suspected": abs(float(slope)) > 0.25 and len(deltas_y) >= 8,
            "ambiguous_margin_suspected": len(low_margin_rows) > max(3, len(rows) // 4),
        },
    }


def _horizontal_projection_mean_energy(binary: np.ndarray, y0: int, y1: int) -> float:
    """Satır bandında yatay projeksiyon ortalaması (hizalama skoru yardımcısı)."""
    h, w = binary.shape[:2]
    y0 = max(0, min(y0, h - 1))
    y1 = max(y0 + 1, min(y1, h))
    band = binary[y0:y1, :]
    if band.size == 0:
        return 0.0
    proj = np.mean(band, axis=1) / 255.0
    return float(np.mean(proj))


def run_turkish_alignment_grid_search(
    gray: np.ndarray,
    binary: np.ndarray,
    *,
    question_count: int,
    option_count: int,
) -> dict[str, Any]:
    """
    Küresel (dx,dy) marj ızgarası + plato/L1 seçimi + isteğe bağlı (0,0) snap.
    Benchmark ve teşhis için; tam okuma için detect_turkish_column_crop_aligned kullanın.

    Dönüş: chosen_dx/dy, margin değerleri, ikinci tepe, grid üst adaylar, plato listesi, seçim özeti.
    """
    from ml_service.api.routes import optical_scan as op

    tm = get_turkish_column_crop_template_mm()
    oc = max(4, min(5, int(option_count)))
    height, width = binary.shape

    option_step_mm = tm.ad_centers_span_mm / 3.0
    row_step_mm = tm.q1_q20_centers_span_mm / 19.0
    row_step_px = row_step_mm / tm.page_h_mm * height
    step_x_px = option_step_mm / tm.page_w_mm * width
    r_mult = _env_float("OPTICAL_TR_COL_BUBBLE_RADIUS_MULT", 1.03)
    radius = max(
        5,
        int(round(min(step_x_px, row_step_px) * tm.bubble_radius_scale * max(0.85, min(r_mult, 1.35)))),
    )

    rows = max(1, min(question_count, 60))
    opts = op._get_options(oc)

    search_px = _env_int("OPTICAL_TR_COL_ALIGN_SEARCH_PX", 18)
    step = _env_int("OPTICAL_TR_COL_ALIGN_SEARCH_STEP", 2)
    max_probe = _env_int("OPTICAL_TR_COL_ALIGN_PROBE_ROWS", 20)

    def _probe_row_indices(n: int, cap: int) -> list[int]:
        if n <= 0:
            return []
        head = list(range(min(8, n)))
        tail = list(range(max(0, n - 8), n)) if n > 8 else []
        mid: list[int] = []
        if n > 12:
            mid = [n // 2, (n - 1) // 2]
        merged = sorted(set(head + tail + mid))
        if len(merged) <= cap:
            out = merged
        else:
            idx = np.linspace(0, n - 1, num=min(cap, n))
            out = sorted({int(round(float(x))) for x in idx})
        return out

    probe_row_indices = _probe_row_indices(rows, max(8, max_probe))

    def nominal_row_geometry(
        row: int, dx: float, dy: float
    ) -> tuple[float, list[float]]:
        cy_mm = tm.q1_a_cy_mm + row * row_step_mm + tm.grid_offset_y_mm
        cy_px = cy_mm / tm.page_h_mm * height
        cy_px += _turkish_narrow_lower_rows_y_correction_px(row, row_step_px)
        cy_px += dy
        centers_x_mm = [
            tm.q1_a_cx_mm + tm.grid_offset_x_mm + c * option_step_mm for c in range(oc)
        ]
        centers_x_px = [cx / tm.page_w_mm * width + dx for cx in centers_x_mm]
        return cy_px, centers_x_px

    def alignment_objective(dx: float, dy: float) -> float:
        margin_sum = 0.0
        for row in probe_row_indices:
            cy_px, centers_x_px = nominal_row_geometry(row, dx, dy)
            scores, _ = op._row_scores_from_centers_hybrid_vertical_slack(
                binary,
                gray,
                width,
                height,
                centers_x_px,
                cy_px,
                radius,
                row_step_px,
                binary_weight=0.46,
                slack_half_scale=1.0,
            )
            if not scores:
                continue
            ss = sorted((float(x) for x in scores), reverse=True)
            margin_sum += ss[0] - (ss[1] if len(ss) > 1 else 0.0)
        return margin_sum

    grid_scores: list[tuple[float, float, float]] = []
    for dx in range(-search_px, search_px + 1, max(1, step)):
        for dy in range(-search_px, search_px + 1, max(1, step)):
            grid_scores.append((float(dx), float(dy), alignment_objective(float(dx), float(dy))))

    plateau_tau = _env_float("OPTICAL_TR_COL_ALIGN_PLATEAU_TAU", 1.5)
    best_margin = max(t[2] for t in grid_scores) if grid_scores else 0.0
    plateau = [t for t in grid_scores if t[2] >= best_margin - plateau_tau]
    plateau_sorted = sorted(plateau, key=lambda t: (abs(t[0]) + abs(t[1]), -t[2]))
    pl_dx, pl_dy, pl_margin = plateau_sorted[0]
    best_dx, best_dy, best_s = pl_dx, pl_dy, pl_margin
    origin_score = alignment_objective(0.0, 0.0)
    snap_eps = _env_float("OPTICAL_TR_COL_ALIGN_SNAP_EPS", 0.32)
    snap_applied = False
    if pl_margin - origin_score < snap_eps:
        best_dx, best_dy, best_s = 0.0, 0.0, origin_score
        snap_applied = True

    second_s = 0.0
    for t in grid_scores:
        if abs(t[0] - best_dx) < 1e-6 and abs(t[1] - best_dy) < 1e-6:
            continue
        second_s = max(second_s, t[2])
    if second_s <= 0.0 and len(grid_scores) > 1:
        second_s = grid_scores[1][2]

    sorted_by_margin = sorted(grid_scores, key=lambda t: (-t[2], abs(t[0]) + abs(t[1])))
    global_top = sorted_by_margin[0] if sorted_by_margin else (0.0, 0.0, 0.0)

    def _row(d: tuple[float, float, float]) -> dict[str, Any]:
        return {
            "dx": round(float(d[0]), 2),
            "dy": round(float(d[1]), 2),
            "margin": round(float(d[2]), 4),
            "l1": round(abs(d[0]) + abs(d[1]), 2),
        }

    plateau_rows = [_row(t) for t in plateau_sorted[: min(25, len(plateau_sorted))]]
    top_by_margin = [_row(t) for t in sorted_by_margin[:20]]

    tie_with_global = (
        abs(global_top[0] - best_dx) < 1e-5
        and abs(global_top[1] - best_dy) < 1e-5
        and not snap_applied
    )
    if snap_applied:
        rule = (
            f"Snap: plato L1-öncelikli aday (dx,dy)=({pl_dx:.0f},{pl_dy:.0f}) marj={pl_margin:.4f}; "
            f"köken (0,0) marjı={origin_score:.4f}; fark={pl_margin - origin_score:.4f} < eps={snap_eps} → (0,0)."
        )
    elif tie_with_global:
        rule = (
            "Plato seçimi küresel marj tepesi ile aynı (dx,dy); plato içinde L1 tie-break "
            "aynı noktayı korudu."
        )
    else:
        rule = (
            f"Küresel en yüksek marj ({global_top[2]:.4f}) @ (dx,dy)=({global_top[0]:.0f},{global_top[1]:.0f}) "
            f"iken, plato (tau={plateau_tau}) içinde {len(plateau)} aday vardı; "
            f"en küçük |dx|+|dy| ile ({best_dx:.0f},{best_dy:.0f}) seçildi (marj={best_s:.4f})."
        )

    return {
        "chosen_dx": float(best_dx),
        "chosen_dy": float(best_dy),
        "chosen_margin": float(best_s),
        "origin_margin": float(origin_score),
        "snap_applied": snap_applied,
        "snap_eps": snap_eps,
        "second_best_margin": float(second_s),
        "plateau_tau": plateau_tau,
        "plateau_candidate_count": len(plateau),
        "global_max_margin": float(global_top[2]),
        "global_max_dx": float(global_top[0]),
        "global_max_dy": float(global_top[1]),
        "grid_point_count": len(grid_scores),
        "probe_row_indices": probe_row_indices,
        "top_by_margin": top_by_margin,
        "plateau_sorted_by_l1": plateau_rows,
        "selection_rule_tr": rule,
        "_ctx": {
            "row_step_px": row_step_px,
            "radius": radius,
            "rows": rows,
            "oc": oc,
            "opts": opts,
            "nominal_row_geometry": nominal_row_geometry,
        },
    }


def detect_turkish_column_crop_aligned(
    form_image: np.ndarray,
    question_count: int,
    option_count: int,
    *,
    refine_row_y: bool,
    use_vertical_slack: bool,
) -> Tuple[List[Any], dict[str, Any]]:
    """
    Hizalanmış Türkçe sütun okuması. QuestionRead listesi + scan_metadata.turkish_column için sözlük.
    """
    from ml_service.api.routes import optical_scan as op

    gray = form_image
    binary = op._prepare_binary_lgs(form_image)
    height, width = binary.shape
    # Üst yol refine_y=False iken use_vertical_slack=False verebilir; grid hizalı okumada satır Y
    # örneklemesi yine gerekir (affine / dar kadrajda boş satırda komşu şık baskın çıkmasın).
    # refine_y=False iken üst yol use_vertical_slack=False verebilir; tam dikey slack alt satırda
    # komşu satır gürültüsü yapabiliyor. Dar pencere (slack_half_scale) ile örnekleme dengelenir.
    read_slack_half = (
        1.0
        if use_vertical_slack
        else _env_float("OPTICAL_TR_COL_READ_SLACK_HALF_WHEN_REFINE_OFF", 0.56)
    )
    read_use_vertical_slack = op._lgs_vertical_slack_enabled()

    align_peak = run_turkish_alignment_grid_search(
        gray,
        binary,
        question_count=question_count,
        option_count=option_count,
    )
    ctx = align_peak["_ctx"]
    nominal_row_geometry = ctx["nominal_row_geometry"]
    row_step_px = ctx["row_step_px"]
    radius = ctx["radius"]
    rows = ctx["rows"]
    oc = ctx["oc"]
    opts = ctx["opts"]
    probe_row_indices = align_peak["probe_row_indices"]

    best_dx = align_peak["chosen_dx"]
    best_dy = align_peak["chosen_dy"]
    best_s = align_peak["chosen_margin"]
    snap_applied = align_peak["snap_applied"]
    second_s = align_peak["second_best_margin"]
    peak_meta_extras: dict[str, Any] | None = None
    if _env_flag_true("OPTICAL_TR_COL_ALIGN_PEAK_ANALYSIS", False):
        peak_meta_extras = {k: v for k, v in align_peak.items() if k != "_ctx"}

    # Birçok (dx,dy) aynı skoru verebilir (sentetik düzgün ızgara); bu durumda reddetme.
    if second_s >= best_s - 1e-4:
        alignment_score = 0.94
    else:
        # Mutlak fark küçük olsa da birinci net önde olabilir; oranı büyütüp taban ekle.
        gap = max(0.0, best_s - second_s)
        gap_ratio = gap / max(best_s, 1e-3)
        alignment_score = float(min(1.0, max(gap_ratio * 85.0, gap / 25.0 + 0.12, 0.18)))

    # Üst bant enerjisi ile ikincil güven (projeksiyon)
    proj_bin = _prepare_binary_align_projection(gray)
    top_energy = 0.0
    if proj_bin is not None:
        top_h = max(8, int(height * 0.12))
        top_energy = _horizontal_projection_mean_energy(proj_bin, 0, top_h)
        alignment_score = float(min(1.0, alignment_score * 0.82 + min(1.0, top_energy * 2.1) * 0.18))

    reject_below = _env_float("OPTICAL_TR_COL_ALIGN_REJECT_BELOW", 0.022)
    if alignment_score < reject_below:
        raise op.OpticalScanRejected(
            "Optik form hizalaması zayıf görünüyor (kadraj kaymış olabilir). "
            "Telefonu düz tutup turuncu alanı çerçeveye hizalayarak yeniden deneyin."
        )

    reads: List[Any] = []
    row_debug: list[dict[str, Any]] = []
    multi_variant = _env_flag_true("OPTICAL_TR_COL_MULTI_VARIANT_READ", False)

    for row in range(rows):
        expected_cy_px, expected_centers_x_px = nominal_row_geometry(row, 0.0, 0.0)
        cy_px, centers_x_px = nominal_row_geometry(row, best_dx, best_dy)
        pre_refine_cy = cy_px
        tail_n = _env_int("OPTICAL_TR_COL_TAIL_ROWS", 3)
        is_tail_row = tail_n > 0 and row >= rows - min(tail_n, rows)
        r_tail_mult = _env_float("OPTICAL_TR_COL_BUBBLE_RADIUS_MULT_TAIL", 1.025)
        radius_row = max(5, int(round(radius * (r_tail_mult if is_tail_row else 1.0))))
        if refine_row_y:
            cy_px = op._refine_narrow_row_cy_max_hybrid_sum(
                binary,
                gray,
                width,
                height,
                centers_x_px,
                cy_px,
                radius_row,
                row_step_px,
                binary_weight=0.46,
                row_index=row,
                question_count=rows,
            )

        # Global dx/dy sonrası varsayılan: tüm şıklar birlikte skor (eski dar sütun davranışı).
        # İnce şık kayması için OPTICAL_TR_COL_BUBBLE_X_SEARCH_PX=4–8 gibi ayarlanabilir.
        x_search = _env_int("OPTICAL_TR_COL_BUBBLE_X_SEARCH_PX", 0)
        x_step = max(1, _env_int("OPTICAL_TR_COL_BUBBLE_X_SEARCH_STEP", 2))
        refined_x = list(centers_x_px)
        row_slack_half = read_slack_half
        if read_use_vertical_slack and is_tail_row:
            row_slack_half = min(
                1.0,
                row_slack_half + _env_float("OPTICAL_TR_COL_TAIL_VERTICAL_SLACK_HALF_ADD", 0.042),
            )
        if read_use_vertical_slack and row >= rows - 1:
            row_slack_half = min(
                row_slack_half,
                _env_float("OPTICAL_TR_COL_LAST_ROW_SLACK_HALF_MAX", 0.38),
            )
        # Son satırda dikey slack, görüntü alt kenarına yakınsa tüm şıkları şişirebiliyor.
        last_row_no_slack = (
            read_use_vertical_slack
            and row >= rows - 1
            and float(cy_px) + float(radius_row) >= float(height) - 3.0
        )

        def _score_cols_for_bin(bin_img: np.ndarray) -> list[float]:
            if read_use_vertical_slack and not last_row_no_slack:
                sc, _ = op._row_scores_from_centers_hybrid_vertical_slack(
                    bin_img,
                    gray,
                    width,
                    height,
                    centers_x_px,
                    cy_px,
                    radius_row,
                    row_step_px,
                    binary_weight=0.46,
                    slack_half_scale=row_slack_half,
                )
            else:
                sc, _ = op._row_scores_from_centers_hybrid(
                    bin_img,
                    gray,
                    width,
                    height,
                    centers_x_px,
                    cy_px,
                    radius_row,
                    binary_weight=0.46,
                )
            return sc

        use_multi = bool(multi_variant and x_search <= 0)
        if use_multi:
            from ml_service.turkish_column_consensus import (
                build_lgs_binary_variants,
                consensus_merge_row_variant_reads,
            )

            variants = build_lgs_binary_variants(gray)
            variant_results: list[
                tuple[str, Any, list[float], dict[str, Any], float, float]
            ] = []
            for vlabel, bimg in variants:
                sc = _score_cols_for_bin(bimg)
                rv, sec, best, det = _row_read_lgs_with_scores(
                    sc, opts, row_index=row, question_count=rows
                )
                variant_results.append((vlabel, rv, sc, det, sec, best))
            pack = [(a, b, c, d) for a, b, c, d, _, _ in variant_results]
            read_m, consensus_meta = consensus_merge_row_variant_reads(pack)
            v0 = variant_results[0]
            prim_read = v0[1]
            second_sc, best_sc = v0[4], v0[5]
            decision_detail = {
                **v0[3],
                "consensus": consensus_meta,
                "primary_variant_label": v0[0],
                "variant_decisions": [
                    {
                        "label": vr[0],
                        "answer": vr[1].answer,
                        "status": vr[1].status,
                        "confidence": round(float(vr[1].confidence), 4),
                        "decision_code": (vr[3] or {}).get("decision_code"),
                        "scores": {o: round(float(s), 4) for o, s in zip(opts, vr[2])},
                    }
                    for vr in variant_results
                ],
            }
            read = op.QuestionRead(
                read_m.answer,
                read_m.status,
                read_m.confidence,
                second_score=prim_read.second_score,
                fill_ratio_best=prim_read.fill_ratio_best,
            )
            score_cols = v0[2]
        elif x_search <= 0:
            score_cols = _score_cols_for_bin(binary)
            read, second_sc, best_sc, decision_detail = _row_read_lgs_with_scores(
                score_cols, opts, row_index=row, question_count=rows
            )
        else:
            score_cols = []
            for j, cx_nom in enumerate(centers_x_px):
                best_v = -1.0
                best_cx = cx_nom
                for ox in range(-x_search, x_search + 1, x_step):
                    cx_try = float(cx_nom + ox)
                    row_x = [float(c) for c in centers_x_px]
                    row_x[j] = cx_try
                    if read_use_vertical_slack and not last_row_no_slack:
                        sc, _ = op._row_scores_from_centers_hybrid_vertical_slack(
                            binary,
                            gray,
                            width,
                            height,
                            row_x,
                            cy_px,
                            radius_row,
                            row_step_px,
                            binary_weight=0.46,
                            slack_half_scale=row_slack_half,
                        )
                    else:
                        sc, _ = op._row_scores_from_centers_hybrid(
                            binary,
                            gray,
                            width,
                            height,
                            row_x,
                            cy_px,
                            radius_row,
                            binary_weight=0.46,
                        )
                    v = float(sc[j]) if j < len(sc) else 0.0
                    if v > best_v:
                        best_v = v
                        best_cx = cx_try
                refined_x[j] = best_cx
                score_cols.append(best_v)

            read, second_sc, best_sc, decision_detail = _row_read_lgs_with_scores(
                score_cols, opts, row_index=row, question_count=rows
            )

        reads.append(read)
        st_low = (read.status or "").strip().lower()
        is_ambiguous = st_low == "ambiguous"
        per_opt = []
        for j, letter in enumerate(opts):
            per_opt.append(
                {
                    "option": letter,
                    "expected_center_x_px": round(float(expected_centers_x_px[j]), 2),
                    "expected_center_y_px": round(float(expected_cy_px), 2),
                    "aligned_center_x_px": round(float(refined_x[j]), 2),
                    "aligned_center_y_px": round(float(cy_px), 2),
                    "delta_x_px": round(float(refined_x[j] - expected_centers_x_px[j]), 4),
                    "delta_y_px_row": round(float(cy_px - expected_cy_px), 4),
                }
            )

        row_debug.append(
            {
                "question_index": row + 1,
                "row": row + 1,
                "cy_px": round(cy_px, 2),
                "pre_refine_cy_px": round(float(pre_refine_cy), 2),
                "expected_cy_px": round(float(expected_cy_px), 2),
                "expected_centers_x_px": [round(float(x), 2) for x in expected_centers_x_px],
                "centers_x_px": [round(v, 2) for v in refined_x],
                "aligned_centers_x_px": [round(float(x), 2) for x in refined_x],
                "aligned_center_y_px": round(float(cy_px), 2),
                "delta_y_px": round(float(cy_px - expected_cy_px), 4),
                "per_option_geometry": per_opt,
                "radius_px": radius_row,
                "tail_row_band": is_tail_row,
                "options": list(opts),
                "scores": {o: round(float(s), 4) for o, s in zip(opts, score_cols)},
                "raw_scores": {o: round(float(s), 4) for o, s in zip(opts, score_cols)},
                "selected_option": (read.answer or "").strip().upper(),
                "predicted": read.answer,
                "confidence": round(float(read.confidence), 4),
                "second_score": round(float(second_sc), 4),
                "fill_ratio_best": round(
                    float(read.fill_ratio_best if read.fill_ratio_best is not None else best_sc),
                    4,
                ),
                "is_ambiguous": is_ambiguous,
                "status": read.status,
                "decision_detail": decision_detail,
            }
        )

    while len(reads) < question_count:
        from ml_service.api.routes.optical_scan import QuestionRead

        reads.append(QuestionRead("", "empty", 0.0))

    ok_reads = [r for r in reads[:question_count] if (r.status or "").lower() == "ok"]
    conf_mean = (
        float(sum(r.confidence for r in ok_reads) / len(ok_reads)) if ok_reads else 0.0
    )
    amb_count = sum(1 for r in reads[:question_count] if (r.status or "").lower() == "ambiguous")

    from ml_service.turkish_column_consensus import compute_form_reliability_summary

    reliability = compute_form_reliability_summary(
        reads[:question_count],
        row_debug,
        question_count=question_count,
    )

    meta = {
        "turkish_column": {
            "alignment": {
                "dx_px": round(best_dx, 2),
                "dy_px": round(best_dy, 2),
                "alignment_score": round(alignment_score, 4),
                "grid_objective_best": round(best_s, 4),
                "grid_objective_second": round(second_s, 4),
                "snap_to_origin_applied": snap_applied,
                "probe_row_indices": probe_row_indices,
                "probe_row_count": len(probe_row_indices),
                **({"peak_analysis": peak_meta_extras} if peak_meta_extras else {}),
            },
            "confidence_mean": round(conf_mean, 4),
            "ambiguous_count": amb_count,
            "reader": "opencv_grid_align",
            "row_step_px_nominal": round(row_step_px, 3),
            "row_debug_align": row_debug,
            "drift_summary": compute_turkish_row_drift_summary(row_debug),
            "reliability": reliability,
            "multi_variant_read_enabled": bool(multi_variant),
        },
    }
    return reads[:question_count], meta


def render_debug_grid_overlay(
    crop_bgr: np.ndarray,
    row_debug: list[dict[str, Any]],
) -> np.ndarray:
    """
    Grid: satır çizgisi, A–E merkezleri, seçilen şık vurgusu, ham skor etiketleri.
    """
    import cv2

    h, w = crop_bgr.shape[:2]
    out = crop_bgr.copy()
    for row in row_debug:
        cy = int(round(float(row["cy_px"])))
        radius = int(row["radius_px"])
        predicted = (row.get("selected_option") or row.get("predicted") or "").strip().upper()
        opt_labels: list[str] = row.get("options") or ["A", "B", "C", "D"]
        scores_map: dict[str, float] = row.get("scores") or row.get("raw_scores") or {}
        cv2.line(out, (max(0, 2), cy), (min(w - 1, w - 2), cy), (180, 180, 180), 1, cv2.LINE_AA)

        cx_list = row.get("centers_x_px") or row.get("aligned_centers_x_px") or []
        for idx, cx_val in enumerate(cx_list):
            cx = int(round(float(cx_val)))
            opt = opt_labels[idx] if idx < len(opt_labels) else "?"
            sc = float(scores_map.get(opt, 0.0))
            is_sel = predicted == opt and predicted != ""
            color = (255, 0, 255) if is_sel else (0, 165, 255)
            thickness = 3 if is_sel else 2
            cv2.circle(out, (cx, cy), radius, color, thickness)
            cv2.putText(
                out,
                opt,
                (cx - 6, max(14, cy - radius - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.42,
                color,
                1,
                cv2.LINE_AA,
            )
            score_txt = f"{sc:.2f}"
            cv2.putText(
                out,
                score_txt,
                (cx - 14, min(h - 4, cy + radius + 12)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.32,
                (220, 220, 100),
                1,
                cv2.LINE_AA,
            )
        qn = row.get("question_index", row.get("row", "?"))
        cv2.putText(
            out,
            f"Q{qn}",
            (8, max(16, cy + 6)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (255, 40, 40),
            1,
            cv2.LINE_AA,
        )
    return out


def build_turkish_diagnosis_narrative(drift: dict[str, Any], alignment: dict[str, Any]) -> dict[str, str]:
    """Ground truth olmadan olası nedenler ve tek satırlık öneri (teşhis özeti)."""
    hints = (drift or {}).get("interpretation_hints") or {}
    slope = float((drift or {}).get("delta_y_linear_drift_px_per_row") or 0.0)
    probe_n = alignment.get("probe_row_count", "?")
    snap = alignment.get("snap_to_origin_applied", False)

    c1 = (
        "Hizalama amacı (satır marj toplamı) bazen yanlış (dx,dy) tepesini seçiyor; plato "
        f"(OPTICAL_TR_COL_ALIGN_PLATEAU_TAU) içinde en küçük kayma normu tercih ediliyor "
        f"(probe satır sayısı={probe_n})."
    )
    c2 = (
        "Dikey slack komşu satır mürekkebini karıştırıyor; marj düşük satırlarda yanlış şık seçiliyor "
        f"(düşük marj satırları: {len((drift or {}).get('rows_with_low_margin') or [])})."
    )
    c3 = (
        "Alt satırlar için _turkish_narrow_lower_rows_y_correction_px ile mm modeli gerçek baskıdan "
        "sapıyor; delta_y eğilimi: "
        f"{slope:.4f} px/soru."
    )

    most_likely = c1
    if hints.get("vertical_drift_suspected"):
        most_likely = (
            "Satır indeksine göre delta_y doğrusal eğilim belirgin; şablon satır adımı veya "
            "alt-satır Y düzeltmesi gerçek forma uymuyor olabilir."
        )
    elif hints.get("ambiguous_margin_suspected"):
        most_likely = c2
    elif snap:
        most_likely = (
            "(0,0) snap gerçek fotoğrafta küçük ama gerekli (dx,dy) kaymasını sıfırlamış olabilir."
        )

    fix = (
        "Plato tau / SNAP_EPS ile dengeleyin; son satırda kenar etkisinde "
        "OPTICAL_TR_COL_LAST_ROW_SLACK_HALF_MAX veya mm env ince ayarı."
    )

    return {
        "root_cause_candidate_1": c1,
        "root_cause_candidate_2": c2,
        "root_cause_candidate_3": c3,
        "most_likely_reason": most_likely,
        "recommended_minimum_fix": fix,
    }
