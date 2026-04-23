#!/usr/bin/env python3
"""
EduAnalyzer kökünden çalıştırın: Türkçe sütun köşe etiketleme aracı başlatıcısı.

Örnek:
  python3 tools/scripts/label_turkish_column_corners.py
  python3 tools/scripts/label_turkish_column_corners.py --redo
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    ml_service = root / "ml-service"
    venv_python = ml_service / ".venv" / "bin" / "python"
    exe = str(venv_python) if venv_python.is_file() else sys.executable
    data_root = root / "data" / "turkish_column_corners"
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ml_service)
    cmd = [
        exe,
        "-m",
        "ml_service.training.turkish_column_corners.label_ui",
        "--data-root",
        str(data_root),
        *sys.argv[1:],
    ]
    raise SystemExit(subprocess.run(cmd, cwd=str(ml_service), env=env).returncode)


if __name__ == "__main__":
    main()
