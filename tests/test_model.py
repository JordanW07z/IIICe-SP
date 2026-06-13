from irrigation_timing.config import load_config
from irrigation_timing.model.train import train
from irrigation_timing.model.predict import predict_growth, optimum
from irrigation_timing.types import Stage

CFG = load_config()


def test_train_returns_reasonable_metrics(tmp_path):
    model, metrics = train(n=2000, seed=0, model_path=tmp_path / "m.pkl", config=CFG)
    assert metrics["r2"] > 0.7          # learns the surface well
    assert metrics["mae"] < 0.1
    assert (tmp_path / "m.pkl").exists()


def test_model_identifies_fruiting_optimum(tmp_path):
    model, _ = train(n=4000, seed=0, model_path=tmp_path / "m.pkl", config=CFG)
    opt = optimum(model, Stage.SMALL_MEDIUM)
    # cited fruiting bands: temp 20-28 C, RH ~85-95 (peak ~90)
    assert 20.0 <= opt["temp"] <= 28.0
    assert 84.0 <= opt["rh"] <= 95.0


def test_predict_growth_higher_at_optimum(tmp_path):
    model, _ = train(n=2000, seed=0, model_path=tmp_path / "m.pkl", config=CFG)
    good = predict_growth(model, 23.0, 90.0, Stage.SMALL_MEDIUM)
    bad = predict_growth(model, 34.0, 60.0, Stage.SMALL_MEDIUM)
    assert good > bad
