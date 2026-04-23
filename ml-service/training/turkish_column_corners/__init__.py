"""
Türkçe sütun 4 köşe regresyonu — MVP eğitim ve inference iskeleti.

optical_scan entegrasyonu yok; yalnızca veri/model/inference sözleşmesi.

Not: Ağır bağımlılıklar (torch) alt modül import edilene kadar yüklenmez;
etiketleme aracı (`label_ui`) torch gerektirmez.
"""

from __future__ import annotations

from typing import Any

__all__ = ["CornerPrediction", "TurkishColumnCornerInference"]


def __getattr__(name: str) -> Any:
    if name in __all__:
        from ml_service.training.turkish_column_corners import inference

        return getattr(inference, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
