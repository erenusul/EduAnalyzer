"""
Dar Türkçe sütun (lgs_turkish_column_crop): isteğe bağlı AI köşe tahmini + kanonik warp.

Klasik okuyucu aynı kalır; bu modül yalnızca giriş BGR'yi (crop/deskew sonrası) düzeltmeyi dener.
Başarısızlıkta orijinal görüntü döner — optical_scan içinde sessiz fallback.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import numpy as np

# ml-service kökü (api/, training/ ile aynı dizin)
_ML_SERVICE_ROOT = Path(__file__).resolve().parent

_infer = None
_infer_weights_resolved: str | None = None


def _env_flag(name: str) -> bool:
    v = (os.environ.get(name) or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def _env_float(name: str, default: float) -> float:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _default_weights_path() -> Path:
    override = (os.environ.get("OPTICAL_TR_COL_AI_WEIGHTS") or "").strip()
    if override:
        p = Path(override)
        if p.is_file():
            return p.resolve()
        if not p.is_absolute():
            cand = (_ML_SERVICE_ROOT / p).resolve()
            if cand.is_file():
                return cand
        return p.resolve()
    return (_ML_SERVICE_ROOT / "runs" / "turkish_column_corners" / "corner_mvp.pt").resolve()


def _get_inference(weights_path: Path):
    """Tekil yükleme; ağırlık yolu değişirse yeniden yüklenir."""
    global _infer, _infer_weights_resolved
    from ml_service.training.turkish_column_corners.inference import TurkishColumnCornerInference

    key = str(weights_path.resolve())
    if _infer is not None and _infer_weights_resolved == key:
        return _infer
    inf = TurkishColumnCornerInference(weights_path=weights_path)
    _infer = inf if inf.ready else None
    _infer_weights_resolved = key if inf.ready else None
    return _infer


def maybe_apply_turkish_column_ai_warp(bgr: np.ndarray) -> tuple[np.ndarray, dict[str, Any]]:
    """
    OPTICAL_TR_COL_AI_ALIGN=1 ise köşe tahmini + kanonik warp uygular.

    Dönüş: (bgr_okuma_icin, meta). meta anahtarları scan_metadata.ai_align ile birleştirilir.
    """
    meta: dict[str, Any] = {
        "ai_align_requested": True,
        "ai_align_applied": False,
        "ai_align_fallback_reason": None,
        "ai_align_quad_area_px": None,
        "ai_align_weights_path": None,
    }

    if bgr is None or bgr.size == 0 or bgr.ndim != 3 or bgr.shape[2] != 3:
        meta["ai_align_fallback_reason"] = "invalid_bgr"
        return bgr, meta

    if not _env_flag("OPTICAL_TR_COL_AI_ALIGN"):
        meta["ai_align_requested"] = False
        return bgr, {}

    weights = _default_weights_path()
    meta["ai_align_weights_path"] = str(weights)
    if not weights.is_file():
        meta["ai_align_fallback_reason"] = "weights_missing_or_unreadable"
        return bgr, meta

    try:
        infer = _get_inference(weights)
    except Exception as exc:
        meta["ai_align_fallback_reason"] = f"inference_load_error:{type(exc).__name__}"
        return bgr, meta

    if infer is None or not infer.ready:
        meta["ai_align_fallback_reason"] = "inference_not_ready"
        return bgr, meta

    from ml_service.training.turkish_column_corners.warp_helper import (
        DEFAULT_CANONICAL_SIZE,
        quadrilateral_area_abs_px,
        corners_in_image_bounds,
        min_edge_length_px,
        warp_column_to_canonical,
    )

    h_img, w_img = int(bgr.shape[0]), int(bgr.shape[1])
    min_area = _env_float("OPTICAL_TR_COL_AI_MIN_QUAD_AREA_PX", 500.0)
    min_edge = _env_float("OPTICAL_TR_COL_AI_MIN_EDGE_PX", 8.0)
    margin = _env_float("OPTICAL_TR_COL_AI_BOUNDS_MARGIN_PX", 0.0)
    min_warp_std = _env_float("OPTICAL_TR_COL_AI_MIN_WARP_GRAY_STD", 2.0)

    try:
        pred = infer.predict_bgr(bgr)
        corners_px = pred.corners_pixel.astype(np.float64)
    except Exception as exc:
        meta["ai_align_fallback_reason"] = f"predict_error:{type(exc).__name__}"
        return bgr, meta

    if corners_px.shape != (4, 2) or not np.all(np.isfinite(corners_px)):
        meta["ai_align_fallback_reason"] = "invalid_corners_shape_or_nan"
        return bgr, meta

    lo_x = -margin
    lo_y = -margin
    hi_x = w_img - 1.0 + margin
    hi_y = h_img - 1.0 + margin
    for i in range(4):
        x, y = float(corners_px[i, 0]), float(corners_px[i, 1])
        if x < lo_x or x > hi_x or y < lo_y or y > hi_y:
            meta["ai_align_fallback_reason"] = "corner_out_of_bounds"
            meta["ai_align_quad_area_px"] = float(quadrilateral_area_abs_px(corners_px))
            return bgr, meta

    n_in, n_tot = corners_in_image_bounds(corners_px, w_img, h_img)
    if n_in < 4:
        meta["ai_align_fallback_reason"] = "corner_not_fully_inside_image"
        meta["ai_align_quad_area_px"] = float(quadrilateral_area_abs_px(corners_px))
        return bgr, meta

    area = float(quadrilateral_area_abs_px(corners_px))
    meta["ai_align_quad_area_px"] = area
    if area < min_area:
        meta["ai_align_fallback_reason"] = "quad_area_too_small"
        return bgr, meta

    elen = min_edge_length_px(corners_px)
    if elen < min_edge:
        meta["ai_align_fallback_reason"] = "min_edge_too_small"
        return bgr, meta

    try:
        import cv2

        warped = warp_column_to_canonical(
            bgr,
            corners_px,
            out_size=DEFAULT_CANONICAL_SIZE,
        )
    except Exception as exc:
        meta["ai_align_fallback_reason"] = f"warp_error:{type(exc).__name__}"
        return bgr, meta

    if warped is None or warped.size == 0:
        meta["ai_align_fallback_reason"] = "empty_warp_output"
        return bgr, meta

    gray_w = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    std = float(gray_w.std())
    if std < min_warp_std:
        meta["ai_align_fallback_reason"] = f"warp_too_flat_std={std:.3f}"
        return bgr, meta

    meta["ai_align_applied"] = True
    meta["ai_align_fallback_reason"] = None
    return warped, meta
