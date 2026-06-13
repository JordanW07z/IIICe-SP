from irrigation_timing.config import load_config
from irrigation_timing.growth.response import growth_quality
from irrigation_timing.types import Stage

CFG = load_config()


def test_quality_peaks_at_optimum():
    # fruiting optimum: ~23 C, ~90% RH
    at_opt = growth_quality(23.0, 90.0, Stage.SMALL_MEDIUM, CFG)
    off_opt = growth_quality(23.0, 70.0, Stage.SMALL_MEDIUM, CFG)
    assert at_opt > off_opt
    assert at_opt > 0.8


def test_thermal_stress_penalised():
    normal = growth_quality(23.0, 90.0, Stage.SMALL_MEDIUM, CFG)
    hot = growth_quality(34.0, 90.0, Stage.SMALL_MEDIUM, CFG)
    assert hot < normal


def test_oversaturation_penalised():
    optimum = growth_quality(23.0, 90.0, Stage.SMALL_MEDIUM, CFG)
    wet = growth_quality(23.0, 99.0, Stage.SMALL_MEDIUM, CFG)
    assert wet < optimum


def test_quality_bounded_unit_interval():
    for t in (15, 23, 35):
        for r in (55, 90, 100):
            q = growth_quality(t, r, Stage.SMALL_MEDIUM, CFG)
            assert 0.0 <= q <= 1.0


def test_penalties_are_config_driven():
    cfg = load_config()
    hot = growth_quality(34.0, 90.0, Stage.SMALL_MEDIUM, cfg)
    # zeroing the penalty in a copied config should raise the hot-condition quality
    import copy
    cfg2 = copy.deepcopy(cfg)
    cfg2["guardrails"]["temp_stress_penalty"] = 1.0
    hot_no_penalty = growth_quality(34.0, 90.0, Stage.SMALL_MEDIUM, cfg2)
    assert hot_no_penalty > hot
