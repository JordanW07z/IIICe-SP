"""
Train and evaluate the irrigation classifier + duration regressor.

Classifier: should we irrigate? (YES=1 / NO=0)
  - mature stage     -> NO (ready to harvest, don't water)
  - none/small_medium + humidity already high (>= rh_hard_max) -> NO
  - none/small_medium + humidity low enough   -> YES

Regressor: how long to irrigate? (minutes) — only trained on YES samples
  - none        -> shorter duration (3-5 min)
  - small_medium -> longer duration (8-12 min)
  - scaled down by how high humidity already is

Outputs all evaluation graphs to: reports/
Run from the project root: python -m scripts.train_irrigation_models
"""

from __future__ import annotations

import pickle
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    classification_report,
    confusion_matrix,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import train_test_split

from irrigation_timing.config import load_config
from irrigation_timing.features import STAGES

REPORTS_DIR = Path("reports")
MODELS_DIR = Path("models")
REPORTS_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

STAGE_NAMES = ["none", "small_medium", "mature"]
FEATURE_NAMES = ["Temperature (°C)", "Humidity (%)", "Stage", "Mushroom Count"]

# Duration weights per stage (minutes)
DURATION_BASE = {"none": 4.0, "small_medium": 10.0, "mature": 0.0}


def make_dataset(n: int, config: dict, seed: int = 0):
    rng = np.random.default_rng(seed)
    cfg = config

    temps = rng.uniform(15.0, 35.0, n)
    rhs = rng.uniform(55.0, 100.0, n)
    stage_idx = rng.integers(0, 3, n)  # 0=none, 1=small_medium, 2=mature
    counts = rng.integers(0, 20, n).astype(float)

    rh_hard_max = cfg["guardrails"]["rh_hard_max"]

    irrigate = np.zeros(n, dtype=int)
    duration = np.zeros(n, dtype=float)

    for i in range(n):
        stage = STAGE_NAMES[stage_idx[i]]
        rh = rhs[i]

        if stage == "mature":
            irrigate[i] = 0
            duration[i] = 0.0
        elif rh >= rh_hard_max:
            irrigate[i] = 0
            duration[i] = 0.0
        else:
            irrigate[i] = 1
            base = DURATION_BASE[stage]
            # Scale duration down as humidity approaches rh_hard_max
            humidity_factor = 1.0 - ((rh - 55.0) / (rh_hard_max - 55.0))
            humidity_factor = float(np.clip(humidity_factor, 0.1, 1.0))
            noise = float(rng.normal(0, 0.5))
            duration[i] = float(np.clip(base * humidity_factor + noise, 1.0, 15.0))

    X = np.column_stack([temps, rhs, stage_idx.astype(float), counts])
    return X, irrigate, duration


def plot_confusion_matrix(cm, ax, title):
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=["No Irrigate", "Irrigate"])
    disp.plot(ax=ax, colorbar=False, cmap="Greens")
    ax.set_title(title, fontsize=13, fontweight="bold")


def main():
    print("Loading config...")
    config = load_config()

    print("Generating synthetic dataset (n=5000)...")
    X, y_clf, y_reg = make_dataset(5000, config, seed=42)

    # ── Classifier ──────────────────────────────────────────────────────────
    print("\nTraining classifier...")
    X_tr, X_te, yc_tr, yc_te = train_test_split(X, y_clf, test_size=0.2, random_state=42)

    clf = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    clf.fit(X_tr, yc_tr)
    yc_pred = clf.predict(X_te)

    print("\n-- Classifier Results --")
    print(classification_report(yc_te, yc_pred, target_names=["No Irrigate", "Irrigate"]))

    # ── Regressor (YES samples only) ────────────────────────────────────────
    print("Training regressor (YES samples only)...")
    yes_mask = y_clf == 1
    X_yes = X[yes_mask]
    y_yes = y_reg[yes_mask]

    Xr_tr, Xr_te, yr_tr, yr_te = train_test_split(X_yes, y_yes, test_size=0.2, random_state=42)

    reg = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1)
    reg.fit(Xr_tr, yr_tr)
    yr_pred = reg.predict(Xr_te)

    mae = mean_absolute_error(yr_te, yr_pred)
    rmse = mean_squared_error(yr_te, yr_pred) ** 0.5
    r2 = r2_score(yr_te, yr_pred)

    print("\n-- Regressor Results --")
    print(f"  MAE:  {mae:.3f} min")
    print(f"  RMSE: {rmse:.3f} min")
    print(f"  R²:   {r2:.3f}")

    # ── Save models ─────────────────────────────────────────────────────────
    with open(MODELS_DIR / "irrigation_classifier.pkl", "wb") as f:
        pickle.dump(clf, f)
    with open(MODELS_DIR / "irrigation_regressor.pkl", "wb") as f:
        pickle.dump(reg, f)
    print(f"\nModels saved to {MODELS_DIR}/")

    # ── Plots ────────────────────────────────────────────────────────────────
    fig, axes = plt.subplots(2, 3, figsize=(18, 11))
    fig.suptitle("Irrigation Classifier + Duration Regressor — Evaluation", fontsize=15, fontweight="bold")

    # 1. Confusion matrix
    cm = confusion_matrix(yc_te, yc_pred)
    plot_confusion_matrix(cm, axes[0, 0], "Confusion Matrix")

    # 2. Classifier feature importance
    ax = axes[0, 1]
    importances = clf.feature_importances_
    idx = np.argsort(importances)[::-1]
    ax.bar(range(len(FEATURE_NAMES)), importances[idx], color="#4caf50")
    ax.set_xticks(range(len(FEATURE_NAMES)))
    ax.set_xticklabels([FEATURE_NAMES[i] for i in idx], rotation=15, ha="right")
    ax.set_title("Classifier — Feature Importance", fontweight="bold")
    ax.set_ylabel("Importance")

    # 3. Irrigate YES/NO breakdown by stage
    ax = axes[0, 2]
    stage_labels = ["None", "Small/Medium", "Mature"]
    yes_counts = [np.sum((X[:, 2] == i) & (y_clf == 1)) for i in range(3)]
    no_counts  = [np.sum((X[:, 2] == i) & (y_clf == 0)) for i in range(3)]
    x = np.arange(3)
    ax.bar(x - 0.2, yes_counts, 0.4, label="Irrigate", color="#2e7d32")
    ax.bar(x + 0.2, no_counts,  0.4, label="Don't Irrigate", color="#c62828")
    ax.set_xticks(x)
    ax.set_xticklabels(stage_labels)
    ax.set_title("Irrigate Decision by Stage", fontweight="bold")
    ax.set_ylabel("Count")
    ax.legend()

    # 4. Predicted vs actual duration
    ax = axes[1, 0]
    ax.scatter(yr_te, yr_pred, alpha=0.3, color="#4caf50", s=10)
    mn, mx = yr_te.min(), yr_te.max()
    ax.plot([mn, mx], [mn, mx], "r--", linewidth=1.5, label="Perfect fit")
    ax.set_xlabel("Actual Duration (min)")
    ax.set_ylabel("Predicted Duration (min)")
    ax.set_title("Regressor — Predicted vs Actual", fontweight="bold")
    ax.legend()
    ax.text(0.05, 0.92, f"MAE={mae:.2f}  RMSE={rmse:.2f}  R²={r2:.2f}",
            transform=ax.transAxes, fontsize=9)

    # 5. Regressor feature importance
    ax = axes[1, 1]
    r_imp = reg.feature_importances_
    r_idx = np.argsort(r_imp)[::-1]
    ax.bar(range(len(FEATURE_NAMES)), r_imp[r_idx], color="#1976d2")
    ax.set_xticks(range(len(FEATURE_NAMES)))
    ax.set_xticklabels([FEATURE_NAMES[i] for i in r_idx], rotation=15, ha="right")
    ax.set_title("Regressor — Feature Importance", fontweight="bold")
    ax.set_ylabel("Importance")

    # 6. Duration distribution by stage
    ax = axes[1, 2]
    colors = ["#4caf50", "#1976d2"]
    stage_names_yes = ["None", "Small/Medium"]
    for si, (stage_i, color) in enumerate(zip([0, 1], colors)):
        mask = (X_yes[:, 2] == stage_i)
        ax.hist(y_yes[mask], bins=20, alpha=0.7, color=color, label=stage_names_yes[si])
    ax.set_xlabel("Duration (min)")
    ax.set_ylabel("Count")
    ax.set_title("Duration Distribution by Stage", fontweight="bold")
    ax.legend()

    plt.tight_layout()
    out_path = REPORTS_DIR / "irrigation_model_evaluation.png"
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    print(f"Evaluation chart saved to {out_path}")
    plt.show()


if __name__ == "__main__":
    main()
