"""
OMRChecker (vendored third_party/OMRChecker) ile optik okuma köprüsü.

- Yalnızca template kimliği `lgs_turkish_omrchecker` seçildiğinde çağrılır.
- OMR_CHECKER_TEMPLATE_JSON mutlak yol ile geçerli bir template.json göstermelidir; aksi halde None döner (optical_scan dahili okuyucuya düşer).
- OMRChecker bağımlılıkları yüklü değilse veya subprocess hata verirse None döner.
"""

from __future__ import annotations

import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from copy import deepcopy
from pathlib import Path
from typing import Any, List, Optional, Tuple

import cv2
import numpy as np

from ml_service.utils.logger import logger

OmrRowResult = Tuple[str, str, float]

BRIDGE_ROOT = Path(__file__).resolve().parent
OMR_CHECKER_ROOT = BRIDGE_ROOT / "third_party" / "OMRChecker"
MAIN_PY = OMR_CHECKER_ROOT / "main.py"


def _template_json_path() -> Optional[Path]:
    raw = (os.environ.get("OMR_CHECKER_TEMPLATE_JSON") or "").strip()
    if not raw:
        return None
    p = Path(raw).expanduser()
    return p if p.is_file() else None


def _omr_checker_available() -> bool:
    if os.environ.get("OMR_CHECKER_DISABLED", "").strip().lower() in ("1", "true", "yes", "on"):
        return False
    return MAIN_PY.is_file()


def _letterbox_align_from_env() -> str:
    v = (os.environ.get("OMR_CHECKER_LETTERBOX_ALIGN") or "top").strip().lower()
    return "center" if v == "center" else "top"


def _fit_canvas_and_rescale_template(
    bgr: np.ndarray,
    template_path: Path,
    align: str,
) -> Optional[Tuple[np.ndarray, dict[str, Any]]]:
    """
    OMRChecker, girdiyi pageDimensions boyutuna en-boy bağımsız resize eder; telefon en-boy oranı
    farklı olunca şablon ızgarası kayar (sık görülen sonuç: tüm satırlarda A).

    Çözüm: görüntüyü oran koruyarak pageDimensions içine sığdır (letterbox), ardından origin /
    bubbleDimensions / gaps değerlerini aynı ölçek ve pad ile güncelle.
    """
    try:
        with open(template_path, encoding="utf-8") as f:
            tmpl = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("OMRChecker: şablon JSON okunamadı (%s): %s", template_path, e)
        return None

    pd = tmpl.get("pageDimensions")
    if not isinstance(pd, (list, tuple)) or len(pd) < 2:
        return None
    page_w, page_h = int(pd[0]), int(pd[1])
    if page_w < 32 or page_h < 32:
        return None

    h_in, w_in = bgr.shape[:2]
    if h_in < 16 or w_in < 16:
        return None

    scale = min(page_w / float(w_in), page_h / float(h_in))
    sw = max(1, int(round(w_in * scale)))
    sh = max(1, int(round(h_in * scale)))
    resized = cv2.resize(bgr, (sw, sh), interpolation=cv2.INTER_AREA)

    pad_x = max(0, (page_w - sw) // 2)
    if align == "center":
        pad_y = max(0, (page_h - sh) // 2)
    else:
        pad_y = 0

    canvas = np.full((page_h, page_w, 3), 255, dtype=np.uint8)
    canvas[pad_y : pad_y + sh, pad_x : pad_x + sw] = resized

    sx = sw / float(page_w)
    sy = sh / float(page_h)

    out = deepcopy(tmpl)
    fb = out.get("fieldBlocks")
    if not isinstance(fb, dict):
        return None

    for _name, block in fb.items():
        if not isinstance(block, dict):
            continue
        org = block.get("origin")
        if isinstance(org, (list, tuple)) and len(org) >= 2:
            ox, oy = float(org[0]), float(org[1])
            block["origin"] = [
                int(round(pad_x + ox * sx)),
                int(round(pad_y + oy * sy)),
            ]
        bd = block.get("bubbleDimensions")
        if isinstance(bd, (list, tuple)) and len(bd) >= 2:
            block["bubbleDimensions"] = [
                max(8, int(round(float(bd[0]) * sx))),
                max(8, int(round(float(bd[1]) * sy))),
            ]
        if "bubblesGap" in block and isinstance(block["bubblesGap"], (int, float)):
            block["bubblesGap"] = max(4, int(round(float(block["bubblesGap"]) * sx)))
        if "labelsGap" in block and isinstance(block["labelsGap"], (int, float)):
            block["labelsGap"] = max(4, int(round(float(block["labelsGap"]) * sy)))

    return canvas, out


def try_read_with_omr_checker(
    image_jpeg_bytes: bytes,
    question_count: int,
    option_count: int,
) -> Optional[List[OmrRowResult]]:
    """
    Tek görüntü için OMRChecker subprocess çalıştırır; başarılıysa (answer, status, confidence) listesi.
    Aksi halde None (çağıran dahili pipeline kullanır).
    """
    tpl = _template_json_path()
    if tpl is None:
        logger.info(
            "OMRChecker: OMR_CHECKER_TEMPLATE_JSON tanımlı değil; dahili optik okuyucu kullanılacak."
        )
        return None
    if not _omr_checker_available():
        logger.warning("OMRChecker: third_party/OMRChecker veya main.py yok; atlanıyor.")
        return None
    if question_count < 1 or question_count > 60:
        return None
    option_count = max(4, min(5, option_count))

    work_root = tempfile.mkdtemp(prefix="eduanalyzer_omr_")
    try:
        in_dir = Path(work_root) / "sheet"
        out_dir = Path(work_root) / "outputs"
        in_dir.mkdir(parents=True)
        out_dir.mkdir(parents=True)
        scan_path = in_dir / "scan.jpg"
        template_dest = in_dir / "template.json"

        skip_letterbox = (os.environ.get("OMR_CHECKER_NO_LETTERBOX") or "").strip().lower() in (
            "1",
            "true",
            "yes",
            "on",
        )
        jpeg_for_omr = image_jpeg_bytes
        if not skip_letterbox:
            nparr = np.frombuffer(image_jpeg_bytes, np.uint8)
            bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if bgr is not None:
                fitted = _fit_canvas_and_rescale_template(
                    bgr, tpl, _letterbox_align_from_env()
                )
                if fitted is not None:
                    canvas_bgr, tmpl_adj = fitted
                    ok_enc, enc = cv2.imencode(
                        ".jpg", canvas_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 92]
                    )
                    if ok_enc:
                        jpeg_for_omr = enc.tobytes()
                        template_dest.write_text(
                            json.dumps(tmpl_adj, ensure_ascii=False, indent=2),
                            encoding="utf-8",
                        )
                    else:
                        shutil.copy(tpl, template_dest)
                else:
                    shutil.copy(tpl, template_dest)
            else:
                shutil.copy(tpl, template_dest)
        else:
            shutil.copy(tpl, template_dest)

        if not template_dest.is_file() or template_dest.stat().st_size == 0:
            shutil.copy(tpl, template_dest)

        scan_path.write_bytes(jpeg_for_omr)

        cmd = [
            sys.executable,
            str(MAIN_PY),
            "-i",
            str(in_dir),
            "-o",
            str(out_dir),
        ]
        env = {**os.environ}
        env.setdefault("PYTHONIOENCODING", "utf-8")
        # Başsız ortamda GUI kütüphanelerini tetiklememek için
        env.setdefault("MPLBACKEND", "Agg")

        proc = subprocess.run(
            cmd,
            cwd=str(OMR_CHECKER_ROOT),
            capture_output=True,
            timeout=120,
            env=env,
        )
        if proc.returncode != 0:
            err = (proc.stderr or b"").decode("utf-8", errors="replace")[:2000]
            logger.warning("OMRChecker subprocess hata (kod=%s): %s", proc.returncode, err)
            return None

        results_dir = out_dir / "Results"
        if not results_dir.is_dir():
            logger.warning("OMRChecker: Results klasörü yok.")
            return None
        csv_files = sorted(results_dir.glob("Results_*.csv"))
        if not csv_files:
            logger.warning("OMRChecker: Results CSV bulunamadı.")
            return None
        csv_path = csv_files[-1]

        reads = _parse_omr_results_csv(csv_path, question_count, option_count)
        if reads is None:
            return None
        logger.info("OMRChecker: %s soru okundu (şablon: %s).", len(reads), tpl)
        return reads
    except subprocess.TimeoutExpired:
        logger.warning("OMRChecker: zaman aşımı.")
        return None
    except Exception as e:
        logger.warning("OMRChecker: beklenmeyen hata: %s", e, exc_info=True)
        return None
    finally:
        shutil.rmtree(work_root, ignore_errors=True)


def _parse_omr_results_csv(
    csv_path: Path,
    question_count: int,
    option_count: int,
) -> Optional[List[OmrRowResult]]:
    """Results_*.csv son veri satırından q1..qN sütunlarını çıkarır."""
    try:
        with open(csv_path, newline="", encoding="utf-8", errors="replace") as f:
            rows = list(csv.DictReader(f))
    except OSError as e:
        logger.warning("OMRChecker CSV okunamadı: %s", e)
        return None
    if not rows:
        return None
    row = rows[-1]
    q_cols: dict[int, str] = {}
    pat = re.compile(r"^q(\d+)$", re.IGNORECASE)
    for key, val in row.items():
        if key is None:
            continue
        m = pat.match(str(key).strip())
        if m:
            q_cols[int(m.group(1))] = str(val).strip() if val is not None else ""

    letters = set("ABCDE"[:option_count])
    reads: List[OmrRowResult] = []
    for i in range(1, question_count + 1):
        raw = q_cols.get(i, "")
        up = raw.upper().strip()
        if not up or up in ("", "NA", "N/A", "NONE"):
            reads.append(("", "empty", 0.0))
            continue
        ch = up[0]
        if ch in letters:
            reads.append((ch, "ok", 0.88))
        else:
            reads.append(("", "ambiguous", 0.45))
    return reads
