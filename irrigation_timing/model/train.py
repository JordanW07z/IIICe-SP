from __future__ import annotations

import pickle
from pathlib import Path
from typing import Optional, Tuple

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from ..config import load_config
from ..data.synthetic import make_dataset

MODEL_PATH = Path(__file__).resolve().parent.parent.parent / "models" / "growth_rf.pkl"


def train(
    n: int = 4000,
    seed: int = 0,
    model_path: Optional[Path] = None,
    config: Optional[dict] = None,
) -> Tuple[RandomForestRegressor, dict]:
    """Train the growth-quality regressor on synthetic data and persist it."""
    config = config or load_config()
    model_path = Path(model_path) if model_path else MODEL_PATH

    X, y = make_dataset(n, config, seed=seed)
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=seed)

    model = RandomForestRegressor(
        n_estimators=100, max_depth=12, random_state=seed, n_jobs=-1
    )
    model.fit(X_tr, y_tr)

    preds = model.predict(X_te)
    metrics = {
        "r2": float(r2_score(y_te, preds)),
        "mae": float(mean_absolute_error(y_te, preds)),
    }

    model_path.parent.mkdir(parents=True, exist_ok=True)
    with open(model_path, "wb") as fh:
        pickle.dump(model, fh)
    return model, metrics
