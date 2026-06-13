# SpotShrooms Dashboard Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, demo-ready SpotShrooms dashboard (Live Monitoring + Irrigation Timing) wired to the real `irrigation_timing` AI via a thin FastAPI bridge, with a swappable mock camera standing in for the not-yet-committed YOLO weights.

**Architecture:** A FastAPI app in `api/` wraps the existing `irrigation_timing` functions (no logic reimplemented) and a `CameraSource` mock. A Vite + React SPA in `frontend/` polls the API and renders two screens. Both mocks (`SyntheticSensor`, `MockCamera`) sit behind the same interfaces their real counterparts will use, so swapping in real hardware/YOLO needs no frontend change.

**Tech Stack:** Python (FastAPI, uvicorn) + existing scikit-learn module; Node (Vite, React, Vitest, React Testing Library).

---

## File Structure

**Backend (new `api/` package, top-level alongside `irrigation_timing/`):**
- `api/__init__.py` — package marker
- `api/state.py` — lazy singletons: config, model (bootstraps via `train()` if pickle missing), sensor, camera
- `api/schemas.py` — typed response shapes (pydantic) for live/timing/config payloads
- `api/camera/__init__.py`
- `api/camera/base.py` — `CameraSource` interface + `Detection`/`ShelfFrame` dataclasses
- `api/camera/mock.py` — `MockCamera`: synthetic per-shelf stages + normalized detection boxes
- `api/camera/yolo_stub.py` — documented `YoloCamera` stub (raises NotImplementedError), the future drop-in
- `api/main.py` — FastAPI app, CORS, endpoints, model bootstrap on startup
- `tests/test_api.py` — endpoint + camera-contract tests (reuses existing pytest setup)

**Frontend (new `frontend/` Vite app):**
- `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`
- `frontend/src/main.jsx` — React entry
- `frontend/src/App.jsx` — shell, branding, stage selector, screen tabs
- `frontend/src/api.js` — fetch client for the 3 endpoints
- `frontend/src/usePolling.js` — interval polling hook with loading/error/offline state
- `frontend/src/screens/LiveMonitoring.jsx` — camera overlay + gauges + shelf strip + metrics badge
- `frontend/src/screens/IrrigationTiming.jsx` — verdict + window timeline + guardrail + optimum
- `frontend/src/components/Gauge.jsx` — temp/RH gauge with safe-band marks
- `frontend/src/components/CameraPanel.jsx` — CSS camera frame + normalized detection boxes
- `frontend/src/components/Timeline.jsx` — 24 h bar with the recommended window highlighted
- `frontend/src/styles.css` — SpotShrooms theme
- `frontend/src/screens/__tests__/IrrigationTiming.test.jsx`
- `frontend/src/components/__tests__/CameraPanel.test.jsx`
- `frontend/src/test/setup.js` — Vitest + jsdom setup

**Modified:**
- `requirements.txt` — add `fastapi`, `uvicorn[standard]`, `httpx` (test client)
- `README.md` (top-level) — add a "Dashboard" run section

---

## Payload contracts (locked here, referenced by all tasks)

`GET /api/health` →
```json
{"ok": true, "model_loaded": true}
```

`GET /api/config` → the full `oyster.yaml` dict (already JSON-able). UI reads
`stages[stage].temp_min/temp_max/rh_min/rh_max` for safe-band overlays.

`GET /api/live` →
```json
{
  "timestamp": "2026-06-13T09:30:00",
  "ambient": {"temp": 28.3, "rh": 88.1},
  "shelves": [
    {"id": 1, "stage": "small_medium", "temp": 28.1, "rh": 88.7,
     "detections": [
       {"box": [0.30, 0.35, 0.22, 0.28], "label": "dont_water",
        "stage": "small_medium", "confidence": 0.91}
     ]}
  ],
  "model_metrics": {"precision": 0.973, "recall": 0.613, "accuracy": 0.885}
}
```
`box` is `[x, y, w, h]` normalized to 0..1 (frontend scales to panel size).
`label` is the YOLO camera's call; mapping by stage matches the project deck p.14:
`none → water`, `small_medium → dont_water`, `mature → water`.

`GET /api/timing?stage=small_medium` → exactly the CLI `report` shape:
```json
{
  "stage": "small_medium",
  "optimum": {"temp": 23.0, "rh": 90.0, "growth": 0.97},
  "best_window": {"window": [8, 11], "hours": [8, 9, 10], "total_gain": 0.12},
  "now": {"temp": 28.3, "rh": 88.1},
  "live": {"irrigate": true, "growth_gain": 0.04, "reason": "..."}
}
```

> **Separation of concerns (deliberate):** the camera `label` (Live Monitoring) is what YOLO
> outputs; the irrigate/wait `live` decision (Irrigation Timing) is the real `irrigation_timing`
> module with its guardrails. They are surfaced independently and are *not* reconciled — that
> honestly reflects that the camera answers "what's on the shelf" and the timing AI answers "should
> we water now."

---

## Task 1: Backend deps + API state with model bootstrap + health endpoint

**Files:**
- Modify: `requirements.txt`
- Create: `api/__init__.py`, `api/state.py`, `api/main.py`
- Test: `tests/test_api.py`

- [ ] **Step 1: Add backend dependencies**

Append to `requirements.txt`:
```
fastapi==0.115.5
uvicorn[standard]==0.32.1
httpx==0.28.1
```

Run: `pip install -r requirements.txt`
Expected: installs without error.

- [ ] **Step 2: Create the package marker**

Create `api/__init__.py`:
```python
"""FastAPI bridge exposing the SpotShrooms irrigation AI + a mock camera to the dashboard."""
```

- [ ] **Step 3: Write `api/state.py` (lazy singletons + model bootstrap)**

Create `api/state.py`:
```python
from __future__ import annotations

from datetime import datetime
from typing import Optional

from irrigation_timing.config import load_config
from irrigation_timing.model.predict import load_model
from irrigation_timing.model.train import MODEL_PATH, train
from irrigation_timing.sensors.synthetic import SyntheticSensor


class AppState:
    """Holds the loaded config, model, sensor and camera. Bootstraps the model
    (trains on synthetic data) if no pickle exists, so the dashboard works from a
    clean checkout."""

    def __init__(self) -> None:
        self._config: Optional[dict] = None
        self._model = None
        self._sensor: Optional[SyntheticSensor] = None
        self._camera = None

    @property
    def config(self) -> dict:
        if self._config is None:
            self._config = load_config()
        return self._config

    @property
    def model(self):
        if self._model is None:
            if not MODEL_PATH.exists():
                train(config=self.config)  # writes MODEL_PATH
            self._model = load_model(MODEL_PATH)
        return self._model

    @property
    def sensor(self) -> SyntheticSensor:
        if self._sensor is None:
            self._sensor = SyntheticSensor(self.config)
        return self._sensor

    @property
    def model_loaded(self) -> bool:
        return self._model is not None or MODEL_PATH.exists()

    def now(self) -> datetime:
        return datetime.now()


state = AppState()
```

- [ ] **Step 4: Write the failing health-endpoint test**

Create `tests/test_api.py`:
```python
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_health_ok():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "model_loaded" in body
```

- [ ] **Step 5: Run it to verify it fails**

Run: `python -m pytest tests/test_api.py::test_health_ok -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.main'`.

- [ ] **Step 6: Write `api/main.py` with the health endpoint**

Create `api/main.py`:
```python
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .state import state

app = FastAPI(title="SpotShrooms Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev: Vite serves on a different port
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "model_loaded": state.model_loaded}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `python -m pytest tests/test_api.py::test_health_ok -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add requirements.txt api/__init__.py api/state.py api/main.py tests/test_api.py
git commit -m "feat(api): FastAPI app shell with health endpoint and model bootstrap"
```

---

## Task 2: Camera service (interface + mock + YOLO stub)

**Files:**
- Create: `api/camera/__init__.py`, `api/camera/base.py`, `api/camera/mock.py`, `api/camera/yolo_stub.py`
- Test: `tests/test_api.py` (append)

- [ ] **Step 1: Create the package marker**

Create `api/camera/__init__.py`:
```python
"""Camera abstraction: MockCamera now, YoloCamera (real YOLOv8) as a documented drop-in later."""
```

- [ ] **Step 2: Write `api/camera/base.py` (interface + data shapes)**

Create `api/camera/base.py`:
```python
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Tuple


@dataclass(frozen=True)
class Detection:
    box: Tuple[float, float, float, float]  # x, y, w, h normalized 0..1
    label: str                              # "water" | "dont_water"
    stage: str                              # "none" | "small_medium" | "mature"
    confidence: float


@dataclass(frozen=True)
class ShelfFrame:
    id: int
    stage: str
    detections: List[Detection]


class CameraSource(ABC):
    """One frame per shelf with YOLO-shaped detections. Real YoloCamera and MockCamera
    both implement this, so the API and frontend never change when YOLO is wired in."""

    @abstractmethod
    def frames(self) -> List[ShelfFrame]:
        ...
```

- [ ] **Step 3: Write the failing MockCamera contract test**

Append to `tests/test_api.py`:
```python
from api.camera.mock import MockCamera
from api.camera.base import CameraSource, ShelfFrame

_LABEL_BY_STAGE = {"none": "water", "small_medium": "dont_water", "mature": "water"}


def test_mock_camera_contract():
    cam = MockCamera(n_shelves=3, seed=1)
    assert isinstance(cam, CameraSource)
    frames = cam.frames()
    assert len(frames) == 3
    for f in frames:
        assert isinstance(f, ShelfFrame)
        assert f.stage in _LABEL_BY_STAGE
        for d in f.detections:
            assert d.label == _LABEL_BY_STAGE[f.stage]   # matches deck p.14 mapping
            assert len(d.box) == 4
            assert all(0.0 <= v <= 1.0 for v in d.box)
            assert 0.0 <= d.confidence <= 1.0


def test_mock_camera_is_deterministic_with_seed():
    a = MockCamera(n_shelves=4, seed=7).frames()
    b = MockCamera(n_shelves=4, seed=7).frames()
    assert [f.stage for f in a] == [f.stage for f in b]
```

- [ ] **Step 4: Run it to verify it fails**

Run: `python -m pytest tests/test_api.py::test_mock_camera_contract -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.camera.mock'`.

- [ ] **Step 5: Write `api/camera/mock.py`**

Create `api/camera/mock.py`:
```python
from __future__ import annotations

from typing import List

import numpy as np

from .base import CameraSource, Detection, ShelfFrame

_STAGES = ["none", "small_medium", "mature"]
_LABEL_BY_STAGE = {"none": "water", "small_medium": "dont_water", "mature": "water"}


class MockCamera(CameraSource):
    """Synthetic stand-in for the YOLOv8 camera. Each shelf gets a stage and 1-3
    normalized detection boxes labelled per the project deck (p.14) mapping."""

    def __init__(self, n_shelves: int = 3, seed: int = 0) -> None:
        self.n_shelves = n_shelves
        self.rng = np.random.default_rng(seed)

    def frames(self) -> List[ShelfFrame]:
        frames: List[ShelfFrame] = []
        for shelf_id in range(1, self.n_shelves + 1):
            stage = _STAGES[self.rng.integers(0, len(_STAGES))]
            label = _LABEL_BY_STAGE[stage]
            n_det = 0 if stage == "none" else int(self.rng.integers(1, 4))
            detections: List[Detection] = []
            for _ in range(n_det):
                x = float(self.rng.uniform(0.05, 0.7))
                y = float(self.rng.uniform(0.05, 0.6))
                w = float(self.rng.uniform(0.12, min(0.3, 1.0 - x)))
                h = float(self.rng.uniform(0.12, min(0.35, 1.0 - y)))
                conf = float(round(self.rng.uniform(0.6, 0.98), 2))
                detections.append(Detection((x, y, w, h), label, stage, conf))
            frames.append(ShelfFrame(shelf_id, stage, detections))
        return frames
```

- [ ] **Step 6: Write `api/camera/yolo_stub.py` (documented future drop-in)**

Create `api/camera/yolo_stub.py`:
```python
from __future__ import annotations

from typing import List

from .base import CameraSource, ShelfFrame


class YoloCamera(CameraSource):
    """Real-hardware drop-in. Load weights from the YOLO_Model_Code branch
    (`runs/detect/train30/weights/best.pt`) and translate YOLO boxes into ShelfFrame.
    Not wired here because the weights are not committed to this repo.

    Sketch:
        from ultralytics import YOLO
        self.model = YOLO(weights_path)
        results = self.model.predict(source=frame_image)
        # map results.boxes.xywhn + names[int(cls)] -> Detection(box, label, stage, conf)
    """

    def __init__(self, weights_path: str) -> None:  # pragma: no cover - documented stub
        self.weights_path = weights_path

    def frames(self) -> List[ShelfFrame]:  # pragma: no cover - documented stub
        raise NotImplementedError(
            "YoloCamera requires committed YOLOv8 weights (see YOLO_Model_Code branch)."
        )
```

- [ ] **Step 7: Wire the camera singleton into state**

In `api/state.py`, add the import at top:
```python
from api.camera.mock import MockCamera
```
and add this property to `AppState` (after `sensor`):
```python
    @property
    def camera(self):
        if self._camera is None:
            self._camera = MockCamera(n_shelves=3)
        return self._camera
```

- [ ] **Step 8: Run the camera tests to verify they pass**

Run: `python -m pytest tests/test_api.py -k mock_camera -v`
Expected: PASS (both tests).

- [ ] **Step 9: Commit**

```bash
git add api/camera/ api/state.py tests/test_api.py
git commit -m "feat(api): swappable camera service with deterministic MockCamera"
```

---

## Task 3: `/api/live` endpoint

**Files:**
- Modify: `api/main.py`
- Test: `tests/test_api.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_api.py`:
```python
def test_live_payload_shape():
    r = client.get("/api/live")
    assert r.status_code == 200
    body = r.json()
    assert set(body) >= {"timestamp", "ambient", "shelves", "model_metrics"}
    assert body["model_metrics"] == {"precision": 0.973, "recall": 0.613, "accuracy": 0.885}
    assert body["ambient"]["temp"] >= 0 and 0 <= body["ambient"]["rh"] <= 100
    assert len(body["shelves"]) == 3
    shelf = body["shelves"][0]
    assert set(shelf) >= {"id", "stage", "temp", "rh", "detections"}
    for d in shelf["detections"]:
        assert set(d) >= {"box", "label", "stage", "confidence"}
        assert len(d["box"]) == 4
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python -m pytest tests/test_api.py::test_live_payload_shape -v`
Expected: FAIL — 404 Not Found (`/api/live` undefined).

- [ ] **Step 3: Implement `/api/live`**

Add to `api/main.py` (after `health`):
```python
MODEL_METRICS = {"precision": 0.973, "recall": 0.613, "accuracy": 0.885}


@app.get("/api/live")
def live() -> dict:
    reading = state.sensor.read()
    frames = state.camera.frames()
    rng = state.sensor.rng
    shelves = []
    for f in frames:
        # small per-shelf jitter around the ambient hut reading
        shelves.append({
            "id": f.id,
            "stage": f.stage,
            "temp": round(reading.temp + float(rng.normal(0, 0.3)), 1),
            "rh": round(reading.rh + float(rng.normal(0, 0.8)), 1),
            "detections": [
                {"box": list(d.box), "label": d.label,
                 "stage": d.stage, "confidence": d.confidence}
                for d in f.detections
            ],
        })
    return {
        "timestamp": reading.ts.isoformat(timespec="seconds"),
        "ambient": {"temp": round(reading.temp, 1), "rh": round(reading.rh, 1)},
        "shelves": shelves,
        "model_metrics": MODEL_METRICS,
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_api.py::test_live_payload_shape -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/main.py tests/test_api.py
git commit -m "feat(api): /api/live with ambient reading + mock camera detections"
```

---

## Task 4: `/api/config` and `/api/timing` endpoints

**Files:**
- Modify: `api/main.py`
- Test: `tests/test_api.py` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_api.py`:
```python
def test_config_returns_bands():
    r = client.get("/api/config")
    assert r.status_code == 200
    cfg = r.json()
    sm = cfg["stages"]["small_medium"]
    assert sm["rh_min"] == 85.0 and sm["rh_max"] == 95.0


def test_timing_matches_module_shape():
    r = client.get("/api/timing", params={"stage": "small_medium"})
    assert r.status_code == 200
    body = r.json()
    assert body["stage"] == "small_medium"
    assert set(body) >= {"stage", "optimum", "best_window", "now", "live"}
    assert set(body["optimum"]) >= {"temp", "rh", "growth"}
    assert set(body["live"]) >= {"irrigate", "growth_gain", "reason"}
    assert set(body["best_window"]) >= {"window", "hours", "total_gain"}


def test_timing_mature_never_irrigates():
    r = client.get("/api/timing", params={"stage": "mature"})
    body = r.json()
    assert body["live"]["irrigate"] is False
    assert "mature" in body["live"]["reason"].lower()


def test_timing_rejects_unknown_stage():
    r = client.get("/api/timing", params={"stage": "banana"})
    assert r.status_code == 400
```

- [ ] **Step 2: Run them to verify they fail**

Run: `python -m pytest tests/test_api.py -k "config_returns or timing" -v`
Expected: FAIL — 404 for the new routes.

- [ ] **Step 3: Implement both endpoints**

Add to `api/main.py` (imports at top first):
```python
from fastapi import HTTPException

from irrigation_timing.decision import best_window, decide_now
from irrigation_timing.model.predict import optimum
from irrigation_timing.sensors.synthetic import diurnal_profile
from irrigation_timing.types import Stage
```
then the routes:
```python
@app.get("/api/config")
def config() -> dict:
    return state.config


@app.get("/api/timing")
def timing(stage: str = "small_medium") -> dict:
    try:
        st = Stage.from_str(stage)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"unknown stage: {stage}")

    model = state.model
    cfg = state.config
    profile = [(h, t, r) for h, (t, r) in enumerate(diurnal_profile(cfg))]
    reading = state.sensor.read()
    return {
        "stage": st.value,
        "optimum": optimum(model, st),
        "best_window": best_window(model, st, profile, cfg),
        "now": {"temp": round(reading.temp, 1), "rh": round(reading.rh, 1)},
        "live": decide_now(model, reading.temp, reading.rh, st, cfg, hour=reading.ts.hour),
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_api.py -v`
Expected: PASS (all API tests, including Tasks 1–3).

- [ ] **Step 5: Commit**

```bash
git add api/main.py tests/test_api.py
git commit -m "feat(api): /api/config and /api/timing wired to the real irrigation model"
```

---

## Task 5: Frontend scaffold + API client + polling hook

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`,
  `frontend/src/main.jsx`, `frontend/src/api.js`, `frontend/src/usePolling.js`,
  `frontend/src/styles.css`, `frontend/src/test/setup.js`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "spotshrooms-dashboard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@vitejs/plugin-react": "^4.3.3",
    "jsdom": "^25.0.1",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Create `frontend/vite.config.js`**

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },  // dev: proxy to FastAPI
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
  },
});
```

- [ ] **Step 3: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SpotShrooms — Eyes on every mushroom</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `frontend/src/test/setup.js`**

```javascript
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Create `frontend/src/api.js`**

```javascript
async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const getLive = () => getJSON("/api/live");
export const getConfig = () => getJSON("/api/config");
export const getTiming = (stage) => getJSON(`/api/timing?stage=${encodeURIComponent(stage)}`);
```

- [ ] **Step 6: Create `frontend/src/usePolling.js`**

```javascript
import { useEffect, useRef, useState } from "react";

// Polls `fetcher` every `intervalMs`. Exposes {data, error, loading}.
// On error it keeps the last good data and flags `error` so the UI can show "offline".
export function usePolling(fetcher, intervalMs, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const savedFetcher = useRef(fetcher);
  savedFetcher.current = fetcher;

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const next = await savedFetcher.current();
        if (alive) { setData(next); setError(null); }
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading };
}
```

- [ ] **Step 7: Create `frontend/src/styles.css` (SpotShrooms theme)**

```css
:root {
  --bg: #0f1410;
  --panel: #18201a;
  --panel-2: #1f2a22;
  --ink: #e8f1e8;
  --muted: #9fb3a3;
  --accent: #4caf50;
  --water: #2e7d32;
  --dont: #c62828;
  --warn: #ef6c00;
  --line: #2c3a30;
  --radius: 14px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); }
.app { max-width: 1100px; margin: 0 auto; padding: 20px; }
.brand { display: flex; align-items: baseline; gap: 12px; }
.brand h1 { font-size: 22px; margin: 0; letter-spacing: 0.5px; }
.brand .tag { color: var(--muted); font-size: 13px; }
.tabs { display: flex; gap: 8px; margin: 16px 0; }
.tab { background: var(--panel); border: 1px solid var(--line); color: var(--ink);
  padding: 8px 14px; border-radius: 999px; cursor: pointer; }
.tab.active { background: var(--panel-2); border-color: var(--accent); }
.row { display: flex; gap: 16px; flex-wrap: wrap; }
.card { background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 16px; flex: 1; min-width: 260px; }
.card h3 { margin: 0 0 12px; font-size: 13px; color: var(--muted);
  text-transform: uppercase; letter-spacing: 1px; }
.offline { color: var(--warn); font-size: 13px; }
/* (all colour values are valid 6-digit hex, e.g. --accent: #4caf50) */
select { background: var(--panel-2); color: var(--ink); border: 1px solid var(--line);
  border-radius: 8px; padding: 6px 10px; }
.badge { display: inline-block; background: var(--panel-2); border: 1px solid var(--line);
  border-radius: 8px; padding: 4px 8px; font-size: 12px; color: var(--muted); }
```
(Note: remove the stray space in `#4 caf50` → `#4caf50` and `2e7d32` etc. are valid.)

- [ ] **Step 8: Create `frontend/src/main.jsx`**

```javascript
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: Install deps**

Run: `cd frontend && npm install`
Expected: `node_modules` created, no fatal errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/vite.config.js frontend/index.html frontend/src/main.jsx frontend/src/api.js frontend/src/usePolling.js frontend/src/styles.css frontend/src/test/setup.js
git commit -m "chore(frontend): Vite + React scaffold, API client, polling hook"
```

---

## Task 6: App shell — branding, stage selector, screen tabs

**Files:**
- Create: `frontend/src/App.jsx`

- [ ] **Step 1: Create `frontend/src/App.jsx`**

```javascript
import { useState } from "react";
import LiveMonitoring from "./screens/LiveMonitoring.jsx";
import IrrigationTiming from "./screens/IrrigationTiming.jsx";

const STAGES = ["none", "small_medium", "mature"];

export default function App() {
  const [tab, setTab] = useState("live");
  const [stage, setStage] = useState("small_medium");

  return (
    <div className="app">
      <header className="brand">
        <h1>🍄 SpotShrooms</h1>
        <span className="tag">Eyes on every mushroom, anytime, anywhere</span>
      </header>

      <div className="row" style={{ alignItems: "center", marginTop: 12 }}>
        <div className="tabs">
          <button className={`tab ${tab === "live" ? "active" : ""}`}
            onClick={() => setTab("live")}>Live Monitoring</button>
          <button className={`tab ${tab === "timing" ? "active" : ""}`}
            onClick={() => setTab("timing")}>Irrigation Timing</button>
        </div>
        <label style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>
          Stage&nbsp;
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {tab === "live"
        ? <LiveMonitoring stage={stage} />
        : <IrrigationTiming stage={stage} />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): app shell with branding, stage selector, screen tabs"
```

---

## Task 7: Live Monitoring screen (camera overlay + gauges + shelves + metrics)

**Files:**
- Create: `frontend/src/components/Gauge.jsx`, `frontend/src/components/CameraPanel.jsx`,
  `frontend/src/screens/LiveMonitoring.jsx`
- Test: `frontend/src/components/__tests__/CameraPanel.test.jsx`

- [ ] **Step 1: Create `frontend/src/components/Gauge.jsx`**

```javascript
// A simple horizontal gauge with the safe band shaded and the current value marked.
export default function Gauge({ label, value, unit, min, max, bandLow, bandHigh }) {
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const pct = (v) => ((clamp(v) - min) / (max - min)) * 100;
  const inBand = bandLow != null && value >= bandLow && value <= bandHigh;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--muted)" }}>{label}</span>
        <span style={{ color: inBand ? "var(--accent)" : "var(--warn)" }}>
          {value?.toFixed(1)}{unit}
        </span>
      </div>
      <div style={{ position: "relative", height: 10, background: "var(--panel-2)",
        borderRadius: 6, marginTop: 6, overflow: "hidden" }}>
        {bandLow != null && (
          <div style={{ position: "absolute", left: `${pct(bandLow)}%`,
            width: `${pct(bandHigh) - pct(bandLow)}%`, top: 0, bottom: 0,
            background: "rgba(76,175,80,0.25)" }} />
        )}
        <div style={{ position: "absolute", left: `${pct(value)}%`, top: -2, bottom: -2,
          width: 3, background: inBand ? "var(--accent)" : "var(--warn)" }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing CameraPanel test**

Create `frontend/src/components/__tests__/CameraPanel.test.jsx`:
```javascript
import { render, screen } from "@testing-library/react";
import CameraPanel from "../CameraPanel.jsx";

const shelf = {
  id: 1, stage: "small_medium",
  detections: [
    { box: [0.2, 0.2, 0.2, 0.2], label: "dont_water", stage: "small_medium", confidence: 0.9 },
    { box: [0.6, 0.5, 0.2, 0.2], label: "water", stage: "none", confidence: 0.8 },
  ],
};

test("renders one box per detection with label-coded class", () => {
  render(<CameraPanel shelf={shelf} />);
  const boxes = screen.getAllByTestId("det-box");
  expect(boxes).toHaveLength(2);
  expect(boxes[0].className).toContain("box-dont_water");
  expect(boxes[1].className).toContain("box-water");
});

test("shows the stage label", () => {
  render(<CameraPanel shelf={shelf} />);
  expect(screen.getByText(/small_medium/)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/components/__tests__/CameraPanel.test.jsx`
Expected: FAIL — cannot resolve `../CameraPanel.jsx`.

- [ ] **Step 4: Create `frontend/src/components/CameraPanel.jsx`**

```javascript
// CSS-rendered "camera frame" with normalized detection boxes overlaid.
// No external image needed (and no YOLO weights in this repo) — green = water, red = don't-water.
const COLORS = { water: "var(--water)", dont_water: "var(--dont)" };

export default function CameraPanel({ shelf }) {
  return (
    <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 10,
      overflow: "hidden", border: "1px solid var(--line)",
      background: "repeating-linear-gradient(135deg, #11160f, #11160f 12px, #141b12 12px, #141b12 24px)" }}>
      <div className="badge" style={{ position: "absolute", top: 8, left: 8, zIndex: 2 }}>
        Shelf {shelf.id} · {shelf.stage}
      </div>
      {shelf.detections.map((d, i) => {
        const [x, y, w, h] = d.box;
        return (
          <div key={i} data-testid="det-box" className={`box-${d.label}`}
            style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`,
              width: `${w * 100}%`, height: `${h * 100}%`,
              border: `2px solid ${COLORS[d.label] || "#fff"}`, borderRadius: 4 }}>
            <span style={{ position: "absolute", top: -18, left: 0, fontSize: 11,
              background: COLORS[d.label], padding: "1px 4px", borderRadius: 3,
              whiteSpace: "nowrap" }}>
              {d.label} {d.confidence.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/components/__tests__/CameraPanel.test.jsx`
Expected: PASS (both tests).

- [ ] **Step 6: Create `frontend/src/screens/LiveMonitoring.jsx`**

```javascript
import { getLive, getConfig } from "../api.js";
import { usePolling } from "../usePolling.js";
import { useEffect, useState } from "react";
import CameraPanel from "../components/CameraPanel.jsx";
import Gauge from "../components/Gauge.jsx";

export default function LiveMonitoring({ stage }) {
  const { data, error } = usePolling(getLive, 3000, []);
  const [cfg, setCfg] = useState(null);
  useEffect(() => { getConfig().then(setCfg).catch(() => {}); }, []);

  if (!data) return <p style={{ color: "var(--muted)" }}>Connecting to sensors…</p>;
  const band = cfg?.stages?.[stage] || {};
  const m = data.model_metrics;

  return (
    <div>
      {error && <p className="offline">⚠ Sensor/camera offline — showing last reading.</p>}
      <div className="row">
        <div className="card" style={{ flex: 2 }}>
          <h3>Camera — YOLO detection</h3>
          <div className="row">
            {data.shelves.map((s) => (
              <div key={s.id} style={{ flex: 1, minWidth: 220 }}>
                <CameraPanel shelf={s} />
                <div className="badge" style={{ marginTop: 6 }}>
                  {s.temp}°C · {s.rh}% RH
                </div>
              </div>
            ))}
          </div>
          <p className="badge" style={{ marginTop: 12 }}>
            Model — Precision {m.precision} · Recall {m.recall} · Accuracy {m.accuracy}
          </p>
        </div>
        <div className="card">
          <h3>Ambient climate</h3>
          <Gauge label="Temperature" value={data.ambient.temp} unit="°C"
            min={15} max={40} bandLow={band.temp_min} bandHigh={band.temp_max} />
          <Gauge label="Humidity" value={data.ambient.rh} unit="%"
            min={50} max={100} bandLow={band.rh_min} bandHigh={band.rh_max} />
          <p className="badge">Updated {data.timestamp}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Gauge.jsx frontend/src/components/CameraPanel.jsx frontend/src/components/__tests__/CameraPanel.test.jsx frontend/src/screens/LiveMonitoring.jsx
git commit -m "feat(frontend): Live Monitoring — camera overlay, gauges, model metrics"
```

---

## Task 8: Irrigation Timing screen (verdict + window timeline + guardrail + optimum)

**Files:**
- Create: `frontend/src/components/Timeline.jsx`, `frontend/src/screens/IrrigationTiming.jsx`
- Test: `frontend/src/screens/__tests__/IrrigationTiming.test.jsx`

- [ ] **Step 1: Create `frontend/src/components/Timeline.jsx`**

```javascript
// 24-hour strip; the recommended [start,end) window is highlighted.
export default function Timeline({ window }) {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const [start, end] = window || [null, null];
  const inWindow = (h) => start != null && h >= start && h < end;
  return (
    <div>
      <div style={{ display: "flex", gap: 2 }}>
        {hours.map((h) => (
          <div key={h} title={`${h}:00`} style={{ flex: 1, height: 26, borderRadius: 3,
            background: inWindow(h) ? "var(--accent)" : "var(--panel-2)" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between",
        color: "var(--muted)", fontSize: 11, marginTop: 4 }}>
        <span>00:00</span><span>12:00</span><span>23:00</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing IrrigationTiming test**

Create `frontend/src/screens/__tests__/IrrigationTiming.test.jsx`:
```javascript
import { render, screen, waitFor } from "@testing-library/react";
import { vi, beforeEach, test, expect } from "vitest";
import IrrigationTiming from "../IrrigationTiming.jsx";
import * as api from "../../api.js";

beforeEach(() => {
  vi.spyOn(api, "getTiming").mockResolvedValue({
    stage: "mature",
    optimum: { temp: 23, rh: 90, growth: 0.97 },
    best_window: { window: null, hours: [], total_gain: 0 },
    now: { temp: 28, rh: 88 },
    live: { irrigate: false, growth_gain: 0,
            reason: "mature: never irrigate (overwatering causes spoilage)" },
  });
});

test("shows WAIT verdict and the guardrail reason", async () => {
  render(<IrrigationTiming stage="mature" />);
  await waitFor(() => expect(screen.getByText(/WAIT/)).toBeInTheDocument());
  expect(screen.getByText(/never irrigate/i)).toBeInTheDocument();
});

test("renders the identified optimum", async () => {
  render(<IrrigationTiming stage="mature" />);
  await waitFor(() => expect(screen.getByText(/23/)).toBeInTheDocument());
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/screens/__tests__/IrrigationTiming.test.jsx`
Expected: FAIL — cannot resolve `../IrrigationTiming.jsx`.

- [ ] **Step 4: Create `frontend/src/screens/IrrigationTiming.jsx`**

```javascript
import { useCallback } from "react";
import { getTiming } from "../api.js";
import { usePolling } from "../usePolling.js";
import Timeline from "../components/Timeline.jsx";

function fmtWindow(w) {
  if (!w || !w.window) return "No suitable window today";
  const [a, b] = w.window;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(a)}:00 – ${pad(b)}:00`;
}

export default function IrrigationTiming({ stage }) {
  const fetcher = useCallback(() => getTiming(stage), [stage]);
  const { data, error } = usePolling(fetcher, 4000, [stage]);

  if (!data) return <p style={{ color: "var(--muted)" }}>Asking the irrigation AI…</p>;
  const { live, best_window, optimum, now } = data;
  const go = live.irrigate;

  return (
    <div>
      {error && <p className="offline">⚠ API offline — showing last decision.</p>}
      <div className="row">
        <div className="card" style={{ flex: 1.2 }}>
          <h3>Decision now</h3>
          <div style={{ fontSize: 40, fontWeight: 700,
            color: go ? "var(--accent)" : "var(--warn)" }}>
            {go ? "IRRIGATE NOW" : "WAIT"}
          </div>
          <p style={{ color: "var(--muted)" }}>{live.reason}</p>
          <p className="badge">Now: {now.temp}°C · {now.rh}% RH ·
            growth gain {live.growth_gain.toFixed(3)}</p>
        </div>
        <div className="card">
          <h3>Identified optimum ({stage})</h3>
          <div style={{ fontSize: 22 }}>{optimum.temp}°C · {optimum.rh}% RH</div>
          <p className="badge">predicted growth {optimum.growth.toFixed(2)}</p>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Recommended watering window</h3>
        <div style={{ fontSize: 20, marginBottom: 10 }}>{fmtWindow(best_window)}</div>
        <Timeline window={best_window?.window} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/screens/__tests__/IrrigationTiming.test.jsx`
Expected: PASS (both tests).

- [ ] **Step 6: Run the whole frontend suite**

Run: `cd frontend && npm test`
Expected: PASS (CameraPanel + IrrigationTiming tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Timeline.jsx frontend/src/screens/IrrigationTiming.jsx frontend/src/screens/__tests__/IrrigationTiming.test.jsx
git commit -m "feat(frontend): Irrigation Timing — verdict, window timeline, optimum"
```

---

## Task 9: Run scripts, docs, and end-to-end manual verification

**Files:**
- Modify: `README.md` (top-level)
- Create: `run_dashboard.md` (short run notes) — optional consolidation into README

- [ ] **Step 1: Add a Dashboard section to the top-level `README.md`**

Replace the GitLab boilerplate `README.md` content with a real project README; minimally append:
```markdown
## Dashboard (SpotShrooms app)

Two parts: a FastAPI bridge over the irrigation AI (`api/`) and a React dashboard (`frontend/`).

### Backend
    pip install -r requirements.txt
    uvicorn api.main:app --reload --port 8000
First run trains the growth model on synthetic data if no pickle exists.

### Frontend
    cd frontend
    npm install
    npm run dev          # http://localhost:5173 (proxies /api to :8000)

### Tests
    python -m pytest tests/        # API + irrigation module
    cd frontend && npm test        # dashboard components

Screens: **Live Monitoring** (camera YOLO detections + temp/humidity gauges) and
**Irrigation Timing** (irrigate/wait verdict, recommended window, guardrails, optimum).
The camera is a swappable `MockCamera` (real `YoloCamera` drop-in documented in
`api/camera/yolo_stub.py`); the irrigation decisions are the real model.
```

- [ ] **Step 2: Start the backend and smoke-test every endpoint**

Run (in one terminal):
```bash
uvicorn api.main:app --port 8000
```
Then (in another):
```bash
curl -s http://localhost:8000/api/health
curl -s http://localhost:8000/api/live
curl -s "http://localhost:8000/api/timing?stage=small_medium"
curl -s "http://localhost:8000/api/timing?stage=mature"
```
Expected: health `ok:true`; live has 3 shelves; timing small_medium returns optimum/window/live;
timing mature has `"irrigate": false` with a "mature" reason.

- [ ] **Step 3: Start the frontend and verify both screens in a browser**

Run: `cd frontend && npm run dev`, open `http://localhost:5173`.
Verify:
- Live Monitoring: three camera panels with coloured detection boxes (green=water, red=don't),
  per-shelf temp/RH, ambient gauges with shaded safe band, the metrics badge (0.973/0.613/0.885).
- Irrigation Timing: large IRRIGATE NOW / WAIT verdict, reason text, recommended window on the
  24 h timeline, identified optimum. Switching the Stage selector to `mature` flips it to WAIT
  with the never-irrigate reason.

- [ ] **Step 4: Run the full test suite**

Run: `python -m pytest tests/ -q && cd frontend && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add SpotShrooms dashboard run instructions"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** §5 endpoints → Tasks 1,3,4; §3 swappable camera → Task 2 (`yolo_stub.py`);
  §6 Screen 1 → Task 7, Screen 2 → Task 8; §6 stage selector/branding/polling/offline → Tasks 5,6;
  §8 testing (API contract, mock-camera contract, bootstrap, verdict/guardrail render, box colour)
  → Tasks 1–4,7,8; §5 model bootstrap → Task 1; §2 out-of-scope screens omitted.
- **Type consistency:** `Detection(box,label,stage,confidence)` / `ShelfFrame(id,stage,detections)`
  defined in Task 2 and consumed identically in Tasks 3,7,8; `usePolling` signature consistent
  across screens; `best_window.window` is `[start,end)` per the module and used that way in Timeline.
- **Placeholders:** none — every code step is complete and uses valid values.
