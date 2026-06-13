from __future__ import annotations

from typing import Tuple

import numpy as np

from ..features import STAGES
from ..growth.response import growth_quality


def make_dataset(n: int, config: dict, seed: int = 0) -> Tuple[np.ndarray, np.ndarray]:
    """Synthesise (X, y) training data.

    X columns: [temp, rh, stage_index]. y: growth-quality label (0..1) from the
    response surface plus small Gaussian noise so the model must generalise.
    """
    rng = np.random.default_rng(seed)
    temps = rng.uniform(15.0, 35.0, n)
    rhs = rng.uniform(55.0, 100.0, n)
    stage_idx = rng.integers(0, len(STAGES), n)

    X = np.column_stack([temps, rhs, stage_idx.astype(float)])
    y = np.empty(n, dtype=float)
    for i in range(n):
        stage = STAGES[int(stage_idx[i])]
        q = growth_quality(temps[i], rhs[i], stage, config)
        y[i] = float(np.clip(q + rng.normal(0.0, 0.03), 0.0, 1.0))
    return X, y
