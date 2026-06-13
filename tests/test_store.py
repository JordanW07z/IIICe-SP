from datetime import datetime
from irrigation_timing.store import Store
from irrigation_timing.types import Reading


def test_log_and_read_back_reading():
    store = Store(":memory:")
    store.log_reading(Reading(24.0, 88.0, datetime(2026, 6, 13, 7, 0)), stage="small_medium")
    store.log_reading(Reading(31.0, 65.0, datetime(2026, 6, 13, 14, 0)), stage="small_medium")
    profile = store.daily_profile()
    hours = {h for h, _, _ in profile}
    assert 7 in hours and 14 in hours
    by_hour = {h: (t, r) for h, t, r in profile}
    assert by_hour[7][0] == 24.0
    assert by_hour[14][0] == 31.0
    store.close()


def test_log_decision_roundtrip():
    store = Store(":memory:")
    store.log_decision(datetime(2026, 6, 13, 9, 0), irrigate=True, growth_gain=0.12, reason="ok")
    rows = store.conn.execute("SELECT irrigate, reason FROM decisions").fetchall()
    assert rows == [(1, "ok")]
    store.close()
