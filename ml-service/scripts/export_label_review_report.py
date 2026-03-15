"""
Etiket doğrulama için confusion örneklerini raporlar.

Kullanım:
  python ml-service/scripts/export_label_review_report.py

Çıktı: ml-service/eval/label_review_report.md

Bu raporu inceleyerek:
1. Yanlış tahmin edilen soruların gerçekten yanlış etiketli olup olmadığını kontrol edin
2. Hatalı etiketleri question_dataset.json ve question_training_dataset.json içinde düzeltin
3. Düzeltme sonrası retrain_and_evaluate.sh çalıştırın
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

CONFUSIONS_PATH = ROOT / "ml-service" / "eval" / "topic_confusions.json"
DATASET_PATH = ROOT / "pdf_extractor" / "data" / "processed" / "question_dataset.json"
OUTPUT_PATH = ROOT / "ml-service" / "eval" / "label_review_report.md"


def main() -> None:
    if not CONFUSIONS_PATH.exists():
        print(f"Hata: {CONFUSIONS_PATH} bulunamadı. Önce analyze_topic_model.py çalıştırın.")
        sys.exit(1)

    with open(CONFUSIONS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    confusion_examples = data.get("confusion_examples", [])
    if not confusion_examples:
        print("confusion_examples boş. analyze_topic_model.py --examples-per-pair 20 ile tekrar çalıştırın.")
        sys.exit(1)

    # question_id -> question dict (opsiyonel, tam metin için)
    qid_to_question = {}
    if DATASET_PATH.exists():
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            ds = json.load(f)
        for q in ds.get("questions", []):
            qid = q.get("question_id", "")
            if qid:
                qid_to_question[qid] = q

    lines = [
        "# Etiket Doğrulama Raporu",
        "",
        "Bu rapor, modelin yanlış tahmin ettiği soruları listeler. ",
        "**Manuel kontrol:** Her örnek için gerçek etiketin doğru olup olmadığını kontrol edin.",
        "",
        "## Nasıl Düzeltilir?",
        "",
        "1. `question_dataset.json` dosyasında ilgili `question_id` ile soruyu bulun",
        "2. Etiket yanlışsa `topic` alanını düzeltin",
        "3. `question_training_dataset.json` dosyasında aynı soruyu bulup `label` alanını güncelleyin",
        "4. `./ml-service/scripts/retrain_and_evaluate.sh` çalıştırın",
        "",
        "---",
        "",
    ]

    for i, pair in enumerate(confusion_examples, 1):
        true_label = pair.get("true", "?")
        pred_label = pair.get("pred", "?")
        count = pair.get("count", 0)
        examples = pair.get("examples", [])

        lines.append(f"## {i}. {true_label} → {pred_label} ({count} örnek)")
        lines.append("")
        lines.append("| # | question_id | Soru (kısaltılmış) | Tahmin güveni |")
        lines.append("|---|-------------|-------------------|---------------|")

        for j, ex in enumerate(examples, 1):
            qid = ex.get("question_id", "")
            text = ex.get("question_text", "")[:80].replace("|", " ").replace("\n", " ")
            if len(ex.get("question_text", "")) > 80:
                text += "..."
            conf = ex.get("pred_conf", 0)
            lines.append(f"| {j} | `{qid}` | {text} | {conf:.2f} |")

        lines.append("")
        lines.append("**Kontrol:** Bu sorular gerçekten " + true_label + " mi? Yanlış etiket varsa düzeltin.")
        lines.append("")
        lines.append("---")
        lines.append("")

    output_text = "\n".join(lines)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(output_text)

    print(f"Rapor kaydedildi: {OUTPUT_PATH}")
    print(f"Toplam {len(confusion_examples)} karışım çifti, manuel inceleme için hazır.")


if __name__ == "__main__":
    main()
