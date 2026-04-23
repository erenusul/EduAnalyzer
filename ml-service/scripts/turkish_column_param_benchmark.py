#!/usr/bin/env python3
"""
Türkçe dar sütun hizalama parametre sweep — tablo + JSON çıktı.

Kullanım (sentetik test görselleri):
  cd ml-service && .venv/bin/python scripts/turkish_column_param_benchmark.py --synthetic --out-csv /tmp/sweep.csv

Gerçek fotoğraf + etiket:
  .venv/bin/python scripts/turkish_column_param_benchmark.py \\
    --image-glob '/path/crops/*.jpg' \\
    --labels-json /path/labels.json

labels.json: { "/path/crops/a.jpg": ["A","B",...20 adet], ... }
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

# EduAnalyzer kökü (ml_service paketi ve ml-service/tests ile uyumlu)
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _load_gray(path: Path):
    import cv2
    import numpy as np

    b = path.read_bytes()
    arr = np.frombuffer(b, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f"Görüntü okunamadı: {path}")
    return img


def _synthetic_cases():
    """test_optical_scan ile aynı sentetikler — referans cevaplar."""
    from pathlib import Path
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "topt",
        Path(__file__).resolve().parents[1] / "tests" / "test_optical_scan.py",
    )
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)

    affine_answers = [
        "A",
        "B",
        "C",
        "D",
        "",
        "A",
        "A",
        "A",
        "B",
        "B",
        "C",
        "C",
        "D",
        "D",
        "",
        "",
        "A",
        "B",
        "C",
        "D",
    ]
    twenty = [
        "A",
        "B",
        "C",
        "D",
        "",
        "A",
        "A",
        "A",
        "B",
        "B",
        "C",
        "C",
        "D",
        "D",
        "",
        "",
        "A",
        "B",
        "C",
        "D",
    ]
    five = ["A", "E", "B", "", "C", "D", "A", "B", "C", "D", "E", "", "A", "B", "C", "D", "A", "B", "C", "D"]

    import cv2
    import numpy as np

    def aff():
        b = mod._build_lgs_turkish_column_crop_synthetic(affine_answers)
        nparr = np.frombuffer(b, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        h, w = img.shape
        m = np.float32([[1.0, 0.0, 6.0], [0.0, 1.0, -5.0]])
        shifted = cv2.warpAffine(img, m, (w, h), borderValue=255)
        return shifted, affine_answers

    cases = [
        (
            "synthetic_twenty_rows",
            mod._build_lgs_turkish_column_crop_synthetic(twenty),
            twenty,
            4,
        ),
        ("synthetic_affine_shift", aff()[0], aff()[1], 4),
        (
            "synthetic_five_options",
            mod._build_lgs_turkish_column_crop_synthetic_five(five),
            five,
            5,
        ),
    ]
    out = []
    for name, bytes_or_gray, ans, oc in cases:
        if isinstance(bytes_or_gray, bytes):
            nparr = __import__("numpy").frombuffer(bytes_or_gray, dtype=__import__("numpy").uint8)
            g = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        else:
            g = bytes_or_gray
        out.append((name, g, ans, oc))
    return out


def main() -> int:
    import cv2
    import numpy as np

    from ml_service.turkish_column_benchmark import (
        iter_param_combinations,
        parse_float_csv,
        row_to_dict,
        run_benchmark_case,
        suggest_diagnostic_composite,
    )

    p = argparse.ArgumentParser(description="Türkçe sütun hizalama parametre sweep")
    p.add_argument("--synthetic", action="store_true", help="3 sentetik vaka (test ile uyumlu)")
    p.add_argument("--image-glob", type=str, default="", help="Örn. /data/*.jpg")
    p.add_argument(
        "--labels-json",
        type=str,
        default="",
        help='{"path": ["A","B",...]} — anahtarlar glob ile eşleşen tam yol',
    )
    p.add_argument(
        "--plateau-tau",
        type=str,
        default="1.5",
        help="OPTICAL_TR_COL_ALIGN_PLATEAU_TAU virgülle liste (sweep: 1.0,1.5,2.0)",
    )
    p.add_argument(
        "--snap-eps",
        type=str,
        default="0.32",
        help="OPTICAL_TR_COL_ALIGN_SNAP_EPS virgülle liste",
    )
    p.add_argument(
        "--read-slack",
        type=str,
        default="0.56",
        help="OPTICAL_TR_COL_READ_SLACK_HALF_WHEN_REFINE_OFF virgülle liste",
    )
    p.add_argument("--out-csv", type=str, default="")
    p.add_argument("--out-json", type=str, default="")
    p.add_argument(
        "--refine-row-y",
        action="store_true",
        help="detect_turkish_column_crop_aligned refine_row_y=True (varsayılan sentetikte False)",
    )
    p.add_argument(
        "--use-vertical-slack-flag",
        action="store_true",
        help="use_vertical_slack=True (sentetikte genelde False)",
    )
    args = p.parse_args()

    sweep = {
        "OPTICAL_TR_COL_ALIGN_PLATEAU_TAU": [str(x) for x in parse_float_csv(args.plateau_tau)],
        "OPTICAL_TR_COL_ALIGN_SNAP_EPS": [str(x) for x in parse_float_csv(args.snap_eps)],
        "OPTICAL_TR_COL_READ_SLACK_HALF_WHEN_REFINE_OFF": [
            str(x) for x in parse_float_csv(args.read_slack)
        ],
    }

    images: list[tuple[str, "np.ndarray", list[str] | None, int]] = []

    if args.synthetic:
        for name, gray, ans, oc in _synthetic_cases():
            images.append((name, gray, ans, oc))

    if args.image_glob:
        from glob import glob

        labels = {}
        if not args.labels_json:
            print("--image-glob için --labels-json gerekli.", file=sys.stderr)
            return 1
        labels = json.loads(Path(args.labels_json).read_text(encoding="utf-8"))
        for fp in sorted(glob(args.image_glob)):
            path = Path(fp).resolve()
            key = str(path)
            exp = labels.get(key) or labels.get(path.name)
            if not exp:
                print(f"Etiket yok, atlanıyor: {key}", file=sys.stderr)
                continue
            g = _load_gray(path)
            oc = 5 if any((x or "").strip().upper() == "E" for x in exp) else 4
            images.append((key, g, exp, oc))

    if not images:
        print("Görüntü yok: --synthetic ve/veya --image-glob kullanın.", file=sys.stderr)
        return 1

    rows_out: list[dict] = []
    for env_combo, _vals in iter_param_combinations(sweep):
        for image_id, gray, expected, oc in images:
            qc = len(expected) if expected else 20
            br = run_benchmark_case(
                gray,
                image_id=image_id,
                question_count=qc,
                option_count=oc,
                refine_row_y=args.refine_row_y,
                use_vertical_slack=args.use_vertical_slack_flag,
                expected=expected,
                env_updates=env_combo,
            )
            d = row_to_dict(br)
            d["diagnostic_composite_suggestion"] = suggest_diagnostic_composite(br)
            rows_out.append(d)

    # Özet: parametre kombinasyonu başına toplam doğru
    from collections import defaultdict

    agg: dict[tuple[float, float, float], list[int]] = defaultdict(lambda: [0, 0, 0])
    for d in rows_out:
        k = (d["plateau_tau"], d["snap_eps"], d["read_slack_half"])
        agg[k][0] += int(d["correct_count"])
        agg[k][1] += int(d["wrong_count"])
        agg[k][2] += int(d["ambiguous_count"])

    best_key = max(agg.keys(), key=lambda x: agg[x][0])
    summary = {
        "best_param_combo": {
            "plateau_tau": best_key[0],
            "snap_eps": best_key[1],
            "read_slack_half": best_key[2],
            "total_correct": agg[best_key][0],
            "total_wrong": agg[best_key][1],
            "total_ambiguous": agg[best_key][2],
        },
        "note": "Sentetikte doğruluk artışı baseline parametrelerle karşılaştırılmalı; gerçek foto için labels gerekir.",
    }

    if args.out_csv:
        outp = Path(args.out_csv)
        outp.parent.mkdir(parents=True, exist_ok=True)
        if rows_out:
            fieldnames = list(rows_out[0].keys())
            if "extra" in fieldnames:
                fieldnames.remove("extra")
            with outp.open("w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
                w.writeheader()
                for d in rows_out:
                    w.writerow({k: d.get(k, "") for k in fieldnames})

    payload = {"summary": summary, "rows": rows_out}
    if args.out_json:
        Path(args.out_json).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Satır sayısı: {len(rows_out)}")
    if args.out_csv:
        print(f"CSV: {args.out_csv}")
    if args.out_json:
        print(f"JSON: {args.out_json}")

    # Hata analizi: ilk sentetik görüntü + ilk kombinasyon örnek tepe özeti
    if rows_out:
        sample = rows_out[0]
        peak = sample.get("extra", {}).get("peak") if isinstance(sample.get("extra"), dict) else {}
        print("\n--- Örnek hizalama analizi (ilk satır) ---")
        print("selection_rule_tr:", sample.get("selection_rule_tr", ""))
        if peak:
            print(
                "global_max (dx,dy,margin):",
                peak.get("global_max_dx"),
                peak.get("global_max_dy"),
                peak.get("global_max_margin"),
            )
            print("chosen:", sample.get("chosen_dx"), sample.get("chosen_dy"), "margin", peak.get("chosen_margin"))
            tops = peak.get("top_by_margin") or []
            print("top_by_margin (ilk 5):", json.dumps(tops[:5], ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
