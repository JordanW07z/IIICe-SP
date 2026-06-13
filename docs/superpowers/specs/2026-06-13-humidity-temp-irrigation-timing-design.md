# Design — Humidity & Temperature Irrigation-Timing AI

**Project:** SpotShrooms / OSIP Mushroom (SP × EIU Vietnam)
**Feature branch:** `New_Feature/Humidity&amp;Temp_Monitor`
**Date:** 2026-06-13
**Author:** Sean Ho (with Claude, via brainstorming)

---

## 1. Purpose

SpotShrooms automates mushroom watering to cut the 20–30 % annual harvest loss caused by
**overwatering**. Per the project abstract (*SpotShrooms_IIICe2026_Abstract_v3*), the system pairs a
three-class computer-vision growth-stage classifier with automated irrigation, plus a combined
temperature/humidity sensor providing **continuous microclimate telemetry** to a cloud dashboard, and
targets **water-use efficiency (UN SDG 12)**.

The AI camera (YOLO, on `YOLO_Model_Code`) decides *whether* to water based on mushroom maturity.
**This feature decides *when*** — it learns the temperature/humidity conditions that optimise oyster
growth and uses them to determine **the best time of day to irrigate**, aware of the camera's growth
state. It must be **small enough to embed on a Raspberry Pi** and must work **before any hardware
exists**, using synthetic data.

## 2. The model identifies the optimum (not a hand-written rule)

The regressor's job is to **learn the temperature/humidity → mushroom-growth relationship and identify
the optimum**, not to reproduce an irrigation rule. Concretely:

- The training **label is a growth-quality / biological-efficiency score**, drawn from the published
  oyster temp×RH response surface (below) — *not* an irrigation heuristic.
- The model then **finds the optimum** by searching its predicted-growth surface (argmax over
  temp×RH per stage). Irrigation timing is *derived* from that optimum, never hard-coded.

Using synthetic/online data here is exactly the right move to **prove the pipeline works** now;
when real hut sensor + harvest data arrives, the same pipeline retrains on it unchanged.

## 3. Agronomic response surface (cited) — oyster, tropical strain

Oyster strains share the **same humidity response**; only the **temperature optimum** is
strain-dependent. Binh Duong is tropical, so the config defaults to a **warm/tropical oyster strain**
(*P. florida* / *P. pulmonarius*), temperature config-driven for tuning.

| Stage (camera class) | Temperature | Relative humidity | Notes |
|---|---|---|---|
| Colonization / spawn run (`none`) | 25–30 °C | 70–75 % | Substrate moisture only; no surface irrigation. |
| Pinning / young fruiting (`small_medium`) | drop to 20–24 °C | 85–95 % | Thermal drop triggers pinning; primordia desiccate easily. |
| Fruiting → mature (`small_medium` → `mature`) | 20–28 °C (best 22–26 °C) | **peak yield ~90 %** | RH→yield rises to ~90 %, **declines past 95 %** (blotch/mould). |
| Mature (`mature`) | — | — | **Never irrigate** (overwatering = spoilage). |

Response-surface shape used to label synthetic data: growth quality is a **peaked function** — maximal
near the stage's temperature optimum and RH ≈ 90 %, penalised for **>30 °C** (thermal stress, malformed
bodies), **>95 % RH** (blotch/mould), and **<75 % RH** (desiccation). *P. florida* is noted as more
sensitive to RH fluctuation than *P. ostreatus*.

**Timing rule (blotch guardrail) — surface drying, NOT a dry room:** Bacterial blotch
(*Pseudomonas tolaasii*) is driven by a *persistent film of free water on the cap surface*, not by
ambient air humidity. Ambient RH must stay **high (85–90 %)** for the mushrooms; the guardrail only
ensures the **surface droplets from a watering evaporate within a few hours**, via airflow/ventilation
and the natural mid-day RH dip. The lever is **timing**, not desiccation: watering late morning lets
the cap film dry before the near-saturated, still night; evening watering leaves it wet overnight →
blotch. The "≥10 % drying swing" stays *within* the safe band (≈95 % → 85 %), so the air is never dried
below the mushroom-healthy range. The guardrail never lowers ambient humidity below the §3 targets.

Sources:
- [IJRRR 2018 — Influence of Temperature & RH on fruiting body production of *Pleurotus florida*](https://www.ijrrr.com/papers11-1/paper16-Influence%20on%20Temperature%20and%20Relative%20Humidity%20on%20Fruiting%20Body%20Production%20of%20Pleurotus%20Florida%20_Oyster%20Mushrooms_%20in%20the%20Cropping%20Room.pdf) — RH→yield peak ~90 %, fruiting 20–28 °C, spawn 25–30 °C/70–75 %, >30 °C stress
- [ResearchGate — Influence of RH & Temperature on cultivation of *Pleurotus* species](https://www.researchgate.net/publication/324908924_Influence_of_Relative_Humidity_and_Temperature_on_Cultivation_of_Pleurotus_species)
- [ZombieMyco / Rhizo Funga — *P. pulmonarius* (Phoenix) warm-strain fruiting 18–24 °C, RH 85–95 %](https://rhizofunga.com/blogs/mushroom-teks-recipes/phoenix-oyster-complete-guide-2025)
- [Shroomability — oyster incubation vs fruiting temperatures](https://shroomability.com/blogs/news/fruiting-and-incubation-temperatures-for-oyster-mushroom-cultivation-a-comprehensive-guide)
- [Penn State Extension — Bacterial Blotch Disease](https://extension.psu.edu/bacterial-blotch-disease)
- [ZombieMyco — cultivation humidity & the ≥10 % drying swing](https://zombiemyco.com/blogs/mushrooms/mushroom-cultivation-humidity-how-much-is-enough)

> Ranges are literature-seeded for the synthetic stand-in and centralised in editable config, so EIU
> can refine them against the farm's actual oyster strain and hut.

## 4. Requirements

- **Inputs:** temperature (°C), relative humidity (%), growth stage from the camera —
  `none` / `small_medium` / `mature`.
- **Outputs:** (a) the **identified optimum** temp/RH per stage (from the model); (b) real-time
  `irrigate now / wait`; (c) recommended daily irrigation **time-of-day window** (e.g. "06:30–08:00").
- **Engine:** **`RandomForestRegressor`** predicting a continuous **growth-quality score (0–1)** from
  `(temp, rh, stage)`, trained on synthetic data labeled from the §3 response surface. Optimum and
  irrigation timing are derived from the model.
- **Hardware:** none yet — `SyntheticSensor` now; real DHT22/SHT31-on-Raspberry-Pi drop-in later behind
  the same interface.
- **Footprint:** runs on a Raspberry Pi; small dependency set; model persisted as a small pickle.
- **Safety:** hard agronomic guardrails wrap model output (§7).

## 5. Architecture

```
sensor source (abstracted)          ┌─ synthetic climate generator (now)
   ├─ SyntheticSensor  ─────────────┘   (Binh Duong diurnal temp/RH)
   └─ RealSensor (DHT22/SHT31)  ── future drop-in
            │
       data logger ──► storage (SQLite, stdlib)
            │
   ┌─────────────────────────────────────────────┐
   │ growth-response dataset (synthetic, §3)      │ → trains
   │   (temp, rh, stage) → growth-quality label   │
   └─────────────────────────────────────────────┘
            │
   AI model: RandomForestRegressor → growth quality 0..1
            │
   ┌─ optimum(stage):  argmax growth over temp×RH grid
   │
   decision layer
   ├─ real-time:  does watering raise predicted growth? → irrigate / wait
   └─ daily window: per-hour predicted growth gain from watering → best window
            │
   safety guardrails (never water mature; RH≤95% cap; temp clamp; drying rule)
            │
   outputs: CLI report + JSON  (dashboard/actuator consume later)
```

Two **separate** synthetic sources: a **climate generator** (diurnal time-series for timing + logging)
and a **growth-response dataset** (samples across temp×RH×stage labeled by the §3 surface) for training
the model. Each unit has one purpose, a defined interface, and is independently testable.

## 6. Components

| Module | Responsibility | Key interface |
|--------|----------------|---------------|
| `config/oyster.yaml` | Per-stage temp/RH optima & penalties, guardrail limits, watering effect (ΔRH/Δtemp). Editable per strain. | data file |
| `sensors/base.py` | `SensorSource` abstract interface | `read() -> Reading(temp, rh, ts)` |
| `sensors/synthetic.py` | Binh Duong diurnal climate (temp peak ~14:00; RH peak pre-dawn; noise; watering effect) | implements `SensorSource` |
| `sensors/real.py` | Raspberry-Pi DHT22/SHT31 stub (documented, not wired) | implements `SensorSource` |
| `growth/response.py` | The §3 response surface → growth-quality label | `growth_quality(temp, rh, stage) -> float` |
| `data/synthetic.py` | Sample `(temp, rh, stage)` space, label via `growth/response.py`, add noise | `make_dataset(n) -> (X, y)` |
| `model/train.py` | Fit & persist `RandomForestRegressor`; report R²/MAE | `train()`, saves `model.pkl` |
| `model/predict.py` | Load model; predict growth; `optimum(stage)` via grid argmax | `predict(...)`, `optimum(stage)` |
| `decision.py` | Real-time decision + daily-window scan from predicted growth gain, then guardrails | `decide_now(...)`, `best_window(...)` |
| `store.py` | SQLite logging of readings + decisions; diurnal queries | `log_reading`, `log_decision`, `daily_profile` |
| `cli.py` | Train, print identified optima, simulate a day, print best window + live decisions; optional matplotlib chart (dev-only) | entry point |
| `tests/` | response surface, dataset, optimum, guardrails, window selection | pytest |

## 7. Decision logic

- **Identified optimum** (`optimum(stage)`): grid-search the model over temp×RH → the (T\*, RH\*) that
  maximise predicted growth. This is the model's core "find the optimum" output.
- **Real-time** (`decide_now`): from the current reading + stage, estimate predicted-growth gain of
  watering (apply config ΔRH/Δtemp, compare model growth before vs after). Irrigate if gain is positive
  **and** guardrails pass; else wait. Returns `{irrigate, growth_gain, reason}`.
- **Daily window** (`best_window`): over a representative diurnal profile for the active stage, compute
  the predicted-growth gain of watering at each hour; the recommended window is the contiguous run of
  highest-gain hours that also satisfy the drying rule.
- **Guardrails (override the model, always):**
  1. `stage == mature` → never irrigate.
  2. watering would push RH > 95 % → wait (blotch risk).
  3. temp outside safe band → wait.
  4. inadequate post-watering **surface** drying — would the cap film evaporate within a few hours?
     (avoid watering near the daily humidity peak / before the still night) → wait. Ambient RH is never
     pushed below the §3 healthy band.

## 8. Synthetic data

- **Climate generator** (`sensors/synthetic.py`): tropical Binh Duong diurnal series — temperature
  sinusoid (min pre-dawn ~24 °C, max ~14:00 ~33 °C), RH inversely correlated (max pre-dawn ~95 %, min
  mid-afternoon ~60 %), Gaussian noise, day-to-day variation, watering bumps RH / dips temp.
- **Growth-response dataset** (`data/synthetic.py`): sample `(temp, rh, stage)` across realistic ranges,
  label with `growth_quality` from the §3 peaked surface, add noise so the model must generalise. This
  is the training set the RandomForestRegressor learns the optimum from.

## 9. Dependencies (Pi-light)

`scikit-learn`, `numpy` (core); `PyYAML` (config); SQLite via stdlib; `matplotlib` optional/dev-only.
Pinned in `requirements.txt`. All run on Raspberry Pi OS.

## 10. Testing & evaluation

- Unit tests: response surface monotonicity/penalties; dataset shape/ranges; `optimum()` lands in the
  cited bands; **guardrail test asserting mature → never water**; window selection on a known profile.
- Model evaluation: R²/MAE of growth regression on held-out synthetic data, plus a check that the
  model's identified optimum matches the literature bands (parallels the YOLO precision/recall metrics).

## 11. Honest scope note

Because the labels come from a literature-derived response surface, the model's accuracy is bounded by
that literature until **real farm yield/sensor data** replaces it — at which point the same pipeline
retrains with no architectural change. This is reduced circularity vs hand-labeling an irrigation rule:
the model learns a biological growth response and *finds* the optimum itself, rather than echoing a
heuristic. Guardrails keep behaviour safe throughout.

## 12. Out of scope (YAGNI)

- Real firmware / GPIO wiring (documented stub only).
- The app dashboard UI and the physical actuator/pump control (this feature emits JSON they consume).
- Multi-species support beyond the editable oyster config.
- The statistical/learned-window-from-real-history upgrade (enabled by, not built in, this spec).
