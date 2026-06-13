from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class Stage(str, Enum):
    """Camera growth-stage classes (from the YOLO model)."""

    NONE = "none"                 # colonization / no visible mushrooms
    SMALL_MEDIUM = "small_medium"  # pinning + young fruiting
    MATURE = "mature"             # harvest-ready — never water

    @classmethod
    def from_str(cls, value: str) -> "Stage":
        return cls(value.strip().lower())


@dataclass(frozen=True)
class Reading:
    """A single environmental sensor reading."""

    temp: float   # degrees Celsius
    rh: float     # relative humidity, percent (0..100)
    ts: datetime  # timestamp of the reading
