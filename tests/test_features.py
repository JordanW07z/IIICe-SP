from irrigation_timing.features import build_features, STAGES, STAGE_INDEX
from irrigation_timing.types import Stage


def test_stage_index_is_stable_ordering():
    assert STAGES == [Stage.NONE, Stage.SMALL_MEDIUM, Stage.MATURE]
    assert STAGE_INDEX[Stage.NONE] == 0
    assert STAGE_INDEX[Stage.MATURE] == 2


def test_build_features_returns_numeric_vector():
    feats = build_features(24.0, 88.0, "small_medium")
    assert feats == [24.0, 88.0, 1]


def test_build_features_accepts_enum():
    feats = build_features(27.0, 72.0, Stage.NONE)
    assert feats == [27.0, 72.0, 0]
