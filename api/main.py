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
