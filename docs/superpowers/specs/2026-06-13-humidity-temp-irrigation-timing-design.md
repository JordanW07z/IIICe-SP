# Design — Humidity & Temperature Irrigation-Timing AI

**Project:** SpotShrooms / OSIP Mushroom (SP × EIU Vietnam)
**Feature branch:** `New_Feature/Humidity&amp;Temp_Monitor`
**Date:** 2026-06-13
**Author:** Sean Ho (with Claude, via brainstorming)

---

## 1. Purpose

SpotShrooms automates mushroom watering to cut spoilage from **overwatering**. The AI camera
(YOLO, on `YOLO_Model_Code`) decides *whether* to water based on mushroom maturity. This feature
decides **when** — it monitors the hut's temperature and humidity and uses an AI model to determine
**the best time of day to irrigate**, tuned for **oyster mushrooms (Pleurotus)** and aware of the
camera's growth state.

The module must be **small enough to later embed on a Raspberry Pi**, and must work **before any
hardware exists** by using synthetic data.

## 2. Agronomic basis (cited)

Per-stage oyster-mushroom requirements that drive the labels and guardrails:

- **Colonization / incubation** (no visible mushrooms): ~24–27 °C, ~70 % RH, dark. Surface watering
  not needed yet.
- **Pinning / young fruiting** (small & medium): high RH ~85–95 %, fresh air, slight temperature
  drop initiates pinning. Needs watering when RH falls below the band.
- **Fruiting → maturation**: 85–90 % RH, ~13–24 °C, **but caps must partially dry between waterings**
  (≥10 % RH swing) or **bacterial blotch** spoilage results.
- **Mature**: do **not** water — overwatering mature caps is the core spoilage problem. Harvest
  imminent.
- **Timing rule:** disease is probable whenever cap surfaces stay wet after watering. The best
  irrigation window is therefore one where conditions let the surface dry afterward — i.e. not the
  peak-humidity cooling evening period that keeps caps wet overnight.

Sources:
- [GroCycle — conditions needed for mushrooms](https://grocycle.com/what-conditions-are-needed-for-a-mushroom-to-grow/)
- [Shroomability — fruiting & incubation temperatures for oyster mushrooms](https://shroomability.com/blogs/news/fruiting-and-incubation-temperatures-for-oyster-mushroom-cultivation-a-comprehensive-guide)
- [MycoPowered — role of temperature & humidity in colonization vs fruiting](https://www.mycopowered.com/post/the-role-of-temperature-and-humidity-in-mushroom-growth)
- [Penn State Extension — Bacterial Blotch Disease](https://extension.psu.edu/bacterial-blotch-disease)
- [ZombieMyco — mushroom cultivation humidity & the ≥10% drying swing](https://zombiemyco.com/blogs/mushrooms/mushroom-cultivation-humidity-how-much-is-enough)
- [IJRRR — Influence of Temperature and RH on fruiting body production of *Pleurotus florida*](https://www.ijrrr.com/papers11-1/paper16-Influence%20on%20Temperature%20and%20Relative%20Humidity%20on%20Fruiting%20Body%20Production%20of%20Pleurotus%20Florida%20_Oyster%20Mushrooms_%20in%20the%20Cropping%20Room.pdf)

> **Note:** ranges are seeded from these general sources for the synthetic stand-in. They are
> centralised in an editable config so the EIU team can refine them against the farm's actual oyster
> strain and hut conditions.

## 3. Requirements

- **Inputs:** temperature (°C), relative humidity (%), and growth stage from the camera —
  `none` / `small_medium` / `mature`.
- **Outputs:** (a) a real-time `irrigate now / wait` decision; (b) a recommended daily irrigation
  **time-of-day window** (e.g. "06:30–08:00").
- **Engine:** an AI model — **`RandomForestRegressor`** predicting a continuous irrigation
  **suitability score in [0, 1]** — trained on synthetic, agronomy-grounded data now, retrainable on
  real hut logs later.
- **Hardware:** none yet. Synthetic sensor now; real DHT22/SHT31-on-Raspberry-Pi drop-in later behind
  the same interface.
- **Footprint:** runs on a Raspberry Pi; small dependency set; trained model persisted as a small
  pickle.
- **Safety:** hard agronomic guardrails wrap the model output (below).

## 4. Architecture

```
sensor source (abstracted)          ┌─ synthetic generator (now)
   ├─ SyntheticSensor  ─────────────┘
   └─ RealSensor (DHT22/SHT31)  ── future drop-in
            │
       data logger ──► storage (SQLite, stdlib)
            │
   feature builder (hour, temp, RH, stage, RH drying-trend)
            │
   AI model (RandomForestRegressor → suitability score 0..1)
        trained on synthetic labels from cited agronomy
            │
   decision layer  ┌─ real-time:  irrigate-now / wait
                   └─ daily window: argmax suitability across the day
            │
   safety guardrails (never water mature; RH/temp clamps; drying rule)
            │
   outputs: CLI report + JSON  (dashboard/actuator consume later)
```

Each unit has one purpose, a defined interface, and is testable in isolation.

## 5. Components

| Module | Responsibility | Key interface |
|--------|----------------|---------------|
| `config/oyster.yaml` | Per-stage target temp/RH bands, drying swing, guardrail limits. Editable per species. | data file |
| `sensors/base.py` | `SensorSource` abstract interface | `read() -> Reading(temp, rh, ts)` |
| `sensors/synthetic.py` | Binh Duong tropical diurnal curves (temp peak ~14:00; RH peak pre-dawn; noise; watering effect) | implements `SensorSource` |
| `sensors/real.py` | Raspberry-Pi sensor stub (documented, not wired) | implements `SensorSource` |
| `data/synthetic.py` | Generate labeled training set: features `(hour, temp, rh, stage)` → suitability label from §2 rules | `make_dataset(n) -> (X, y)` |
| `model/train.py` | Fit & persist `RandomForestRegressor`; report metrics | `train()`, saves `model.pkl` |
| `model/predict.py` | Load model; score suitability | `predict_suitability(features) -> float` |
| `features.py` | Build feature vector incl. RH drying-trend | `build_features(...)` |
| `decision.py` | Real-time decision + daily-window scan, then guardrails | `decide_now(...)`, `best_window(...)` |
| `store.py` | SQLite logging of readings + decisions; diurnal queries | `log_reading`, `log_decision`, `daily_profile` |
| `cli.py` | Train, simulate a day, print best window + live decisions; optional matplotlib chart (dev-only) | entry point |
| `tests/` | generator, labeling, guardrails, window selection | pytest |

## 6. Growth-stage interface (CV integration)

`growth_stage` is a feature passed in as an enum (`none` / `small_medium` / `mature`). Until the YOLO
model is wired in, it is supplied manually or by the simulator. Mapping to agronomy:

- `none` → colonization rules (minimal/no surface irrigation)
- `small_medium` → pinning/fruiting rules (irrigation matters most here)
- `mature` → hold (never irrigate — guardrail)

## 7. Decision logic

- **Real-time** (`decide_now`): build features from current reading + stage, get model suitability,
  apply guardrails, return `{irrigate: bool, score, reason}`.
- **Daily window** (`best_window`): score each time bin (hourly) of a representative day for the active
  stage; the recommended window is the contiguous run of highest-suitability bins (argmax + threshold).
- **Guardrails (override the model, always):**
  1. `stage == mature` → never irrigate.
  2. current RH ≥ stage upper band → wait (already wet; avoid blotch).
  3. temp outside safe band → wait.
  4. predicted post-watering drying inadequate (near daily humidity peak) → wait.

Guardrails guarantee safe behaviour even if the model is wrong.

## 8. Synthetic data & labeling

`SyntheticSensor` produces realistic tropical (Binh Duong) time-series: temperature diurnal sinusoid
(min pre-dawn ~24 °C, max ~14:00 ~33 °C), humidity inversely correlated (max pre-dawn ~95 %, min
mid-afternoon ~60 %), plus Gaussian noise and day-to-day variation. The training label (suitability
0..1) is computed from the §2 rules: high when stage allows watering **and** RH is below the target
band **and** the following hours permit cap drying; ~0 for mature or already-wet conditions. The model
thus learns a smooth version of the agronomy and handles noise/interpolation.

## 9. Dependencies

`scikit-learn`, `numpy` (core); `PyYAML` (config); SQLite via stdlib; `matplotlib` optional/dev-only
(not required on the Pi). Pinned in `requirements.txt`. All run on Raspberry Pi OS.

## 10. Testing & evaluation

- Unit tests: synthetic generator shape/ranges; labeling rules; **guardrail test asserting mature →
  never water**; window selection on a known profile.
- Model evaluation: R² / MAE of suitability regression vs held-out synthetic labels, reported by
  `model/train.py` (parallels the YOLO precision/recall slide).

## 11. Honest tradeoff / scope

Because synthetic labels come from the cited rules, the model today largely **reproduces those rules**
plus noise tolerance — it is not discovering new agronomy. Its value is the **trainable, swappable
pipeline**: replace `SyntheticSensor` with `RealSensor`, accumulate real hut logs + watering outcomes,
and retrain on real data with **no architectural change**. Guardrails keep behaviour safe throughout.

## 12. Out of scope (YAGNI)

- Real firmware / GPIO wiring (documented stub only).
- The app dashboard UI and the physical actuator/pump control (this feature emits JSON they consume).
- GC-style multi-species tuning beyond the editable config.
- The statistical/learned-window-from-real-history upgrade (enabled by, but not built in, this spec).
