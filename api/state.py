from __future__ import annotations

from datetime import datetime
from typing import Optional

from irrigation_timing.config import load_config
from irrigation_timing.model.predict import load_model
from irrigation_timing.model.train import MODEL_PATH, train
from irrigation_timing.sensors.synthetic import SyntheticSensor


class AppState:
    """Holds the loaded config, model, sensor and camera. Bootstraps the model
    (trains on synthetic data) if no pickle exists, so the dashboard works from a
    clean checkout."""

    def __init__(self) -> None:
        self._config: Optional[dict] = None
        self._model = None
        self._sensor: Optional[SyntheticSensor] = None
        self._camera = None

    @property
    def config(self) -> dict:
        if self._config is None:
            self._config = load_config()
        return self._config

    @property
    def model(self):
        if self._model is None:
            if not MODEL_PATH.exists():
                train(config=self.config)  # writes MODEL_PATH
            self._model = load_model(MODEL_PATH)
        return self._model

    @property
    def sensor(self) -> SyntheticSensor:
        if self._sensor is None:
            self._sensor = SyntheticSensor(self.config)
        return self._sensor

    @property
    def model_loaded(self) -> bool:
        return self._model is not None or MODEL_PATH.exists()

    def now(self) -> datetime:
        return datetime.now()


state = AppState()
