from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import List, Optional, Tuple

from .types import Reading

_SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    temp REAL NOT NULL,
    rh REAL NOT NULL,
    stage TEXT
);
CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    irrigate INTEGER NOT NULL,
    growth_gain REAL,
    reason TEXT
);
"""


class Store:
    """Lightweight SQLite logger for readings and decisions (Pi-friendly)."""

    def __init__(self, path: str = ":memory:"):
        self.conn = sqlite3.connect(path)
        self.conn.executescript(_SCHEMA)

    def log_reading(self, reading: Reading, stage: Optional[str] = None) -> None:
        self.conn.execute(
            "INSERT INTO readings (ts, temp, rh, stage) VALUES (?, ?, ?, ?)",
            (reading.ts.isoformat(), reading.temp, reading.rh, stage),
        )
        self.conn.commit()

    def log_decision(self, ts: datetime, irrigate: bool, growth_gain: float, reason: str) -> None:
        self.conn.execute(
            "INSERT INTO decisions (ts, irrigate, growth_gain, reason) VALUES (?, ?, ?, ?)",
            (ts.isoformat(), int(irrigate), growth_gain, reason),
        )
        self.conn.commit()

    def daily_profile(self) -> List[Tuple[int, float, float]]:
        """Average (hour, temp, rh) across all logged readings, grouped by hour."""
        cur = self.conn.execute(
            "SELECT CAST(strftime('%H', ts) AS INTEGER) AS hour, AVG(temp), AVG(rh) "
            "FROM readings GROUP BY hour ORDER BY hour"
        )
        return [(int(h), float(t), float(r)) for h, t, r in cur.fetchall()]

    def close(self) -> None:
        self.conn.close()
