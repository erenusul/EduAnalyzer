#!/usr/bin/env python3
"""
Etiket JSON + görüntü: köşeleri çizip QC görüntüsü üretir (torch gerekmez).

Kullanım (EduAnalyzer kökünden):
  python -m ml_service.training.turkish_column_corners.verify_labels \\
    --data-root data/turkish_column_corners \\
    --out-dir ml-service/debug/turkish_column_corner_qc
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2

from ml_service.training.turkish_column_corners.dataset import (
    find_image_for_stem,
    load_annotation_json,
    parse_corners_pixel,
)
from ml_service.training.turkish_column_corners.warp_helper import draw_corners_labeled_overlay


def main() -> None:
    ap = argparse.ArgumentParser(description="Köşe etiketlerini görüntü üzerinde doğrula")
    ap.add_argument(
        "--data-root",
        type=Path,
        required=True,
        help="images/ ve labels/ içeren kök (örn. EduAnalyzer/data/turkish_column_corners)",
    )
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Çıktı klasörü (varsayılan: ml-service/debug/turkish_column_corner_qc)",
    )
    ap.add_argument(
        "--stems",
        nargs="*",
        default=None,
        help="Yalnız bu kök adları (uzantısız); boşsa tüm etiketler",
    )
    args = ap.parse_args()

    root = args.data_root.resolve()
    images_dir = root / "images"
    labels_dir = root / "labels"
    if not labels_dir.is_dir():
        raise SystemExit(f"labels/ yok: {labels_dir}")

    ml_root = Path(__file__).resolve().parents[2]
    out_dir = (args.out_dir or (ml_root / "debug" / "turkish_column_corner_qc")).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    label_files = sorted(labels_dir.glob("*.json"))
    if args.stems:
        wanted = set(args.stems)
        label_files = [p for p in label_files if p.stem in wanted]

    n_ok = 0
    for lab_path in label_files:
        stem = lab_path.stem
        img_path = find_image_for_stem(images_dir, stem)
        if img_path is None:
            print(f"[skip] görüntü yok: {stem}")
            continue
        data = load_annotation_json(lab_path)
        try:
            corners = parse_corners_pixel(data, str(lab_path))
        except ValueError as e:
            print(f"[err] {lab_path}: {e}")
            continue

        bgr = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
        if bgr is None:
            print(f"[skip] okunamadı: {img_path}")
            continue

        overlay = draw_corners_labeled_overlay(bgr, corners)
        out_path = out_dir / f"{stem}_labels_qc.jpg"
        cv2.imwrite(str(out_path), overlay)
        print(f"[ok] {out_path}")
        n_ok += 1

    print(f"Tamamlandı: {n_ok} dosya -> {out_dir}")


if __name__ == "__main__":
    main()
