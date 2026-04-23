#!/usr/bin/env python3
"""
Türkçe sütun köşe etiketleme (4 tıklama: TL → TR → BR → BL).

Girdi: data/turkish_column_corners/images/*.jpg|jpeg|png
Çıktı: data/turkish_column_corners/labels/<stem>.json (example.json ile aynı şema)

Tuşlar:
  Enter  — 4 nokta seçiliyken kaydet, sonraki görüntüye geç
  R      — bu görüntüdeki noktaları sıfırla
  ESC    — çık

EduAnalyzer/ml-service kökünden:
  python -m ml_service.training.turkish_column_corners.label_ui --data-root ../../data/turkish_column_corners
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Sequence, Tuple

import cv2
import numpy as np

CORNER_ORDER: Sequence[str] = ("TL", "TR", "BR", "BL")
IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG")
MAX_DISPLAY = 1280


def _natural_stems(images_dir: Path) -> List[str]:
    stems: List[str] = []
    seen: set[str] = set()
    for suf in IMAGE_SUFFIXES:
        for p in sorted(images_dir.glob(f"*{suf}")):
            if p.stem not in seen:
                seen.add(p.stem)
                stems.append(p.stem)
    return sorted(stems, key=lambda s: s.lower())


def _find_image_path(images_dir: Path, stem: str) -> Path | None:
    for suf in IMAGE_SUFFIXES:
        p = images_dir / f"{stem}{suf}"
        if p.is_file():
            return p
    return None


def _build_json_payload(
    image_file: str,
    width: int,
    height: int,
    points_xy: List[Tuple[float, float]],
) -> dict:
    return {
        "schema_version": 1,
        "image_file": image_file,
        "image_size": {"width": width, "height": height},
        "corners_pixel": {
            "order": list(CORNER_ORDER),
            "points": [[float(x), float(y)] for x, y in points_xy],
        },
    }


@dataclass
class Session:
    data_root: Path
    stems: List[str]
    index: int = 0
    points_orig: List[Tuple[float, float]] = field(default_factory=list)
    bgr: np.ndarray | None = None
    stem: str = ""
    image_path: Path | None = None
    display_scale: float = 1.0
    window: str = "label_ui: TL -> TR -> BR -> BL | Enter=save R=reset ESC=quit"

    def load_current(self) -> bool:
        if self.index >= len(self.stems):
            return False
        self.stem = self.stems[self.index]
        img_path = _find_image_path(self.data_root / "images", self.stem)
        if img_path is None:
            print(f"[atla] görüntü yok: {self.stem}", file=sys.stderr)
            self.index += 1
            return self.load_current()
        bgr = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
        if bgr is None:
            print(f"[atla] okunamadı: {img_path}", file=sys.stderr)
            self.index += 1
            return self.load_current()
        self.bgr = bgr
        self.image_path = img_path
        self.points_orig = []
        h, w = bgr.shape[:2]
        scale = min(1.0, MAX_DISPLAY / max(h, w, 1))
        self.display_scale = scale
        return True

    def to_display(self, x: float, y: float) -> Tuple[int, int]:
        s = self.display_scale
        return int(round(x * s)), int(round(y * s))

    def to_orig(self, xd: int, yd: int) -> Tuple[float, float]:
        s = self.display_scale
        if s <= 0:
            return float(xd), float(yd)
        return float(xd) / s, float(yd) / s

    def render(self) -> np.ndarray | None:
        if self.bgr is None:
            return None
        h, w = self.bgr.shape[:2]
        disp = cv2.resize(
            self.bgr,
            (int(round(w * self.display_scale)), int(round(h * self.display_scale))),
            interpolation=cv2.INTER_AREA,
        )
        overlay = disp.copy()
        colors = (
            (0, 255, 0),
            (255, 0, 0),
            (0, 0, 255),
            (0, 255, 255),
        )
        pts_disp: List[Tuple[int, int]] = []
        for i, (ox, oy) in enumerate(self.points_orig):
            xd, yd = self.to_display(ox, oy)
            pts_disp.append((xd, yd))
            cv2.circle(overlay, (xd, yd), 6, colors[i], -1)
            cv2.putText(
                overlay,
                CORNER_ORDER[i],
                (xd + 8, yd - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                colors[i],
                2,
                cv2.LINE_AA,
            )
        if len(pts_disp) >= 2:
            for a, b in zip(pts_disp, pts_disp[1:]):
                cv2.line(overlay, a, b, (200, 200, 200), 1, cv2.LINE_AA)
        if len(pts_disp) == 4:
            cv2.line(overlay, pts_disp[3], pts_disp[0], (200, 200, 200), 1, cv2.LINE_AA)
        next_i = len(self.points_orig)
        hint = (
            f"{self.stem}  ({self.index + 1}/{len(self.stems)})  "
            f"Siradaki: {CORNER_ORDER[next_i] if next_i < 4 else 'Enter ile kaydet'}"
        )
        cv2.putText(
            overlay,
            hint,
            (10, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            3,
            cv2.LINE_AA,
        )
        cv2.putText(
            overlay,
            hint,
            (10, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (40, 40, 40),
            1,
            cv2.LINE_AA,
        )
        return overlay


def _default_data_root() -> Path:
    here = Path(__file__).resolve()
    ml_service_root = here.parents[2]
    edu_root = ml_service_root.parent
    return edu_root / "data" / "turkish_column_corners"


def run(data_root: Path, *, redo: bool) -> int:
    images_dir = data_root / "images"
    labels_dir = data_root / "labels"
    if not images_dir.is_dir():
        print(f"images/ yok: {images_dir}", file=sys.stderr)
        return 1
    labels_dir.mkdir(parents=True, exist_ok=True)

    all_stems = _natural_stems(images_dir)
    if not all_stems:
        print(f"Görüntü yok: {images_dir}", file=sys.stderr)
        return 1

    if redo:
        stems = all_stems
    else:
        stems = [s for s in all_stems if not (labels_dir / f"{s}.json").is_file()]

    if not stems:
        print("Etiketlenecek görüntü kalmadı (tümü etiketli veya --redo kullanın).")
        return 0

    print(
        "Köşe sırası: TL → TR → BR → BL.\n"
        "Enter: kaydet ve ilerle | R: sıfırla | ESC: çık\n"
        f"Toplam: {len(stems)} görüntü\n"
    )

    session = Session(data_root=data_root, stems=stems)
    if not session.load_current():
        return 0

    cv2.namedWindow(session.window, cv2.WINDOW_NORMAL)

    def on_mouse(event: int, x: int, y: int, _flags: int, _param: object) -> None:
        if event != cv2.EVENT_LBUTTONDOWN:
            return
        if session.bgr is None:
            return
        if len(session.points_orig) >= 4:
            return
        ox, oy = session.to_orig(x, y)
        session.points_orig.append((ox, oy))

    cv2.setMouseCallback(session.window, on_mouse)

    while True:
        frame = session.render()
        if frame is None:
            break
        cv2.imshow(session.window, frame)
        key = cv2.waitKey(30) & 0xFF
        if key == 27:
            print("Çıkıldı (ESC).")
            break
        if key in (ord("r"), ord("R")):
            session.points_orig = []
        if key in (13, 10):
            if len(session.points_orig) != 4:
                print("4 köşe seçin (TL, TR, BR, BL), sonra Enter.")
                continue
            assert session.image_path is not None and session.bgr is not None
            h, w = session.bgr.shape[:2]
            payload = _build_json_payload(
                session.image_path.name,
                w,
                h,
                [(session.points_orig[i][0], session.points_orig[i][1]) for i in range(4)],
            )
            out_path = labels_dir / f"{session.stem}.json"
            out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"[kaydedildi] {out_path}")
            session.index += 1
            if not session.load_current():
                print("Tüm seçili görüntüler tamamlandı.")
                break

    cv2.destroyAllWindows()
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description="Türkçe sütun 4 köşe etiketleme aracı")
    ap.add_argument(
        "--data-root",
        type=Path,
        default=_default_data_root(),
        help="images/ ve labels/ içeren kök (varsayılan: EduAnalyzer/data/turkish_column_corners)",
    )
    ap.add_argument(
        "--redo",
        action="store_true",
        help="Etiketi olsa bile tüm görüntüleri sıraya al",
    )
    args = ap.parse_args()
    root = args.data_root.resolve()
    sys.exit(run(root, redo=args.redo))


if __name__ == "__main__":
    main()
