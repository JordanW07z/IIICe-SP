from __future__ import annotations

from typing import List

import numpy as np

from .base import CameraSource, Detection, ShelfFrame

_STAGES = ["none", "small_medium", "mature"]
# Public so tests verify against the implementation's mapping, not a copy.
LABEL_BY_STAGE = {"none": "water", "small_medium": "dont_water", "mature": "water"}


class MockCamera(CameraSource):
    """Synthetic stand-in for the YOLOv8 camera. Each shelf is assigned a FIXED growth
    stage at construction (a shelf does not change stage between polls); the detection
    boxes are regenerated on each frames() call so the live view drifts slightly, the way
    a real camera feed would. Labels follow the project deck (p.14) stage->label mapping."""

    def __init__(self, n_shelves: int = 3, seed: int = 0) -> None:
        self.n_shelves = n_shelves
        self.rng = np.random.default_rng(seed)
        # Stage per shelf is stable for the life of the camera instance.
        self._stages = [
            _STAGES[int(self.rng.integers(0, len(_STAGES)))] for _ in range(n_shelves)
        ]

    def frames(self) -> List[ShelfFrame]:
        frames: List[ShelfFrame] = []
        for shelf_id in range(1, self.n_shelves + 1):
            stage = self._stages[shelf_id - 1]
            label = LABEL_BY_STAGE[stage]
            n_det = 0 if stage == "none" else int(self.rng.integers(1, 4))
            detections: List[Detection] = []
            for _ in range(n_det):
                x = float(self.rng.uniform(0.05, 0.7))
                y = float(self.rng.uniform(0.05, 0.6))
                w = float(self.rng.uniform(0.12, min(0.3, 1.0 - x)))
                h = float(self.rng.uniform(0.12, min(0.35, 1.0 - y)))
                conf = float(round(self.rng.uniform(0.6, 0.98), 2))
                detections.append(Detection((x, y, w, h), label, stage, conf))
            frames.append(ShelfFrame(shelf_id, stage, tuple(detections)))
        return frames
