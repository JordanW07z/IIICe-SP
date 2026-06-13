from datetime import datetime
import pytest
from irrigation_timing.types import Stage, Reading


def test_stage_from_str_normalises():
    assert Stage.from_str(" Small_Medium ") == Stage.SMALL_MEDIUM
    assert Stage.from_str("MATURE") == Stage.MATURE


def test_stage_from_str_rejects_unknown():
    with pytest.raises(ValueError):
        Stage.from_str("flowering")


def test_reading_holds_values():
    ts = datetime(2026, 6, 13, 7, 30)
    r = Reading(temp=24.0, rh=88.0, ts=ts)
    assert r.temp == 24.0 and r.rh == 88.0 and r.ts == ts
