from __future__ import annotations

from typing import List

from .base import CameraSource, ShelfFrame


class YoloCamera(CameraSource):
    """Real-hardware drop-in. Load weights from the YOLO_Model_Code branch
    (`runs/detect/train30/weights/best.pt`) and translate YOLO boxes into ShelfFrame.
    Not wired here because the weights are not committed to this repo.

    Sketch:
        from ultralytics import YOLO
        self.model = YOLO(weights_path)
        results = self.model.predict(source=frame_image)
        # map results.boxes.xywhn + names[int(cls)] -> Detection(box, label, stage, conf)
    """

    def __init__(self, weights_path: str) -> None:  # pragma: no cover - documented stub
        self.weights_path = weights_path

    def frames(self) -> List[ShelfFrame]:  # pragma: no cover - documented stub
        raise NotImplementedError(
            "YoloCamera requires committed YOLOv8 weights (see YOLO_Model_Code branch)."
        )
