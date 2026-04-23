"""
Loss ve değerlendirme: normalize uzayda L1 (MAE), isteğe bağlı piksel MAE.
"""

from __future__ import annotations

import numpy as np
import torch
import torch.nn.functional as F


def loss_l1_normalized(pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    """
    pred, target: (N, 8) — [0,1] köşe düz vektörü.
    """
    return F.l1_loss(pred, target)


def loss_smooth_l1_normalized(pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    return F.smooth_l1_loss(pred, target, beta=0.05)


def mean_corner_error_normalized(pred: torch.Tensor, target: torch.Tensor) -> float:
    """Ortalama L1 köşe hatası (normalize koordinat, tek örnek batch için ortalama)."""
    with torch.no_grad():
        return float(F.l1_loss(pred, target).item())


def mean_pixel_error_from_normalized(
    pred_norm: torch.Tensor,
    target_norm: torch.Tensor,
    orig_w: float,
    orig_h: float,
) -> float:
    """
    Köşeleri orijinal piksel uzayına çevirip ortalama piksel L1 hatası (tek batch ortalaması).
    pred_norm, target_norm: (N,8) veya (8,).
    """
    p = pred_norm.detach().cpu().numpy().reshape(-1, 4, 2)
    t = target_norm.detach().cpu().numpy().reshape(-1, 4, 2)
    p_px = p.copy()
    t_px = t.copy()
    p_px[:, :, 0] *= orig_w
    p_px[:, :, 1] *= orig_h
    t_px[:, :, 0] *= orig_w
    t_px[:, :, 1] *= orig_h
    return float(np.mean(np.abs(p_px - t_px)))
