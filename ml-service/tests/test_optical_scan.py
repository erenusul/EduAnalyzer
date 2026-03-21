import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import cv2
import numpy as np

from ml_service.api.routes.optical_scan import _detect_answers_from_image


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

    detected = _detect_answers_from_image(image_bytes, question_count=len(answers))

    assert detected == answers


def test_optical_scan_detects_answers_4_options_turkce():
    """4 şık (A-D) Türkçe formu için optik okuma testi."""
    answers = ["A", "C", "B", "", "D", "A", "B", "C"]
    image_bytes = _build_synthetic_optical_form(
        answers, option_count=4, use_perspective_warp=False
    )

    detected = _detect_answers_from_image(
        image_bytes, question_count=len(answers), option_count=4
    )

    assert detected == answers
