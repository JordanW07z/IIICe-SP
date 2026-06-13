from __future__ import annotations

from typing import List, Optional, Tuple, Union

from .model.predict import predict_growth
from .types import Stage


def _guardrails(temp: float, rh: float, stage: Stage, config: dict) -> Tuple[bool, str]:
    """Return (blocked, reason). Guardrails override the model — spec §7."""
    g = config["guardrails"]
    if stage == Stage.MATURE:
        return True, "mature: never irrigate (overwatering causes spoilage)"
    if not config["stages"].get(stage.value, {}).get("irrigate", False):
        return True, f"stage {stage.value}: surface irrigation not required"
    if temp > g["temp_stress"]:
        return True, "temperature above safe band (thermal stress); wait for cooler conditions"
    if rh + config["watering_effect"]["delta_rh"] > g["rh_hard_max"]:
        return True, "watering would push RH above safe max (blotch risk)"
    return False, ""


def _surface_can_dry(hour: Optional[float], config: dict) -> Tuple[bool, str]:
    """Surface-drying guardrail: only water inside the daytime drying window so the
    cap film evaporates before the humid night. Does NOT lower ambient RH."""
    if hour is None:
        return True, ""
    lo, hi = config["drying_window"]
    if lo <= hour < hi:
        return True, ""
    return False, "outside daytime drying window; cap film won't dry before the humid night"


def decide_now(
    model,
    temp: float,
    rh: float,
    stage: Union[str, Stage],
    config: dict,
    hour: Optional[float] = None,
) -> dict:
    """Real-time irrigate/wait decision from predicted growth gain + guardrails."""
    stage = Stage.from_str(stage) if isinstance(stage, str) else stage

    blocked, reason = _guardrails(temp, rh, stage, config)
    if blocked:
        return {"irrigate": False, "growth_gain": 0.0, "reason": reason}

    eff = config["watering_effect"]
    before = predict_growth(model, temp, rh, stage)
    after = predict_growth(model, temp + eff["delta_temp"], rh + eff["delta_rh"], stage)
    gain = after - before

    if gain <= 0:
        return {"irrigate": False, "growth_gain": gain,
                "reason": "RH already near optimum; watering yields no growth gain"}

    dry_ok, dry_reason = _surface_can_dry(hour, config)
    if not dry_ok:
        return {"irrigate": False, "growth_gain": gain, "reason": dry_reason}

    return {"irrigate": True, "growth_gain": gain,
            "reason": "watering raises predicted growth and the cap will dry in time"}


def best_window(
    model,
    stage: Union[str, Stage],
    profile: List[Tuple[float, float, float]],
    config: dict,
) -> dict:
    """Scan a (hour, temp, rh) diurnal profile; return the contiguous run of
    irrigate-now hours with the greatest total predicted growth gain."""
    stage = Stage.from_str(stage) if isinstance(stage, str) else stage

    runs: List[List[Tuple[float, float]]] = []
    current: List[Tuple[float, float]] = []
    for hour, temp, rh in profile:
        d = decide_now(model, temp, rh, stage, config, hour=hour)
        if d["irrigate"]:
            current.append((hour, d["growth_gain"]))
        elif current:
            runs.append(current)
            current = []
    if current:
        runs.append(current)

    if not runs:
        return {"window": None, "hours": [], "total_gain": 0.0,
                "reason": "no suitable irrigation time for this stage"}

    best = max(runs, key=lambda run: sum(g for _, g in run))
    return {
        "window": (int(best[0][0]), int(best[-1][0]) + 1),
        "hours": [int(h) for h, _ in best],
        "total_gain": float(sum(g for _, g in best)),
    }
