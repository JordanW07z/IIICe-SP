from __future__ import annotations

from typing import List

import numpy as np

from .base import CameraSource, Detection, ShelfFrame

_STAGES = ["none", "small_medium", "mature"]
_LABEL_BY_STAGE = {"none": "water", "small_medium": "dont_water", "mature": "water"}


class MockCamera(CameraSource):
    """Synthetic stand-in for the YOLOv8 camera. Each shelf gets a stage and 1-3
    normalized detection boxes labelled per the project deck (p.14) mapping."""

    def __init__(self, n_shelves: int = 3, seed: int = 0) -> None:
        self.n_shelves = n_shelves
        self.rng = np.random.default_rng(seed)

    def frames(self) -> List[ShelfFrame]:
        frames: List[ShelfFrame] = []
        for shelf_id in range(1, self.n_shelves + 1):
            stage = _STAGES[self.rng.integers(0, len(_STAGES))]
            label = _LABEL_BY_STAGE[stage]
            n_det = 0 if stage == "none" else int(self.rng.integers(1, 4))
            detections: List[Detection] = []
            for _ in range(n_det):
                x = float(self.rng.uniform(0.05, 0.7))
                y = float(self.rng.uniform(0.05, 0.6))
                w = float(self.rng.uniform(0.12, min(0.3, 1.0 - x)))
                h = float(self.rng.uniform(0.12, min(0.35, 1.0 - y)))
                conf = float(round(self.rng.uniform(0.6, 0.98), 2))
                detections.append(Detection((x, y, w, h), label, stage, conf))
            frames.append(ShelfFrame(shelf_id, stage, detections))
        return frames
