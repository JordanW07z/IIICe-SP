# Design — SpotShrooms Dashboard Frontend

**Project:** SpotShrooms / OSIP Mushroom (SP × EIU Vietnam)
**Date:** 2026-06-13
**Author:** Sean Ho (with Claude, via brainstorming)
**Status:** Approved (design), pending implementation plan

---

## 1. Purpose

SpotShrooms automates mushroom watering to cut the **20–30 % annual harvest loss from
overwatering** on Binh Duong (Vietnam) farms. The project deck lists four features —
**① AI camera detection** (YOLOv8, water / don't-water), **② temperature + humidity sensors**,
**③ IoT**, **④ App Dashboard** — and an "App Design" slide. Feature ④ is currently unbuilt.
The `irrigation_timing` design spec also notes the dashboard "consumes the JSON this feature
emits." **This spec builds that dashboard.**

The frontend is **both** a polished, demo-ready showcase for the forum/pitch **and** an
operational tool **wired to the real `irrigation_timing` AI** (not a reimplementation). It
targets the deck's "beginner-friendly, simple interface" value and the **UN SDG 9 & 12** framing.

## 2. Scope

**In scope — two screens** (the two chosen as most central to the cause):

1. **Live Monitoring** — camera feed with YOLO water/don't-water detection boxes + growth stage,
   live temperature & humidity gauges with the oyster safe-band marked, per-shelf status.
2. **Irrigation Timing** — real-time IRRIGATE NOW / WAIT verdict + reason, today's recommended
   watering window on a 24 h timeline, the active safety guardrail when blocked, and the
   model-identified optimum (T\*, RH\*) for the current stage.

**Out of scope (YAGNI):** Climate-trends screen, Impact/SDG screen, real GPIO/camera firmware,
authentication, multi-user accounts, persistence beyond what the module already provides.

## 3. Key constraint — the YOLO weights are not in this repo

The YOLOv8 detection model lives on the `YOLO_Model_Code` branch and was trained on a local
machine (paths under `C:\Users\xy07c\...`); its weights are **not committed here**. Therefore the
camera/detection side is a **swappable mock**, designed to drop in the real YOLO later — exactly
mirroring how `irrigation_timing` swaps `SyntheticSensor` → `RealSensor`. The mock returns the
**same payload shape** the real YOLO would (boxes, label, stage, confidence), so the swap is a
drop-in with no frontend change.

The **irrigation decision side is the real AI** — the API calls the actual `irrigation_timing`
model functions; nothing is reimplemented in JavaScript.

## 4. Architecture

```
React + Vite SPA  ──HTTP/JSON──►  FastAPI bridge (api/)  ──►  irrigation_timing module (REAL)
  (polished UI)                                              optimum / decide_now / best_window
       │                                  └──►  camera service (MOCK, swappable → YOLO later)
       │                                          sample shelf images + simulated detections
       └─ 2 screens: Live Monitoring · Irrigation Timing
```

Two new top-level units alongside the existing module, each with one purpose and a defined
interface:

- `api/` — FastAPI app; thin HTTP layer over `irrigation_timing` + the camera service. No business
  logic of its own.
- `frontend/` — Vite + React single-page app; presentation only, talks to `api/` over JSON.
- `api/camera/` — `CameraSource` interface with `MockCamera` (now) and a documented `YoloCamera`
  stub (later), paralleling `sensors/base.py`.

## 5. Backend — `api/` (FastAPI)

Wraps the existing functions directly (`load_config`, `load_model`/`train`, `optimum`,
`decide_now`, `best_window`, `diurnal_profile`, `SyntheticSensor`).

| Endpoint | Returns |
|---|---|
| `GET /api/live` | Current reading (`SyntheticSensor.read()`): per-shelf temp/RH + camera detections (mock YOLO: `{box, label: water\|dont_water, stage, confidence}`), shaped identically to real YOLO output. |
| `GET /api/timing?stage=small_medium` | `{ optimum, best_window, now, live }` — the same payload as the CLI `report` command, straight from the real module. |
| `GET /api/config` | Oyster optima / guardrail bands, so the UI can draw safe-band overlays. |
| `GET /api/health` | Liveness + whether the model pickle is loaded. |

**Model bootstrap:** if `models/growth_rf.pkl` is missing, the API trains it on startup (small,
fast on synthetic data) so the dashboard works from a clean checkout.

**Errors:** structured JSON errors (`{error, detail}`); the UI renders an explicit offline state
rather than blank panels.

## 6. Frontend — `frontend/` (Vite + React)

**Screen 1 · Live Monitoring**
- Camera panel: sample shelf image with detection boxes overlaid — **green = water**, **red =
  don't-water** — plus the stage label (`none` / `small_medium` / `mature`) and confidence.
- Live **temperature** and **humidity** gauges, each marking the oyster safe-band from
  `/api/config`.
- Per-shelf status strip (the camera moves along the threaded rod across shelves).
- Model-confidence badge showing the real reported metrics: **Precision 0.973 / Recall 0.613 /
  Accuracy 0.885**.

**Screen 2 · Irrigation Timing**
- Large **IRRIGATE NOW / WAIT** verdict with the `decide_now` reason text.
- Today's recommended **watering window** (e.g. "06:30–08:00") plotted on a 24 h timeline.
- The **active guardrail** when blocked: mature / RH-cap / thermal-stress / surface-drying.
- The identified **optimum** (T\*, RH\*) for the current stage from `optimum()`.

**Cross-cutting:** SpotShrooms branding ("Eyes on every mushroom, anytime, anywhere"), a stage
selector (none / small_medium / mature) driving both screens, polling every few seconds for a live
feel, and a clear offline state.

## 7. Data flow

UI polls `/api/live` + `/api/timing` on an interval → FastAPI calls the **real**
`irrigation_timing` model + the **mock** camera → JSON → React renders. No hardware required;
`SyntheticSensor` + `MockCamera` stand in for the sensor and camera respectively.

## 8. Testing

- **API (pytest):** endpoint shapes; `/api/timing` payload matches the module's own output;
  `MockCamera` satisfies the `CameraSource` contract and returns the YOLO-compatible shape;
  model-bootstrap path works on a clean checkout. Reuses the existing `tests/` setup.
- **Frontend:** component tests for the verdict/guardrail rendering and the detection-box overlay
  (correct colour per label).

## 9. Dependencies

- Backend (Python): `fastapi`, `uvicorn` added to `requirements.txt`; reuses existing
  `scikit-learn` / `numpy` / `PyYAML`.
- Frontend (Node): Vite + React, kept minimal; one charting/gauge approach chosen at plan time.

## 10. Honest scope note

The dashboard is **real on the irrigation-decision side** (it calls the trained model and its
guardrails) and **mocked on the camera side** (no YOLO weights in this repo). Both mocks
(`SyntheticSensor`, `MockCamera`) sit behind the same interfaces their real counterparts will use,
so replacing them is a drop-in with no change to the API contract or the frontend.
