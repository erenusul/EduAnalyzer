"""
Perspektif warp ve köşe çizimi — OMR öncesi geometri doğrulama için.
Köşe sırası: TL, TR, BR, BL (OpenCV getPerspectiveTransform ile uyumlu).
"""

from __future__ import annotations

from typing import Tuple

import numpy as np

# Dar sütun ~26×88 mm oranına yakın sabit çıktı (OMR şablonu ile yakın; gerekirce env ile değiştirilebilir)
DEFAULT_CANONICAL_SIZE: Tuple[int, int] = (260, 910)  # (width, height)

# Çok küçük alan: warp neredeyse çizgi/nokta; gri/boş çıktıya yol açabilir.
MIN_QUAD_AREA_PX_WARN = 500.0


def quadrilateral_area_abs_px(corners_tl_tr_br_bl: np.ndarray) -> float:
    """TL→TR→BR→BL sırasıyla shoelace; mutlak alan (piksel²)."""
    p = corners_tl_tr_br_bl.astype(np.float64).reshape(4, 2)
    x = p[:, 0]
    y = p[:, 1]
    signed = 0.5 * np.sum(x * np.roll(y, -1) - y * np.roll(x, -1))
    return float(abs(signed))


def min_edge_length_px(corners_tl_tr_br_bl: np.ndarray) -> float:
    p = corners_tl_tr_br_bl.astype(np.float64).reshape(4, 2)
    d = []
    for i in range(4):
        a = p[i]
        b = p[(i + 1) % 4]
        d.append(float(np.hypot(b[0] - a[0], b[1] - a[1])))
    return min(d) if d else 0.0


def corners_in_image_bounds(
    corners_pixel: np.ndarray, width: int, height: int
) -> tuple[int, int]:
    """Sınırlar içindeki köşe sayısı ve toplam köşe sayısı."""
    p = corners_pixel.reshape(-1, 2)
    n_in = 0
    for x, y in p:
        if 0 <= x < width and 0 <= y < height:
            n_in += 1
    return n_in, len(p)


def log_corner_diagnostics(
    stem: str,
    corners_pixel: np.ndarray,
    *,
    corners_norm: np.ndarray | None = None,
    img_shape: tuple[int, ...] | None = None,
    prefix: str = "[corners]",
) -> None:
    """Terminal: köşe matrisi, sınır, alan, kenar — dejenere warp teşhisi için."""
    p = corners_pixel.astype(np.float64)
    h = w = 0
    if img_shape is not None and len(img_shape) >= 2:
        h, w = int(img_shape[0]), int(img_shape[1])
    print(f"{prefix} stem={stem}")
    print(f"{prefix} corners_pixel (TL,TR,BR,BL):\n{p}")
    if corners_norm is not None:
        cn = corners_norm.astype(np.float64)
        print(
            f"{prefix} corners_norm min/max: "
            f"{cn.min():.4f} / {cn.max():.4f} (beklenen ~[0,1] sigmoid sonrası)"
        )
    if w > 0 and h > 0:
        n_in, n_tot = corners_in_image_bounds(p, w, h)
        print(f"{prefix} image size: {w}x{h}, corners inside bounds: {n_in}/{n_tot}")
    area = quadrilateral_area_abs_px(p)
    elen = min_edge_length_px(p)
    print(f"{prefix} quad_area_abs_px={area:.1f} min_edge_px={elen:.1f}")
    if area < MIN_QUAD_AREA_PX_WARN:
        print(
            f"{prefix} WARN: çok küçük alan — warp çıktısı boş/gri olabilir (dejenere homografi)."
        )
    if elen < 5.0:
        print(f"{prefix} WARN: köşeler birbirine çok yakın (kenar < 5 px).")


def warp_column_to_canonical(
    bgr: np.ndarray,
    corners_pixel_tl_tr_br_bl: np.ndarray,
    out_size: Tuple[int, int] = DEFAULT_CANONICAL_SIZE,
    *,
    border_value: Tuple[int, int, int] = (255, 255, 255),
) -> np.ndarray:
    """
    bgr: H×W×3 uint8.
    corners_pixel_tl_tr_br_bl: (4,2) float — TL, TR, BR, BL orijinal piksel.
    out_size: (out_w, out_h) warp çıktısı.
    """
    import cv2

    src = corners_pixel_tl_tr_br_bl.astype(np.float32)
    if src.shape != (4, 2):
        raise ValueError("corners (4,2) olmalı")
    ow, oh = out_size
    dst = np.array(
        [[0.0, 0.0], [ow - 1.0, 0.0], [ow - 1.0, oh - 1.0], [0.0, oh - 1.0]],
        dtype=np.float32,
    )
    m = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(
        bgr,
        m,
        (ow, oh),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=border_value,
    )


def draw_corners_labeled_overlay(
    bgr: np.ndarray,
    corners_pixel_tl_tr_br_bl: np.ndarray,
    *,
    labels: Tuple[str, ...] = ("TL", "TR", "BR", "BL"),
    circle_radius: int = 10,
    line_thickness: int = 2,
) -> np.ndarray:
    """Köşeleri numaralı/etiketli çokgen + daire ile çizer; kopya döner."""
    import cv2

    out = bgr.copy()
    pts = corners_pixel_tl_tr_br_bl.astype(np.int32)
    poly = pts.reshape(-1, 1, 2)
    cv2.polylines(out, [poly], isClosed=True, color=(0, 200, 0), thickness=line_thickness)
    colors = (
        (0, 0, 255),
        (255, 0, 0),
        (255, 0, 255),
        (0, 128, 255),
    )
    for i, lab in enumerate(labels):
        x, y = int(pts[i, 0]), int(pts[i, 1])
        cv2.circle(out, (x, y), circle_radius, colors[i % len(colors)], -1)
        cv2.putText(
            out,
            lab,
            (x + 8, y - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (40, 40, 40),
            2,
            cv2.LINE_AA,
        )
    return out
