"""
Resize / normalize ve köşe koordinat dönüşümleri.

Augmentasyon: MVP iskeletinde yalnızca hafif seçenekler (uygulama train_skeleton'ta).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

import numpy as np


@dataclass(frozen=True)
class ImageGeometry:
    orig_w: int
    orig_h: int
    input_w: int
    input_h: int


def corners_pixel_to_normalized(
    corners_xy: np.ndarray,
    width: float,
    height: float,
) -> np.ndarray:
    """
    corners_xy: (4, 2) float, [x,y] piksel.
    Dönüş: (4, 2) normalize [0,1] — payda orijinal genişlik/yükseklik.
    """
    out = corners_xy.astype(np.float64).copy()
    out[:, 0] /= float(width)
    out[:, 1] /= float(height)
    return np.clip(out, 0.0, 1.0)


def corners_normalized_to_pixel(
    corners_norm: np.ndarray,
    width: float,
    height: float,
) -> np.ndarray:
    """(4,2) norm [0,1] → piksel."""
    out = corners_norm.astype(np.float64).copy()
    out[:, 0] *= float(width)
    out[:, 1] *= float(height)
    return out


def resize_corners_with_image(
    corners_xy: np.ndarray,
    geom: ImageGeometry,
) -> np.ndarray:
    """
    Orijinal piksel köşeleri, input_w x input_h boyutuna ölçeklenmiş görüntü uzayına çevirir,
    ardından [0,1] normalize eder (model hedefi).
    """
    sx = geom.input_w / float(max(geom.orig_w, 1))
    sy = geom.input_h / float(max(geom.orig_h, 1))
    scaled = corners_xy.astype(np.float64).copy()
    scaled[:, 0] *= sx
    scaled[:, 1] *= sy
    return corners_pixel_to_normalized(scaled, geom.input_w, geom.input_h)


def flip_horizontal_corners(norm_xy: np.ndarray) -> np.ndarray:
    """Yatay çevirme: TL↔TR, BL↔BR; x' = 1 - x."""
    out = norm_xy.copy()
    out[:, 0] = 1.0 - out[:, 0]
    return out[[1, 0, 3, 2], :]


def augment_light(
    norm_xy: np.ndarray,
    *,
    hflip: bool = False,
    noise_std: float = 0.0,
) -> np.ndarray:
    """Basit augment (MVP)."""
    x = norm_xy.copy()
    if hflip:
        x = flip_horizontal_corners(x)
    if noise_std > 0:
        x += np.random.randn(*x.shape).astype(np.float64) * noise_std
    return np.clip(x, 0.0, 1.0)


def flat8(norm_xy: np.ndarray) -> np.ndarray:
    """(4,2) → (8,) sıra TL,TR,BR,BL — [x0,y0,x1,y1,...]."""
    return norm_xy.reshape(8).astype(np.float32)


def unflat8(flat: np.ndarray) -> np.ndarray:
    """(8,) → (4,2)."""
    return flat.reshape(4, 2).astype(np.float32)
