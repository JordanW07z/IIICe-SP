# Humidity & Temperature Irrigation-Timing AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight, Raspberry-Pi-embeddable Python feature that learns the oyster-mushroom temperature/humidity growth optimum from synthetic data and uses it to recommend the best time of day to irrigate, aware of the camera's growth stage.

**Architecture:** A `RandomForestRegressor` is trained on synthetic data labeled by a literature-derived growth-quality response surface; it *finds* the optimum via argmax over its predicted-growth surface. A decision layer derives a real-time `irrigate/wait` call and a daily best-time window, wrapped by hard agronomic guardrails (never water mature; keep RH ≤ 95 %; only water inside the daytime surface-drying window). Sensor input is behind an abstract interface — synthetic now, real DHT22/SHT31 later.

**Tech Stack:** Python 3.10+, scikit-learn, numpy, PyYAML, SQLite (stdlib), pytest; matplotlib optional/dev-only.

**Reference spec:** `docs/superpowers/specs/2026-06-13-humidity-temp-irrigation-timing-design.md`

**Branch/commit rules:** ALL work stays on branch `New_Feature/Humidity&amp;Temp_Monitor`. Do **not** touch or push other branches. Append this trailer to every commit message:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## File Structure

```
osip-mushroom/
├── requirements.txt                     # pinned deps
├── .gitignore                           # ignore models/*.pkl, __pycache__, *.db
├── config/
│   └── oyster.yaml                      # per-stage optima, guardrails, climate, watering effect
├── irrigation_timing/
│   ├── __init__.py
│   ├── types.py                         # Stage enum, Reading dataclass
│   ├── config.py                        # load_config()
│   ├── features.py                      # build_features(), STAGES, STAGE_INDEX
│   ├── growth/
│   │   ├── __init__.py
│   │   └── response.py                  # growth_quality() response surface
│   ├── data/
│   │   ├── __init__.py
│   │   └── synthetic.py                 # make_dataset()
│   ├── model/
│   │   ├── __init__.py
│   │   ├── train.py                     # train(), MODEL_PATH
│   │   └── predict.py                   # load_model(), predict_growth(), optimum()
│   ├── sensors/
│   │   ├── __init__.py
│   │   ├── base.py                      # SensorSource ABC
│   │   ├── synthetic.py                 # climate_at(), diurnal_profile(), SyntheticSensor
│   │   └── real.py                      # RealSensor stub (Pi)
│   ├── store.py                         # SQLite Store
│   ├── decision.py                      # decide_now(), best_window(), guardrails
│   └── cli.py                           # train / report CLI
└── tests/
    ├── __init__.py
    ├── test_types.py
    ├── test_config.py
    ├── test_response.py
    ├── test_synthetic_data.py
    ├── test_features.py
    ├── test_model.py
    ├── test_sensors.py
    ├── test_store.py
    ├── test_decision.py
    └── test_cli.py
```

---

## Task 1: Project scaffold (deps, gitignore, package, config)

**Files:**
- Create: `requirements.txt`
- Create: `.gitignore`
- Create: `irrigation_timing/__init__.py`
- Create: `irrigation_timing/growth/__init__.py`, `irrigation_timing/data/__init__.py`, `irrigation_timing/model/__init__.py`, `irrigation_timing/sensors/__init__.py`
- Create: `tests/__init__.py`
- Create: `config/oyster.yaml`

- [ ] **Step 1: Create `requirements.txt`**

```
scikit-learn>=1.3
numpy>=1.24
PyYAML>=6.0
matplotlib>=3.7   ; optional, dev/visualisation only
pytest>=7.4       ; dev only
```

- [ ] **Step 2: Create `.gitignore`**

```
__pycache__/
*.pyc
models/*.pkl
*.db
.pytest_cache/
```

- [ ] **Step 3: Create empty package markers**

Create these files, each containing a single line:

`irrigation_timing/__init__.py`:
```python
"""SpotShrooms humidity & temperature irrigation-timing AI."""
```
`irrigation_timing/growth/__init__.py`, `irrigation_timing/data/__init__.py`, `irrigation_timing/model/__init__.py`, `irrigation_timing/sensors/__init__.py`, `tests/__init__.py`: each empty (`# package`).

- [ ] **Step 4: Create `config/oyster.yaml`**

```yaml
# Tropical oyster (Pleurotus florida / pulmonarius) — Binh Duong, Vietnam.
# Ranges literature-seeded (see spec §3); edit to match the farm's strain.
species: oyster_tropical

stages:
  none:            # colonization / spawn run — no surface irrigation
    temp_opt: 27.0
    temp_min: 25.0
    temp_max: 30.0
    rh_opt: 72.5
    rh_min: 70.0
    rh_max: 75.0
    irrigate: false
  small_medium:    # pinning + fruiting — irrigation matters here
    temp_opt: 23.0
    temp_min: 20.0
    temp_max: 28.0
    rh_opt: 90.0
    rh_min: 85.0
    rh_max: 95.0
    irrigate: true
  mature:          # harvest-ready — never water (spoilage)
    irrigate: false

guardrails:
  rh_hard_max: 95.0      # never let watering push RH above this (blotch/mould)
  temp_stress: 30.0      # above this = thermal stress
  rh_desiccation: 75.0   # below this (fruiting) = desiccation

watering_effect:
  delta_rh: 8.0          # one watering raises RH ~8 percentage points
  delta_temp: -1.0       # and cools slightly

# Daytime hours during which a watered cap can dry (warmth + ventilation)
# before the near-saturated, still night. Surface-drying guardrail uses this.
drying_window: [8, 15]

climate:                 # Binh Duong tropical diurnal (synthetic sensor)
  temp_min: 24.0
  temp_max: 33.0
  temp_peak_hour: 14
  rh_min: 60.0
  rh_max: 95.0
  rh_peak_hour: 5
```

- [ ] **Step 5: Verify the tree imports and config parses**

Run: `python -c "import irrigation_timing; import yaml; print(yaml.safe_load(open('config/oyster.yaml'))['species'])"`
Expected: prints `oyster_tropical`

- [ ] **Step 6: Commit**

```bash
git add requirements.txt .gitignore irrigation_timing tests config
git commit -m "chore: scaffold irrigation-timing package, deps, oyster config"
```

---

## Task 2: Core types (Stage enum + Reading)

**Files:**
- Create: `irrigation_timing/types.py`
- Test: `tests/test_types.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_types.py
from datetime import datetime
import pytest
from irrigation_timing.types import Stage, Reading


def test_stage_from_str_normalises():
    assert Stage.from_str(" Small_Medium ") == Stage.SMALL_MEDIUM
    assert Stage.from_str("MATURE") == Stage.MATURE


def test_stage_from_str_rejects_unknown():
    with pytest.raises(ValueError):
        Stage.from_str("flowering")


def test_reading_holds_values():
    ts = datetime(2026, 6, 13, 7, 30)
    r = Reading(temp=24.0, rh=88.0, ts=ts)
    assert r.temp == 24.0 and r.rh == 88.0 and r.ts == ts
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_types.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'irrigation_timing.types'`

- [ ] **Step 3: Write minimal implementation**

```python
# irrigation_timing/types.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class Stage(str, Enum):
    """Camera growth-stage classes (from the YOLO model)."""

    NONE = "none"                 # colonization / no visible mushrooms
    SMALL_MEDIUM = "small_medium"  # pinning + young fruiting
    MATURE = "mature"             # harvest-ready — never water

    @classmethod
    def from_str(cls, value: str) -> "Stage":
        return cls(value.strip().lower())


@dataclass(frozen=True)
class Reading:
    """A single environmental sensor reading."""

    temp: float   # degrees Celsius
    rh: float     # relative humidity, percent (0..100)
    ts: datetime  # timestamp of the reading
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_types.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add irrigation_timing/types.py tests/test_types.py
git commit -m "feat: add Stage enum and Reading dataclass"
```

---

## Task 3: Config loader

**Files:**
- Create: `irrigation_timing/config.py`
- Test: `tests/test_config.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_config.py
from irrigation_timing.config import load_config


def test_load_default_config_has_expected_keys():
    cfg = load_config()
    assert cfg["species"] == "oyster_tropical"
    assert set(cfg["stages"]) == {"none", "small_medium", "mature"}
    assert cfg["stages"]["small_medium"]["rh_opt"] == 90.0
    assert cfg["guardrails"]["rh_hard_max"] == 95.0
    assert cfg["drying_window"] == [8, 15]
    assert cfg["climate"]["temp_peak_hour"] == 14
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'irrigation_timing.config'`

- [ ] **Step 3: Write minimal implementation**

```python
# irrigation_timing/config.py
from __future__ import annotations

from pathlib import Path
from typing import Optional

import yaml

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "oyster.yaml"


def load_config(path: Optional[str] = None) -> dict:
    """Load the species/agronomy config. Defaults to config/oyster.yaml."""
    cfg_path = Path(path) if path else DEFAULT_CONFIG_PATH
    with open(cfg_path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_config.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add irrigation_timing/config.py tests/test_config.py
git commit -m "feat: add YAML config loader"
```

---

## Task 4: Feature builder (stage encoding)

**Files:**
- Create: `irrigation_timing/features.py`
- Test: `tests/test_features.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_features.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_features.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'irrigation_timing.features'`

- [ ] **Step 3: Write minimal implementation**

```python
# irrigation_timing/features.py
from __future__ import annotations

from typing import List, Union

from .types import Stage

# Canonical stage ordering — used for both training labels and inference.
STAGES = [Stage.NONE, Stage.SMALL_MEDIUM, Stage.MATURE]
STAGE_INDEX = {stage: i for i, stage in enumerate(STAGES)}


def build_features(temp: float, rh: float, stage: Union[str, Stage]) -> List[float]:
    """Build the model feature vector: [temp, rh, stage_index]."""
    stage = Stage.from_str(stage) if isinstance(stage, str) else stage
    return [float(temp), float(rh), STAGE_INDEX[stage]]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_features.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add irrigation_timing/features.py tests/test_features.py
git commit -m "feat: add feature builder with stable stage encoding"
```

---

## Task 5: Growth-response surface

**Files:**
- Create: `irrigation_timing/growth/response.py`
- Test: `tests/test_response.py`

This is the literature-derived label function (spec §3): a peaked surface maximal at the stage's
temp/RH optimum, penalised for thermal stress (>30 °C) and over-saturation (>95 % RH).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_response.py
from irrigation_timing.config import load_config
from irrigation_timing.growth.response import growth_quality
from irrigation_timing.types import Stage

CFG = load_config()


def test_quality_peaks_at_optimum():
    # fruiting optimum: ~23 C, ~90% RH
    at_opt = growth_quality(23.0, 90.0, Stage.SMALL_MEDIUM, CFG)
    off_opt = growth_quality(23.0, 70.0, Stage.SMALL_MEDIUM, CFG)
    assert at_opt > off_opt
    assert at_opt > 0.8


def test_thermal_stress_penalised():
    normal = growth_quality(23.0, 90.0, Stage.SMALL_MEDIUM, CFG)
    hot = growth_quality(34.0, 90.0, Stage.SMALL_MEDIUM, CFG)
    assert hot < normal


def test_oversaturation_penalised():
    optimum = growth_quality(23.0, 90.0, Stage.SMALL_MEDIUM, CFG)
    wet = growth_quality(23.0, 99.0, Stage.SMALL_MEDIUM, CFG)
    assert wet < optimum


def test_quality_bounded_unit_interval():
    for t in (15, 23, 35):
        for r in (55, 90, 100):
            q = growth_quality(t, r, Stage.SMALL_MEDIUM, CFG)
            assert 0.0 <= q <= 1.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_response.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'irrigation_timing.growth.response'`

- [ ] **Step 3: Write minimal implementation**

```python
# irrigation_timing/growth/response.py
from __future__ import annotations

import math
from typing import Union

from ..types import Stage


def _bell(x: float, opt: float, half_width: float) -> float:
    """Gaussian-shaped response, 1.0 at opt, decaying with distance."""
    half_width = half_width or 1.0
    return math.exp(-((x - opt) ** 2) / (2.0 * half_width ** 2))


def growth_quality(temp: float, rh: float, stage: Union[str, Stage], config: dict) -> float:
    """Predicted growth quality (0..1) at the given conditions for a stage.

    Literature-derived response surface (spec §3). For MATURE the growth
    response uses the fruiting band (mature caps still live in fruiting
    conditions); irrigation on mature is vetoed by the decision guardrail,
    not here.
    """
    stage = Stage.from_str(stage) if isinstance(stage, str) else stage
    key = "small_medium" if stage == Stage.MATURE else stage.value
    s = config["stages"][key]

    temp_q = _bell(temp, s["temp_opt"], (s["temp_max"] - s["temp_min"]) / 2.0)
    rh_q = _bell(rh, s["rh_opt"], (s["rh_max"] - s["rh_min"]) / 2.0)
    quality = temp_q * rh_q

    g = config["guardrails"]
    if temp > g["temp_stress"]:
        quality *= 0.3   # thermal stress: malformed bodies, low BE
    if rh > g["rh_hard_max"]:
        quality *= 0.4   # over-saturation: blotch/mould risk

    return max(0.0, min(1.0, quality))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_response.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add irrigation_timing/growth/response.py tests/test_response.py
git commit -m "feat: add literature-derived growth-response surface"
```

---

## Task 6: Synthetic training dataset

**Files:**
- Create: `irrigation_timing/data/synthetic.py`
- Test: `tests/test_synthetic_data.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_synthetic_data.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_synthetic_data.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'irrigation_timing.data.synthetic'`

- [ ] **Step 3: Write minimal implementation**

```python
# irrigation_timing/data/synthetic.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_synthetic_data.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add irrigation_timing/data/synthetic.py tests/test_synthetic_data.py
git commit -m "feat: add synthetic growth-response training dataset"
```

---

## Task 7: Model train + predict + optimum

**Files:**
- Create: `irrigation_timing/model/train.py`
- Create: `irrigation_timing/model/predict.py`
- Test: `tests/test_model.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_model.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_model.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'irrigation_timing.model.train'`

- [ ] **Step 3: Write minimal implementation**

```python
# irrigation_timing/model/train.py
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
```

```python
# irrigation_timing/model/predict.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_model.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add irrigation_timing/model/train.py irrigation_timing/model/predict.py tests/test_model.py
git commit -m "feat: train growth regressor and identify optimum via argmax"
```

---

## Task 8: Sensors (abstract + synthetic climate + real stub)

**Files:**
- Create: `irrigation_timing/sensors/base.py`
- Create: `irrigation_timing/sensors/synthetic.py`
- Create: `irrigation_timing/sensors/real.py`
- Test: `tests/test_sensors.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_sensors.py
from datetime import datetime
import pytest
from irrigation_timing.config import load_config
from irrigation_timing.sensors.synthetic import climate_at, diurnal_profile, SyntheticSensor
from irrigation_timing.sensors.real import RealSensor
from irrigation_timing.types import Reading

CFG = load_config()


def test_climate_diurnal_shape():
    # temperature peaks mid-afternoon, RH peaks pre-dawn (inverse)
    t14, _ = climate_at(14, CFG)
    t5, _ = climate_at(5, CFG)
    _, rh5 = climate_at(5, CFG)
    _, rh14 = climate_at(14, CFG)
    assert t14 > t5
    assert rh5 > rh14


def test_diurnal_profile_is_24_hours_in_bounds():
    prof = diurnal_profile(CFG)
    assert len(prof) == 24
    for temp, rh in prof:
        assert 20.0 <= temp <= 36.0
        assert 0.0 <= rh <= 100.0


def test_synthetic_sensor_reads_at_fixed_clock():
    sensor = SyntheticSensor(CFG, clock=lambda: datetime(2026, 6, 13, 14, 0), seed=0)
    r = sensor.read()
    assert isinstance(r, Reading)
    assert 25.0 <= r.temp <= 36.0   # afternoon, warm


def test_real_sensor_not_implemented():
    with pytest.raises(NotImplementedError):
        RealSensor().read()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_sensors.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'irrigation_timing.sensors.synthetic'`

- [ ] **Step 3: Write minimal implementation**

```python
# irrigation_timing/sensors/base.py
from __future__ import annotations

from abc import ABC, abstractmethod

from ..types import Reading


class SensorSource(ABC):
    """Abstract temperature/humidity source. Synthetic now, real hardware later."""

    @abstractmethod
    def read(self) -> Reading:
        ...
```

```python
# irrigation_timing/sensors/synthetic.py
from __future__ import annotations

import math
from datetime import datetime
from typing import Callable, List, Optional, Tuple

import numpy as np

from .base import SensorSource
from ..types import Reading


def climate_at(hour: float, config: dict, noise_rng: Optional[np.random.Generator] = None) -> Tuple[float, float]:
    """Synthetic Binh Duong climate at a given hour (0..24)."""
    c = config["climate"]
    t_amp = (c["temp_max"] - c["temp_min"]) / 2.0
    t_mid = (c["temp_max"] + c["temp_min"]) / 2.0
    temp = t_mid + t_amp * math.cos(2 * math.pi * (hour - c["temp_peak_hour"]) / 24.0)

    rh_amp = (c["rh_max"] - c["rh_min"]) / 2.0
    rh_mid = (c["rh_max"] + c["rh_min"]) / 2.0
    rh = rh_mid + rh_amp * math.cos(2 * math.pi * (hour - c["rh_peak_hour"]) / 24.0)

    if noise_rng is not None:
        temp += noise_rng.normal(0.0, 0.5)
        rh += noise_rng.normal(0.0, 1.5)
    return temp, max(0.0, min(100.0, rh))


def diurnal_profile(config: dict) -> List[Tuple[float, float]]:
    """Noise-free 24-hour (temp, rh) profile, one entry per hour 0..23."""
    return [climate_at(h, config) for h in range(24)]


class SyntheticSensor(SensorSource):
    def __init__(self, config: dict, clock: Optional[Callable[[], datetime]] = None, seed: int = 0):
        self.config = config
        self.clock = clock or datetime.now
        self.rng = np.random.default_rng(seed)

    def read(self) -> Reading:
        now = self.clock()
        hour = now.hour + now.minute / 60.0
        temp, rh = climate_at(hour, self.config, self.rng)
        return Reading(temp=temp, rh=rh, ts=now)
```

```python
# irrigation_timing/sensors/real.py
from __future__ import annotations

from typing import Optional

from .base import SensorSource
from ..types import Reading


class RealSensor(SensorSource):
    """Stub for a DHT22/SHT31 on Raspberry Pi GPIO — not wired yet.

    To implement on the Pi:
        pip install adafruit-circuitpython-dht
        import board, adafruit_dht
        dht = adafruit_dht.DHT22(board.D4)
        return Reading(temp=dht.temperature, rh=dht.humidity, ts=datetime.now())
    """

    def __init__(self, pin: Optional[int] = None):
        self.pin = pin

    def read(self) -> Reading:
        raise NotImplementedError(
            "RealSensor needs DHT22/SHT31 hardware + adafruit-circuitpython-dht. "
            "Wire the sensor and implement read() on the Raspberry Pi."
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_sensors.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add irrigation_timing/sensors tests/test_sensors.py
git commit -m "feat: add abstract sensor, synthetic climate, real-sensor stub"
```

---

## Task 9: SQLite store

**Files:**
- Create: `irrigation_timing/store.py`
- Test: `tests/test_store.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_store.py
from datetime import datetime
from irrigation_timing.store import Store
from irrigation_timing.types import Reading


def test_log_and_read_back_reading():
    store = Store(":memory:")
    store.log_reading(Reading(24.0, 88.0, datetime(2026, 6, 13, 7, 0)), stage="small_medium")
    store.log_reading(Reading(31.0, 65.0, datetime(2026, 6, 13, 14, 0)), stage="small_medium")
    profile = store.daily_profile()
    hours = {h for h, _, _ in profile}
    assert 7 in hours and 14 in hours
    store.close()


def test_log_decision_roundtrip():
    store = Store(":memory:")
    store.log_decision(datetime(2026, 6, 13, 9, 0), irrigate=True, growth_gain=0.12, reason="ok")
    rows = store.conn.execute("SELECT irrigate, reason FROM decisions").fetchall()
    assert rows == [(1, "ok")]
    store.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_store.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'irrigation_timing.store'`

- [ ] **Step 3: Write minimal implementation**

```python
# irrigation_timing/store.py
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import List, Optional, Tuple

from .types import Reading

_SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    temp REAL NOT NULL,
    rh REAL NOT NULL,
    stage TEXT
);
CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    irrigate INTEGER NOT NULL,
    growth_gain REAL,
    reason TEXT
);
"""


class Store:
    """Lightweight SQLite logger for readings and decisions (Pi-friendly)."""

    def __init__(self, path: str = ":memory:"):
        self.conn = sqlite3.connect(path)
        self.conn.executescript(_SCHEMA)

    def log_reading(self, reading: Reading, stage: Optional[str] = None) -> None:
        self.conn.execute(
            "INSERT INTO readings (ts, temp, rh, stage) VALUES (?, ?, ?, ?)",
            (reading.ts.isoformat(), reading.temp, reading.rh, stage),
        )
        self.conn.commit()

    def log_decision(self, ts: datetime, irrigate: bool, growth_gain: float, reason: str) -> None:
        self.conn.execute(
            "INSERT INTO decisions (ts, irrigate, growth_gain, reason) VALUES (?, ?, ?, ?)",
            (ts.isoformat(), int(irrigate), growth_gain, reason),
        )
        self.conn.commit()

    def daily_profile(self) -> List[Tuple[int, float, float]]:
        """Average (hour, temp, rh) across all logged readings, grouped by hour."""
        cur = self.conn.execute(
            "SELECT CAST(strftime('%H', ts) AS INTEGER) AS hour, AVG(temp), AVG(rh) "
            "FROM readings GROUP BY hour ORDER BY hour"
        )
        return [(int(h), float(t), float(r)) for h, t, r in cur.fetchall()]

    def close(self) -> None:
        self.conn.close()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_store.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add irrigation_timing/store.py tests/test_store.py
git commit -m "feat: add SQLite store for readings and decisions"
```

---

## Task 10: Decision layer (guardrails, decide_now, best_window)

**Files:**
- Create: `irrigation_timing/decision.py`
- Test: `tests/test_decision.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_decision.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_decision.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'irrigation_timing.decision'`

- [ ] **Step 3: Write minimal implementation**

```python
# irrigation_timing/decision.py
from __future__ import annotations

from typing import List, Optional, Tuple, Union

from .model.predict import predict_growth
from .types import Stage


def _guardrails(temp: float, rh: float, stage: Stage, config: dict) -> Tuple[bool, str]:
    """Return (blocked, reason). Guardrails override the model — spec §7."""
    g = config["guardrails"]
    if stage == Stage.MATURE:
        return True, "mature: never irrigate (overwatering causes spoilage)"
    if not config["stages"].get(stage.value, {}).get("irrigate", False):
        return True, f"stage {stage.value}: surface irrigation not required"
    if rh + config["watering_effect"]["delta_rh"] > g["rh_hard_max"]:
        return True, "watering would push RH above safe max (blotch risk)"
    return False, ""


def _surface_can_dry(hour: Optional[float], config: dict) -> Tuple[bool, str]:
    """Surface-drying guardrail: only water inside the daytime drying window so the
    cap film evaporates before the humid night. Does NOT lower ambient RH."""
    if hour is None:
        return True, ""
    lo, hi = config["drying_window"]
    if lo <= hour < hi:
        return True, ""
    return False, "outside daytime drying window; cap film won't dry before the humid night"


def decide_now(
    model,
    temp: float,
    rh: float,
    stage: Union[str, Stage],
    config: dict,
    hour: Optional[float] = None,
) -> dict:
    """Real-time irrigate/wait decision from predicted growth gain + guardrails."""
    stage = Stage.from_str(stage) if isinstance(stage, str) else stage

    blocked, reason = _guardrails(temp, rh, stage, config)
    if blocked:
        return {"irrigate": False, "growth_gain": 0.0, "reason": reason}

    eff = config["watering_effect"]
    before = predict_growth(model, temp, rh, stage)
    after = predict_growth(model, temp + eff["delta_temp"], rh + eff["delta_rh"], stage)
    gain = after - before

    if gain <= 0:
        return {"irrigate": False, "growth_gain": gain,
                "reason": "RH already near optimum; watering yields no growth gain"}

    dry_ok, dry_reason = _surface_can_dry(hour, config)
    if not dry_ok:
        return {"irrigate": False, "growth_gain": gain, "reason": dry_reason}

    return {"irrigate": True, "growth_gain": gain,
            "reason": "watering raises predicted growth and the cap will dry in time"}


def best_window(
    model,
    stage: Union[str, Stage],
    profile: List[Tuple[float, float, float]],
    config: dict,
) -> dict:
    """Scan a (hour, temp, rh) diurnal profile; return the contiguous run of
    irrigate-now hours with the greatest total predicted growth gain."""
    stage = Stage.from_str(stage) if isinstance(stage, str) else stage

    runs: List[List[Tuple[float, float]]] = []
    current: List[Tuple[float, float]] = []
    for hour, temp, rh in profile:
        d = decide_now(model, temp, rh, stage, config, hour=hour)
        if d["irrigate"]:
            current.append((hour, d["growth_gain"]))
        elif current:
            runs.append(current)
            current = []
    if current:
        runs.append(current)

    if not runs:
        return {"window": None, "hours": [], "total_gain": 0.0,
                "reason": "no suitable irrigation time for this stage"}

    best = max(runs, key=lambda run: sum(g for _, g in run))
    return {
        "window": (int(best[0][0]), int(best[-1][0]) + 1),
        "hours": [int(h) for h, _ in best],
        "total_gain": float(sum(g for _, g in best)),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_decision.py -v`
Expected: PASS (7 passed)

- [ ] **Step 5: Commit**

```bash
git add irrigation_timing/decision.py tests/test_decision.py
git commit -m "feat: add decision layer with safety + surface-drying guardrails"
```

---

## Task 11: CLI (train / report)

**Files:**
- Create: `irrigation_timing/cli.py`
- Test: `tests/test_cli.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_cli.py
import json
import irrigation_timing.cli as cli


def test_cli_train_then_report(tmp_path, monkeypatch, capsys):
    model_path = tmp_path / "m.pkl"
    # redirect the module-level MODEL_PATH used by both train and report
    monkeypatch.setattr(cli, "MODEL_PATH", model_path)

    cli.main(["train", "--n", "1500"])
    out = json.loads(capsys.readouterr().out)
    assert out["trained"] is True
    assert model_path.exists()

    cli.main(["report", "--stage", "small_medium"])
    report = json.loads(capsys.readouterr().out)
    assert "optimum" in report and "best_window" in report and "live" in report
    assert 20.0 <= report["optimum"]["temp"] <= 28.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_cli.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'irrigation_timing.cli'`

- [ ] **Step 3: Write minimal implementation**

```python
# irrigation_timing/cli.py
from __future__ import annotations

import argparse
import json
from typing import List, Optional

from .config import load_config
from .decision import best_window, decide_now
from .model.predict import load_model, optimum
from .model.train import MODEL_PATH, train
from .sensors.synthetic import SyntheticSensor, diurnal_profile
from .types import Stage


def main(argv: Optional[List[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="SpotShrooms irrigation-timing AI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_train = sub.add_parser("train", help="train the growth model on synthetic data")
    p_train.add_argument("--n", type=int, default=4000)

    p_report = sub.add_parser("report", help="print optimum, best window, and live decision")
    p_report.add_argument("--stage", default="small_medium")

    args = parser.parse_args(argv)
    config = load_config()

    if args.cmd == "train":
        _, metrics = train(n=args.n, model_path=MODEL_PATH, config=config)
        print(json.dumps({"trained": True, "metrics": metrics}))
        return

    if args.cmd == "report":
        model = load_model(MODEL_PATH)
        stage = Stage.from_str(args.stage)
        opt = optimum(model, stage)
        profile = [(h, t, r) for h, (t, r) in enumerate(diurnal_profile(config))]
        window = best_window(model, stage, profile, config)
        now = SyntheticSensor(config).read()
        live = decide_now(model, now.temp, now.rh, stage, config, hour=now.ts.hour)
        print(json.dumps(
            {"stage": stage.value, "optimum": opt, "best_window": window,
             "now": {"temp": round(now.temp, 1), "rh": round(now.rh, 1)}, "live": live},
            indent=2,
        ))


if __name__ == "__main__":
    main()
```

**Note on the test:** `cli.main` reads `MODEL_PATH` from its own module namespace at call time (it imports the name), so `monkeypatch.setattr(cli, "MODEL_PATH", ...)` redirects both subcommands to the temp path. Keep the `from .model.train import MODEL_PATH` import as shown.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_cli.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add irrigation_timing/cli.py tests/test_cli.py
git commit -m "feat: add train/report CLI entry point"
```

---

## Task 12: Feature README & full test run

**Files:**
- Create: `irrigation_timing/README.md`

- [ ] **Step 1: Write the feature README**

```markdown
# Humidity & Temperature Irrigation-Timing AI

Part of **SpotShrooms**. Learns the oyster-mushroom temperature/humidity growth
optimum from synthetic, literature-grounded data and recommends the **best time
of day to irrigate** — aware of the camera's growth stage. Designed to embed on a
Raspberry Pi; swap `SyntheticSensor` for `RealSensor` (DHT22/SHT31) when hardware
is wired.

See the design spec: `docs/superpowers/specs/2026-06-13-humidity-temp-irrigation-timing-design.md`.

## Install
    pip install -r requirements.txt

## Use
    # train the model on synthetic data (writes models/growth_rf.pkl)
    python -m irrigation_timing.cli train

    # print identified optimum, best irrigation window, and live decision
    python -m irrigation_timing.cli report --stage small_medium

## Stages (from the YOLO camera model)
- `none`         — colonization; no surface irrigation
- `small_medium` — pinning/fruiting; irrigation timing matters
- `mature`       — never irrigate (overwatering = spoilage)

## Safety guardrails (always override the model)
1. Never irrigate mature mushrooms.
2. Never let watering push RH above 95 % (blotch/mould).
3. Only irrigate inside the daytime drying window so the cap film dries before
   the humid night. Ambient RH is never lowered below the healthy band.

## Tests
    python -m pytest tests/

## Config
Agronomy ranges live in `config/oyster.yaml` (per-stage temp/RH optima, guardrails,
climate, watering effect). Edit to match the farm's oyster strain.
```

- [ ] **Step 2: Run the full test suite**

Run: `python -m pytest tests/ -v`
Expected: PASS (all tests across all modules green)

- [ ] **Step 3: Smoke-test the CLI end to end**

Run: `python -m irrigation_timing.cli train && python -m irrigation_timing.cli report --stage small_medium`
Expected: train prints `{"trained": true, ...}`; report prints JSON with `optimum.temp` in 20–28 °C, `optimum.rh` near 90, a daytime `best_window`, and a `live` decision.

- [ ] **Step 4: Commit**

```bash
git add irrigation_timing/README.md
git commit -m "docs: add irrigation-timing feature README"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §2 model finds optimum (not a rule) → Task 5 (response label), Task 7 (`optimum()` argmax). ✓
- §3 oyster tropical config, per-stage bands, penalties → Task 1 (`oyster.yaml`), Task 5. ✓
- §4 inputs/outputs/engine → Tasks 7 (regressor + optimum), 10 (decide_now + best_window). ✓
- §5 architecture (abstracted sensor, two synthetic sources) → Tasks 6, 8. ✓
- §6 component table → one task per module (Tasks 2–11). ✓
- §7 decision logic + 4 guardrails → Task 10 (`_guardrails`, `_surface_can_dry`, gain check). ✓
- §8 synthetic climate + response dataset → Tasks 6, 8. ✓
- §9 deps Pi-light → Task 1 `requirements.txt`. ✓
- §10 testing & evaluation → tests in every task; `optimum` band check in Task 7. ✓
- §11/§12 honest scope / YAGNI (no firmware, no UI, no learned-window) → reflected by `RealSensor` stub only and scope kept to module. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete, runnable code.

**Type consistency:** `Stage`, `Reading`, `build_features([temp, rh, stage_idx])`, `STAGES`/`STAGE_INDEX`, `growth_quality(temp, rh, stage, config)`, `make_dataset(n, config, seed)`, `train(n, seed, model_path, config)`, `predict_growth(model, temp, rh, stage)`, `optimum(model, stage, ...)`, `decide_now(model, temp, rh, stage, config, hour)`, `best_window(model, stage, profile, config)`, `Store(path)` — names/signatures consistent across all tasks. ✓
