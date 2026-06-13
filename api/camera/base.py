from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Tuple


@dataclass(frozen=True)
class Detection:
    box: Tuple[float, float, float, float]  # x, y, w, h normalized 0..1
    label: str                              # "water" | "dont_water"
    stage: str                              # "none" | "small_medium" | "mature"
    confidence: float


@dataclass(frozen=True)
class ShelfFrame:
    id: int
    stage: str
    detections: Tuple[Detection, ...]   # tuple keeps the frozen dataclass truly immutable


class CameraSource(ABC):
    """One frame per shelf with YOLO-shaped detections. Real YoloCamera and MockCamera
    both implement this, so the API and frontend never change when YOLO is wired in."""

    @abstractmethod
    def frames(self) -> List[ShelfFrame]:
        ...
