from __future__ import annotations

import pickle
from pathlib import Path
from typing import Union

import numpy as np

from ..features import build_features
from ..types import Stage


def load_model(model_path: Union[str, Path]):
    with open(model_path, "rb") as fh:
        return pickle.load(fh)


def predict_growth(model, temp: float, rh: float, stage: Union[str, Stage]) -> float:
    return float(model.predict([build_features(temp, rh, stage)])[0])


def optimum(
    model,
    stage: Union[str, Stage],
    temp_range=(18.0, 30.0),
    rh_range=(70.0, 98.0),
    step: float = 0.5,
) -> dict:
    """Grid-search the model's predicted-growth surface; return argmax conditions."""
    temps = np.arange(temp_range[0], temp_range[1] + 1e-9, step)
    rhs = np.arange(rh_range[0], rh_range[1] + 1e-9, step)
    grid = [build_features(t, r, stage) for t in temps for r in rhs]
    preds = model.predict(grid)
    i = int(np.argmax(preds))
    return {
        "temp": float(temps[i // len(rhs)]),
        "rh": float(rhs[i % len(rhs)]),
        "growth": float(preds[i]),
    }
