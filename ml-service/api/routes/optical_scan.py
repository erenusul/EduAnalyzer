"""
Optik form fotoğrafından işaret tanıma.

Faz 1 yaklaşımı:
- köşe marker'larını algıla
- perspektifi düzelt
- iç grid üzerinde adaptif eşikleme ve doluluk oranı ile şık seç
"""

from typing import List, Tuple

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ml_service.utils.logger import logger

router = APIRouter()

OPTIONS = ["A", "B", "C", "D", "E"]


def _prepare_binary(gray_image):
    import cv2

    blurred = cv2.GaussianBlur(gray_image, (5, 5), 0)
    binary = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        31,
        8,
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)


def _find_corner_markers(binary_image) -> Tuple[Tuple[float, float], ...] | None:
    import cv2
    import numpy as np

    height, width = binary_image.shape
    image_area = height * width
    contours, _ = cv2.findContours(binary_image, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    candidates = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < image_area * 0.0005 or area > image_area * 0.05:
            continue

        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.08 * perimeter, True)
        if len(approx) != 4:
            continue

        x, y, w, h = cv2.boundingRect(approx)
        if h == 0:
            continue

        aspect_ratio = w / float(h)
        if not 0.7 <= aspect_ratio <= 1.3:
            continue

        fill_ratio = area / float(max(w * h, 1))
        if fill_ratio < 0.55:
            continue

        center_x = x + w / 2.0
        center_y = y + h / 2.0
        candidates.append(
            {
                "rect": (x, y, w, h),
                "center": (center_x, center_y),
                "area": area,
            }
        )

    if len(candidates) < 4:
        return None

    corner_targets = {
        "top_left": (0.0, 0.0),
        "top_right": (float(width), 0.0),
        "bottom_right": (float(width), float(height)),
        "bottom_left": (0.0, float(height)),
    }

    used_indices = set()
    selected = {}
    diagonal = np.hypot(width, height)

    for key, target in corner_targets.items():
        ranked = []
        for index, candidate in enumerate(candidates):
            cx, cy = candidate["center"]
            distance = np.hypot(cx - target[0], cy - target[1]) / max(diagonal, 1.0)
            score = distance - (candidate["area"] / max(image_area, 1.0))
            ranked.append((score, index, candidate))

        ranked.sort(key=lambda item: item[0])
        for _, index, candidate in ranked:
            if index not in used_indices:
                used_indices.add(index)
                selected[key] = candidate["rect"]
                break

    if len(selected) != 4:
        return None

    tl_x, tl_y, _, _ = selected["top_left"]
    tr_x, tr_y, tr_w, _ = selected["top_right"]
    br_x, br_y, br_w, br_h = selected["bottom_right"]
    bl_x, bl_y, _, bl_h = selected["bottom_left"]

    return (
        (float(tl_x), float(tl_y)),
        (float(tr_x + tr_w), float(tr_y)),
        (float(br_x + br_w), float(br_y + br_h)),
        (float(bl_x), float(bl_y + bl_h)),
    )


def _warp_from_markers(gray_image, markers):
    import cv2
    import numpy as np

    top_left, top_right, bottom_right, bottom_left = markers

    width_top = np.linalg.norm(np.array(top_right) - np.array(top_left))
    width_bottom = np.linalg.norm(np.array(bottom_right) - np.array(bottom_left))
    max_width = int(max(width_top, width_bottom))

    height_right = np.linalg.norm(np.array(bottom_right) - np.array(top_right))
    height_left = np.linalg.norm(np.array(bottom_left) - np.array(top_left))
    max_height = int(max(height_right, height_left))

    if max_width < 200 or max_height < 200:
        return gray_image

    source = np.array(markers, dtype="float32")
    destination = np.array(
        [
            [0, 0],
            [max_width - 1, 0],
            [max_width - 1, max_height - 1],
            [0, max_height - 1],
        ],
        dtype="float32",
    )

    transform = cv2.getPerspectiveTransform(source, destination)
    return cv2.warpPerspective(gray_image, transform, (max_width, max_height))


def _detect_answers_from_template(form_image, question_count: int) -> List[str]:
    import numpy as np
    import cv2

    binary = _prepare_binary(form_image)
    height, width = binary.shape
    rows = max(1, min(question_count, 60))
    grid_left = int(width * 0.16)
    grid_right = int(width * 0.84)
    grid_top = int(height * 0.17)
    grid_bottom = int(height * 0.90)
    grid_width = max(grid_right - grid_left, 1)
    grid_height = max(grid_bottom - grid_top, 1)
    row_height = grid_height / rows
    col_width = grid_width / 5.0
    answers = []

    for row in range(rows):
        option_scores = []
        for col in range(5):
            center_x = int(grid_left + (col + 0.5) * col_width)
            center_y = int(grid_top + (row + 0.5) * row_height)
            radius = max(6, int(min(col_width, row_height) * 0.16))

            x1 = max(center_x - radius - 4, 0)
            x2 = min(center_x + radius + 4, width)
            y1 = max(center_y - radius - 4, 0)
            y2 = min(center_y + radius + 4, height)
            roi = binary[y1:y2, x1:x2]
            if roi.size == 0 or roi.shape[0] < 3 or roi.shape[1] < 3:
                option_scores.append(0.0)
                continue

            mask = np.zeros(roi.shape, dtype=np.uint8)
            local_center = (center_x - x1, center_y - y1)
            cv2.circle(mask, local_center, radius, 255, -1)
            inner_pixels = roi[mask > 0]
            if inner_pixels.size == 0:
                option_scores.append(0.0)
                continue

            fill_ratio = float(np.count_nonzero(inner_pixels)) / float(inner_pixels.size)
            option_scores.append(fill_ratio)

        best_index = int(np.argmax(option_scores))
        sorted_scores = sorted(option_scores, reverse=True)
        best_score = sorted_scores[0]
        second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0.0

        is_marked = best_score >= 0.18
        is_dominant = best_score >= max(second_score * 1.35, second_score + 0.05)

        if is_marked and is_dominant:
            answers.append(OPTIONS[best_index])
        else:
            answers.append("")

    return answers[:question_count]


def _detect_answers_from_image(image_bytes: bytes, question_count: int = 20) -> List[str]:
    """
    Optik form görüntüsünden işaretleri tespit et.

    Öncelik:
    1. Köşe marker'larını bulup perspektifi düzelt
    2. İç cevap grid'ini ayır
    3. Adaptif threshold + doluluk oranı ile işaretli şıkkı belirle

    Marker bulunamazsa mevcut görüntü üzerinden aynı mantıkla devam eder.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        logger.warning("OpenCV yüklü değil, optik form OCR kullanılamaz")
        return []

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return []

        binary = _prepare_binary(img)
        markers = _find_corner_markers(binary)
        working_image = _warp_from_markers(img, markers) if markers else img
        answers = _detect_answers_from_template(working_image, question_count)

        logger.info(
            "Optik form işlendi",
            extra={
                "question_count": question_count,
                "markers_detected": bool(markers),
                "detected_answers": len(answers),
            },
        )
        return answers
    except Exception as e:
        logger.error(f"Optik form işleme hatası: {e}", exc_info=True)
        return []


@router.post("/optical-scan")
async def optical_scan(
    file: UploadFile = File(..., description="Optik form fotoğrafı"),
    question_count: int = Form(20),
):
    """
    Optik form fotoğrafından işaretleri oku.
    question_count: soru sayısı (varsayılan 20)
    Döner: { "answers": ["A","B","C",...], "questionCount": 20 }
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Sadece görsel dosyalar kabul edilir")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "Dosya boyutu 10MB'dan küçük olmalı")

    answers = _detect_answers_from_image(content, question_count=question_count)
    return {"answers": answers, "questionCount": len(answers)}
