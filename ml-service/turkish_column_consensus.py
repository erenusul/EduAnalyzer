"""
Dar Türkçe sütun: çoklu ikili eşik varyantlarından satır bazlı çoğunluk / güven birleştirme.

optical_scan API değişmez; yalnızca scan_metadata ve karar mantığı genişler.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, List, Sequence, Tuple

import numpy as np


def build_lgs_binary_variants(gray: np.ndarray) -> List[Tuple[str, np.ndarray]]:
    """
    Aynı gri üzerinde birkaç ikili üretir (hizalama yine birincil binary ile yapılır).

    Sıra: adaptive_default (mevcut), otsu_inv, adaptive_wide.
    """
    import cv2

    from ml_service.api.routes import optical_scan as op

    out: List[Tuple[str, np.ndarray]] = [("adaptive_default", op._prepare_binary_lgs(gray))]

    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    g = clahe.apply(gray)
    blur = cv2.GaussianBlur(g, (5, 5), 0)
    _, otsu = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    k3 = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    out.append(("otsu_inv", cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, k3, iterations=1)))

    wide = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        51,
        11,
    )
    out.append(("adaptive_51_11", cv2.morphologyEx(wide, cv2.MORPH_CLOSE, k3, iterations=1)))
    return out


def _norm_letter(a: str) -> str:
    return (a or "").strip().upper()


def consensus_merge_row_variant_reads(
    variant_pack: Sequence[
        Tuple[str, Any, list[float], dict[str, Any]]
    ],  # (label, QuestionRead, scores, decision_detail)
) -> Tuple[Any, dict[str, Any]]:
    """
    Birden fazla varyanttan tek QuestionRead + birleşik meta.

    Kurallar (güvenilirlik öncelikli):
    - Üçü de boş → boş
    - Aynı harften 2+ net ok (ok) → o harf, güven ortalama
    - 2 boş + 1 harf → belirsiz (yanlış kesin cevap verme)
    - Çelişen harfler → belirsiz
    """
    from ml_service.api.routes.optical_scan import QuestionRead

    if not variant_pack:
        return QuestionRead("", "empty", 0.0), {"consensus_reason": "no_variants"}

    labels: list[str] = []
    answers: list[str] = []
    statuses: list[str] = []
    confs: list[float] = []
    details: list[dict[str, Any]] = []

    for lbl, read, scores, det in variant_pack:
        labels.append(lbl)
        answers.append(_norm_letter(getattr(read, "answer", "") or ""))
        statuses.append((read.status or "").strip().lower())
        confs.append(float(getattr(read, "confidence", 0.0) or 0.0))
        details.append(dict(det))

    per_v = [
        {
            "label": labels[i],
            "answer": answers[i],
            "status": statuses[i],
            "confidence": round(confs[i], 4),
            "decision_code": details[i].get("decision_code"),
        }
        for i in range(len(labels))
    ]

    empty_votes = sum(1 for a in answers if not a)
    letter_counter = Counter(a for a in answers if a)

    meta: dict[str, Any] = {
        "consensus_reason": "single_or_fallback",
        "variant_reads": per_v,
    }

    if len(variant_pack) == 1:
        r0 = variant_pack[0][1]
        meta["consensus_reason"] = "single_variant"
        return r0, meta

    # Çoklu
    if empty_votes == len(answers):
        meta["consensus_reason"] = "all_empty_unanimous"
        return QuestionRead("", "empty", 0.0), meta

    if not letter_counter:
        meta["consensus_reason"] = "no_letter_all_empty_or_malformed"
        return QuestionRead("", "empty", 0.0), meta

    winner, win_cnt = letter_counter.most_common(1)[0]

    # 2 boş + 1 harf → güvenli tarafta belirsiz
    if empty_votes >= 2 and win_cnt == 1:
        meta["consensus_reason"] = "inconclusive_one_mark_two_empty"
        return (
            QuestionRead("", "ambiguous", min(0.55, float(np.mean(confs) if confs else 0.35))),
            meta,
        )

    if win_cnt >= 2:
        agree_idx = [i for i, a in enumerate(answers) if a == winner]
        agree_ok = all(statuses[i] == "ok" for i in agree_idx)
        if agree_ok:
            wconf = float(np.mean([confs[i] for i in agree_idx]))
            if win_cnt == 3:
                wconf = min(1.0, wconf * 1.02)
            else:
                wconf = min(1.0, wconf * 0.92)
            meta["consensus_reason"] = "majority_ok"
            meta["winner_votes"] = win_cnt
            return QuestionRead(winner, "ok", wconf), meta
        meta["consensus_reason"] = "majority_letter_but_not_all_ok"
        return (
            QuestionRead("", "ambiguous", min(0.62, float(np.mean(confs)))),
            meta,
        )

    # Üç farklı veya 1-1-1 dağılım
    if len(letter_counter) >= 2 and win_cnt == 1:
        meta["consensus_reason"] = "split_vote"
        return (
            QuestionRead("", "ambiguous", min(0.5, float(np.mean(confs)))),
            meta,
        )

    meta["consensus_reason"] = "fallback_ambiguous"
    return QuestionRead("", "ambiguous", min(0.48, float(np.mean(confs)))), meta


def compute_form_reliability_summary(
    reads: Sequence[Any],
    row_debug: Sequence[dict[str, Any]],
    *,
    question_count: int,
) -> dict[str, Any]:
    """Form düzeyi özet — düşük güven / yeniden çekim önerisi."""
    n = min(len(reads), int(question_count))
    ok_c = sum(1 for i in range(n) if (reads[i].status or "").lower() == "ok")
    amb_c = sum(1 for i in range(n) if (reads[i].status or "").lower() == "ambiguous")
    empty_c = sum(1 for i in range(n) if (reads[i].status or "").lower() == "empty")

    unstable = 0
    for row in row_debug[:n]:
        dd = row.get("decision_detail") or {}
        c = row.get("consensus") or dd.get("consensus") or {}
        if c.get("consensus_reason") in (
            "split_vote",
            "inconclusive_one_mark_two_empty",
            "majority_letter_but_not_all_ok",
        ):
            unstable += 1
        elif (row.get("status") or "").lower() == "ambiguous":
            unstable += 1

    ok_reads = [reads[i] for i in range(n) if (reads[i].status or "").lower() == "ok"]
    conf_mean = (
        float(sum(r.confidence for r in ok_reads) / len(ok_reads)) if ok_reads else 0.0
    )

    thr_unstable = max(3, n // 5)
    low_conf = conf_mean < 0.42 and ok_c > 0
    recommend = unstable >= thr_unstable or amb_c >= max(4, n // 4) or low_conf

    quality = "ok"
    if recommend:
        quality = "low_confidence"
    elif amb_c >= max(2, n // 10) or empty_c >= max(4, n // 4):
        quality = "mixed"

    return {
        "confidence_mean": round(conf_mean, 4),
        "empty_count": empty_c,
        "ambiguous_count": amb_c,
        "ok_count": ok_c,
        "unstable_question_count": unstable,
        "quality_hint": quality,
        "recommend_rescan": bool(recommend),
        "recommend_rescan_reason": (
            "yüksek_belirsizlik_sayisi"
            if unstable >= thr_unstable
            else "coklu_bos_veya_belirsiz"
            if empty_c + amb_c >= max(6, n // 3)
            else "dusuk_ortalama_guven"
            if low_conf
            else "none"
        ),
    }
