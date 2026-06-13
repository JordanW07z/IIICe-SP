from __future__ import annotations

from typing import Optional

from .base import SensorSource
from ..types import Reading


class RealSensor(SensorSource):
    """Stub for a DHT22/SHT31 on Raspberry Pi GPIO — not wired yet.

    To implement on the Pi:
        pip install adafruit-circuitpython-dht
        import board, adafruit_dht
        dht = adafruit_dht.DHT22(board.D4)
        return Reading(temp=dht.temperature, rh=dht.humidity, ts=datetime.now())
    """

    def __init__(self, pin: Optional[int] = None):
        self.pin = pin

    def read(self) -> Reading:
        raise NotImplementedError(
            "RealSensor needs DHT22/SHT31 hardware + adafruit-circuitpython-dht. "
            "Wire the sensor and implement read() on the Raspberry Pi."
        )
