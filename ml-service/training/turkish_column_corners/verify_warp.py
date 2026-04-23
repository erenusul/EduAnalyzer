#!/usr/bin/env python3
"""
Köşe tahmini (GT veya eğitilmiş model) + warp çıktısı — OMR öncesi görsel doğrulama.

  --source gt     : labels/*.json içindeki piksel köşeleri kullan (eğitim öncesi geometri testi)
  --source model  : inference.TurkishColumnCornerInference (--weights zorunlu)

Kullanım:
  python -m ml_service.training.turkish_column_corners.verify_warp --data-root ... --source gt
  python -m ml_service.training.turkish_column_corners.verify_warp --data-root ... --source model --weights runs/corner.pt
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
from ml_service.training.turkish_column_corners.warp_helper import (
    DEFAULT_CANONICAL_SIZE,
    draw_corners_labeled_overlay,
    log_corner_diagnostics,
    warp_column_to_canonical,
)


def main() -> None:
    ap = argparse.ArgumentParser(description="Köşe + perspektif warp QC")
    ap.add_argument("--data-root", type=Path, required=True)
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Varsayılan: ml-service/debug/turkish_column_corner_qc",
    )
    ap.add_argument("--source", choices=("gt", "model"), default="gt")
    ap.add_argument("--weights", type=Path, default=None, help="--source model için state_dict .pt")
    ap.add_argument("--stems", nargs="*", default=None)
    ap.add_argument(
        "--canonical",
        type=int,
        nargs=2,
        default=list(DEFAULT_CANONICAL_SIZE),
        metavar=("W", "H"),
        help=f"Warp çıktı boyutu (varsayılan {DEFAULT_CANONICAL_SIZE[0]} {DEFAULT_CANONICAL_SIZE[1]})",
    )
    ap.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Köşe piksel/normalize değerleri, alan ve sınır kontrolü (model teşhisi)",
    )
    args = ap.parse_args()

    if args.source == "model" and (args.weights is None or not args.weights.is_file()):
        raise SystemExit("--source model için geçerli --weights gerekli")

    root = args.data_root.resolve()
    images_dir = root / "images"
    labels_dir = root / "labels"
    ml_root = Path(__file__).resolve().parents[2]
    out_dir = (args.out_dir or (ml_root / "debug" / "turkish_column_corner_qc")).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    infer = None
    if args.source == "model":
        from ml_service.training.turkish_column_corners.inference import TurkishColumnCornerInference

        infer = TurkishColumnCornerInference(weights_path=args.weights)

    label_files = sorted(labels_dir.glob("*.json"))
    if args.stems:
        w = set(args.stems)
        label_files = [p for p in label_files if p.stem in w]

    can_size = (int(args.canonical[0]), int(args.canonical[1]))

    for lab_path in label_files:
        stem = lab_path.stem
        img_path = find_image_for_stem(images_dir, stem)
        if img_path is None:
            print(f"[skip] görüntü yok: {stem}")
            continue
        bgr = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
        if bgr is None:
            continue

        if args.source == "gt":
            data = load_annotation_json(lab_path)
            corners = parse_corners_pixel(data, str(lab_path))
            if args.verbose:
                log_corner_diagnostics(stem, corners, img_shape=bgr.shape)
        else:
            pred = infer.predict_bgr(bgr)
            corners = pred.corners_pixel
            if args.verbose:
                log_corner_diagnostics(
                    stem,
                    corners,
                    corners_norm=pred.corners_norm,
                    img_shape=bgr.shape,
                )

        tag = "gt" if args.source == "gt" else "model"
        overlay = draw_corners_labeled_overlay(bgr, corners)
        cv2.imwrite(str(out_dir / f"{stem}_{tag}_corners.jpg"), overlay)

        warped = warp_column_to_canonical(bgr, corners, out_size=can_size)
        cv2.imwrite(str(out_dir / f"{stem}_{tag}_warp.jpg"), warped)
        print(f"[ok] {stem} -> {out_dir}/{stem}_{tag}_*.jpg")


if __name__ == "__main__":
    main()
