from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_health_ok():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "model_loaded" in body


from api.camera.mock import MockCamera
from api.camera.base import CameraSource, ShelfFrame

_LABEL_BY_STAGE = {"none": "water", "small_medium": "dont_water", "mature": "water"}


def test_mock_camera_contract():
    cam = MockCamera(n_shelves=3, seed=1)
    assert isinstance(cam, CameraSource)
    frames = cam.frames()
    assert len(frames) == 3
    for f in frames:
        assert isinstance(f, ShelfFrame)
        assert f.stage in _LABEL_BY_STAGE
        for d in f.detections:
            assert d.label == _LABEL_BY_STAGE[f.stage]   # matches deck p.14 mapping
            assert len(d.box) == 4
            assert all(0.0 <= v <= 1.0 for v in d.box)
            assert 0.0 <= d.confidence <= 1.0


def test_mock_camera_is_deterministic_with_seed():
    a = MockCamera(n_shelves=4, seed=7).frames()
    b = MockCamera(n_shelves=4, seed=7).frames()
    assert [f.stage for f in a] == [f.stage for f in b]
