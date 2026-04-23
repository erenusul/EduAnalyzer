"""
Küçük CNN + 8 çıkış (köşe normalize [0,1]); sigmoid ile sınırlı.
"""

from __future__ import annotations

import torch
import torch.nn as nn


class TinyCornerCNN(nn.Module):
    """
    Girdi: N x 3 x H x W (RGB, [0,1]).
    Çıktı: N x 8 (sigmoid) — [TLx,TLy, TRx,TRy, BRx,BRy, BLx,BLy] ∈ [0,1].
    """

    def __init__(self, input_height: int = 256, input_width: int = 256) -> None:
        super().__init__()
        self._h = input_height
        self._w = input_width
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d((4, 4)),
        )
        flat = 128 * 4 * 4
        self.head = nn.Sequential(
            nn.Flatten(),
            nn.Linear(flat, 256),
            nn.ReLU(inplace=True),
            nn.Linear(256, 8),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        z = self.features(x)
        return self.head(z)


def build_model(
    input_size: tuple[int, int] = (256, 256),
) -> TinyCornerCNN:
    h, w = input_size[1], input_size[0]
    return TinyCornerCNN(input_height=h, input_width=w)
