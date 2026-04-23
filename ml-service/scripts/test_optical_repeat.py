#!/usr/bin/env python3
"""
Aynı görüntüyü birden çok kez optical-scan API'sine gönderip sonuçları karşılaştırır.

Sunucu tarafında farklı OPTICAL_TR_COL_* env ile ml-service'i yeniden başlattıktan sonra
bu scripti tekrar çalıştırarak algoritma etkisini ölçebilirsiniz.

Ham ML yanıtında genelde correctCount/wrongCount yoktur; bu durumda status_ok / empty /
ambiguous sayıları yazdırılır (aynı görüntüde karşılaştırma için yeterlidir).

Kullanım:
  python scripts/test_optical_repeat.py --image /path/to/test.jpg --runs 3
  python scripts/test_optical_repeat.py --image scan.jpg --runs 5 --url http://127.0.0.1:8000/api/optical-scan

İsteğe bağlı: pip install requests — yoksa urllib (stdlib) kullanılır.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import uuid
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import requests  # type: ignore[import-untyped]
except ImportError:
    requests = None


def _guess_media_type(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if mime and mime.startswith("image/"):
        return mime
    suf = path.suffix.lower()
    if suf in (".jpg", ".jpeg"):
        return "image/jpeg"
    if suf == ".png":
        return "image/png"
    return "image/jpeg"


def _build_multipart(
    fields: dict[str, str],
    file_path: Path,
    file_field: str,
) -> tuple[bytes, str]:
    boundary = f"----FormBoundary{uuid.uuid4().hex}"
    mime = _guess_media_type(file_path)
    chunks: list[bytes] = []
    for key, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode())
        chunks.append(f"{value}\r\n".encode())
    raw = file_path.read_bytes()
    chunks.append(f"--{boundary}\r\n".encode())
    chunks.append(
        (
            f'Content-Disposition: form-data; name="{file_field}"; filename="{file_path.name}"\r\n'
            f"Content-Type: {mime}\r\n\r\n"
        ).encode()
    )
    chunks.append(raw)
    chunks.append(f"\r\n--{boundary}--\r\n".encode())
    body = b"".join(chunks)
    content_type = f"multipart/form-data; boundary={boundary}"
    return body, content_type


def post_optical_scan_urllib(
    url: str,
    image_path: Path,
    *,
    question_count: int,
    option_count: int,
    template: str,
    timeout: float,
) -> dict[str, Any]:
    fields = {
        "question_count": str(question_count),
        "option_count": str(option_count),
        "template": template,
    }
    body, ct = _build_multipart(fields, image_path, "file")
    req = Request(url, data=body, method="POST", headers={"Content-Type": ct})
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    return json.loads(raw)


def post_optical_scan_requests(
    url: str,
    image_path: Path,
    *,
    question_count: int,
    option_count: int,
    template: str,
    timeout: float,
) -> dict[str, Any]:
    assert requests is not None
    mt = _guess_media_type(image_path)
    with image_path.open("rb") as f:
        files = {"file": (image_path.name, f, mt)}
        data = {
            "question_count": str(question_count),
            "option_count": str(option_count),
            "template": template,
        }
        r = requests.post(url, files=files, data=data, timeout=timeout)
    if not r.ok:
        try:
            err = r.json()
            detail = err.get("detail", r.text)
        except json.JSONDecodeError:
            detail = r.text
        raise RuntimeError(f"HTTP {r.status_code}: {detail}")
    return r.json()


def post_optical_scan(
    url: str,
    image_path: Path,
    *,
    question_count: int,
    option_count: int,
    template: str,
    timeout: float,
) -> dict[str, Any]:
    if requests is not None:
        return post_optical_scan_requests(
            url,
            image_path,
            question_count=question_count,
            option_count=option_count,
            template=template,
            timeout=timeout,
        )
    try:
        return post_optical_scan_urllib(
            url,
            image_path,
            question_count=question_count,
            option_count=option_count,
            template=template,
            timeout=timeout,
        )
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            err = json.loads(body)
            detail = err.get("detail", body)
        except json.JSONDecodeError:
            detail = body
        raise RuntimeError(f"HTTP {e.code}: {detail}") from e


def extract_metrics(data: dict[str, Any]) -> dict[str, Any]:
    cc = data.get("correct_count", data.get("correctCount"))
    wc = data.get("wrong_count", data.get("wrongCount"))
    tc = data.get("total_count", data.get("totalCount"))

    pq = data.get("per_question") or []
    n = int(data.get("question_count") or len(pq) or 0)
    ok_c = sum(1 for p in pq if (p.get("status") or "").strip().lower() == "ok")
    empty_c = sum(1 for p in pq if (p.get("status") or "").strip().lower() == "empty")
    amb_c = sum(1 for p in pq if (p.get("status") or "").strip().lower() == "ambiguous")

    if tc is None:
        tc = n if n else len(pq)

    return {
        "correct_count": cc,
        "wrong_count": wc,
        "total_count": tc,
        "status_ok": ok_c,
        "empty": empty_c,
        "ambiguous": amb_c,
        "question_count": n,
    }


def format_run(run_idx: int, m: dict[str, Any]) -> list[str]:
    lines = [f"TEST RUN {run_idx}", "-" * 40]
    if m.get("correct_count") is not None:
        lines.append(f"correctCount: {m['correct_count']}")
    if m.get("wrong_count") is not None:
        lines.append(f"wrongCount: {m['wrong_count']}")
    if m.get("total_count") is not None:
        lines.append(f"totalCount: {m['total_count']}")
    if m.get("correct_count") is None and m.get("wrong_count") is None:
        lines.append("(Ham ML: correctCount/wrongCount yok — karşılaştırma için status_ok / empty / ambiguous)")
    lines.append(f"status_ok:  {m['status_ok']}")
    lines.append(f"empty:      {m['empty']}")
    lines.append(f"ambiguous:  {m['ambiguous']}")
    lines.append(f"total:      {m.get('question_count') or m.get('total_count')}")
    return lines


def main() -> None:
    p = argparse.ArgumentParser(description="Aynı optik görüntüsünü tekrarlayarak API sonucunu karşılaştır.")
    p.add_argument("--image", required=True, type=Path, help="Örn. /path/to/test.jpg")
    p.add_argument("--runs", type=int, default=1, help="Kaç kez aynı istek (varsayılan 1)")
    p.add_argument(
        "--url",
        default="http://localhost:5245/api/optical-scan",
        help="Tam endpoint URL",
    )
    p.add_argument("--question-count", type=int, default=20)
    p.add_argument("--option-count", type=int, default=5)
    p.add_argument("--template", default="lgs_turkish_column_crop", help="Optik şablon kimliği")
    p.add_argument("--timeout", type=float, default=120.0)
    p.add_argument("--json", action="store_true", help="Ham JSON'u stderr'a yaz")
    args = p.parse_args()

    img = args.image.expanduser().resolve()
    if not img.is_file():
        print(f"Dosya bulunamadı: {img}", file=sys.stderr)
        sys.exit(1)
    if args.runs < 1:
        print("--runs en az 1 olmalı", file=sys.stderr)
        sys.exit(1)

    metrics_list: list[dict[str, Any]] = []
    for i in range(1, args.runs + 1):
        try:
            data = post_optical_scan(
                args.url,
                img,
                question_count=args.question_count,
                option_count=args.option_count,
                template=args.template,
                timeout=args.timeout,
            )
        except (RuntimeError, URLError, OSError) as e:
            print(f"TEST RUN {i} — HATA: {e}", file=sys.stderr)
            sys.exit(1)

        if args.json:
            print(json.dumps(data, ensure_ascii=False, indent=2), file=sys.stderr)

        m = extract_metrics(data)
        metrics_list.append(m)
        print("\n".join(format_run(i, m)))
        print()

    if len(metrics_list) > 1:
        print("=" * 40)
        print("ÖZET")
        print("-" * 40)
        hdr = f"{'Run':>4}  {'ok':>4}  {'empty':>5}  {'amb':>4}"
        if any(x.get("correct_count") is not None for x in metrics_list):
            hdr += f"  {'correct':>7}  {'wrong':>5}"
        print(hdr)
        print("-" * len(hdr))
        ok_vals: list[int] = []
        for i, m in enumerate(metrics_list, start=1):
            row = f"{i:>4}  {m['status_ok']:>4}  {m['empty']:>5}  {m['ambiguous']:>4}"
            if any(x.get("correct_count") is not None for x in metrics_list):
                cc = m.get("correct_count")
                wc = m.get("wrong_count")
                row += f"  {str(cc) if cc is not None else '-':>7}  {str(wc) if wc is not None else '-':>5}"
            print(row)
            ok_vals.append(int(m["status_ok"]))

        if ok_vals:
            avg = sum(ok_vals) / len(ok_vals)
            print("-" * len(hdr))
            print(f"Ortalama status_ok: {avg:.2f}")


if __name__ == "__main__":
    main()
