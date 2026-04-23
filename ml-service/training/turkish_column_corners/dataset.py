"""
Türkçe sütun köşe veri seti: görüntü + JSON etiket okuma, train/val split.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Iterator, List, Sequence, Tuple

import numpy as np
import torch
from torch.utils.data import Dataset

from ml_service.training.turkish_column_corners.transforms import (
    ImageGeometry,
    flat8,
    resize_corners_with_image,
)


CORNER_ORDER = ("TL", "TR", "BR", "BL")


def load_annotation_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def parse_corners_pixel(data: dict, source_path: str = "") -> np.ndarray:
    """JSON → (4,2) float64, sıra TL..BL."""
    cp = data.get("corners_pixel") or data.get("corners", {})
    pts = cp.get("points")
    order = cp.get("order", list(CORNER_ORDER))
    if pts is None or len(pts) != 4:
        raise ValueError(f"Geçersiz köşe: {source_path}")
    if tuple(order) != CORNER_ORDER:
        raise ValueError(f"Köşe sırası {CORNER_ORDER} olmalı, gelen: {order}")
    return np.array(pts, dtype=np.float64)


_IMAGE_SUFFIXES_DEFAULT = (".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG")


def find_image_for_stem(
    images_dir: Path,
    stem: str,
    suffixes: Tuple[str, ...] = _IMAGE_SUFFIXES_DEFAULT,
) -> Path | None:
    """images/ altında stem ile eşleşen ilk görüntü dosyası."""
    for suf in suffixes:
        p = images_dir / f"{stem}{suf}"
        if p.is_file():
            return p
    return None


def read_split_file(path: Path) -> List[str]:
    if not path.is_file():
        return []
    lines = path.read_text(encoding="utf-8").strip().splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith("#")]


class TurkishColumnCornerDataset(Dataset):
    """
    Kök dizin:
      root/images/<stem>.jpg
      root/labels/<stem>.json
    split dosyası: kök adı listesi (uzantısız).
    """

    def __init__(
        self,
        root: Path | str,
        split_stems: Sequence[str],
        *,
        input_size: Tuple[int, int] = (256, 256),
        augment: bool = False,
        image_suffixes: Tuple[str, ...] = (".jpg", ".jpeg", ".png"),
    ) -> None:
        super().__init__()
        self._root = Path(root)
        self._images_dir = self._root / "images"
        self._labels_dir = self._root / "labels"
        self._input_size = input_size
        self._augment = augment

        self._items: List[Tuple[Path, Path]] = []
        for stem in split_stems:
            label_path = self._labels_dir / f"{stem}.json"
            if not label_path.is_file():
                continue
            img_path = find_image_for_stem(self._images_dir, stem, image_suffixes)
            if img_path is None:
                continue
            self._items.append((img_path, label_path))

    def __len__(self) -> int:
        return len(self._items)

    def __getitem__(self, index: int) -> dict:
        import cv2

        img_path, label_path = self._items[index]
        data = load_annotation_json(label_path)
        corners_px = parse_corners_pixel(data, str(label_path))

        bgr = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
        if bgr is None:
            raise FileNotFoundError(str(img_path))
        orig_h, orig_w = bgr.shape[:2]
        iw, ih = self._input_size
        resized = cv2.resize(bgr, (iw, ih), interpolation=cv2.INTER_AREA)

        geom = ImageGeometry(orig_w=orig_w, orig_h=orig_h, input_w=iw, input_h=ih)
        target_norm = resize_corners_with_image(corners_px, geom)

        if self._augment and random.random() < 0.5:
            from ml_service.training.turkish_column_corners.transforms import (
                augment_light,
                flip_horizontal_corners,
            )

            resized = cv2.flip(resized, 1)
            flipped = flip_horizontal_corners(target_norm)
            target_norm = augment_light(flipped, hflip=False, noise_std=0.002)

        tensor = torch.from_numpy(resized).permute(2, 0, 1).float() / 255.0
        target = torch.from_numpy(flat8(target_norm)).float()

        return {
            "image": tensor,
            "target": target,
            "stem": img_path.stem,
            "orig_size": torch.tensor([orig_w, orig_h], dtype=torch.float32),
        }


def train_val_split(
    stems: List[str],
    *,
    val_ratio: float = 0.15,
    seed: int = 42,
) -> Tuple[List[str], List[str]]:
    rng = random.Random(seed)
    shuffled = list(stems)
    rng.shuffle(shuffled)
    if len(shuffled) <= 1:
        return shuffled, []
    n_val = max(1, int(len(shuffled) * val_ratio))
    val = shuffled[:n_val]
    train = shuffled[n_val:]
    return train, val


def stems_from_dirs(labels_dir: Path) -> List[str]:
    """split dosyası yoksa: etiketi olan tüm kök adları."""
    stems: List[str] = []
    for jp in sorted(labels_dir.glob("*.json")):
        stems.append(jp.stem)
    return stems


def iter_dataset_roots(data_root: Path) -> Iterator[Path]:
    """Tek veri kökü veya alt klasörler (genişletme için)."""
    if (data_root / "images").is_dir() and (data_root / "labels").is_dir():
        yield data_root
