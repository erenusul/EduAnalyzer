"""
Optik şablon mm modeli — gerçek baskı/PDF ile hizalamak için.

Ölçüm (PDF veya fiziksel form):
- Görüntünün sol üst köşesi (0,0); X sağa, Y aşağı (mm).
- 1. sütun, 1. sorunun A şıkkı daire merkezi: (q1_a_cx_col0_mm, q1_a_cy_mm).
- A ile D merkezleri arası mesafe → ad_centers_span_mm (4 şık için 3 aralık bölünür).
- Aynı sütunda 1. ile 20. soru A merkezleri arası dikey mesafe → q1_q20_centers_span_mm;
  satır adımı = bu değer / 19.
- Sayfa genişlik/yüksekliği: kadrajın kapladığı dikdörtgen (SÖZEL için hedef 117×107 mm).

Kalibrasyon: aşağıdaki OPTICAL_* ortam değişkenlerini .env veya servis ortamında ayarlayın;
kod değiştirmeden yeniden başlatmak yeterli.

Türkçe tek sütun kırpıntısı (lgs_turkish_column_crop): OPTICAL_TR_COL_* değişkenleri.

Örnek (docker / shell):
  export OPTICAL_SOZEL_GRID_OFFSET_X_MM=-0.4
  export OPTICAL_SOZEL_GRID_OFFSET_Y_MM=0.2
  export OPTICAL_SOZEL_COLUMN_WIDTHS_MM=29.0,29.5,29.0,29.5
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Sequence


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    return float(str(raw).strip())


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    return int(str(raw).strip(), 10)


def _parse_column_widths_mm(raw: str | None, page_w_mm: float, column_count: int) -> list[float]:
    """
    Virgülle ayrılmış sütun genişlikleri (mm). Boşsa eşit bölünür.
    """
    if raw is None or not str(raw).strip():
        w = page_w_mm / float(column_count)
        return [w] * column_count
    parts = [float(x.strip()) for x in str(raw).split(",") if x.strip()]
    if len(parts) != column_count:
        raise ValueError(
            f"OPTICAL_SOZEL_COLUMN_WIDTHS_MM: {len(parts)} değer beklenen sütun sayısı {column_count} ile uyuşmuyor."
        )
    return parts


@dataclass(frozen=True)
class SozelTemplateMm:
    page_w_mm: float
    page_h_mm: float
    q1_a_cx_col0_mm: float
    q1_a_cy_mm: float
    ad_centers_span_mm: float
    q1_q20_centers_span_mm: float
    column_count: int
    rows_per_column: int
    grid_offset_x_mm: float
    grid_offset_y_mm: float
    bubble_radius_scale: float
    column_widths_mm: tuple[float, ...]

    @property
    def max_questions(self) -> int:
        return self.column_count * self.rows_per_column

    def column_left_mm(self, col_index: int) -> float:
        return float(sum(self.column_widths_mm[:col_index]))


@dataclass(frozen=True)
class LgsTurkishTemplateMm:
    page_w_mm: float
    page_h_mm: float
    q1_a_cx_mm: float
    q1_a_cy_mm: float
    ad_centers_span_mm: float
    q1_q20_centers_span_mm: float
    grid_offset_x_mm: float
    grid_offset_y_mm: float


@dataclass(frozen=True)
class TurkishColumnCropTemplateMm:
    """
    Yalnızca TÜRKÇE sütunu kırpıntısı (dar kadraj; turuncu/pembe blok).
    `ad_centers_span_mm`: A ile D daire merkezleri arası mesafe (mm). Şık adımı = span/3;
    5 şık (A–E) için aynı adım kullanılır (E, D’nin bir adım ötesi). OPTICAL_TR_COL_* ile kalibre.
    Q1 A merkezi (6, 11) mm; Q1–Q20 A merkezleri dikey 80 mm.
    """

    page_w_mm: float
    page_h_mm: float
    q1_a_cx_mm: float
    q1_a_cy_mm: float
    ad_centers_span_mm: float
    q1_q20_centers_span_mm: float
    grid_offset_x_mm: float
    grid_offset_y_mm: float
    bubble_radius_scale: float


@lru_cache(maxsize=1)
def get_sozel_template_mm() -> SozelTemplateMm:
    page_w = _env_float("OPTICAL_SOZEL_PAGE_W_MM", 117.0)
    page_h = _env_float("OPTICAL_SOZEL_PAGE_H_MM", 107.0)
    col_n = _env_int("OPTICAL_SOZEL_COLUMN_COUNT", 4)
    row_n = _env_int("OPTICAL_SOZEL_ROWS_PER_COLUMN", 20)
    widths = tuple(
        _parse_column_widths_mm(os.environ.get("OPTICAL_SOZEL_COLUMN_WIDTHS_MM"), page_w, col_n)
    )
    s = sum(widths)
    if abs(s - page_w) > 0.05:
        # Uyarı: model sayfa genişliği ile sütun toplamı çakışsın diye ölçekle
        scale = page_w / s
        widths = tuple(w * scale for w in widths)

    return SozelTemplateMm(
        page_w_mm=page_w,
        page_h_mm=page_h,
        q1_a_cx_col0_mm=_env_float("OPTICAL_SOZEL_Q1_A_CX_COL0_MM", 11.0),
        q1_a_cy_mm=_env_float("OPTICAL_SOZEL_Q1_A_CY_MM", 21.0),
        ad_centers_span_mm=_env_float("OPTICAL_SOZEL_AD_CENTERS_SPAN_MM", 15.0),
        q1_q20_centers_span_mm=_env_float("OPTICAL_SOZEL_Q1_Q20_CENTERS_SPAN_MM", 84.0),
        column_count=col_n,
        rows_per_column=row_n,
        grid_offset_x_mm=_env_float("OPTICAL_SOZEL_GRID_OFFSET_X_MM", 0.0),
        grid_offset_y_mm=_env_float("OPTICAL_SOZEL_GRID_OFFSET_Y_MM", 0.0),
        bubble_radius_scale=_env_float("OPTICAL_SOZEL_BUBBLE_RADIUS_SCALE", 0.50),
        column_widths_mm=widths,
    )


@lru_cache(maxsize=1)
def get_lgs_turkish_template_mm() -> LgsTurkishTemplateMm:
    return LgsTurkishTemplateMm(
        page_w_mm=_env_float("OPTICAL_LGS_PAGE_W_MM", 212.0),
        page_h_mm=_env_float("OPTICAL_LGS_PAGE_H_MM", 300.0),
        q1_a_cx_mm=_env_float("OPTICAL_LGS_Q1_A_CX_MM", 27.0),
        q1_a_cy_mm=_env_float("OPTICAL_LGS_Q1_A_CY_MM", 194.0),
        ad_centers_span_mm=_env_float("OPTICAL_LGS_AD_CENTERS_SPAN_MM", 15.0),
        q1_q20_centers_span_mm=_env_float("OPTICAL_LGS_Q1_Q20_CENTERS_SPAN_MM", 85.0),
        grid_offset_x_mm=_env_float("OPTICAL_LGS_GRID_OFFSET_X_MM", 0.0),
        grid_offset_y_mm=_env_float("OPTICAL_LGS_GRID_OFFSET_Y_MM", 0.0),
    )


@lru_cache(maxsize=1)
def get_turkish_column_crop_template_mm() -> TurkishColumnCropTemplateMm:
    """Tek sütun kırpıntısı — OPTICAL_TR_COL_* ile kalibre edilir."""
    page_w = _env_float("OPTICAL_TR_COL_PAGE_W_MM", 25.5)
    page_h = _env_float("OPTICAL_TR_COL_PAGE_H_MM", 85.0)
    return TurkishColumnCropTemplateMm(
        page_w_mm=page_w,
        page_h_mm=page_h,
        q1_a_cx_mm=_env_float("OPTICAL_TR_COL_Q1_A_CX_MM", 5.5),
        q1_a_cy_mm=_env_float("OPTICAL_TR_COL_Q1_A_CY_MM", 10.5),
        ad_centers_span_mm=_env_float("OPTICAL_TR_COL_AD_CENTERS_SPAN_MM", 13.0),
        q1_q20_centers_span_mm=_env_float("OPTICAL_TR_COL_Q1_Q20_CENTERS_SPAN_MM", 74.0),
        grid_offset_x_mm=_env_float("OPTICAL_TR_COL_GRID_OFFSET_X_MM", -0.1),
        grid_offset_y_mm=_env_float("OPTICAL_TR_COL_GRID_OFFSET_Y_MM", -0.2),
        bubble_radius_scale=_env_float("OPTICAL_TR_COL_BUBBLE_RADIUS_SCALE", 0.40),
    )


def clear_template_cache() -> None:
    """Testlerde ortam değişince cache sıfırlamak için."""
    get_sozel_template_mm.cache_clear()
    get_lgs_turkish_template_mm.cache_clear()
    get_turkish_column_crop_template_mm.cache_clear()
