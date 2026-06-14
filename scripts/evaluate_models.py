"""Evaluate the SpotShrooms non-YOLO model — the irrigation growth-quality regressor.

Reports BOTH:
  * regression metrics (R2, MAE, RMSE) — the model's native task, and
  * classification metrics (precision, recall, accuracy, F1) for the derived task
    "identify a favourable growth condition" (true growth-quality >= threshold),
    which is directly comparable to the YOLOv8 detector's precision/recall/accuracy.

Run:  python -m scripts.evaluate_models
"""
from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    precision_score,
    r2_score,
    recall_score,
)

from irrigation_timing.config import load_config
from irrigation_timing.features import STAGES, build_features
from irrigation_timing.growth.response import growth_quality
from irrigation_timing.model.train import train

TEST_N = 4000
TEST_SEED = 99          # held-out: different seed from training (seed=0)
GOOD_THRESHOLD = 0.50   # growth-quality >= this == a "favourable growth condition"


def _truth_and_features(n: int, config: dict, seed: int):
    """Generate a held-out test set: noiseless ground-truth growth-quality + the
    feature rows the model consumes."""
    rng = np.random.default_rng(seed)
    temps = rng.uniform(15.0, 35.0, n)
    rhs = rng.uniform(55.0, 100.0, n)
    stage_idx = rng.integers(0, len(STAGES), n)

    X = np.array([
        build_features(temps[i], rhs[i], STAGES[int(stage_idx[i])]) for i in range(n)
    ])
    truth = np.array([
        growth_quality(temps[i], rhs[i], STAGES[int(stage_idx[i])], config) for i in range(n)
    ])
    return X, truth


def main() -> None:
    config = load_config()

    # Train on the standard synthetic set (seed=0), evaluate on a fresh held-out set.
    model, train_metrics = train(config=config)
    X_test, truth = _truth_and_features(TEST_N, config, TEST_SEED)
    pred = model.predict(X_test)

    # --- Regression (native task) ---
    r2 = r2_score(truth, pred)
    mae = mean_absolute_error(truth, pred)
    rmse = float(np.sqrt(np.mean((truth - pred) ** 2)))

    # --- Classification (derived: favourable-condition detection) ---
    y_true = (truth >= GOOD_THRESHOLD).astype(int)
    y_pred = (pred >= GOOD_THRESHOLD).astype(int)
    precision = precision_score(y_true, y_pred, zero_division=0)
    recall = recall_score(y_true, y_pred, zero_division=0)
    accuracy = accuracy_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    pos_rate = float(y_true.mean())

    print("=" * 64)
    print("SpotShrooms irrigation growth-quality model — held-out evaluation")
    print(f"  test samples: {TEST_N}  (seed {TEST_SEED}, unseen in training)")
    print("-" * 64)
    print("Regression (native task: predict growth-quality 0..1)")
    print(f"  R^2  : {r2:.3f}")
    print(f"  MAE  : {mae:.3f}")
    print(f"  RMSE : {rmse:.3f}")
    print("-" * 64)
    print(f"Classification (favourable condition, growth-quality >= {GOOD_THRESHOLD})")
    print(f"  positive base rate : {pos_rate:.3f}")
    print(f"  Precision : {precision:.3f}")
    print(f"  Recall    : {recall:.3f}")
    print(f"  Accuracy  : {accuracy:.3f}")
    print(f"  F1        : {f1:.3f}")
    print("=" * 64)
    print(f"(train-time internal split: R^2={train_metrics['r2']:.3f}, "
          f"MAE={train_metrics['mae']:.3f})")


if __name__ == "__main__":
    main()
