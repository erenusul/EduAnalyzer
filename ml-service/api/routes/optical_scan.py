"""
Optik form fotoğrafından işaret tanıma
"""

from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ml_service.utils.logger import logger

router = APIRouter()

OPTIONS = ["A", "B", "C", "D", "E"]


def _detect_answers_from_image(image_bytes: bytes, question_count: int = 20) -> List[str]:
    """
    Optik form görüntüsünden işaretleri tespit et.
    Basit grid yaklaşımı: görüntüyü question_count x 5 grid'e böl, her hücrenin
    ortalama yoğunluğuna göre en koyu (işaretli) seçeneği belirle.
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

        h, w = img.shape
        rows = min(question_count, 40)
        cols = 5

        answers = []
        cell_h = h // rows
        cell_w = w // cols

        for r in range(rows):
            if len(answers) >= question_count:
                break
            row_means = []
            for c in range(cols):
                y1, y2 = r * cell_h, (r + 1) * cell_h
                x1, x2 = c * cell_w, (c + 1) * cell_w
                roi = img[y1:y2, x1:x2]
                mean_val = np.mean(roi) if roi.size > 0 else 255
                row_means.append(mean_val)

            min_idx = int(np.argmin(row_means))
            threshold = 200
            if row_means[min_idx] < threshold:
                answers.append(OPTIONS[min_idx])
            else:
                answers.append("")

        return answers[:question_count]
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
