from __future__ import annotations

from abc import ABC, abstractmethod

from ..types import Reading


class SensorSource(ABC):
    """Abstract temperature/humidity source. Synthetic now, real hardware later."""

    @abstractmethod
    def read(self) -> Reading:
        ...
