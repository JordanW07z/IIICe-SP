from __future__ import annotations

import math
from datetime import datetime
from typing import Callable, List, Optional, Tuple

import numpy as np

from .base import SensorSource
from ..types import Reading


def climate_at(hour: float, config: dict, noise_rng: Optional[np.random.Generator] = None) -> Tuple[float, float]:
    """Synthetic Binh Duong climate at a given hour (0..24)."""
    c = config["climate"]
    t_amp = (c["temp_max"] - c["temp_min"]) / 2.0
    t_mid = (c["temp_max"] + c["temp_min"]) / 2.0
    temp = t_mid + t_amp * math.cos(2 * math.pi * (hour - c["temp_peak_hour"]) / 24.0)

    rh_amp = (c["rh_max"] - c["rh_min"]) / 2.0
    rh_mid = (c["rh_max"] + c["rh_min"]) / 2.0
    rh = rh_mid + rh_amp * math.cos(2 * math.pi * (hour - c["rh_peak_hour"]) / 24.0)

    if noise_rng is not None:
        temp += noise_rng.normal(0.0, 0.5)
        rh += noise_rng.normal(0.0, 1.5)
    temp = max(0.0, min(50.0, temp))
    return temp, max(0.0, min(100.0, rh))


def diurnal_profile(config: dict) -> List[Tuple[float, float]]:
    """Noise-free 24-hour (temp, rh) profile, one entry per hour 0..23."""
    return [climate_at(h, config) for h in range(24)]


class SyntheticSensor(SensorSource):
    def __init__(self, config: dict, clock: Optional[Callable[[], datetime]] = None, seed: int = 0):
        self.config = config
        self.clock = clock or datetime.now
        self.rng = np.random.default_rng(seed)

    def read(self) -> Reading:
        now = self.clock()
        hour = now.hour + now.minute / 60.0
        temp, rh = climate_at(hour, self.config, self.rng)
        return Reading(temp=temp, rh=rh, ts=now)
