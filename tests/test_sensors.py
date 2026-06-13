from datetime import datetime
import pytest
from irrigation_timing.config import load_config
from irrigation_timing.sensors.synthetic import climate_at, diurnal_profile, SyntheticSensor
from irrigation_timing.sensors.real import RealSensor
from irrigation_timing.types import Reading

CFG = load_config()


def test_climate_diurnal_shape():
    # temperature peaks mid-afternoon, RH peaks pre-dawn (inverse)
    t14, _ = climate_at(14, CFG)
    t5, _ = climate_at(5, CFG)
    _, rh5 = climate_at(5, CFG)
    _, rh14 = climate_at(14, CFG)
    assert t14 > t5
    assert rh5 > rh14


def test_diurnal_profile_is_24_hours_in_bounds():
    prof = diurnal_profile(CFG)
    assert len(prof) == 24
    for temp, rh in prof:
        assert 20.0 <= temp <= 36.0
        assert 0.0 <= rh <= 100.0


def test_synthetic_sensor_reads_at_fixed_clock():
    sensor = SyntheticSensor(CFG, clock=lambda: datetime(2026, 6, 13, 14, 0), seed=0)
    r = sensor.read()
    assert isinstance(r, Reading)
    assert 25.0 <= r.temp <= 36.0   # afternoon, warm


def test_real_sensor_not_implemented():
    with pytest.raises(NotImplementedError):
        RealSensor().read()
