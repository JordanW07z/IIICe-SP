from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from irrigation_timing.decision import best_window, decide_now
from irrigation_timing.model.predict import optimum
from irrigation_timing.sensors.synthetic import diurnal_profile
from irrigation_timing.types import Stage

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
