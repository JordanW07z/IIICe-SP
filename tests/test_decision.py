from irrigation_timing.config import load_config
from irrigation_timing.model.train import train
from irrigation_timing.decision import decide_now, best_window
from irrigation_timing.sensors.synthetic import diurnal_profile
from irrigation_timing.types import Stage

CFG = load_config()


def _model(tmp_path):
    model, _ = train(n=3000, seed=0, model_path=tmp_path / "m.pkl", config=CFG)
    return model


def test_mature_never_irrigates(tmp_path):
    model = _model(tmp_path)
    d = decide_now(model, 23.0, 80.0, Stage.MATURE, CFG, hour=10)
    assert d["irrigate"] is False
    assert "mature" in d["reason"].lower()


def test_no_stage_does_not_irrigate(tmp_path):
    model = _model(tmp_path)
    d = decide_now(model, 27.0, 72.0, Stage.NONE, CFG, hour=10)
    assert d["irrigate"] is False


def test_high_rh_blocked_to_avoid_blotch(tmp_path):
    model = _model(tmp_path)
    # 92 + delta_rh(8) = 100 > rh_hard_max(95) -> veto
    d = decide_now(model, 23.0, 92.0, Stage.SMALL_MEDIUM, CFG, hour=10)
    assert d["irrigate"] is False
    assert "rh" in d["reason"].lower() or "blotch" in d["reason"].lower()


def test_dry_fruiting_midday_irrigates(tmp_path):
    model = _model(tmp_path)
    # low RH, inside drying window (8..15), not mature -> should water
    d = decide_now(model, 24.0, 70.0, Stage.SMALL_MEDIUM, CFG, hour=11)
    assert d["irrigate"] is True
    assert d["growth_gain"] > 0


def test_evening_blocked_by_drying_window(tmp_path):
    model = _model(tmp_path)
    # same dry conditions but at 21:00 -> outside drying window -> wait
    d = decide_now(model, 24.0, 70.0, Stage.SMALL_MEDIUM, CFG, hour=21)
    assert d["irrigate"] is False
    assert "dry" in d["reason"].lower()


def test_best_window_is_daytime_for_fruiting(tmp_path):
    model = _model(tmp_path)
    profile = [(h, t, r) for h, (t, r) in enumerate(diurnal_profile(CFG))]
    win = best_window(model, Stage.SMALL_MEDIUM, profile, CFG)
    assert win["window"] is not None
    start, end = win["window"]
    assert 8 <= start and end <= 15   # inside the configured drying window


def test_best_window_none_for_mature(tmp_path):
    model = _model(tmp_path)
    profile = [(h, t, r) for h, (t, r) in enumerate(diurnal_profile(CFG))]
    win = best_window(model, Stage.MATURE, profile, CFG)
    assert win["window"] is None
