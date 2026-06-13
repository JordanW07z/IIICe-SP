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
