"""
Görüntü → 4 köşe (normalize ve piksel). Sonraki adım: warp helper ile birleştirme.

Warp bağlantısı (OpenCV):
  corners_pixel sırası TL, TR, BR, BL → src_pts (float32)
  hedef dikdörtgen köşeleri (ör. 0,0), (W-1,0), (W-1,H-1), (0,H-1) → dst_pts
  M = cv2.getPerspectiveTransform(src_pts, dst_pts)
  out = cv2.warpPerspective(bgr, M, (W, H))
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
import torch

from ml_service.training.turkish_column_corners.model import TinyCornerCNN, build_model
from ml_service.training.turkish_column_corners.transforms import (
    corners_normalized_to_pixel,
    unflat8,
)


@dataclass(frozen=True)
class CornerPrediction:
    """4 köşe — sıra her zaman TL, TR, BR, BL."""

    corners_norm: np.ndarray  # (4, 2) float64, [0,1]
    corners_pixel: np.ndarray  # (4, 2) float64, verilen orig_w/h için
    orig_width: int
    orig_height: int
    input_size: Tuple[int, int]


class TurkishColumnCornerInference:
    """
    Eğitilmiş ağırlık (state_dict) ile köşe tahmini.
    Ağırlık yoksa forward çağrılmamalı — üst katman fallback kullanır.
    """

    def __init__(
        self,
        *,
        weights_path: Optional[Path | str] = None,
        input_size: Tuple[int, int] = (256, 256),
        device: Optional[str] = None,
    ) -> None:
        self._input_size = input_size
        self._device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self._model: Optional[TinyCornerCNN] = None
        if weights_path is not None:
            p = Path(weights_path)
            if p.is_file():
                self._model = build_model(input_size)
                state = torch.load(p, map_location=self._device)
                self._model.load_state_dict(state)
                self._model.to(self._device)
                self._model.eval()

    @property
    def ready(self) -> bool:
        return self._model is not None

    def predict_bgr(self, bgr: np.ndarray) -> CornerPrediction:
        """
        bgr: H x W x 3 uint8 (OpenCV).
        """
        import cv2

        if self._model is None:
            raise RuntimeError("Model yüklenmedi; weights_path verin veya fallback kullanın.")

        orig_h, orig_w = bgr.shape[:2]
        iw, ih = self._input_size
        resized = cv2.resize(bgr, (iw, ih), interpolation=cv2.INTER_AREA)
        tensor = (
            torch.from_numpy(resized).permute(2, 0, 1).float().unsqueeze(0) / 255.0
        )
        tensor = tensor.to(self._device)

        with torch.no_grad():
            out = self._model(tensor).cpu().numpy().reshape(8)

        corners_norm = unflat8(out)
        corners_px = corners_normalized_to_pixel(
            corners_norm, float(orig_w), float(orig_h)
        )
        return CornerPrediction(
            corners_norm=corners_norm.astype(np.float64),
            corners_pixel=corners_px,
            orig_width=int(orig_w),
            orig_height=int(orig_h),
            input_size=self._input_size,
        )


def corners_to_warp_src_points(corners_pixel_tl_tr_br_bl: np.ndarray) -> np.ndarray:
    """cv2.getPerspectiveTransform için (4,2) float32."""
    pts = corners_pixel_tl_tr_br_bl.astype(np.float32)
    if pts.shape != (4, 2):
        raise ValueError("Beklenen şekil (4,2)")
    return pts
