import numpy as np
from irrigation_timing.config import load_config
from irrigation_timing.data.synthetic import make_dataset

CFG = load_config()


def test_dataset_shape_and_bounds():
    X, y = make_dataset(500, CFG, seed=1)
    assert X.shape == (500, 3)
    assert y.shape == (500,)
    assert y.min() >= 0.0 and y.max() <= 1.0
    # feature columns: temp, rh, stage_index
    assert X[:, 0].min() >= 15.0 and X[:, 0].max() <= 35.0
    assert X[:, 1].min() >= 55.0 and X[:, 1].max() <= 100.0
    assert set(np.unique(X[:, 2]).astype(int)).issubset({0, 1, 2})


def test_dataset_is_reproducible():
    X1, y1 = make_dataset(100, CFG, seed=7)
    X2, y2 = make_dataset(100, CFG, seed=7)
    assert np.array_equal(X1, X2) and np.array_equal(y1, y2)
