from __future__ import annotations

import io
import os
from pathlib import Path
from typing import List, Optional

# Where to drop the trained weights exported from the YOLO_Model_Code notebook
# (runs/detect/train30/weights/best.pt). Override with the SPOTSHROOMS_YOLO_WEIGHTS env var.
DEFAULT_WEIGHTS = Path(__file__).resolve().parent / "camera" / "weights" / "best.pt"

# The notebook trained YOLO with classes ["water", "dont water"]; normalise the spelling
# to the dashboard's "dont_water".
_LABEL_FIX = {"water": "water", "dont water": "dont_water", "dont_water": "dont_water"}


class YoloDetector:
    """Real YOLOv8 inference, loaded lazily. Stays dormant — and the whole app keeps
    running — until BOTH `ultralytics` is installed AND a weights file exists. That keeps
    the heavy PyTorch dependency optional for anyone who only wants the synthetic demo,
    while making the real model a genuine drop-in: add best.pt and it goes live."""

    def __init__(self, weights_path: Optional[str] = None) -> None:
        self.weights_path = Path(
            weights_path or os.environ.get("SPOTSHROOMS_YOLO_WEIGHTS", DEFAULT_WEIGHTS)
        )
        self._model = None
        self._load_error: Optional[str] = None

    def _ensure_model(self):
        if self._model is not None:
            return self._model
        if not self.weights_path.exists():
            self._load_error = (
                f"YOLO weights not found at {self.weights_path}. Export best.pt from the "
                "YOLO_Model_Code notebook (runs/detect/train30/weights/best.pt) to that "
                "path, or set SPOTSHROOMS_YOLO_WEIGHTS."
            )
            return None
        try:
            from ultralytics import YOLO  # heavy import — only when weights are present
        except ImportError:
            self._load_error = (
                "ultralytics is not installed. Run `pip install ultralytics` to enable "
                "real YOLO detection."
            )
            return None
        self._model = YOLO(str(self.weights_path))
        self._load_error = None
        return self._model

    def available(self) -> bool:
        return self._ensure_model() is not None

    def status(self) -> str:
        self._ensure_model()
        return self._load_error or "ready"

    def detect(self, image_bytes: bytes) -> List[dict]:
        """Run the model on one image; return detections with boxes normalised to 0..1
        as [x, y, w, h] (top-left origin) — the exact shape the dashboard already draws."""
        model = self._ensure_model()
        if model is None:
            raise RuntimeError(self._load_error or "YOLO model unavailable")
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        results = model.predict(source=img, verbose=False)
        dets: List[dict] = []
        for r in results:
            names = r.names
            for b in r.boxes:
                cx, cy, w, h = (float(v) for v in b.xywhn[0])  # normalised centre x/y, w, h
                raw = names[int(b.cls[0])]
                label = _LABEL_FIX.get(raw.lower(), raw.lower().replace(" ", "_"))
                dets.append(
                    {
                        "box": [cx - w / 2.0, cy - h / 2.0, w, h],
                        "label": label,
                        "confidence": round(float(b.conf[0]), 2),
                    }
                )
        return dets


# Module-level singleton (lazy — constructing it does no heavy work).
detector = YoloDetector()
