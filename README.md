# OSIP Mushroom — SpotShrooms

**Eyes on every mushroom, anytime, anywhere.**

SpotShrooms is an AI-powered system that cuts the **20–30 % annual mushroom harvest loss from
overwatering** on Binh Duong (Vietnam) farms. A camera (YOLOv8) reads each shelf's growth stage and a
temperature/humidity sensor feeds a small irrigation-timing AI; together they decide **whether** and
**when** to water. Built by SP (Singapore Polytechnic) students with Eastern International University
(EIU), Vietnam. Aligned to **UN SDG 9 & 12**.

## Repository layout

| Path | What it is |
|---|---|
| `irrigation_timing/` | The irrigation-timing AI (RandomForest growth model + safety guardrails). Decides *when* to water. |
| `api/` | FastAPI bridge that exposes the irrigation AI + a swappable camera to the dashboard. |
| `frontend/` | The SpotShrooms dashboard (Vite + React) — Live Monitoring + Irrigation Timing. |
| `config/oyster.yaml` | Agronomy ranges (per-stage temp/RH optima, guardrails) — edit per strain. |
| `docs/superpowers/` | Design specs and implementation plans. |

> Branches `YOLO_Model_Code` (camera model) and `New_Feature/Humidity&Temp_Monitor` (sensor work)
> are developed separately.

## Dashboard (SpotShrooms app)

Two parts: a FastAPI bridge over the irrigation AI (`api/`) and a React dashboard (`frontend/`). The
**irrigation decisions are the real model**; the **camera is a swappable mock** (`MockCamera`) because
the YOLOv8 weights live on the `YOLO_Model_Code` branch and aren't committed here — the real
`YoloCamera` drop-in is documented in `api/camera/yolo_stub.py`.

### Backend
    pip install -r requirements.txt
    uvicorn api.main:app --reload --port 8000

The first request trains the growth model on synthetic data if no pickle exists (a few seconds).
Endpoints: `/api/health`, `/api/live`, `/api/config`, `/api/timing?stage=small_medium`.

### Frontend
    cd frontend
    npm install
    npm run dev          # http://localhost:5173 (proxies /api to :8000)

Open http://localhost:5173 with the backend running.

### Tests
    python -m pytest tests/        # irrigation module + API
    cd frontend && npm test        # dashboard components

## Screens

- **Live Monitoring** — per-shelf camera frames with YOLO water/don't-water detection boxes
  (green = water, red = don't-water) and growth stage, plus temperature & humidity gauges with the
  oyster safe-band shaded, and the detection model's reported metrics (Precision 0.973 / Recall 0.613
  / Accuracy 0.885).
- **Irrigation Timing** — a large IRRIGATE NOW / WAIT verdict with the reason, today's recommended
  watering window on a 24 h timeline, and the model-identified temperature/humidity optimum for the
  selected stage. Switching the stage selector to `mature` shows the never-irrigate guardrail.

## Team

Wui Soon Hiang Jordan (EEE) · Sean Ho Yan Xian (CLS) · Teo Xin Yin (SOC) · Pasu Chua (MAE) ·
Kayden Mok Zhen Xi (SOC)
