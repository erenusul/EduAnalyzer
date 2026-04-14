import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import cv2
import numpy as np
import pytest

from ml_service.api.routes.optical_scan import (
    QuestionRead,
    TEMPLATE_LGS_SOZEL_CROP_117X107,
    TEMPLATE_LGS_TURKISH_212X300,
    TEMPLATE_LGS_TURKISH_COLUMN_CROP,
    OpticalScanRejected,
    _detect_answers_from_image,
    _looks_like_collapsed_single_option,
)


def _build_synthetic_optical_form(
    answers: list[str],
    width: int = 900,
    height: int = 1400,
    option_count: int = 5,
    use_perspective_warp: bool = True,
) -> bytes:
    image = np.full((height, width), 255, dtype=np.uint8)

    marker_size = 70
    margin = 35
    markers = [
        (margin, margin),
        (width - margin - marker_size, margin),
        (width - margin - marker_size, height - margin - marker_size),
        (margin, height - margin - marker_size),
    ]

    for x, y in markers:
        cv2.rectangle(image, (x, y), (x + marker_size, y + marker_size), 0, -1)

    grid_left = int(width * 0.16)
    grid_right = int(width * 0.84)
    grid_top = int(height * 0.17)
    grid_bottom = int(height * 0.90)
    rows = len(answers)
    cols = option_count

    row_height = (grid_bottom - grid_top) / rows
    col_width = (grid_right - grid_left) / cols

    options = ["A", "B", "C", "D", "E"][:option_count]

    for row_index, selected in enumerate(answers):
        for col_index, option in enumerate(options):
            center_x = int(grid_left + (col_index + 0.5) * col_width)
            center_y = int(grid_top + (row_index + 0.5) * row_height)
            radius = max(10, int(min(col_width, row_height) * 0.23))
            cv2.circle(image, (center_x, center_y), radius, 0, 3)

            if selected == option:
                fill_radius = max(8, radius - 3)
                cv2.circle(image, (center_x, center_y), fill_radius, 0, -1)

    if use_perspective_warp:
        source = np.float32(
            [
                [0, 0],
                [width - 1, 0],
                [width - 1, height - 1],
                [0, height - 1],
            ]
        )
        destination = np.float32(
            [
                [40, 20],
                [width - 40, 0],
                [width - 10, height - 25],
                [20, height - 5],
            ]
        )
        transform = cv2.getPerspectiveTransform(source, destination)
        image = cv2.warpPerspective(image, transform, (width, height), borderValue=255)

    success, encoded = cv2.imencode(".png", image)
    assert success
    return encoded.tobytes()


def test_optical_scan_detects_answers_with_markers_and_perspective():
    answers = ["A", "C", "E", "B", "", "D", "A", "E"]
    image_bytes = _build_synthetic_optical_form(answers)

    result = _detect_answers_from_image(image_bytes, question_count=len(answers))

    assert result.answers == answers
    assert result.markers_detected is True
    assert result.perspective_ok is True


def test_black_image_rejected_no_fake_scores():
    """Siyah/düz görüntüde gürültüden sahte işaret üretilmesin."""
    black = np.zeros((800, 600), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", black, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    assert ok
    with pytest.raises(OpticalScanRejected):
        _detect_answers_from_image(buf.tobytes(), question_count=20, option_count=5)


def test_optical_scan_detects_answers_4_options_turkce():
    """4 şık (A-D) Türkçe formu için optik okuma testi."""
    answers = ["A", "C", "B", "", "D", "A", "B", "C"]
    image_bytes = _build_synthetic_optical_form(
        answers, option_count=4, use_perspective_warp=False
    )

    result = _detect_answers_from_image(
        image_bytes, question_count=len(answers), option_count=4
    )

    assert result.answers == answers


def _build_lgs_turkish_212x300_synthetic(answers: list[str]) -> bytes:
    """212×300 mm sayfayı 4 px/mm ile sentetik üret; Türkçe mm şablonuyla uyumlu merkezler."""
    scale = 4.0
    w = int(212 * scale)
    h = int(300 * scale)
    image = np.full((h, w), 255, dtype=np.uint8)
    option_step_mm = 5.0
    row_step_mm = 85.0 / 19.0
    opts = ["A", "B", "C", "D"]

    for row, selected in enumerate(answers):
        cy = (194.0 + row * row_step_mm) * scale
        for col, letter in enumerate(opts):
            cx = (27.0 + col * option_step_mm) * scale
            radius = max(8.0, min(option_step_mm, row_step_mm) * scale * 0.42)
            r = int(round(radius))
            cxi, cyi = int(round(cx)), int(round(cy))
            cv2.circle(image, (cxi, cyi), r, 0, 2)
            if selected == letter:
                cv2.circle(image, (cxi, cyi), max(4, r - 3), 0, -1)

    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return encoded.tobytes()


def test_lgs_turkish_212x300_template_reads_marked_bubbles():
    answers = ["A", "C", "", "D", "B", "A", "B", "C", "D", "", "A", "B"]
    image_bytes = _build_lgs_turkish_212x300_synthetic(answers)
    result = _detect_answers_from_image(
        image_bytes,
        question_count=len(answers),
        option_count=4,
        template=TEMPLATE_LGS_TURKISH_212X300,
    )
    assert result.answers == answers
    # Köşe karesi yok; kısa kenar >= 560 px ise tam sayfa fallback markers/perspective true sayılır.
    assert result.markers_detected is True
    assert result.perspective_ok is True


def _build_lgs_sozel_117x107_synthetic(answers: list[str]) -> bytes:
    """117×107 mm SÖZEL kırpıntısı; mm şablonuyla uyumlu merkezler (4 sütun × 20 satır sırası)."""
    scale = 4.0
    w = int(117 * scale)
    h = int(107 * scale)
    image = np.full((h, w), 255, dtype=np.uint8)
    option_step_mm = 5.0
    row_step_mm = 84.0 / 19.0
    col_w_mm = 117.0 / 4.0
    opts = ["A", "B", "C", "D"]

    for global_idx, selected in enumerate(answers):
        col = global_idx // 20
        row = global_idx % 20
        q1_a_x = col * col_w_mm + 11.0
        cy = (21.0 + row * row_step_mm) * scale
        for c, letter in enumerate(opts):
            cx = (q1_a_x + c * option_step_mm) * scale
            radius = max(8.0, min(option_step_mm, row_step_mm) * scale * 0.42)
            r = int(round(radius))
            cxi, cyi = int(round(cx)), int(round(cy))
            cv2.circle(image, (cxi, cyi), r, 0, 2)
            if selected == letter:
                cv2.circle(image, (cxi, cyi), max(4, r - 3), 0, -1)

    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return encoded.tobytes()


def test_lgs_sozel_crop_117x107_template_reads_marked_bubbles():
    """İlk sütun + ikinci sütunun ilk iki satırı (22 soru)."""
    answers = (
        ["A", "B", "C", "D", "", "A", "B", "C", "D", "A"] * 2
        + ["B", "C"]
    )
    assert len(answers) == 22
    image_bytes = _build_lgs_sozel_117x107_synthetic(answers)
    result = _detect_answers_from_image(
        image_bytes,
        question_count=len(answers),
        option_count=4,
        template=TEMPLATE_LGS_SOZEL_CROP_117X107,
    )
    assert result.answers == answers
    assert result.perspective_ok is False


def _build_lgs_turkish_column_crop_synthetic(answers: list[str]) -> bytes:
    """Yalnızca TÜRKÇE sütunu (26×91 mm kadraj, pembe blok 26×85) — optical_template_mm varsayılanları."""
    scale = 4.0
    w = int(26.0 * scale)
    h = int(91.0 * scale)
    image = np.full((h, w), 255, dtype=np.uint8)
    option_step_mm = 13.0 / 3.0
    row_step_mm = 80.0 / 19.0
    opts = ["A", "B", "C", "D"]

    for row, selected in enumerate(answers):
        cy = (11.0 + row * row_step_mm) * scale
        for c, letter in enumerate(opts):
            cx = (6.0 + c * option_step_mm) * scale
            radius = max(8.0, min(option_step_mm, row_step_mm) * scale * 0.42)
            r = int(round(radius))
            cxi, cyi = int(round(cx)), int(round(cy))
            cv2.circle(image, (cxi, cyi), r, 0, 2)
            if selected == letter:
                cv2.circle(image, (cxi, cyi), max(4, r - 3), 0, -1)

    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return encoded.tobytes()


def _build_lgs_turkish_left_panel_photo_like_synthetic(answers: list[str]) -> bytes:
    """Gerçek örneğe benzer: turuncu dış kutu + sol 1-20 alanında A-D işaretleri."""
    canvas_w = 768
    canvas_h = 1024
    image = np.full((canvas_h, canvas_w, 3), 255, dtype=np.uint8)
    orange = (80, 165, 235)

    # Sol siyah işaret şeridi
    for i in range(14):
        y = 22 + i * 69
        cv2.rectangle(image, (118, y), (155, y + 16), (40, 40, 40), -1)

    x0, y0, w0, h0 = 227, 85, 541, 818
    cv2.rectangle(image, (x0, y0), (x0 + w0 - 1, y0 + h0 - 1), orange, 2)
    cv2.rectangle(image, (x0, y0 + 78), (x0 + w0 - 1, y0 + 79), orange, -1)
    cv2.rectangle(image, (x0 + 32, y0 + 150), (x0 + 33, y0 + h0 - 1), orange, -1)
    cv2.rectangle(image, (x0 + 240, y0 + 150), (x0 + 241, y0 + h0 - 1), orange, -1)

    centers_x = [
        x0 + int(round(w0 * 0.109)),
        x0 + int(round(w0 * 0.181)),
        x0 + int(round(w0 * 0.247)),
        x0 + int(round(w0 * 0.314)),
    ]
    y_start = y0 + int(round(h0 * 0.175))
    y_end = y0 + int(round(h0 * 0.972))
    row_step = (y_end - y_start) / 19.0
    radius = 15
    opts = ["A", "B", "C", "D"]

    for row, selected in enumerate(answers):
        cy = int(round(y_start + row * row_step))
        for idx, letter in enumerate(opts):
            cx = centers_x[idx]
            cv2.circle(image, (cx, cy), radius, orange, 2)
            if selected == letter:
                cv2.circle(image, (cx, cy), radius - 4, (25, 25, 25), -1)

    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return encoded.tobytes()


def test_lgs_turkish_column_crop_reads_twenty_rows():
    answers = [
        "A",
        "B",
        "C",
        "D",
        "",
        "A",
        "A",
        "A",
        "B",
        "B",
        "C",
        "C",
        "D",
        "D",
        "",
        "",
        "A",
        "B",
        "C",
        "D",
    ]
    assert len(answers) == 20
    image_bytes = _build_lgs_turkish_column_crop_synthetic(answers)
    result = _detect_answers_from_image(
        image_bytes,
        question_count=20,
        option_count=4,
        template=TEMPLATE_LGS_TURKISH_COLUMN_CROP,
    )
    assert result.answers == answers
    assert result.markers_detected is True
    assert result.perspective_ok is True


def test_lgs_turkish_column_crop_reads_left_panel_photo_like_image():
    answers = ["A", "B", "C", "D", "", "A", "B", "", "D", "C", "A", "D", "", "B", "C", "A", "", "D", "C", "B"]
    image_bytes = _build_lgs_turkish_left_panel_photo_like_synthetic(answers)
    result = _detect_answers_from_image(
        image_bytes,
        question_count=len(answers),
        option_count=4,
        template=TEMPLATE_LGS_TURKISH_COLUMN_CROP,
    )

    assert result.answers == answers
    assert result.markers_detected is True
    assert result.perspective_ok is True


def _build_lgs_turkish_column_crop_synthetic_five(answers: list[str]) -> bytes:
    """Dar sütun A–E; adım 13/3 mm (A–D span 13 mm ile uyumlu)."""
    scale = 4.0
    w = int(26.0 * scale)
    h = int(91.0 * scale)
    image = np.full((h, w), 255, dtype=np.uint8)
    option_step_mm = 13.0 / 3.0
    row_step_mm = 80.0 / 19.0
    opts = ["A", "B", "C", "D", "E"]

    for row, selected in enumerate(answers):
        cy = (11.0 + row * row_step_mm) * scale
        for c, letter in enumerate(opts):
            cx = (6.0 + c * option_step_mm) * scale
            radius = max(8.0, min(option_step_mm, row_step_mm) * scale * 0.42)
            r = int(round(radius))
            cxi, cyi = int(round(cx)), int(round(cy))
            cv2.circle(image, (cxi, cyi), r, 0, 2)
            if selected == letter:
                cv2.circle(image, (cxi, cyi), max(4, r - 3), 0, -1)

    ok, encoded = cv2.imencode(".png", image)
    assert ok
    return encoded.tobytes()


def test_lgs_turkish_column_crop_reads_five_options():
    answers = ["A", "E", "B", "", "C", "D", "A", "B", "C", "D", "E", "", "A", "B", "C", "D", "A", "B", "C", "D"]
    assert len(answers) == 20
    image_bytes = _build_lgs_turkish_column_crop_synthetic_five(answers)
    result = _detect_answers_from_image(
        image_bytes,
        question_count=20,
        option_count=5,
        template=TEMPLATE_LGS_TURKISH_COLUMN_CROP,
    )
    assert result.answers == answers
    assert result.markers_detected is True
    assert result.perspective_ok is True


def test_collapsed_single_option_guard_flags_all_a_pattern():
    reads = [QuestionRead("A", "ok", 0.88) for _ in range(18)] + [
        QuestionRead("", "empty", 0.0),
        QuestionRead("", "empty", 0.0),
    ]
    assert _looks_like_collapsed_single_option(reads, 20) is True


def test_ambiguous_when_two_bubbles_filled_same_row():
    """Aynı satırda iki şık güçlü dolu ise ambiguous (bloklama için)."""
    width, height = 900, 1400
    image = np.full((height, width), 255, dtype=np.uint8)
    marker_size = 70
    margin = 35
    for x, y in [
        (margin, margin),
        (width - margin - marker_size, margin),
        (width - margin - marker_size, height - margin - marker_size),
        (margin, height - margin - marker_size),
    ]:
        cv2.rectangle(image, (x, y), (x + marker_size, y + marker_size), 0, -1)

    grid_left = int(width * 0.16)
    grid_right = int(width * 0.84)
    grid_top = int(height * 0.17)
    grid_bottom = int(height * 0.90)
    rows = 3
    cols = 5
    row_height = (grid_bottom - grid_top) / rows
    col_width = (grid_right - grid_left) / cols

    for row_index in range(rows):
        for col_index in range(cols):
            center_x = int(grid_left + (col_index + 0.5) * col_width)
            center_y = int(grid_top + (row_index + 0.5) * row_height)
            radius = max(10, int(min(col_width, row_height) * 0.23))
            cv2.circle(image, (center_x, center_y), radius, 0, 3)
            fill_both = row_index == 0 and col_index in (0, 1)
            if fill_both or (row_index == 1 and col_index == 2):
                fill_radius = max(8, radius - 3)
                cv2.circle(image, (center_x, center_y), fill_radius, 0, -1)

    ok, encoded = cv2.imencode(".png", image)
    assert ok
    result = _detect_answers_from_image(encoded.tobytes(), question_count=1, option_count=5)
    assert len(result.per_question) == 1
    assert result.per_question[0].status == "ambiguous"
    assert result.answers[0] == ""
