from irrigation_timing.config import load_config


def test_load_default_config_has_expected_keys():
    cfg = load_config()
    assert cfg["species"] == "oyster_tropical"
    assert set(cfg["stages"]) == {"none", "small_medium", "mature"}
    assert cfg["stages"]["small_medium"]["rh_opt"] == 90.0
    assert cfg["guardrails"]["rh_hard_max"] == 95.0
    assert cfg["drying_window"] == [8, 15]
    assert cfg["climate"]["temp_peak_hour"] == 14
