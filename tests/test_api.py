from fastapi.testclient import TestClient

from api.main import app
from api.camera.base import CameraSource, ShelfFrame
from api.camera.mock import MockCamera, LABEL_BY_STAGE

client = TestClient(app)


def test_health_ok():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "model_loaded" in body


def test_mock_camera_contract():
    cam = MockCamera(n_shelves=3, seed=1)
    assert isinstance(cam, CameraSource)
    frames = cam.frames()
    assert len(frames) == 3
    for f in frames:
        assert isinstance(f, ShelfFrame)
        assert f.stage in LABEL_BY_STAGE
        if f.stage == "none":
            assert f.detections == ()          # no mushroom -> no boxes
        for d in f.detections:
            assert d.label == LABEL_BY_STAGE[f.stage]   # matches deck p.14 mapping
            assert len(d.box) == 4
            assert all(0.0 <= v <= 1.0 for v in d.box)
            assert 0.0 <= d.confidence <= 1.0


def test_mock_camera_is_deterministic_with_seed():
    a = MockCamera(n_shelves=4, seed=7).frames()
    b = MockCamera(n_shelves=4, seed=7).frames()
    assert [(f.stage, f.detections) for f in a] == [(f.stage, f.detections) for f in b]


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
