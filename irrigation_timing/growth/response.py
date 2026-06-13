from __future__ import annotations

import math
from typing import Union

from ..types import Stage


def _bell(x: float, opt: float, half_width: float) -> float:
    """Gaussian-shaped response, 1.0 at opt, decaying with distance."""
    half_width = half_width or 1.0
    return math.exp(-((x - opt) ** 2) / (2.0 * half_width ** 2))


def growth_quality(temp: float, rh: float, stage: Union[str, Stage], config: dict) -> float:
    """Predicted growth quality (0..1) at the given conditions for a stage.

    Literature-derived response surface (spec §3). For MATURE the growth
    response uses the fruiting band (mature caps still live in fruiting
    conditions); irrigation on mature is vetoed by the decision guardrail,
    not here.
    """
    stage = Stage.from_str(stage) if isinstance(stage, str) else stage
    key = "small_medium" if stage == Stage.MATURE else stage.value
    s = config["stages"][key]

    temp_q = _bell(temp, s["temp_opt"], (s["temp_max"] - s["temp_min"]) / 2.0)
    rh_q = _bell(rh, s["rh_opt"], (s["rh_max"] - s["rh_min"]) / 2.0)
    quality = temp_q * rh_q

    g = config["guardrails"]
    if temp > g["temp_stress"]:
        quality *= g["temp_stress_penalty"]   # thermal stress: malformed bodies, low BE
    if rh > g["rh_hard_max"]:
        quality *= g["rh_oversaturation_penalty"]   # over-saturation: blotch/mould risk

    return max(0.0, min(1.0, quality))
