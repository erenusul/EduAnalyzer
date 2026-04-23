"""
Eğitim döngüsü — köşe regresyonu (normalize L1).

Kullanım (EduAnalyzer kökünden data yolu):
  cd ml-service && .venv/bin/python -m ml_service.training.turkish_column_corners.train_skeleton \\
    --data-root ../data/turkish_column_corners --epochs 50 --save runs/turkish_column_corners/corner_mvp.pt

Overfit (pipeline doğrulama, augment kapalı):
  .venv/bin/python -m ml_service.training.turkish_column_corners.train_skeleton \\
    --data-root ../data/turkish_column_corners --overfit --overfit-n 4 --epochs 120 --lr 0.002 \\
    --save debug/corner_overfit.pt
"""

from __future__ import annotations

import argparse
import random
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

from ml_service.training.turkish_column_corners.dataset import (
    TurkishColumnCornerDataset,
    read_split_file,
    stems_from_dirs,
    train_val_split,
)
from ml_service.training.turkish_column_corners.metrics import loss_l1_normalized
from ml_service.training.turkish_column_corners.model import build_model


def _default_data_root() -> Path:
    return Path(__file__).resolve().parents[3] / "data" / "turkish_column_corners"


def _default_save_path() -> Path:
    return Path(__file__).resolve().parents[2] / "runs" / "turkish_column_corners" / "corner_mvp.pt"


def pick_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _debug_val_batch(
    model: torch.nn.Module,
    val_ds: TurkishColumnCornerDataset,
    batch_size: int,
    device: str,
) -> None:
    """İlk val batch: pred vs target min/max ve ortalama mutlak hata (çöküş teşhisi)."""
    if len(val_ds) == 0:
        return
    n = min(batch_size, len(val_ds))
    loader = DataLoader(val_ds, batch_size=n, shuffle=False, num_workers=0)
    model.eval()
    with torch.no_grad():
        batch = next(iter(loader))
        x = batch["image"].to(device)
        y = batch["target"].to(device)
        pred = model(x)
        diff = (pred - y).abs()
        print("[train_skeleton] --- val batch debug (ilk batch, eğitim sonrası) ---")
        print(f"  pred min/max: {pred.min().item():.5f} / {pred.max().item():.5f}")
        print(f"  tgt  min/max: {y.min().item():.5f} / {y.max().item():.5f}")
        print(f"  mean abs L1 (tüm batch): {diff.mean().item():.6f}")
        stems = batch.get("stem")
        if stems is not None:
            print(f"  stems: {stems}")


def run_train_skeleton(
    data_root: Path,
    *,
    epochs: int = 1,
    batch_size: int = 4,
    lr: float = 3e-4,
    save_path: Path | None = None,
    overfit: bool = False,
    overfit_n: int = 4,
    overfit_stems: list[str] | None = None,
    seed: int = 42,
    no_augment: bool = False,
    weight_decay: float = 1e-4,
    grad_clip: float | None = 1.0,
) -> None:
    """
    Veri yoksa veya boşsa erken çıkış (CI kırılmaz).

    overfit=True: küçük alt küme, augment kapalı; train/val aynı örnekler (loss eğrisi izlenir).
    """
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

    labels_dir = data_root / "labels"
    if not labels_dir.is_dir():
        print(f"[train_skeleton] Etiket klasörü yok: {labels_dir} — atlanıyor.")
        return

    stems = stems_from_dirs(labels_dir)
    if not stems:
        print("[train_skeleton] Etiket yok — önce data_root altına images/ ve labels/ ekleyin.")
        return

    if overfit:
        if overfit_stems:
            train_stems = [s for s in overfit_stems if (labels_dir / f"{s}.json").is_file()]
            missing = set(overfit_stems) - set(train_stems)
            if missing:
                print(f"[train_skeleton] Uyarı: etiketi olmayan kökler atlandı: {sorted(missing)}")
        else:
            train_stems = sorted(stems)[: max(1, overfit_n)]
        val_stems = list(train_stems)
        use_augment = False
        print(
            f"[train_skeleton] Overfit modu: {len(train_stems)} örnek, augment=kapalı, train==val."
        )
    else:
        split_train = read_split_file(data_root / "splits" / "train.txt")
        split_val = read_split_file(data_root / "splits" / "val.txt")
        if split_train:
            train_stems, val_stems = split_train, split_val
        else:
            train_stems, val_stems = train_val_split(stems, val_ratio=0.15)
        use_augment = not no_augment
        print(
            f"[train_skeleton] Train/val: {len(train_stems)} train, {len(val_stems)} val "
            f"(splits/ yoksa ~%85/%15 rastgele); augment={'açık' if use_augment else 'kapalı'}."
        )

    if not train_stems:
        print("[train_skeleton] Eğitim örneği yok.")
        return

    train_ds = TurkishColumnCornerDataset(data_root, train_stems, augment=use_augment)
    val_ds = (
        TurkishColumnCornerDataset(data_root, val_stems, augment=False)
        if val_stems
        else None
    )

    gen = torch.Generator()
    gen.manual_seed(seed)
    train_loader = DataLoader(
        train_ds,
        batch_size=batch_size,
        shuffle=True,
        num_workers=0,
        generator=gen,
    )
    device = pick_device()
    model = build_model((256, 256)).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    print(
        f"[train_skeleton] device={device} lr={lr} batch_size={batch_size} epochs={epochs} "
        f"weight_decay={weight_decay} grad_clip={grad_clip}"
    )

    for epoch in range(epochs):
        model.train()
        total = 0.0
        n = 0
        for batch in train_loader:
            x = batch["image"].to(device)
            y = batch["target"].to(device)
            opt.zero_grad()
            pred = model(x)
            loss = loss_l1_normalized(pred, y)
            loss.backward()
            if grad_clip is not None and grad_clip > 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), grad_clip)
            opt.step()
            total += float(loss.item())
            n += 1
        print(f"epoch {epoch + 1}/{epochs} train_loss={total / max(n, 1):.6f}")

        if val_ds is not None and len(val_ds) > 0:
            model.eval()
            vloader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)
            vt = 0.0
            vn = 0
            with torch.no_grad():
                for batch in vloader:
                    x = batch["image"].to(device)
                    y = batch["target"].to(device)
                    pred = model(x)
                    vt += float(loss_l1_normalized(pred, y).item())
                    vn += 1
            print(f"           val_loss={vt / max(vn, 1):.6f}")

    if val_ds is not None and len(val_ds) > 0:
        _debug_val_batch(model, val_ds, batch_size, device)

    if save_path is not None and train_stems:
        save_path = Path(save_path)
        save_path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(model.state_dict(), save_path)
        print(f"[train_skeleton] Ağırlık kaydedildi: {save_path}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument(
        "--data-root",
        type=Path,
        default=None,
        help="images/ ve labels/ kökü (varsayılan: EduAnalyzer/data/turkish_column_corners)",
    )
    p.add_argument("--epochs", type=int, default=50, help="Tam eğitim için 40–80 tipik; overfit için 80–200")
    p.add_argument("--batch-size", type=int, default=4)
    p.add_argument(
        "--lr",
        type=float,
        default=3e-4,
        help="Küçük veri + augment için 1e-3 sık diverjans yapar; 3e-4–1e-4 deneyin",
    )
    p.add_argument(
        "--no-augment",
        action="store_true",
        help="Yatay çevirme augment kapalı (az veride daha stabil tam eğitim)",
    )
    p.add_argument(
        "--weight-decay",
        type=float,
        default=1e-4,
        help="AdamW ağırlık cezası",
    )
    p.add_argument(
        "--grad-clip",
        type=float,
        default=1.0,
        help="0 veya negatif: kapalı",
    )
    p.add_argument(
        "--save",
        type=Path,
        default=None,
        help="state_dict (.pt); verify_warp --source model --weights ile kullanılır",
    )
    p.add_argument(
        "--overfit",
        action="store_true",
        help="Küçük alt küme ile augment kapalı eğitim (pipeline / ezber testi)",
    )
    p.add_argument(
        "--overfit-n",
        type=int,
        default=4,
        help="--overfit: sıralı ilk N etiketli örnek (varsayılan 4)",
    )
    p.add_argument(
        "--overfit-stems",
        nargs="*",
        default=None,
        help="--overfit: belirli kök adları (image_001 vb.); verilirse --overfit-n yok sayılır",
    )
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()
    root = args.data_root or _default_data_root()
    save = args.save if args.save is not None else _default_save_path()
    gc = args.grad_clip if args.grad_clip > 0 else None
    run_train_skeleton(
        root.resolve(),
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        save_path=save,
        overfit=args.overfit,
        overfit_n=args.overfit_n,
        overfit_stems=list(args.overfit_stems) if args.overfit_stems else None,
        seed=args.seed,
        no_augment=args.no_augment,
        weight_decay=args.weight_decay,
        grad_clip=gc,
    )
