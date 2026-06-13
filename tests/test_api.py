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
