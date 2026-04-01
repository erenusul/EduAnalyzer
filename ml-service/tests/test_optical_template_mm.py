import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pytest

from ml_service.optical_template_mm import (
    clear_template_cache,
    get_sozel_template_mm,
    get_turkish_column_crop_template_mm,
)


def teardown_module() -> None:
    for key in list(os.environ.keys()):
        if key.startswith("OPTICAL_SOZEL_") or key.startswith("OPTICAL_LGS_") or key.startswith(
            "OPTICAL_TR_COL_"
        ):
            del os.environ[key]
    clear_template_cache()


def test_sozel_defaults_equal_column_widths_sum_to_page() -> None:
    clear_template_cache()
    tm = get_sozel_template_mm()
    assert tm.page_w_mm == pytest.approx(117.0)
    assert sum(tm.column_widths_mm) == pytest.approx(tm.page_w_mm, abs=0.01)
    assert tm.column_left_mm(0) == pytest.approx(0.0)
    assert tm.column_left_mm(1) == pytest.approx(tm.column_widths_mm[0])


def test_sozel_custom_column_widths_scaled_to_page_w() -> None:
    clear_template_cache()
    os.environ["OPTICAL_SOZEL_PAGE_W_MM"] = "117.0"
    os.environ["OPTICAL_SOZEL_COLUMN_WIDTHS_MM"] = "30,30,30,27"
    clear_template_cache()
    tm = get_sozel_template_mm()
    assert sum(tm.column_widths_mm) == pytest.approx(117.0, abs=0.02)
    assert len(tm.column_widths_mm) == 4
    del os.environ["OPTICAL_SOZEL_PAGE_W_MM"]
    del os.environ["OPTICAL_SOZEL_COLUMN_WIDTHS_MM"]
    clear_template_cache()


def test_turkish_column_crop_defaults() -> None:
    clear_template_cache()
    tm = get_turkish_column_crop_template_mm()
    assert tm.page_w_mm == pytest.approx(26.0)
    assert tm.page_h_mm == pytest.approx(91.0)
    assert tm.q1_a_cx_mm == pytest.approx(6.0)
    assert tm.q1_a_cy_mm == pytest.approx(11.0)
    assert tm.ad_centers_span_mm == pytest.approx(13.0)
    assert tm.q1_q20_centers_span_mm == pytest.approx(80.0)
