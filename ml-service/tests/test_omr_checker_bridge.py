import csv
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ml_service.omr_checker_bridge import (
    _fit_canvas_and_rescale_template,
    _parse_omr_results_csv,
    try_read_with_omr_checker,
)


def test_try_read_without_template_env_returns_none():
    import os

    old = os.environ.pop("OMR_CHECKER_TEMPLATE_JSON", None)
    try:
        assert try_read_with_omr_checker(b"\xff\xd8\xff", 3, 4) is None
    finally:
        if old is not None:
            os.environ["OMR_CHECKER_TEMPLATE_JSON"] = old


def test_fit_canvas_identity_preserves_origin(tmp_path):
    """993×1319 girdi, şablon 993×1319 — origin ve ölçek değişmez."""
    tpl = tmp_path / "t.json"
    tpl.write_text(
        '{"pageDimensions":[993,1319],"fieldBlocks":{"B":{"origin":[157,635],'
        '"bubbleDimensions":[29,29],"bubblesGap":44,"labelsGap":42}}}',
        encoding="utf-8",
    )
    bgr = np.full((1319, 993, 3), 255, dtype=np.uint8)
    out = _fit_canvas_and_rescale_template(bgr, tpl, "top")
    assert out is not None
    canvas, adj = out
    assert canvas.shape[:2] == (1319, 993)
    assert adj["fieldBlocks"]["B"]["origin"] == [157, 635]
    assert adj["fieldBlocks"]["B"]["bubbleDimensions"] == [29, 29]


def test_fit_canvas_wide_input_scales_geometry(tmp_path):
    """200×100 görüntü, 100×100 sayfa: scale=0.5, dikey sy=0.5 ile y koordinatları yarılanır."""
    tpl = tmp_path / "t.json"
    tpl.write_text(
        '{"pageDimensions":[100,100],"fieldBlocks":{"B":{"origin":[50,40],'
        '"bubbleDimensions":[10,10],"bubblesGap":8,"labelsGap":9}}}',
        encoding="utf-8",
    )
    bgr = np.full((100, 200, 3), 255, dtype=np.uint8)
    out = _fit_canvas_and_rescale_template(bgr, tpl, "top")
    assert out is not None
    _canvas, adj = out
    b = adj["fieldBlocks"]["B"]
    assert b["origin"] == [50, 20]
    assert b["bubbleDimensions"] == [10, 8]
    assert b["labelsGap"] == 4


def test_parse_omr_results_csv_maps_q_columns(tmp_path):
    p = tmp_path / "r.csv"
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["file_id", "input_path", "output_path", "score", "q1", "q2", "q3"],
        )
        w.writeheader()
        w.writerow(
            {
                "file_id": "x.jpg",
                "input_path": "/a",
                "output_path": "/b",
                "score": "0",
                "q1": "A",
                "q2": "",
                "q3": "D",
            }
        )
    rows = _parse_omr_results_csv(p, 3, 4)
    assert rows is not None
    assert rows[0] == ("A", "ok", 0.88)
    assert rows[1][1] == "empty"
    assert rows[2] == ("D", "ok", 0.88)
