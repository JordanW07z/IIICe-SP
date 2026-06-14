from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from irrigation_timing.decision import best_window, decide_now
from irrigation_timing.model.predict import optimum
from irrigation_timing.sensors.synthetic import diurnal_profile
from irrigation_timing.types import Stage

from .state import state
from .yolo import detector

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


@app.get("/api/detect/status")
def detect_status() -> dict:
    """Whether the real YOLOv8 model is live (weights present + ultralytics installed)."""
    return {
        "available": detector.available(),
        "status": detector.status(),
        "weights_path": str(detector.weights_path),
    }


@app.post("/api/detect")
async def detect(file: UploadFile = File(...)) -> dict:
    """Run the real YOLOv8 model on an uploaded photo and return water/don't-water boxes."""
    if not detector.available():
        raise HTTPException(status_code=503, detail=detector.status())
    image_bytes = await file.read()
    try:
        dets = detector.detect(image_bytes)
    except Exception as exc:  # malformed image, inference failure, etc.
        raise HTTPException(status_code=500, detail=str(exc))
    return {"detections": dets, "count": len(dets)}
