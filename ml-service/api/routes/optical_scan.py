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

OPTIONS_5 = ["A", "B", "C", "D", "E"]
OPTIONS_4 = ["A", "B", "C", "D"]

# A4 baskı (212×300 mm): yalnızca Türkçe 20 soru × 4 şık — ölçüler mm, sol üst köşe referans.
TEMPLATE_LGS_TURKISH_212X300 = "lgs_turkish_212x300"
_LGS_PAGE_W_MM = 212.0
_LGS_PAGE_H_MM = 300.0
_LGS_Q1_A_CX_MM = 27.0
_LGS_Q1_A_CY_MM = 194.0
_LGS_AD_CENTERS_SPAN_MM = 15.0  # A merkezi → D merkezi
_LGS_Q1_Q20_CENTERS_SPAN_MM = 85.0  # 1. soru merkezi → 20. soru merkezi

# SÖZEL bölümü kırpıntısı (117×107 mm): 4 sütun × 20 satır; sol üst (0,0), X sağa Y aşağı.
# Soru sırası: sütun 1 (Türkçe) 1–20, sütun 2 21–40, sütun 3 41–60, sütun 4 61–80.
# Sütun genişliği eşit kabul edilir; Q1–A x = k * (sayfa_genişliği/4) + ilk_sütun_Q1A_x.
TEMPLATE_LGS_SOZEL_CROP_117X107 = "lgs_sozel_crop_117x107"
_SOZEL_PAGE_W_MM = 117.0
_SOZEL_PAGE_H_MM = 107.0
_SOZEL_Q1_A_CX_COL0_MM = 11.0  # 1. sütun, 1. soru A merkezi X (sayfa solundan)
_SOZEL_Q1_A_CY_MM = 21.0
_SOZEL_AD_CENTERS_SPAN_MM = 15.0  # A merkezi → D merkezi
_SOZEL_Q1_Q20_CENTERS_SPAN_MM = 84.0  # 1. satır merkezi → 20. satır merkezi (aynı sütun)
_SOZEL_COLUMN_COUNT = 4
_SOZEL_COLUMN_WIDTH_MM = _SOZEL_PAGE_W_MM / float(_SOZEL_COLUMN_COUNT)
_SOZEL_ROWS_PER_COLUMN = 20
_SOZEL_MAX_QUESTIONS = _SOZEL_COLUMN_COUNT * _SOZEL_ROWS_PER_COLUMN  # 80


class OpticalScanRejected(Exception):
    """Görüntü optik okumaya uygun değil (boş, çok karanlık, tek renk vb.)."""


def _validate_optical_image_quality(gray) -> None:
    """
    Siyah ekran / boş duvar gibi girdilerde adaptif eşik gürültü üretip sahte işaretler çıkmasını önler.
    """
    import numpy as np

    if gray is None or gray.size == 0:
        raise OpticalScanRejected("Görüntü okunamadı.")

    mean = float(np.mean(gray))
    std = float(np.std(gray))
    # Tek renk veya neredeyse düz görüntü (siyah fotoğraf, düz yüzey)
    if std < 14.0:
        raise OpticalScanRejected(
            "Optik form algılanamadı. Formu net gösterin, aydınlık ortamda tekrar deneyin."
        )
    # Çok karanlık ve düşük kontrast (kapaklı lens, kapalı kamera)
    if mean < 22.0 and std < 45.0:
        raise OpticalScanRejected(
            "Görüntü çok karanlık veya belirsiz. Işığı artırıp formu kadraja alarak tekrar çekin."
        )


def _is_probably_image(content_type: str | None, body: bytes) -> bool:
    """İstemci veya proxy Content-Type iletmezse (ör. octet-stream) imzaya bak."""
    if body and len(body) >= 3 and body[:3] == b"\xff\xd8\xff":
        return True
    if body and len(body) >= 8 and body[:8] == b"\x89PNG\r\n\x1a\n":
        return True
    if body and len(body) >= 12 and body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return True
    if not content_type:
        return False
    main = content_type.split(";", 1)[0].strip().lower()
    return main.startswith("image/")


def _get_options(option_count: int) -> List[str]:
    if option_count == 4:
        return OPTIONS_4
    return OPTIONS_5


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


def _looks_like_saturated_color_print(bgr_image) -> bool:
    """
    Siyah-beyaz baskı + gri tonlamalı fotoğrafta doygunluk düşüktür; pembe mürekkep maskesi gerekmez.
    Renkli baskı (pembe çizgi vb.) varsa medyan S yüksek çıkar.
    """
    import cv2
    import numpy as np

    h, w = bgr_image.shape[:2]
    if h < 8 or w < 8:
        return False
    nw = min(320, w)
    nh = max(1, int(h * nw / w))
    small = cv2.resize(bgr_image, (nw, nh), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    med_s = float(np.median(hsv[:, :, 1]))
    return med_s >= 30.0


def _bgr_to_gray_magenta_dropout(bgr_image):
    """
    Yalnızca renkli mürekkep baskılı formlar için: pembe/magenta çizgileri HSV ile bastırır.
    Siyah-beyaz baskıda `_bgr_to_gray_for_lgs` bunu atlar.
    """
    import cv2
    import numpy as np

    hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
    mask_magenta = cv2.inRange(hsv, np.array([130, 35, 45]), np.array([175, 255, 255]))
    mask_red_wrap = cv2.inRange(hsv, np.array([0, 35, 45]), np.array([12, 255, 255]))
    mask = cv2.bitwise_or(mask_magenta, mask_red_wrap)
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    return np.where(mask > 0, 255, gray).astype(np.uint8)


def _bgr_to_gray_for_lgs(bgr_image):
    """
    Siyah-beyaz baskı: doğrudan gri tonlama (pembe mürekkep maskesi yok).
    Renkli baskı (yüksek doygunluk): magenta dropout.
    Dönüş: (gri_görüntü, magenta_dropout_kullanıldı_mı)
    """
    import cv2

    if _looks_like_saturated_color_print(bgr_image):
        return _bgr_to_gray_magenta_dropout(bgr_image), True
    return cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY), False


def _prepare_binary_lgs(gray_image):
    """LGS şablonu: CLAHE + biraz daha geniş blok adaptif eşik."""
    import cv2

    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    g = clahe.apply(gray_image)
    blurred = cv2.GaussianBlur(g, (5, 5), 0)
    binary = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        35,
        9,
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
    """Gri (H×W) veya BGR (H×W×3) görüntü; perspektif düzeltme."""
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


def _bubble_fill_ratio(
    binary, width: int, height: int, center_x: float, center_y: float, radius: int
) -> float:
    """Adaptif ikili görüntüde daire ROI içindeki dolu (işaretli) piksel oranı."""
    import numpy as np
    import cv2

    cx = int(round(center_x))
    cy = int(round(center_y))
    r = int(max(4, radius))
    x1 = max(cx - r - 4, 0)
    x2 = min(cx + r + 4, width)
    y1 = max(cy - r - 4, 0)
    y2 = min(cy + r + 4, height)
    roi = binary[y1:y2, x1:x2]
    if roi.size == 0 or roi.shape[0] < 3 or roi.shape[1] < 3:
        return 0.0

    mask = np.zeros(roi.shape, dtype=np.uint8)
    local_center = (cx - x1, cy - y1)
    cv2.circle(mask, local_center, r, 255, -1)
    inner_pixels = roi[mask > 0]
    if inner_pixels.size == 0:
        return 0.0
    return float(np.count_nonzero(inner_pixels)) / float(inner_pixels.size)


def _bubble_pencil_darkness(
    gray, width: int, height: int, center_x: float, center_y: float, radius: int
) -> float:
    """
    Daire ROI içinde kurşun kalemle koyulaşma (0–1). Pembe çember ikilide gürültü verse de
    gri kanalda göreli fark genelde işareti ayırır.
    """
    import numpy as np
    import cv2

    if gray is None or gray.ndim != 2:
        return 0.0

    cx = int(round(center_x))
    cy = int(round(center_y))
    r = int(max(4, radius))
    x1 = max(cx - r - 4, 0)
    x2 = min(cx + r + 4, width)
    y1 = max(cy - r - 4, 0)
    y2 = min(cy + r + 4, height)
    roi = gray[y1:y2, x1:x2]
    if roi.size == 0 or roi.shape[0] < 3 or roi.shape[1] < 3:
        return 0.0

    mask = np.zeros(roi.shape, dtype=np.uint8)
    local_center = (cx - x1, cy - y1)
    cv2.circle(mask, local_center, r, 255, -1)
    inner = roi[mask > 0]
    if inner.size == 0:
        return 0.0
    mean_g = float(np.mean(inner))
    return max(0.0, min(1.0, (255.0 - mean_g) / 255.0))


def _row_scores_from_centers(
    binary,
    width: int,
    height: int,
    centers_x: list[float],
    center_y: float,
    radius: int,
) -> tuple[list[float], list[str]]:
    """Bir soru satırı için şık doluluk skorları ve şık harfleri."""
    options = _get_options(len(centers_x))
    scores = [
        _bubble_fill_ratio(binary, width, height, cx, center_y, radius)
        for cx in centers_x
    ]
    return scores, options


def _row_scores_from_centers_hybrid(
    binary,
    gray,
    width: int,
    height: int,
    centers_x: list[float],
    center_y: float,
    radius: int,
    binary_weight: float = 0.52,
) -> tuple[list[float], list[str]]:
    """
    İkili doluluk + satır içi normalize gri koyulaşma (pembe çizgide ikili gürültü azalır).
    """
    options = _get_options(len(centers_x))
    b_scores = [
        _bubble_fill_ratio(binary, width, height, cx, center_y, radius) for cx in centers_x
    ]
    d_scores = [
        _bubble_pencil_darkness(gray, width, height, cx, center_y, radius) for cx in centers_x
    ]
    d_min = min(d_scores)
    d_span = max(d_scores) - d_min + 1e-6
    d_norm = [(d - d_min) / d_span for d in d_scores]
    gw = max(0.0, min(1.0, binary_weight))
    scores = [gw * b + (1.0 - gw) * dn for b, dn in zip(b_scores, d_norm)]
    return scores, options


def _answers_from_option_scores(option_scores: list[float], options: list[str]) -> str:
    if not option_scores:
        return ""
    best_index = max(range(len(option_scores)), key=lambda i: option_scores[i])
    sorted_scores = sorted(option_scores, reverse=True)
    best_score = sorted_scores[0]
    second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    is_marked = best_score >= 0.18
    is_dominant = best_score >= max(second_score * 1.35, second_score + 0.05)
    if is_marked and is_dominant:
        return options[best_index]
    return ""


def _answers_from_lgs_option_scores(option_scores: list[float], options: list[str]) -> str:
    """Pembe form + hafif işaret için daha yumuşak eşik."""
    if not option_scores:
        return ""
    best_index = max(range(len(option_scores)), key=lambda i: option_scores[i])
    sorted_scores = sorted(option_scores, reverse=True)
    best_score = sorted_scores[0]
    second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    if best_score < 0.09:
        return ""
    if best_score < max(second_score * 1.18, second_score + 0.025):
        return ""
    return options[best_index]


def _answers_from_lgs_option_scores_sozel(option_scores: list[float], options: list[str]) -> str:
    """
    117×107 SÖZEL: hibrit skor + biraz daha toleranslı baskınlık (yanlış satırda boş/yanlış şık azalsın).
    """
    if not option_scores:
        return ""
    best_index = max(range(len(option_scores)), key=lambda i: option_scores[i])
    sorted_scores = sorted(option_scores, reverse=True)
    best_score = sorted_scores[0]
    second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    if best_score < 0.062:
        return ""
    if best_score < max(second_score * 1.12, second_score + 0.017):
        return ""
    return options[best_index]


def _detect_answers_lgs_turkish_212x300(
    form_image, question_count: int, option_count: int = 4
) -> List[str]:
    """
    212×300 mm sayfa; Türkçe 1–20: 1. soru A merkezi (27,194) mm, A–D arası 15 mm, satır aralığı 85/19 mm.
    Görüntü köşe düzeltmesinden sonra piksel boyutu sayfanın tamamına karşılık gelmeli (tam kadraj).
    """
    _ = option_count  # Bu şablonda her zaman 4 şık
    binary = _prepare_binary_lgs(form_image)
    height, width = binary.shape
    oc = 4
    option_step_mm = _LGS_AD_CENTERS_SPAN_MM / float(oc - 1)
    row_step_mm = _LGS_Q1_Q20_CENTERS_SPAN_MM / 19.0

    step_x_px = option_step_mm / _LGS_PAGE_W_MM * width
    step_y_px = row_step_mm / _LGS_PAGE_H_MM * height
    radius = max(5, int(min(step_x_px, step_y_px) * 0.48))

    rows = max(1, min(question_count, 60))
    answers: List[str] = []

    for row in range(rows):
        cy_mm = _LGS_Q1_A_CY_MM + row * row_step_mm
        cy_px = cy_mm / _LGS_PAGE_H_MM * height
        centers_x_mm = [_LGS_Q1_A_CX_MM + c * option_step_mm for c in range(oc)]
        centers_x_px = [cx / _LGS_PAGE_W_MM * width for cx in centers_x_mm]
        scores, opts = _row_scores_from_centers(
            binary, width, height, centers_x_px, cy_px, radius
        )
        answers.append(_answers_from_lgs_option_scores(scores, opts))

    return answers[:question_count]


def _detect_answers_lgs_sozel_crop_117x107(
    form_image, question_count: int, option_count: int = 4
) -> List[str]:
    """
    117×107 mm kırpıntı; dört ders sütunu (Türkçe, Sosyal, Din, İngilizce), sütun başına 20 soru.
    Görüntü bu dikdörtgene denk gelecek şekilde kadrajlanmalı (köşe düzeltmesi sonrası tam alan).
    """
    _ = option_count
    gray = form_image
    binary = _prepare_binary_lgs(form_image)
    height, width = binary.shape
    oc = 4
    option_step_mm = _SOZEL_AD_CENTERS_SPAN_MM / float(oc - 1)
    row_step_mm = _SOZEL_Q1_Q20_CENTERS_SPAN_MM / 19.0

    step_x_px = option_step_mm / _SOZEL_PAGE_W_MM * width
    step_y_px = row_step_mm / _SOZEL_PAGE_H_MM * height
    radius = max(5, int(min(step_x_px, step_y_px) * 0.48))

    n = max(0, min(question_count, _SOZEL_MAX_QUESTIONS))
    answers: List[str] = []

    for global_idx in range(n):
        col = global_idx // _SOZEL_ROWS_PER_COLUMN
        row = global_idx % _SOZEL_ROWS_PER_COLUMN
        q1_a_x_mm = col * _SOZEL_COLUMN_WIDTH_MM + _SOZEL_Q1_A_CX_COL0_MM
        cy_mm = _SOZEL_Q1_A_CY_MM + row * row_step_mm
        cy_px = cy_mm / _SOZEL_PAGE_H_MM * height
        centers_x_mm = [q1_a_x_mm + c * option_step_mm for c in range(oc)]
        centers_x_px = [cx / _SOZEL_PAGE_W_MM * width for cx in centers_x_mm]
        scores, opts = _row_scores_from_centers_hybrid(
            binary, gray, width, height, centers_x_px, cy_px, radius
        )
        answers.append(_answers_from_lgs_option_scores_sozel(scores, opts))

    return answers


def _detect_answers_from_template(
    form_image, question_count: int, option_count: int = 5
) -> List[str]:
    option_count = max(4, min(5, option_count))
    options = _get_options(option_count)

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
    col_width = grid_width / float(option_count)
    answers = []

    for row in range(rows):
        option_scores = []
        for col in range(option_count):
            center_x = grid_left + (col + 0.5) * col_width
            center_y = grid_top + (row + 0.5) * row_height
            radius = max(6, int(min(col_width, row_height) * 0.16))
            option_scores.append(
                _bubble_fill_ratio(binary, width, height, center_x, center_y, radius)
            )

        answers.append(_answers_from_option_scores(option_scores, options))

    return answers[:question_count]


def _detect_answers_from_image(
    image_bytes: bytes,
    question_count: int = 20,
    option_count: int = 5,
    template: str | None = None,
) -> List[str]:
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
        bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if bgr is None:
            return []

        img_gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        _validate_optical_image_quality(img_gray)

        binary = _prepare_binary(img_gray)
        markers = _find_corner_markers(binary)
        tmpl = (template or "").strip().lower()
        lgs_magenta_dropout = False
        if tmpl == TEMPLATE_LGS_TURKISH_212X300:
            work_bgr = _warp_from_markers(bgr, markers) if markers else bgr
            gray_lgs, lgs_magenta_dropout = _bgr_to_gray_for_lgs(work_bgr)
            answers = _detect_answers_lgs_turkish_212x300(gray_lgs, question_count, 4)
        elif tmpl == TEMPLATE_LGS_SOZEL_CROP_117X107:
            work_bgr = _warp_from_markers(bgr, markers) if markers else bgr
            gray_lgs, lgs_magenta_dropout = _bgr_to_gray_for_lgs(work_bgr)
            answers = _detect_answers_lgs_sozel_crop_117x107(gray_lgs, question_count, 4)
        else:
            working_gray = _warp_from_markers(img_gray, markers) if markers else img_gray
            answers = _detect_answers_from_template(
                working_gray, question_count, option_count
            )

        log_extra = {
            "question_count": question_count,
            "option_count": option_count,
            "template": tmpl or "default",
            "markers_detected": bool(markers),
            "detected_answers": len(answers),
        }
        if tmpl in (TEMPLATE_LGS_TURKISH_212X300, TEMPLATE_LGS_SOZEL_CROP_117X107):
            log_extra["lgs_magenta_dropout"] = lgs_magenta_dropout

        logger.info("Optik form işlendi", extra=log_extra)
        return answers
    except OpticalScanRejected:
        raise
    except Exception as e:
        logger.error(f"Optik form işleme hatası: {e}", exc_info=True)
        return []


@router.post("/optical-scan")
async def optical_scan(
    file: UploadFile = File(..., description="Optik form fotoğrafı"),
    question_count: int = Form(20),
    option_count: int = Form(5),
    template: str | None = Form(
        None,
        description=(
            f"Şablon; örn. {TEMPLATE_LGS_SOZEL_CROP_117X107} (117×107 mm SÖZEL 4×20) veya "
            f"{TEMPLATE_LGS_TURKISH_212X300} (212×300 A4 Türkçe 20×4)"
        ),
    ),
):
    """
    Optik form fotoğrafından işaretleri oku.
    question_count: soru sayısı (varsayılan 20)
    option_count: şık sayısı 4 veya 5 (varsayılan 5, Türkçe için 4)
    template: lgs_sozel_crop_117x107 = 117×107 mm SÖZEL dört sütun (kadraj bu alanı doldursun);
        lgs_turkish_212x300 = A4 Türkçe tek sütun 20×4
    Döner: { "answers": ["A","B","C",...], "questionCount": 20 }
    """
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "Dosya boyutu 10MB'dan küçük olmalı")

    if not _is_probably_image(file.content_type, content):
        raise HTTPException(400, "Sadece görsel dosyalar kabul edilir")

    option_count = max(4, min(5, option_count))
    try:
        answers = _detect_answers_from_image(
            content,
            question_count=question_count,
            option_count=option_count,
            template=template,
        )
    except OpticalScanRejected as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"answers": answers, "questionCount": len(answers)}
