"""
Optik form fotoğrafından işaret tanıma.

Faz 1 yaklaşımı:
- köşe marker'larını algıla
- perspektifi düzelt
- iç grid üzerinde adaptif eşikleme ve doluluk oranı ile şık seç
"""

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, List, Tuple

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ml_service.optical_template_mm import (
    get_lgs_turkish_template_mm,
    get_sozel_template_mm,
    get_turkish_column_crop_template_mm,
)
from ml_service.omr_checker_bridge import (
    DEFAULT_COLUMN_TEMPLATE_JSON,
    try_read_with_omr_checker,
)
from ml_service.utils.logger import logger

router = APIRouter()

OPTIONS_5 = ["A", "B", "C", "D", "E"]
OPTIONS_4 = ["A", "B", "C", "D"]

# A4 baskı (212×300 mm) Türkçe şablon kimliği — mm değerleri ml_service.optical_template_mm + OPTICAL_LGS_* env.
TEMPLATE_LGS_TURKISH_212X300 = "lgs_turkish_212x300"

# SÖZEL kırpıntı şablon kimliği — mm değerleri optical_template_mm + OPTICAL_SOZEL_* env ile kalibre edilir.
TEMPLATE_LGS_SOZEL_CROP_117X107 = "lgs_sozel_crop_117x107"

# Yalnızca TÜRKÇE sütunu (dar kadraj; 4 veya 5 şık) — kadraj = kırpıntı; OPTICAL_TR_COL_* env.
TEMPLATE_LGS_TURKISH_COLUMN_CROP = "lgs_turkish_column_crop"

# OMRChecker (third_party/OMRChecker) — OMR_CHECKER_TEMPLATE_JSON zorunlu; yoksa veya hata olursa dahili lgs_turkish_212x300 okumasına düşülür.
TEMPLATE_LGS_TURKISH_OMRCHECKER = "lgs_turkish_omrchecker"

# A4 tam sayfa: uzak kadrajda köşe kareleri _find_corner_markers eşiğinin altında kalınca
# markers_detected/perspective_ok false olur; backend kesin politika reddeder. Yeterli çözünürlükte
# okumayı denemeye izin ver (lgs_turkish_column_crop ile aynı fikir).
_FULLPAGE_MIN_SHORT_EDGE_FOR_MARKER_FALLBACK_PX = 560
_TURKISH_COLUMN_MIN_WARPED_W_PX = 96
_TURKISH_COLUMN_MIN_WARPED_H_PX = 300
_TURKISH_COLUMN_TARGET_ASPECT = 26.0 / 88.0
_TURKISH_COLUMN_PINK_BOX_W_MM = 26.0
_TURKISH_COLUMN_PINK_BOX_H_MM = 85.0
_TURKISH_COLUMN_EXTRA_BOTTOM_MM = 6.0
_TURKISH_LEFT_PANEL_TARGET_ASPECT = 0.66
_TURKISH_LEFT_PANEL_MIN_W_PX = 280
_TURKISH_LEFT_PANEL_MIN_H_PX = 500
_TURKISH_LEFT_PANEL_Q1_CY_RATIO = 0.186
_TURKISH_LEFT_PANEL_Q20_CY_RATIO = 0.954
_TURKISH_LEFT_PANEL_AX_RATIO = 0.109
_TURKISH_LEFT_PANEL_BX_RATIO = 0.181
_TURKISH_LEFT_PANEL_CX_RATIO = 0.247
_TURKISH_LEFT_PANEL_DX_RATIO = 0.314
_TURKISH_DEBUG_DIR = Path(__file__).resolve().parents[2] / "debug"


def _turkish_narrow_analysis_rect_clamped_to_min(
    x: int, y: int, w: int, h: int, image_w: int, image_h: int
) -> tuple[int, int, int, int]:
    """
    Maske bbox'ı sütunu yatayda daraltabiliyor; tam kadraj yeterliyse merkez korunarak
    minimum okuma pikseline genişletilir (sentetik dar sütun + gerçek foto tutarlılığı).
    """
    w0, h0 = int(w), int(h)
    w_req = min(image_w, max(w0, _TURKISH_COLUMN_MIN_WARPED_W_PX))
    h_req = min(image_h, max(h0, _TURKISH_COLUMN_MIN_WARPED_H_PX))
    cx = x + w0 * 0.5
    cy = y + h0 * 0.5
    x1 = int(round(cx - w_req * 0.5))
    y1 = int(round(cy - h_req * 0.5))
    x1 = max(0, min(x1, image_w - w_req))
    y1 = max(0, min(y1, image_h - h_req))
    return x1, y1, w_req, h_req


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
    scan_metadata: dict[str, Any] = field(default_factory=dict)

    def to_api_dict(self, question_count: int) -> dict[str, Any]:
        # .NET JsonNamingPolicy.SnakeCaseLower ile uyumlu anahtarlar
        d: dict[str, Any] = {
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
        if self.scan_metadata:
            d["scan_metadata"] = self.scan_metadata
        return d


def _question_read_summary(reads: List[QuestionRead]) -> dict[str, Any]:
    non_empty_answers = [r.answer for r in reads if (r.answer or "").strip()]
    unique_answers = sorted(set(non_empty_answers))
    counts: dict[str, int] = {}
    for ans in non_empty_answers:
        counts[ans] = counts.get(ans, 0) + 1
    dominant_answer = ""
    dominant_count = 0
    if counts:
        dominant_answer, dominant_count = max(counts.items(), key=lambda item: item[1])
    return {
        "total": len(reads),
        "non_empty": len(non_empty_answers),
        "unique_answers": unique_answers,
        "dominant_answer": dominant_answer,
        "dominant_count": dominant_count,
        "dominant_ratio": (dominant_count / float(max(len(non_empty_answers), 1))),
    }


def _looks_like_collapsed_single_option(reads: List[QuestionRead], question_count: int) -> bool:
    """
    OMR şablonu kaydığında sık görülen belirti: neredeyse tüm dolu cevaplar tek şıkta toplanır (örn. hep A).
    Gerçek optikte mümkündür ama 20 soruluk testlerde düşük olasılık; Türkçe sütunu için bunu şüpheli say.
    """
    s = _question_read_summary(reads)
    if question_count < 8:
        return False
    if s["non_empty"] < max(6, int(question_count * 0.35)):
        return False
    if len(s["unique_answers"]) <= 1 and s["dominant_ratio"] >= 0.9:
        return True
    if len(s["unique_answers"]) <= 2 and s["dominant_ratio"] >= 0.82:
        return True
    return False


def _min_area_skew_deg_from_xy(xy: Any) -> float:
    """minAreaRect ile [-45,45] derece yaklaşık gövde eğikliği (Otsu veya Canny noktaları)."""
    import cv2
    import numpy as np

    if xy is None or len(xy) < 30:
        return 0.0
    rect = cv2.minAreaRect(xy.astype(np.float32))
    angle = float(rect[-1])
    rw, rh = rect[1]
    if rw < rh:
        angle -= 90.0
    while angle < -45.0:
        angle += 90.0
    while angle > 45.0:
        angle -= 90.0
    return float(angle)


def _maybe_deskew_bgr_light(bgr) -> tuple[Any, dict[str, Any]]:
    """
    Dar TÜRKÇE kadrajda çok küçük telefon eğikliği için hafif deskew (QR'daki hafif düzeltme fikri).
    Varsayılan açık (OPTICAL_TR_COL_DESKEW=1); kapatmak için 0/false.
    Otsu ön plan + Canny kontur ikili tahminden güçlü olanı seçer (daire ağırlıklı kadrajda Otsu bazen ~0 döner).
    """
    import cv2
    import numpy as np

    meta: dict[str, Any] = {"deskew_applied": False, "deskew_angle_deg": 0.0}
    v = (os.environ.get("OPTICAL_TR_COL_DESKEW") or "1").strip().lower()
    if v in ("0", "false", "no", "off"):
        return bgr, meta
    if bgr is None or bgr.size == 0:
        return bgr, meta
    h, w = bgr.shape[:2]
    if h < 80 or w < 40:
        return bgr, meta

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    ys, xs = np.where(bw > 0)
    ang1 = 0.0
    if len(xs) >= 80:
        coords = np.column_stack((xs, ys))
        ang1 = _min_area_skew_deg_from_xy(coords)
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blur, 50, 150)
    ey, ex = np.where(edges > 0)
    ang2 = 0.0
    if len(ex) >= 40:
        ang2 = _min_area_skew_deg_from_xy(np.column_stack((ex, ey)))
    angle = ang1 if abs(ang1) >= abs(ang2) else ang2
    max_abs = float(os.environ.get("OPTICAL_TR_COL_DESKEW_MAX_DEG", "5.5") or "5.5")
    dead = float(os.environ.get("OPTICAL_TR_COL_DESKEW_DEAD_DEG", "0.75") or "0.75")
    if max(abs(ang1), abs(ang2)) < dead:
        return bgr, meta
    if abs(angle) > max_abs:
        angle = float(np.sign(angle) * max_abs)
    meta["deskew_angle_deg"] = round(angle, 3)
    center = (w * 0.5, h * 0.5)
    m = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        bgr,
        m,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255),
    )
    meta["deskew_applied"] = True
    return rotated, meta


def _try_decode_optional_qr_from_bgr(bgr) -> str | None:
    """
    Kağıttaki küçük QR (sınav/öğrenci meta) — isteğe bağlı; OPTICAL_TR_COL_SCAN_QR=1 ile açılır.
    """
    v = (os.environ.get("OPTICAL_TR_COL_SCAN_QR") or "").strip().lower()
    if v not in ("1", "true", "yes", "on"):
        return None
    try:
        import cv2

        det = cv2.QRCodeDetector()
        r = det.detectAndDecode(bgr)
        if len(r) >= 1 and isinstance(r[0], str) and r[0].strip():
            return r[0].strip()
        h, w = bgr.shape[:2]
        mx = max(32, min(w, h) // 5)
        my = max(32, min(w, h) // 5)
        rois = (
            bgr[0:my, 0:mx],
            bgr[0:my, max(0, w - mx) : w],
            bgr[max(0, h - my) : h, 0:mx],
            bgr[max(0, h - my) : h, max(0, w - mx) : w],
        )
        for roi in rois:
            if roi is None or roi.size == 0:
                continue
            r2 = det.detectAndDecode(roi)
            if len(r2) >= 1 and isinstance(r2[0], str) and r2[0].strip():
                return r2[0].strip()
    except Exception:
        return None
    return None


def _refine_narrow_row_cy_max_hybrid_sum(
    binary,
    gray,
    width: int,
    height: int,
    centers_x: list[float],
    cy_nominal: float,
    radius: int,
    row_step_px: float,
    binary_weight: float = 0.46,
) -> float:
    """Nominal Y etrafında kısa aralıkta hibrit skor toplamını maksimize eder (hafif QR-benzeri hizalama)."""
    import numpy as np

    r = int(max(4, radius))
    rsp = max(float(row_step_px), 1.0)
    half = min(max(rsp * 0.16, 2.5), 7.0)
    y_lo = float(r + 1)
    y_hi = float(max(r + 1, height - r - 1))
    if y_lo >= y_hi:
        return float(max(y_lo, min(y_hi, cy_nominal)))

    best_sum = -1.0
    best_y = float(cy_nominal)
    for y in np.linspace(cy_nominal - half, cy_nominal + half, num=9):
        yy = float(max(y_lo, min(y_hi, y)))
        scores, _ = _row_scores_from_centers_hybrid(
            binary, gray, width, height, centers_x, yy, r, binary_weight=binary_weight
        )
        s = float(sum(scores)) if scores else 0.0
        if s > best_sum + 1e-6 or (
            abs(s - best_sum) <= 1e-6 and abs(yy - cy_nominal) < abs(best_y - cy_nominal)
        ):
            best_sum = s
            best_y = yy
    return best_y


def _turkish_sentinel_check(reads: List[QuestionRead], question_count: int) -> None:
    """
    Baskıda bilinen sentinel satırı (env) — tutmazsa kadraj/şablon şüphesi.
    OPTICAL_TR_COL_SENTINEL_ROW=1..N, OPTICAL_TR_COL_SENTINEL_EXPECT= boş veya A|B|...
    """
    raw = (os.environ.get("OPTICAL_TR_COL_SENTINEL_ROW") or "").strip()
    if not raw:
        return
    try:
        row_1 = int(raw)
    except ValueError:
        return
    if row_1 < 1 or row_1 > question_count or row_1 > len(reads):
        return
    expect = (os.environ.get("OPTICAL_TR_COL_SENTINEL_EXPECT") or "").strip().upper()
    got = (reads[row_1 - 1].answer or "").strip().upper()
    if expect == "":
        if got != "":
            raise OpticalScanRejected(
                "Kalibrasyon satırı boş olmalıydı; kadrajı veya şablonu kontrol edip yeniden çekin."
            )
        return
    if got != expect:
        raise OpticalScanRejected(
            f"Kalibrasyon satırı ({row_1}) beklenen '{expect}' iken '{got or '(boş)'}' okundu; formu düzeltip tekrar deneyin."
        )


def _turkish_collapsed_consistency_check(reads: List[QuestionRead], question_count: int) -> None:
    """Şüpheli tek-şık çöküşü (OPTICAL_TR_COL_REJECT_COLLAPSED=1)."""
    v = (os.environ.get("OPTICAL_TR_COL_REJECT_COLLAPSED") or "").strip().lower()
    if v not in ("1", "true", "yes", "on"):
        return
    if _looks_like_collapsed_single_option(reads, question_count):
        raise OpticalScanRejected(
            "Okuma tutarsız görünüyor (neredeyse tüm cevaplar tek şıkta). Formu daha yakından ve net çekin."
        )


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


def _normalize_uploaded_image_bytes(image_bytes: bytes) -> bytes:
    """
    Galeriden seçilen JPEG'lerde EXIF orientation sık görülür; OpenCV bunu her zaman uygulamaz.
    Pillow ile orientation'ı düzeltip tekrar kodla.
    """
    from io import BytesIO

    try:
        from PIL import Image, ImageOps
    except ImportError:
        return image_bytes

    try:
        with Image.open(BytesIO(image_bytes)) as img:
            normalized = ImageOps.exif_transpose(img)
            if normalized.mode not in ("RGB", "L"):
                normalized = normalized.convert("RGB")
            buf = BytesIO()
            fmt = "PNG" if (img.format or "").upper() == "PNG" else "JPEG"
            save_kwargs = {"format": fmt}
            if fmt == "JPEG":
                save_kwargs["quality"] = 95
                save_kwargs["optimize"] = True
            normalized.save(buf, **save_kwargs)
            out = buf.getvalue()
            return out or image_bytes
    except Exception:
        return image_bytes


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


def _clip_rect(x: int, y: int, w: int, h: int, max_w: int, max_h: int) -> tuple[int, int, int, int]:
    x1 = max(0, min(int(round(x)), max_w - 1))
    y1 = max(0, min(int(round(y)), max_h - 1))
    x2 = max(x1 + 1, min(int(round(x + w)), max_w))
    y2 = max(y1 + 1, min(int(round(y + h)), max_h))
    return x1, y1, x2 - x1, y2 - y1


def _score_turkish_column_rect(x: int, y: int, w: int, h: int, image_w: int, image_h: int) -> float:
    area_ratio = (w * h) / float(max(image_w * image_h, 1))
    if area_ratio < 0.025 or area_ratio > 0.82:
        return -1.0

    aspect = w / float(max(h, 1))
    if not 0.14 <= aspect <= 0.46:
        return -1.0

    # Tam sayfa fotoğrafta sağdaki dikey renk bandı dar sütun sanılabiliyor.
    if y <= int(image_h * 0.05) and h >= int(image_h * 0.88) and x >= int(image_w * 0.18):
        return -1.0

    aspect_score = 1.0 - min(1.0, abs(aspect - _TURKISH_COLUMN_TARGET_ASPECT) / _TURKISH_COLUMN_TARGET_ASPECT)
    height_score = min(1.0, h / max(image_h * 0.58, 1.0))
    area_score = min(1.0, area_ratio / 0.18)
    top_bias = 1.0 - min(1.0, y / max(image_h * 0.7, 1.0))
    return aspect_score * 0.52 + height_score * 0.23 + area_score * 0.17 + top_bias * 0.08


def _score_turkish_left_panel_rect(x: int, y: int, w: int, h: int, image_w: int, image_h: int) -> float:
    area_ratio = (w * h) / float(max(image_w * image_h, 1))
    if area_ratio < 0.12 or area_ratio > 0.9:
        return -1.0

    aspect = w / float(max(h, 1))
    if not 0.48 <= aspect <= 0.82:
        return -1.0

    aspect_score = 1.0 - min(
        1.0,
        abs(aspect - _TURKISH_LEFT_PANEL_TARGET_ASPECT) / _TURKISH_LEFT_PANEL_TARGET_ASPECT,
    )
    area_score = min(1.0, area_ratio / 0.42)
    top_bias = 1.0 - min(1.0, y / max(image_h * 0.25, 1.0))
    left_bias = 1.0 - min(1.0, x / max(image_w * 0.25, 1.0))
    return aspect_score * 0.48 + area_score * 0.28 + top_bias * 0.14 + left_bias * 0.10


def _find_turkish_column_rect_from_mask(mask, image_shape, method: str) -> dict[str, Any] | None:
    import cv2

    image_h, image_w = image_shape[:2]
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best: dict[str, Any] | None = None

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        score = _score_turkish_column_rect(x, y, w, h, image_w, image_h)
        if score < 0:
            continue

        if method == "magenta":
            extra_bottom_px = int(round(h * max(0.0, _TURKISH_COLUMN_EXTRA_BOTTOM_MM / _TURKISH_COLUMN_PINK_BOX_H_MM)))
            analysis_rect = _clip_rect(
                x - int(round(w * 0.03)),
                y - int(round(h * 0.02)),
                w + int(round(w * 0.06)),
                h + int(round(h * 0.04)) + extra_bottom_px,
                image_w,
                image_h,
            )
        else:
            analysis_rect = _clip_rect(
                x - int(round(w * 0.04)),
                y - int(round(h * 0.03)),
                w + int(round(w * 0.08)),
                h + int(round(h * 0.06)),
                image_w,
                image_h,
            )

        candidate = {
            "method": method,
            "score": round(score, 4),
            "source_rect": (int(x), int(y), int(w), int(h)),
            "analysis_rect": analysis_rect,
        }
        if best is None or candidate["score"] > best["score"]:
            best = candidate

    return best


def _find_turkish_left_panel_rect_from_mask(mask, image_shape) -> dict[str, Any] | None:
    import cv2

    image_h, image_w = image_shape[:2]
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best: dict[str, Any] | None = None

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        score = _score_turkish_left_panel_rect(x, y, w, h, image_w, image_h)
        if score < 0:
            continue

        analysis_rect = _clip_rect(
            x - int(round(w * 0.01)),
            y - int(round(h * 0.01)),
            w + int(round(w * 0.02)),
            h + int(round(h * 0.02)),
            image_w,
            image_h,
        )
        candidate = {
            "kind": "left_panel",
            "method": "orange_panel",
            "score": round(score, 4),
            "source_rect": (int(x), int(y), int(w), int(h)),
            "analysis_rect": analysis_rect,
        }
        if best is None or candidate["score"] > best["score"]:
            best = candidate

    return best


def _try_crop_turkish_column_region(bgr_image) -> tuple[Any, dict[str, Any] | None]:
    """
    Dar TÜRKÇE sütun fotoğraflarında önce pembe kutuyu bulup analize o bölgeyi ver.
    Tam tespit edilemezse görüntüyü olduğu gibi döndür.
    """
    import cv2
    import numpy as np

    if bgr_image is None or bgr_image.size == 0:
        return bgr_image, None

    image_h, image_w = bgr_image.shape[:2]
    aspect_wh = image_w / float(max(image_h, 1))
    if (
        image_w >= _TURKISH_COLUMN_MIN_WARPED_W_PX
        and image_h >= _TURKISH_COLUMN_MIN_WARPED_H_PX
        and aspect_wh <= 0.40
        and not _looks_like_saturated_color_print(bgr_image)
    ):
        # Zaten dar siyah-beyaz sütun kadrajı: karanlık maske bbox'ı mm ölçeğini bozmasın.
        return bgr_image, None

    hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
    mask_magenta = cv2.inRange(hsv, np.array([130, 35, 45]), np.array([175, 255, 255]))
    mask_red_wrap = cv2.inRange(hsv, np.array([0, 35, 45]), np.array([12, 255, 255]))
    color_mask = cv2.bitwise_or(mask_magenta, mask_red_wrap)

    kx = max(5, int(round(image_w * 0.025)))
    ky = max(7, int(round(image_h * 0.025)))
    kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (kx | 1, ky | 1))
    kernel_dilate = cv2.getStructuringElement(cv2.MORPH_RECT, (max(3, kx // 2) | 1, max(3, ky // 2) | 1))

    orange_mask = cv2.inRange(hsv, np.array([3, 18, 70]), np.array([35, 255, 255]))
    orange_mask = cv2.morphologyEx(orange_mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)
    orange_mask = cv2.dilate(orange_mask, kernel_dilate, iterations=2)
    panel_meta = _find_turkish_left_panel_rect_from_mask(orange_mask, bgr_image.shape)
    if panel_meta is not None:
        x, y, w, h = panel_meta["analysis_rect"]
        panel_meta["crop_size"] = (int(w), int(h))
        return bgr_image[y : y + h, x : x + w], panel_meta

    color_mask = cv2.morphologyEx(color_mask, cv2.MORPH_CLOSE, kernel_close, iterations=2)
    color_mask = cv2.dilate(color_mask, kernel_dilate, iterations=1)

    crop_meta = _find_turkish_column_rect_from_mask(color_mask, bgr_image.shape, "magenta")
    if crop_meta is not None:
        x, y, w, h = crop_meta["source_rect"]
        right_edge = x + w
        if (
            y <= int(image_h * 0.06)
            and h >= int(image_h * 0.82)
            and right_edge >= int(image_w * 0.9)
        ):
            panel_w = int(round(h * _TURKISH_LEFT_PANEL_TARGET_ASPECT))
            panel_rect = _clip_rect(
                right_edge - panel_w,
                y - int(round(h * 0.01)),
                panel_w,
                h + int(round(h * 0.02)),
                image_w,
                image_h,
            )
            px, py, pw, ph = panel_rect
            expanded_meta = {
                "kind": "left_panel",
                "method": "magenta_expanded_left_panel",
                "score": round(crop_meta["score"], 4),
                "source_rect": crop_meta["source_rect"],
                "analysis_rect": panel_rect,
                "crop_size": (int(pw), int(ph)),
            }
            return bgr_image[py : py + ph, px : px + pw], expanded_meta
        x, y, w, h = crop_meta["analysis_rect"]
        crop_meta["kind"] = "narrow_column"
        x, y, w, h = _turkish_narrow_analysis_rect_clamped_to_min(x, y, w, h, image_w, image_h)
        crop_meta["analysis_rect"] = (x, y, w, h)
        crop_meta["crop_size"] = (int(w), int(h))
        return bgr_image[y : y + h, x : x + w], crop_meta

    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    binary = _prepare_binary_lgs(gray)
    kernel_fallback = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (max(5, int(round(image_w * 0.05))) | 1, max(7, int(round(image_h * 0.035))) | 1),
    )
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel_fallback, iterations=1)
    binary = cv2.dilate(binary, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=1)
    crop_meta = _find_turkish_column_rect_from_mask(binary, bgr_image.shape, "dark")
    if crop_meta is not None:
        x, y, w, h = crop_meta["analysis_rect"]
        crop_meta["kind"] = "narrow_column"
        x, y, w, h = _turkish_narrow_analysis_rect_clamped_to_min(x, y, w, h, image_w, image_h)
        crop_meta["analysis_rect"] = (x, y, w, h)
        crop_meta["crop_size"] = (int(w), int(h))
        return bgr_image[y : y + h, x : x + w], crop_meta

    return bgr_image, None


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


def _row_scores_from_centers_hybrid_vertical_slack(
    binary,
    gray,
    width: int,
    height: int,
    centers_x: list[float],
    center_y: float,
    radius: int,
    row_step_px: float,
    binary_weight: float = 0.46,
    *,
    slack_half_scale: float = 1.0,
    slack_num_samples: int = 7,
) -> tuple[list[float], list[str]]:
    """
    Hibrit skorları nominal Y etrafında birkaç örnekten alıp şık başına en iyi değeri seç.
    Dar kırpıntıda küçük eğiklik / crop kaymalarını daha iyi tolere eder.
    """
    import numpy as np

    r = int(max(4, radius))
    rsp = max(float(row_step_px), 1.0)
    half = min(rsp * 0.22, max(float(r) * 1.7, rsp * 0.12))
    half = max(half, 1.0) * max(0.5, float(slack_half_scale))
    num_samples = max(5, int(slack_num_samples))

    y_lo = float(r + 1)
    y_hi = float(max(r + 1, height - r - 1))
    if y_lo >= y_hi:
        y_mid = max(0.0, min(float(height - 1), float(center_y)))
        y_lo = y_hi = y_mid

    options = _get_options(len(centers_x))
    best_scores = [0.0 for _ in centers_x]
    cy = float(center_y)
    for dy in np.linspace(-half, half, num=num_samples):
        y = max(y_lo, min(y_hi, cy + float(dy)))
        scores, _ = _row_scores_from_centers_hybrid(
            binary, gray, width, height, centers_x, y, r, binary_weight=binary_weight
        )
        best_scores = [max(prev, cur) for prev, cur in zip(best_scores, scores)]

    nominal_scores, _ = _row_scores_from_centers_hybrid(
        binary, gray, width, height, centers_x, max(y_lo, min(y_hi, cy)), r, binary_weight=binary_weight
    )
    best_scores = [max(prev, cur) for prev, cur in zip(best_scores, nominal_scores)]
    return best_scores, options


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


def _row_read_turkish_left_panel_orange(
    option_scores: list[float], options: list[str]
) -> QuestionRead:
    """
    Turuncu baskılı daire konturları boş satırda birden fazla şıkta yapay yüksek skor üretebilir.
    Üç veya daha fazla şık orta-yüksek görünüyorsa işaretsiz (boş) varsay.
    """
    if not option_scores:
        return QuestionRead("", "empty", 0.0)
    outline_floor = 0.22
    if sum(1 for s in option_scores if s >= outline_floor) >= 3:
        return QuestionRead("", "empty", float(max(option_scores)))
    return _row_read_lgs(option_scores, options)


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
    form_image,
    question_count: int,
    option_count: int = 4,
    *,
    use_vertical_slack: bool | None = None,
    refine_row_y: bool = False,
) -> List[QuestionRead]:
    """
    Tek sütun TÜRKÇE kırpıntısı; görüntü OPTICAL_TR_COL_PAGE_* mm dikdörtgenine denk gelmeli.

    Dar kırpıntıda otomatik crop sonrası hibrit skor + dikey slack ile küçük geometri kaymalarını tolere et.
    Zaten hizalı dar kadrajda (otomatik kırpım yok) slack komşu satır gürültüsü yaratabilir; bu durumda kapatılır.
    refine_row_y: otomatik kırpım sonrası (crop_meta varken) satır Y için kısa hibrit skor maksimizasyonu.
    """
    oc = max(4, min(5, int(option_count)))
    tm = get_turkish_column_crop_template_mm()
    gray = form_image
    binary = _prepare_binary_lgs(form_image)
    height, width = binary.shape
    # ad_centers_span_mm = A–D merkez aralığı (3 aralık); 4 veya 5 şıkta aynı adım span/3.
    option_step_mm = tm.ad_centers_span_mm / 3.0
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
        cy_px += _turkish_narrow_lower_rows_y_correction_px(row, row_step_px)
        centers_x_mm = [
            tm.q1_a_cx_mm + tm.grid_offset_x_mm + c * option_step_mm for c in range(oc)
        ]
        centers_x_px = [cx / tm.page_w_mm * width for cx in centers_x_mm]
        opts = _get_options(oc)
        if refine_row_y:
            cy_px = _refine_narrow_row_cy_max_hybrid_sum(
                binary,
                gray,
                width,
                height,
                centers_x_px,
                cy_px,
                radius,
                row_step_px,
                binary_weight=0.46,
            )
        slack_on = (
            _lgs_vertical_slack_enabled()
            if use_vertical_slack is None
            else bool(use_vertical_slack)
        )
        if slack_on:
            scores, _ = _row_scores_from_centers_hybrid_vertical_slack(
                binary,
                gray,
                width,
                height,
                centers_x_px,
                cy_px,
                radius,
                row_step_px,
                binary_weight=0.46,
            )
        else:
            scores, _ = _row_scores_from_centers_hybrid(
                binary, gray, width, height, centers_x_px, cy_px, radius, binary_weight=0.46
            )
        reads.append(_row_read_lgs(scores, opts))

    while len(reads) < question_count:
        reads.append(QuestionRead("", "empty", 0.0))
    return reads[:question_count]


def _detect_answers_turkish_left_panel_orange(
    form_image, question_count: int, option_count: int = 4
) -> List[QuestionRead]:
    """
    Turuncu dış kutulu yeni optik: sol 1–20 alanında A–D veya A–E (option_count).
    5 şıkta E konumu: A–D arası eş aralık adımıyla bir adım öteye uzatılır.
    """
    oc = max(4, min(5, int(option_count)))
    gray = form_image
    binary = _prepare_binary_lgs(form_image)
    height, width = binary.shape
    if oc == 4:
        centers_x_px = [
            width * _TURKISH_LEFT_PANEL_AX_RATIO,
            width * _TURKISH_LEFT_PANEL_BX_RATIO,
            width * _TURKISH_LEFT_PANEL_CX_RATIO,
            width * _TURKISH_LEFT_PANEL_DX_RATIO,
        ]
    else:
        ax = width * _TURKISH_LEFT_PANEL_AX_RATIO
        dx = width * _TURKISH_LEFT_PANEL_DX_RATIO
        step = (dx - ax) / 3.0
        centers_x_px = [ax + i * step for i in range(5)]
    y_start = height * _TURKISH_LEFT_PANEL_Q1_CY_RATIO
    y_end = height * _TURKISH_LEFT_PANEL_Q20_CY_RATIO
    row_step_px = (y_end - y_start) / 19.0
    step_x_px = min(
        centers_x_px[i + 1] - centers_x_px[i] for i in range(len(centers_x_px) - 1)
    )
    radius = max(6, int(min(step_x_px * 0.36, row_step_px * 0.42)))

    rows = max(1, min(question_count, 20))
    reads: List[QuestionRead] = []
    opts = _get_options(oc)
    for row in range(rows):
        cy_px = y_start + row * row_step_px
        scores, _ = _row_scores_from_centers_hybrid(
            binary, gray, width, height, centers_x_px, cy_px, radius, binary_weight=0.34
        )
        reads.append(_row_read_turkish_left_panel_orange(scores, opts))

    while len(reads) < question_count:
        reads.append(QuestionRead("", "empty", 0.0))
    return reads[:question_count]


def _turkish_narrow_lower_rows_y_correction_px(row_index: int, row_step_px: float) -> float:
    """
    Alt satırlarda baskı/perspektif nedeniyle merkezler hafif yukarı kayıyor.
    İlk 13 satıra dokunma; 14-20 aralığında kademeli küçük yukarı telafi uygula.
    """
    if row_index < 13:
        return 0.0

    lower_idx = min(row_index - 13, 6)
    correction_ratio = 0.06 + lower_idx * 0.03
    return -row_step_px * correction_ratio


def _debug_rows_turkish_left_panel_orange(
    form_image, question_count: int, option_count: int = 4
) -> list[dict[str, Any]]:
    oc = max(4, min(5, int(option_count)))
    gray = form_image
    binary = _prepare_binary_lgs(form_image)
    height, width = binary.shape
    if oc == 4:
        centers_x_px = [
            width * _TURKISH_LEFT_PANEL_AX_RATIO,
            width * _TURKISH_LEFT_PANEL_BX_RATIO,
            width * _TURKISH_LEFT_PANEL_CX_RATIO,
            width * _TURKISH_LEFT_PANEL_DX_RATIO,
        ]
    else:
        ax = width * _TURKISH_LEFT_PANEL_AX_RATIO
        dx = width * _TURKISH_LEFT_PANEL_DX_RATIO
        step = (dx - ax) / 3.0
        centers_x_px = [ax + i * step for i in range(5)]
    y_start = height * _TURKISH_LEFT_PANEL_Q1_CY_RATIO
    y_end = height * _TURKISH_LEFT_PANEL_Q20_CY_RATIO
    row_step_px = (y_end - y_start) / 19.0
    step_x_px = min(
        centers_x_px[i + 1] - centers_x_px[i] for i in range(len(centers_x_px) - 1)
    )
    radius = max(6, int(min(step_x_px * 0.36, row_step_px * 0.42)))

    rows = max(1, min(question_count, 20))
    opts = _get_options(oc)
    data: list[dict[str, Any]] = []
    for row in range(rows):
        cy_px = y_start + row * row_step_px
        scores, _ = _row_scores_from_centers_hybrid(
            binary, gray, width, height, centers_x_px, cy_px, radius, binary_weight=0.34
        )
        read = _row_read_turkish_left_panel_orange(scores, opts)
        data.append(
            {
                "row": row + 1,
                "cy_px": round(cy_px, 2),
                "centers_x_px": [round(v, 2) for v in centers_x_px],
                "radius_px": radius,
                "options": list(opts),
                "scores": {opt: round(score, 4) for opt, score in zip(opts, scores)},
                "predicted": read.answer,
            }
        )
    return data


def _debug_rows_turkish_narrow_column(
    form_image,
    question_count: int,
    option_count: int = 4,
    *,
    use_vertical_slack: bool | None = None,
    refine_row_y: bool = False,
) -> list[dict[str, Any]]:
    oc = max(4, min(5, int(option_count)))
    tm = get_turkish_column_crop_template_mm()
    gray = form_image
    binary = _prepare_binary_lgs(form_image)
    height, width = binary.shape
    option_step_mm = tm.ad_centers_span_mm / 3.0
    row_step_mm = tm.q1_q20_centers_span_mm / 19.0
    row_step_px = row_step_mm / tm.page_h_mm * height
    step_x_px = option_step_mm / tm.page_w_mm * width
    radius = max(5, int(min(step_x_px, row_step_px) * tm.bubble_radius_scale))

    rows = max(1, min(question_count, 20))
    data: list[dict[str, Any]] = []
    for row in range(rows):
        cy_mm = tm.q1_a_cy_mm + row * row_step_mm + tm.grid_offset_y_mm
        cy_px = cy_mm / tm.page_h_mm * height
        cy_px += _turkish_narrow_lower_rows_y_correction_px(row, row_step_px)
        centers_x_mm = [
            tm.q1_a_cx_mm + tm.grid_offset_x_mm + c * option_step_mm for c in range(oc)
        ]
        centers_x_px = [cx / tm.page_w_mm * width for cx in centers_x_mm]
        opts = _get_options(oc)
        if refine_row_y:
            cy_px = _refine_narrow_row_cy_max_hybrid_sum(
                binary,
                gray,
                width,
                height,
                centers_x_px,
                cy_px,
                radius,
                row_step_px,
                binary_weight=0.46,
            )
        slack_on = (
            _lgs_vertical_slack_enabled()
            if use_vertical_slack is None
            else bool(use_vertical_slack)
        )
        if slack_on:
            scores, _ = _row_scores_from_centers_hybrid_vertical_slack(
                binary,
                gray,
                width,
                height,
                centers_x_px,
                cy_px,
                radius,
                row_step_px,
                binary_weight=0.46,
            )
        else:
            scores, _ = _row_scores_from_centers_hybrid(
                binary, gray, width, height, centers_x_px, cy_px, radius, binary_weight=0.46
            )
        read = _row_read_lgs(scores, opts)
        data.append(
            {
                "row": row + 1,
                "cy_px": round(cy_px, 2),
                "centers_x_px": [round(v, 2) for v in centers_x_px],
                "radius_px": radius,
                "options": list(opts),
                "scores": {opt: round(score, 4) for opt, score in zip(opts, scores)},
                "predicted": read.answer,
            }
        )
    return data


def _write_turkish_debug_artifacts(
    source_bgr,
    crop_bgr,
    crop_meta: dict[str, Any] | None,
    reader: str,
    reads: List[QuestionRead],
    row_debug: list[dict[str, Any]],
    scan_metadata: dict[str, Any] | None = None,
) -> None:
    import cv2

    if source_bgr is None or crop_bgr is None:
        return

    _TURKISH_DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    overlay = crop_bgr.copy()
    for row in row_debug:
        cy = int(round(float(row["cy_px"])))
        radius = int(row["radius_px"])
        predicted = (row.get("predicted") or "").strip().upper()
        opt_labels: list[str] = row.get("options") or ["A", "B", "C", "D"]
        for idx, cx_val in enumerate(row["centers_x_px"]):
            cx = int(round(float(cx_val)))
            opt = opt_labels[idx] if idx < len(opt_labels) else "?"
            color = (0, 180, 0) if predicted == opt else (0, 140, 255)
            cv2.circle(overlay, (cx, cy), radius, color, 2)
            cv2.putText(
                overlay,
                opt,
                (cx - 5, max(16, cy - radius - 4)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                color,
                1,
                cv2.LINE_AA,
            )
        cv2.putText(
            overlay,
            str(row["row"]),
            (10, max(16, cy + 5)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.48,
            (255, 0, 0),
            1,
            cv2.LINE_AA,
        )

    cv2.imwrite(str(_TURKISH_DEBUG_DIR / "last_turkish_source.jpg"), source_bgr)
    cv2.imwrite(str(_TURKISH_DEBUG_DIR / "last_turkish_crop.jpg"), crop_bgr)
    cv2.imwrite(str(_TURKISH_DEBUG_DIR / "last_turkish_overlay.jpg"), overlay)

    payload: dict[str, Any] = {
        "reader": reader,
        "crop_meta": crop_meta,
        "read_summary": _question_read_summary(reads),
        "answers": [r.answer for r in reads],
        "statuses": [r.status for r in reads],
        "confidences": [round(r.confidence, 4) for r in reads],
        "rows": row_debug,
    }
    if scan_metadata:
        payload["scan_metadata"] = scan_metadata
    (_TURKISH_DEBUG_DIR / "last_turkish_debug.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


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
        image_bytes = _normalize_uploaded_image_bytes(image_bytes)
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
        scan_metadata: dict[str, Any] = {}
        lgs_magenta_dropout = False
        turkish_column_crop_meta: dict[str, Any] | None = None
        turkish_column_omr_used = False
        turkish_column_reader = "opencv"
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
            # Dar Türkçe sütun modunda mobil taraf zaten yakın kadraj gönderiyor.
            # Köşe marker warp'ı bu modda gereksiz ekstra kırpmaya yol açabiliyor.
            work_bgr = bgr
            qr_text = _try_decode_optional_qr_from_bgr(work_bgr)
            if qr_text:
                scan_metadata["qr_text"] = qr_text
            work_bgr, turkish_column_crop_meta = _try_crop_turkish_column_region(work_bgr)
            ih, iw = work_bgr.shape[:2]
            crop_kind = (
                (turkish_column_crop_meta or {}).get("kind", "narrow_column")
                if turkish_column_crop_meta is not None
                else "narrow_column"
            )
            use_left_panel_reader = crop_kind == "left_panel" or (
                iw >= _TURKISH_LEFT_PANEL_MIN_W_PX
                and ih >= _TURKISH_LEFT_PANEL_MIN_H_PX
                and (iw / float(max(ih, 1))) >= 0.52
            )
            if not use_left_panel_reader:
                work_bgr, deskew_meta = _maybe_deskew_bgr_light(work_bgr)
                scan_metadata.update(deskew_meta)
            gray_lgs, lgs_magenta_dropout = _bgr_to_gray_for_lgs(work_bgr)
            gh, gw = gray_lgs.shape[:2]
            if use_left_panel_reader:
                if gw < _TURKISH_LEFT_PANEL_MIN_W_PX or gh < _TURKISH_LEFT_PANEL_MIN_H_PX:
                    raise OpticalScanRejected(
                        "Turuncu soru kutusu çok küçük veya uzak görünüyor. Sol 1-20 alanını daha yakından çekin."
                    )
            elif gw < _TURKISH_COLUMN_MIN_WARPED_W_PX or gh < _TURKISH_COLUMN_MIN_WARPED_H_PX:
                raise OpticalScanRejected(
                    "TÜRKÇE kutusu çok küçük veya uzak görünüyor. Kutuyu daha yakından çekip yeniden deneyin."
                )
            if use_left_panel_reader:
                reads = _detect_answers_turkish_left_panel_orange(
                    gray_lgs, question_count, option_count
                )
                turkish_column_reader = "opencv_left_panel"
            else:
                # Dar Türkçe sütununda OMRChecker son denemelerde B/C kaymasına yol açtı.
                # Bu yol için yalnızca debug'lanabilir OpenCV hibrit okuyucuyu kullan.
                narrow_slack = _lgs_vertical_slack_enabled() and (
                    turkish_column_crop_meta is not None
                )
                refine_y = turkish_column_crop_meta is not None
                reads = _detect_answers_lgs_turkish_column_crop(
                    gray_lgs,
                    question_count,
                    option_count,
                    use_vertical_slack=narrow_slack,
                    refine_row_y=refine_y,
                )
                turkish_column_reader = "opencv"
            if turkish_column_crop_meta is not None:
                markers_detected = True
                perspective_ok = True
            elif not markers_detected or not perspective_ok:
                # Dar kırpıntıda köşe kareleri yok; yeterli çözünürlük varsa yine okumaya izin ver.
                if gw >= _TURKISH_COLUMN_MIN_WARPED_W_PX and gh >= _TURKISH_COLUMN_MIN_WARPED_H_PX:
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

        if tmpl == TEMPLATE_LGS_TURKISH_COLUMN_CROP:
            _turkish_sentinel_check(reads, question_count)
            _turkish_collapsed_consistency_check(reads, question_count)

        answers = [r.answer for r in reads]
        result = OpticalScanFullResult(
            answers=answers,
            markers_detected=markers_detected,
            perspective_ok=perspective_ok,
            per_question=reads,
            scan_metadata=scan_metadata,
        )

        if tmpl == TEMPLATE_LGS_TURKISH_COLUMN_CROP and gray_lgs is not None:
            try:
                if turkish_column_reader == "opencv_left_panel":
                    row_debug = _debug_rows_turkish_left_panel_orange(
                        gray_lgs, question_count, option_count
                    )
                else:
                    narrow_slack = _lgs_vertical_slack_enabled() and (
                        turkish_column_crop_meta is not None
                    )
                    refine_y = turkish_column_crop_meta is not None
                    row_debug = _debug_rows_turkish_narrow_column(
                        gray_lgs,
                        question_count,
                        option_count,
                        use_vertical_slack=narrow_slack,
                        refine_row_y=refine_y,
                    )
                _write_turkish_debug_artifacts(
                    bgr,
                    work_bgr if "work_bgr" in locals() else bgr,
                    turkish_column_crop_meta,
                    turkish_column_reader,
                    reads,
                    row_debug,
                    scan_metadata=scan_metadata or None,
                )
            except Exception as debug_exc:
                logger.warning("Türkçe debug görselleri yazılamadı: %s", debug_exc)

        status_counts = {"ok": 0, "empty": 0, "ambiguous": 0}
        low_conf_rows = []
        for idx, q in enumerate(reads):
            st = (q.status or "").strip().lower()
            if st in status_counts:
                status_counts[st] += 1
            if st == "ok" and q.confidence < 0.35:
                low_conf_rows.append(idx + 1)

        log_extra = {
            "question_count": question_count,
            "option_count": option_count,
            "template": tmpl or "default",
            "markers_detected": markers_detected,
            "perspective_ok": perspective_ok,
            "detected_answers": len(answers),
            "status_counts": status_counts,
            "low_conf_rows": low_conf_rows[:10],
        }
        if tmpl in (
            TEMPLATE_LGS_TURKISH_212X300,
            TEMPLATE_LGS_TURKISH_OMRCHECKER,
            TEMPLATE_LGS_SOZEL_CROP_117X107,
            TEMPLATE_LGS_TURKISH_COLUMN_CROP,
        ):
            log_extra["lgs_magenta_dropout"] = lgs_magenta_dropout
        if turkish_column_crop_meta is not None:
            log_extra["turkish_column_crop"] = turkish_column_crop_meta
        if tmpl == TEMPLATE_LGS_TURKISH_COLUMN_CROP:
            log_extra["turkish_column_omr_used"] = turkish_column_omr_used
            log_extra["turkish_column_reader"] = turkish_column_reader
            log_extra["read_summary"] = _question_read_summary(reads)

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
    option_count: şık sayısı 4 veya 5 (varsayılan 5; lgs_turkish_column_crop için basılı A–E ile 5)
    template: lgs_sozel_crop_117x107 = 117×107 mm SÖZEL dört sütun (kadraj bu alanı doldursun);
        lgs_turkish_212x300 = A4 Türkçe tek sütun (genelde 4 şık);
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
