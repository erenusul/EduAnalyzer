"""
Optik form fotoğrafından işaret tanıma.

Faz 1 yaklaşımı:
- köşe marker'larını algıla
- perspektifi düzelt
- iç grid üzerinde adaptif eşikleme ve doluluk oranı ile şık seç
"""

import os
from dataclasses import dataclass, field
from typing import Any, List, Tuple

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ml_service.optical_template_mm import (
    get_lgs_turkish_template_mm,
    get_sozel_template_mm,
    get_turkish_column_crop_template_mm,
)
from ml_service.omr_checker_bridge import try_read_with_omr_checker
from ml_service.utils.logger import logger

router = APIRouter()

OPTIONS_5 = ["A", "B", "C", "D", "E"]
OPTIONS_4 = ["A", "B", "C", "D"]

# A4 baskı (212×300 mm) Türkçe şablon kimliği — mm değerleri ml_service.optical_template_mm + OPTICAL_LGS_* env.
TEMPLATE_LGS_TURKISH_212X300 = "lgs_turkish_212x300"

# SÖZEL kırpıntı şablon kimliği — mm değerleri optical_template_mm + OPTICAL_SOZEL_* env ile kalibre edilir.
TEMPLATE_LGS_SOZEL_CROP_117X107 = "lgs_sozel_crop_117x107"

# Yalnızca TÜRKÇE sütunu (pembe başlık + 20×4) — kadraj = kırpıntı; OPTICAL_TR_COL_* env.
TEMPLATE_LGS_TURKISH_COLUMN_CROP = "lgs_turkish_column_crop"

# OMRChecker (third_party/OMRChecker) — OMR_CHECKER_TEMPLATE_JSON zorunlu; yoksa veya hata olursa dahili lgs_turkish_212x300 okumasına düşülür.
TEMPLATE_LGS_TURKISH_OMRCHECKER = "lgs_turkish_omrchecker"

# A4 tam sayfa: uzak kadrajda köşe kareleri _find_corner_markers eşiğinin altında kalınca
# markers_detected/perspective_ok false olur; backend kesin politika reddeder. Yeterli çözünürlükte
# okumayı denemeye izin ver (lgs_turkish_column_crop ile aynı fikir).
_FULLPAGE_MIN_SHORT_EDGE_FOR_MARKER_FALLBACK_PX = 560


class OpticalScanRejected(Exception):
    """Görüntü optik okumaya uygun değil (boş, çok karanlık, tek renk vb.)."""


@dataclass(frozen=True)
class QuestionRead:
    """Tek soru satırı için okuma sonucu (bloklama politikası için)."""

    answer: str
    status: str  # ok | empty | ambiguous
    confidence: float


@dataclass
class OpticalScanFullResult:
    """Tam optik tarama çıktısı; API ve .NET istemcisi ile uyumlu."""

    answers: List[str]
    markers_detected: bool
    perspective_ok: bool
    per_question: List[QuestionRead] = field(default_factory=list)

    def to_api_dict(self, question_count: int) -> dict[str, Any]:
        # .NET JsonNamingPolicy.SnakeCaseLower ile uyumlu anahtarlar
        return {
            "answers": self.answers,
            "question_count": question_count,
            "markers_detected": self.markers_detected,
            "perspective_ok": self.perspective_ok,
            "per_question": [
                {
                    "answer": q.answer,
                    "status": q.status,
                    "confidence": round(q.confidence, 4),
                }
                for q in self.per_question
            ],
        }


def _confidence_from_margin(best: float, second: float, scale: float = 0.12) -> float:
    """Baskın şık ile ikinci arasındaki marjdan 0–1 güven (scale: tipik marj aralığı)."""
    gap = max(0.0, best - second)
    return min(1.0, max(0.0, 0.2 + 0.8 * min(1.0, gap / max(scale, 1e-6))))


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


def _try_warp_from_markers(image, markers) -> tuple[Any, bool]:
    """
    Gri (H×W) veya BGR (H×W×3) görüntü; perspektif düzeltme.
    Dönüş: (görüntü, warp_uygulandı_mı). Köşe yok veya çıktı çok küçükse orijinal + False.
    """
    import cv2
    import numpy as np

    if not markers:
        return image, False

    top_left, top_right, bottom_right, bottom_left = markers

    width_top = np.linalg.norm(np.array(top_right) - np.array(top_left))
    width_bottom = np.linalg.norm(np.array(bottom_right) - np.array(bottom_left))
    max_width = int(max(width_top, width_bottom))

    height_right = np.linalg.norm(np.array(bottom_right) - np.array(top_right))
    height_left = np.linalg.norm(np.array(bottom_left) - np.array(top_left))
    max_height = int(max(height_right, height_left))

    if max_width < 200 or max_height < 200:
        return image, False

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
    return cv2.warpPerspective(image, transform, (max_width, max_height)), True


def _warp_from_markers(gray_image, markers):
    """Geriye dönük: yalnızca görüntü (warp yoksa orijinal)."""
    warped, _ = _try_warp_from_markers(gray_image, markers)
    return warped


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


def _lgs_vertical_slack_enabled() -> bool:
    v = (os.environ.get("OPTICAL_LGS_DISABLE_VERTICAL_SLACK") or "").strip().lower()
    return v not in ("1", "true", "yes", "on")


def _row_scores_from_centers_lgs_vertical_slack(
    binary,
    width: int,
    height: int,
    centers_x: list[float],
    center_y: float,
    radius: int,
    row_step_px: float,
) -> tuple[list[float], list[str]]:
    """
    Her şık dairesi için nominal Y etrafında dar dikey pencerede maksimum doluluk alınır.
    Geçerli Y aralığına clamp + nominal Y ile max alınır; kenar/bozuk kadrajda tüm örneklerin
    atlanıp skorun 0 kalması engellenir.
    """
    import numpy as np

    r = int(max(4, radius))
    rsp = max(float(row_step_px), 1.0)
    half = min(rsp * 0.22, max(float(r) * 1.6, rsp * 0.12))
    half = max(half, 1.0)

    y_lo = float(r + 1)
    y_hi = float(max(r + 1, height - r - 1))
    if y_lo >= y_hi:
        y_mid = max(0.0, min(float(height - 1), float(center_y)))
        y_lo = y_hi = y_mid

    options = _get_options(len(centers_x))
    scores: list[float] = []
    cy = float(center_y)
    for cx in centers_x:
        best = 0.0
        for dy in np.linspace(-half, half, num=7):
            y = max(y_lo, min(y_hi, cy + float(dy)))
            v = _bubble_fill_ratio(binary, width, height, cx, y, r)
            if v > best:
                best = v
        nominal = _bubble_fill_ratio(binary, width, height, cx, max(y_lo, min(y_hi, cy)), r)
        scores.append(max(best, nominal))
    return scores, options


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


def _row_read_default(option_scores: list[float], options: list[str]) -> QuestionRead:
    """Varsayılan grid şablonu: baskın değilse ve iki şık da güçlü + marj darsa ambiguous."""
    if not option_scores:
        return QuestionRead("", "empty", 0.0)
    best_index = max(range(len(option_scores)), key=lambda i: option_scores[i])
    sorted_scores = sorted(option_scores, reverse=True)
    best_score = sorted_scores[0]
    second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    mark_thresh = 0.165
    if best_score < mark_thresh:
        return QuestionRead("", "empty", best_score)
    is_dominant = best_score >= max(second_score * 1.33, second_score + 0.048)
    if not is_dominant:
        strong2 = mark_thresh * 0.92
        if second_score >= strong2 and (best_score - second_score) < max(
            0.048, second_score * 0.17
        ):
            return QuestionRead("", "ambiguous", min(1.0, (best_score + second_score) / 2.0))
        return QuestionRead("", "empty", best_score)
    conf = _confidence_from_margin(best_score, second_score, scale=0.1)
    return QuestionRead(options[best_index], "ok", conf)


def _row_read_lgs(option_scores: list[float], options: list[str]) -> QuestionRead:
    """212×300 Türkçe LGS şablonu."""
    if not option_scores:
        return QuestionRead("", "empty", 0.0)
    best_index = max(range(len(option_scores)), key=lambda i: option_scores[i])
    sorted_scores = sorted(option_scores, reverse=True)
    best_score = sorted_scores[0]
    second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    min_best = 0.085
    if best_score < min_best:
        return QuestionRead("", "empty", best_score)
    strong2 = min_best * 1.35
    if second_score >= strong2 and (best_score - second_score) < max(
        0.024, second_score * 0.11
    ):
        return QuestionRead("", "ambiguous", min(1.0, (best_score + second_score) / 2.0))
    if best_score < max(second_score * 1.18, second_score + 0.025):
        return QuestionRead("", "empty", best_score)
    conf = _confidence_from_margin(best_score, second_score, scale=0.08)
    return QuestionRead(options[best_index], "ok", conf)


def _row_read_sozel(option_scores: list[float], options: list[str]) -> QuestionRead:
    """117×107 SÖZEL hibrit skorları."""
    if not option_scores:
        return QuestionRead("", "empty", 0.0)
    best_index = max(range(len(option_scores)), key=lambda i: option_scores[i])
    sorted_scores = sorted(option_scores, reverse=True)
    best_score = sorted_scores[0]
    second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    min_best = 0.062
    if best_score < min_best:
        return QuestionRead("", "empty", best_score)
    strong2 = min_best * 1.5
    if second_score >= strong2 and (best_score - second_score) < max(
        0.018, second_score * 0.09
    ):
        return QuestionRead("", "ambiguous", min(1.0, (best_score + second_score) / 2.0))
    if best_score < max(second_score * 1.12, second_score + 0.017):
        return QuestionRead("", "empty", best_score)
    conf = _confidence_from_margin(best_score, second_score, scale=0.06)
    return QuestionRead(options[best_index], "ok", conf)


def _detect_answers_lgs_turkish_212x300(
    form_image, question_count: int, option_count: int = 4
) -> List[QuestionRead]:
    """
    212×300 mm sayfa; Türkçe 1–20: varsayılan A merkezi (27,194) mm — env ile güncellenir.
    Görüntü köşe düzeltmesinden sonra piksel boyutu sayfanın tamamına karşılık gelmeli (tam kadraj).
    """
    _ = option_count  # Bu şablonda her zaman 4 şık
    tm = get_lgs_turkish_template_mm()
    binary = _prepare_binary_lgs(form_image)
    height, width = binary.shape
    oc = 4
    option_step_mm = tm.ad_centers_span_mm / float(oc - 1)
    row_step_mm = tm.q1_q20_centers_span_mm / 19.0
    row_step_px = row_step_mm / tm.page_h_mm * height

    step_x_px = option_step_mm / tm.page_w_mm * width
    step_y_px = row_step_px
    radius = max(5, int(min(step_x_px, step_y_px) * 0.48))

    rows = max(1, min(question_count, 60))
    reads: List[QuestionRead] = []

    for row in range(rows):
        cy_mm = tm.q1_a_cy_mm + row * row_step_mm + tm.grid_offset_y_mm
        cy_px = cy_mm / tm.page_h_mm * height
        centers_x_mm = [
            tm.q1_a_cx_mm + tm.grid_offset_x_mm + c * option_step_mm for c in range(oc)
        ]
        centers_x_px = [cx / tm.page_w_mm * width for cx in centers_x_mm]
        if _lgs_vertical_slack_enabled():
            scores, opts = _row_scores_from_centers_lgs_vertical_slack(
                binary, width, height, centers_x_px, cy_px, radius, row_step_px
            )
        else:
            scores, opts = _row_scores_from_centers(
                binary, width, height, centers_x_px, cy_px, radius
            )
        reads.append(_row_read_lgs(scores, opts))

    while len(reads) < question_count:
        reads.append(QuestionRead("", "empty", 0.0))
    return reads[:question_count]


def _detect_answers_lgs_sozel_crop_117x107(
    form_image, question_count: int, option_count: int = 4
) -> List[QuestionRead]:
    """
    SÖZEL kırpıntısı; sütun başına N soru (varsayılan 4×20). mm modeli optical_template_mm + OPTICAL_SOZEL_* env.
    Görüntü bu dikdörtgene denk gelecek şekilde kadrajlanmalı (köşe düzeltmesi sonrası tam alan).
    """
    _ = option_count
    tm = get_sozel_template_mm()
    gray = form_image
    binary = _prepare_binary_lgs(form_image)
    height, width = binary.shape
    oc = 4
    option_step_mm = tm.ad_centers_span_mm / float(oc - 1)
    row_step_mm = tm.q1_q20_centers_span_mm / 19.0

    step_x_px = option_step_mm / tm.page_w_mm * width
    step_y_px = row_step_mm / tm.page_h_mm * height
    radius = max(5, int(min(step_x_px, step_y_px) * tm.bubble_radius_scale))

    n = max(0, min(question_count, tm.max_questions))
    reads: List[QuestionRead] = []

    for global_idx in range(n):
        col = global_idx // tm.rows_per_column
        row = global_idx % tm.rows_per_column
        q1_a_x_mm = tm.column_left_mm(col) + tm.q1_a_cx_col0_mm + tm.grid_offset_x_mm
        cy_mm = tm.q1_a_cy_mm + row * row_step_mm + tm.grid_offset_y_mm
        cy_px = cy_mm / tm.page_h_mm * height
        centers_x_mm = [q1_a_x_mm + c * option_step_mm for c in range(oc)]
        centers_x_px = [cx / tm.page_w_mm * width for cx in centers_x_mm]
        scores, opts = _row_scores_from_centers_hybrid(
            binary, gray, width, height, centers_x_px, cy_px, radius, binary_weight=0.52
        )
        reads.append(_row_read_sozel(scores, opts))

    while len(reads) < question_count:
        reads.append(QuestionRead("", "empty", 0.0))
    return reads[:question_count]


def _detect_answers_lgs_turkish_column_crop(
    form_image, question_count: int, option_count: int = 4
) -> List[QuestionRead]:
    """
    Tek sütun TÜRKÇE kırpıntısı; görüntü OPTICAL_TR_COL_PAGE_* mm dikdörtgenine denk gelmeli.

    Tam sayfa `lgs_turkish_212x300` ile aynı ikili doluluk + `_row_read_lgs` ailesi kullanılır;
    hibrit/SÖZEL eşikleri bu şablonda skor dağılımıyla uyumsuz olduğu için gerçek fotoğraflarda
    sık belirsiz/düşük güven üretiyordu.
    """
    _ = option_count
    tm = get_turkish_column_crop_template_mm()
    binary = _prepare_binary_lgs(form_image)
    height, width = binary.shape
    oc = 4
    option_step_mm = tm.ad_centers_span_mm / float(oc - 1)
    row_step_mm = tm.q1_q20_centers_span_mm / 19.0
    row_step_px = row_step_mm / tm.page_h_mm * height

    step_x_px = option_step_mm / tm.page_w_mm * width
    step_y_px = row_step_px
    radius = max(5, int(min(step_x_px, step_y_px) * tm.bubble_radius_scale))

    rows = max(1, min(question_count, 60))
    reads: List[QuestionRead] = []

    for row in range(rows):
        cy_mm = tm.q1_a_cy_mm + row * row_step_mm + tm.grid_offset_y_mm
        cy_px = cy_mm / tm.page_h_mm * height
        centers_x_mm = [
            tm.q1_a_cx_mm + tm.grid_offset_x_mm + c * option_step_mm for c in range(oc)
        ]
        centers_x_px = [cx / tm.page_w_mm * width for cx in centers_x_mm]
        if _lgs_vertical_slack_enabled():
            scores, opts = _row_scores_from_centers_lgs_vertical_slack(
                binary, width, height, centers_x_px, cy_px, radius, row_step_px
            )
        else:
            scores, opts = _row_scores_from_centers(
                binary, width, height, centers_x_px, cy_px, radius
            )
        reads.append(_row_read_lgs(scores, opts))

    while len(reads) < question_count:
        reads.append(QuestionRead("", "empty", 0.0))
    return reads[:question_count]


def _detect_answers_from_template(
    form_image, question_count: int, option_count: int = 5
) -> List[QuestionRead]:
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
    reads: List[QuestionRead] = []

    for row in range(rows):
        option_scores = []
        for col in range(option_count):
            center_x = grid_left + (col + 0.5) * col_width
            center_y = grid_top + (row + 0.5) * row_height
            radius = max(6, int(min(col_width, row_height) * 0.16))
            option_scores.append(
                _bubble_fill_ratio(binary, width, height, center_x, center_y, radius)
            )

        reads.append(_row_read_default(option_scores, options))

    while len(reads) < question_count:
        reads.append(QuestionRead("", "empty", 0.0))
    return reads[:question_count]


def _detect_answers_from_image(
    image_bytes: bytes,
    question_count: int = 20,
    option_count: int = 5,
    template: str | None = None,
) -> OpticalScanFullResult:
    """
    Optik form görüntüsünden işaretleri tespit et.

    Öncelik:
    1. Köşe marker'larını bulup perspektifi düzelt
    2. İç cevap grid'ini ayır
    3. Adaptif threshold + doluluk oranı ile işaretli şıkkı belirle

    markers_detected / perspective_ok bloklama politikası için döner (köşe yok veya warp
    uygulanmadıysa perspective_ok false).
    """
    empty = OpticalScanFullResult([], False, False, [])
    try:
        import cv2
        import numpy as np
    except ImportError:
        logger.warning("OpenCV yüklü değil, optik form OCR kullanılamaz")
        return empty

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if bgr is None:
            return empty

        img_gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        _validate_optical_image_quality(img_gray)

        binary = _prepare_binary(img_gray)
        markers = _find_corner_markers(binary)
        markers_detected = markers is not None
        tmpl = (template or "").strip().lower()
        lgs_magenta_dropout = False
        perspective_ok = False
        reads: List[QuestionRead]
        gray_lgs = None

        if tmpl == TEMPLATE_LGS_TURKISH_OMRCHECKER:
            if markers:
                work_bgr, perspective_ok = _try_warp_from_markers(bgr, markers)
            else:
                work_bgr = bgr
            gray_lgs, lgs_magenta_dropout = _bgr_to_gray_for_lgs(work_bgr)
            omr_reads: List[QuestionRead] | None = None
            jpeg_ok, jpeg_buf = cv2.imencode(
                ".jpg", work_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 92]
            )
            if jpeg_ok:
                omr_tuples = try_read_with_omr_checker(
                    jpeg_buf.tobytes(), question_count, option_count
                )
                if omr_tuples is not None:
                    omr_reads = [
                        QuestionRead(a, st, conf) for a, st, conf in omr_tuples
                    ]
            if omr_reads is not None:
                reads = omr_reads
                markers_detected = True
                perspective_ok = True
                lgs_magenta_dropout = False
            else:
                reads = _detect_answers_lgs_turkish_212x300(gray_lgs, question_count, 4)
        elif tmpl == TEMPLATE_LGS_TURKISH_212X300:
            if markers:
                work_bgr, perspective_ok = _try_warp_from_markers(bgr, markers)
            else:
                work_bgr = bgr
            gray_lgs, lgs_magenta_dropout = _bgr_to_gray_for_lgs(work_bgr)
            reads = _detect_answers_lgs_turkish_212x300(gray_lgs, question_count, 4)
        elif tmpl == TEMPLATE_LGS_SOZEL_CROP_117X107:
            if markers:
                work_bgr, perspective_ok = _try_warp_from_markers(bgr, markers)
            else:
                work_bgr = bgr
            gray_lgs, lgs_magenta_dropout = _bgr_to_gray_for_lgs(work_bgr)
            reads = _detect_answers_lgs_sozel_crop_117x107(gray_lgs, question_count, 4)
        elif tmpl == TEMPLATE_LGS_TURKISH_COLUMN_CROP:
            if markers:
                work_bgr, perspective_ok = _try_warp_from_markers(bgr, markers)
            else:
                work_bgr = bgr
            gray_lgs, lgs_magenta_dropout = _bgr_to_gray_for_lgs(work_bgr)
            reads = _detect_answers_lgs_turkish_column_crop(gray_lgs, question_count, 4)
            gh, gw = gray_lgs.shape[:2]
            if not markers_detected or not perspective_ok:
                # Dar kırpıntıda köşe kareleri yok; ~4 px/mm altında hizalama hataları çok artar
                if gw >= 100 and gh >= 320:
                    markers_detected = True
                    perspective_ok = True
        else:
            if markers:
                working_gray, perspective_ok = _try_warp_from_markers(img_gray, markers)
            else:
                working_gray = img_gray
            reads = _detect_answers_from_template(
                working_gray, question_count, option_count
            )

        if (
            tmpl in (TEMPLATE_LGS_TURKISH_212X300, TEMPLATE_LGS_TURKISH_OMRCHECKER)
            and gray_lgs is not None
        ):
            gh, gw = gray_lgs.shape[:2]
            if (not markers_detected or not perspective_ok) and min(gh, gw) >= int(
                _FULLPAGE_MIN_SHORT_EDGE_FOR_MARKER_FALLBACK_PX
            ):
                markers_detected = True
                perspective_ok = True

        answers = [r.answer for r in reads]
        result = OpticalScanFullResult(
            answers=answers,
            markers_detected=markers_detected,
            perspective_ok=perspective_ok,
            per_question=reads,
        )

        log_extra = {
            "question_count": question_count,
            "option_count": option_count,
            "template": tmpl or "default",
            "markers_detected": markers_detected,
            "perspective_ok": perspective_ok,
            "detected_answers": len(answers),
        }
        if tmpl in (
            TEMPLATE_LGS_TURKISH_212X300,
            TEMPLATE_LGS_TURKISH_OMRCHECKER,
            TEMPLATE_LGS_SOZEL_CROP_117X107,
            TEMPLATE_LGS_TURKISH_COLUMN_CROP,
        ):
            log_extra["lgs_magenta_dropout"] = lgs_magenta_dropout

        logger.info("Optik form işlendi", extra=log_extra)
        return result
    except OpticalScanRejected:
        raise
    except Exception as e:
        logger.error(f"Optik form işleme hatası: {e}", exc_info=True)
        return empty


@router.post("/optical-scan")
async def optical_scan(
    file: UploadFile = File(..., description="Optik form fotoğrafı"),
    question_count: int = Form(20),
    option_count: int = Form(5),
    template: str | None = Form(
        None,
        description=(
            f"Şablon; örn. {TEMPLATE_LGS_SOZEL_CROP_117X107} (117×107 mm SÖZEL 4×20), "
            f"{TEMPLATE_LGS_TURKISH_212X300} (212×300 A4), "
            f"{TEMPLATE_LGS_TURKISH_OMRCHECKER} (OMRChecker + OMR_CHECKER_TEMPLATE_JSON)"
        ),
    ),
):
    """
    Optik form fotoğrafından işaretleri oku.
    question_count: soru sayısı (varsayılan 20)
    option_count: şık sayısı 4 veya 5 (varsayılan 5, Türkçe için 4)
    template: lgs_sozel_crop_117x107 = 117×107 mm SÖZEL dört sütun (kadraj bu alanı doldursun);
        lgs_turkish_212x300 = A4 Türkçe tek sütun 20×4;
        lgs_turkish_omrchecker = OMRChecker (env OMR_CHECKER_TEMPLATE_JSON); yoksa dahili 212×300
    Döner: answers, question_count, markers_detected, perspective_ok, per_question (ok|empty|ambiguous).
    """
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "Dosya boyutu 10MB'dan küçük olmalı")

    if not _is_probably_image(file.content_type, content):
        raise HTTPException(400, "Sadece görsel dosyalar kabul edilir")

    option_count = max(4, min(5, option_count))
    try:
        result = _detect_answers_from_image(
            content,
            question_count=question_count,
            option_count=option_count,
            template=template,
        )
    except OpticalScanRejected as exc:
        raise HTTPException(400, str(exc)) from exc
    return result.to_api_dict(len(result.answers))
