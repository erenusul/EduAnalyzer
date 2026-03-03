"""
Model performans ve karışan sınıf çifti analizi.

Kullanım:
  python3 ml-service/scripts/analyze_topic_model.py \
    --checkpoint ml-service/models/checkpoints/topic_classifier.pt \
    --output ml-service/eval/topic_confusions.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml_service.config import QUESTION_DATASET_PATH
from ml_service.data.dataset import load_question_dataset
from ml_service.models.classifier import QuestionClassifier


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze topic model confusions")
    parser.add_argument(
        "--checkpoint",
        default="ml-service/models/checkpoints/topic_classifier.pt",
        help="Path to topic model checkpoint",
    )
    parser.add_argument(
        "--dataset",
        default=str(QUESTION_DATASET_PATH),
        help="Path to question dataset JSON",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Top-k ile kontrol edilecek en olası tahmin sayısı",
    )
    parser.add_argument(
        "--limit-per-topic",
        type=int,
        default=30,
        help="Her gerçek sınıf için geri dönen en çok karışan top N sınıf",
    )
    parser.add_argument(
        "--min-count",
        type=int,
        default=1,
        help="Confusion listesine girsin diye minimum sayım eşiği",
    )
    parser.add_argument(
        "--output",
        default="",
        help="Çıktı JSON dosyası (boş bırakılırsa sadece ekrana yazar)",
    )
    parser.add_argument(
        "--examples-per-pair",
        type=int,
        default=20,
        help="Her gerçek/pred pair için en zorlu örnek sayısı",
    )
    return parser.parse_args()


def format_pair_confusions(
    matrix: List[List[int]],
    idx_to_label: Dict[int, str],
) -> List[Dict[str, object]]:
    pairs = []
    num_labels = len(idx_to_label)
    for true_idx in range(num_labels):
        for pred_idx in range(num_labels):
            if true_idx == pred_idx:
                continue
            count = int(matrix[true_idx][pred_idx])
            if count <= 0:
                continue
            pairs.append(
                {
                    "true": idx_to_label[true_idx],
                    "pred": idx_to_label[pred_idx],
                    "count": count,
                }
            )
    pairs.sort(key=lambda x: x["count"], reverse=True)
    return pairs


def per_topic_confusion(
    matrix: List[List[int]],
    idx_to_label: Dict[int, str],
    top_n: int,
    min_count: int,
) -> List[Dict[str, object]]:
    result = []
    num_labels = len(idx_to_label)
    for true_idx in range(num_labels):
        true_total = int(sum(matrix[true_idx]))
        if true_total == 0:
            continue

        row_pairs = []
        for pred_idx in range(num_labels):
            if pred_idx == true_idx:
                continue
            count = int(matrix[true_idx][pred_idx])
            if count < min_count:
                continue

            rate = count / true_total
            row_pairs.append(
                {
                    "pred": idx_to_label[pred_idx],
                    "count": count,
                    "rate": round(rate, 4),
                }
            )

        row_pairs.sort(key=lambda x: x["count"], reverse=True)
        if row_pairs:
            result.append(
                {
                    "true": idx_to_label[true_idx],
                    "support": true_total,
                    "top_confusions": row_pairs[:top_n],
                }
            )

    result.sort(key=lambda x: x["top_confusions"][0]["count"], reverse=True)
    return result


def _update_top_examples(
    examples_by_pair: Dict[Tuple[str, str], List[Dict]],
    true_label: str,
    pred_label: str,
    sample: Dict,
    max_items: int,
) -> None:
    pair_key = (true_label, pred_label)
    current = examples_by_pair.get(pair_key, [])
    current.append(sample)
    current.sort(key=lambda item: item["margin"])
    if len(current) > max_items:
        current.pop()
    examples_by_pair[pair_key] = current


def main() -> int:
    args = parse_args()

    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset dosyası bulunamadı: {dataset_path}")

    checkpoint_path = Path(args.checkpoint)
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint dosyası bulunamadı: {checkpoint_path}")

    questions, _subjects, topics = load_question_dataset(dataset_path=dataset_path)
    if not questions:
        print("Veri bulunamadı.")
        return 1

    unique_topics = sorted(set(topics))
    if not unique_topics:
        print("Etiketli konu bulunamadı.")
        return 1

    classifier = QuestionClassifier(model_path=checkpoint_path, model_type="topic")
    # load_model ile model açıldıktan sonra etiket sırası checkpoint metadata'sına göre farklı olabilir.
    model_labels = classifier.topic_labels or unique_topics
    model_label_to_idx = {label: idx for idx, label in enumerate(model_labels)}

    y_true: List[int] = []
    y_pred: List[int] = []
    conf: List[float] = []
    gap: List[float] = []
    missed = 0
    confusion_examples: Dict[Tuple[str, str], List[Dict]] = {}
    low_confidence_examples: List[Dict] = []
    low_margin_examples: List[Dict] = []

    for idx, (q, topic) in enumerate(zip(questions, topics)):
        text = q.get("question_text", "") or ""
        if not text:
            continue

        pred_items = classifier.predict(
            text,
            top_k_subject=1,
            top_k_topic=args.top_k,
        )["topic"]

        if not pred_items:
            missed += 1
            continue

        pred_label = pred_items[0][0]
        pred_conf = float(pred_items[0][1])
        second_conf = float(pred_items[1][1]) if len(pred_items) > 1 else 0.0
        margin = pred_conf - second_conf

        question_id = q.get("question_id", f"q_{idx + 1}")

        true_idx = model_label_to_idx.get(topic)
        pred_idx = model_label_to_idx.get(pred_label)
        if true_idx is None or pred_idx is None:
            missed += 1
            continue

        y_true.append(true_idx)
        y_pred.append(pred_idx)
        conf.append(pred_conf)
        gap.append(margin)

        if pred_label != topic:
            example = {
                "question_id": question_id,
                "question_text": text,
                "pred": pred_label,
                "pred_conf": pred_conf,
                "second_conf": second_conf,
                "margin": margin,
            }
            _update_top_examples(
                confusion_examples,
                true_label=topic,
                pred_label=pred_label,
                sample=example,
                max_items=args.examples_per_pair,
            )

        if pred_conf < 0.45:
            low_confidence_examples.append(
                {
                    "question_id": question_id,
                    "true_label": topic,
                    "pred": pred_label,
                    "pred_conf": pred_conf,
                    "second_conf": second_conf,
                    "margin": margin,
                    "question_text": text,
                }
            )
        if margin < 0.12:
            low_margin_examples.append(
                {
                    "question_id": question_id,
                    "true_label": topic,
                    "pred": pred_label,
                    "pred_conf": pred_conf,
                    "second_conf": second_conf,
                    "margin": margin,
                    "question_text": text,
                }
            )

    if not y_true:
        print("Tahmin üretilemedi.")
        return 1

    labels = model_labels
    num_labels = len(labels)

    matrix = [[0 for _ in range(num_labels)] for _ in range(num_labels)]
    for t, p in zip(y_true, y_pred):
        matrix[t][p] += 1

    total = len(y_true)
    correct = 0
    for i in range(total):
        if y_true[i] == y_pred[i]:
            correct += 1

    acc = round(correct / total, 4)

    pair_confusions = format_pair_confusions(matrix, {i: labels[i] for i in range(num_labels)})
    per_topic = per_topic_confusion(
        matrix=matrix,
        idx_to_label={i: labels[i] for i in range(num_labels)},
        top_n=args.limit_per_topic,
        min_count=args.min_count,
    )

    low_conf = sum(1 for c in conf if c < 0.45)
    low_margin = sum(1 for g in gap if g < 0.12)
    mean_conf = sum(conf) / len(conf) if conf else 0.0
    mean_gap = sum(gap) / len(gap) if gap else 0.0

    output_payload = {
        "summary": {
            "total": total,
            "accuracy": acc,
            "missed_or_unmatched": missed,
            "mean_confidence_top1": round(mean_conf, 4),
            "mean_confidence_gap_top1_top2": round(mean_gap, 4),
            "below_045_top1": low_conf,
            "below_012_margin": low_margin,
            "classes": num_labels,
        },
        "top_30_confused_pairs": pair_confusions[:30],
        "per_topic_top_confusions": per_topic[:30],
        "confusion_examples": [
            {
                "true": true_label,
                "pred": pred_label,
                "count": len(samples),
                "examples": samples,
            }
            for (true_label, pred_label), samples in sorted(
                confusion_examples.items(),
                key=lambda item: len(item[1]),
                reverse=True,
            )
        ],
        "low_confidence_examples": sorted(
            low_confidence_examples,
            key=lambda item: item["pred_conf"],
        )[:200],
        "low_margin_examples": sorted(
            low_margin_examples,
            key=lambda item: item["margin"],
        )[:200],
    }

    print(f"Toplam örnek: {total} | Doğru: {correct} | Acc: {acc}")
    print("Top-30 en çok karışan çift:")
    for item in output_payload["top_30_confused_pairs"]:
        print(f"  {item['true']} -> {item['pred']}: {item['count']}")

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output_payload, f, ensure_ascii=False, indent=2)
        print(f"Rapor kaydedildi: {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
