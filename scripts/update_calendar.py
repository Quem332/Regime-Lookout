#!/usr/bin/env python3
"""
Build a NYSE (XNYS) trading calendar JSON for the UI countdown.

Outputs:
  public/data/calendar.json

Format (stable, human-readable):
{
  "schema": "calendar.v1",
  "tz": "America/New_York",
  "generated_at": "2026-02-22T00:00:00Z",
  "sessions": [
    {"date":"2026-02-21","open":"2026-02-21T09:30:00-05:00","close":"2026-02-21T16:00:00-05:00"},
    ...
  ]
}
"""
from __future__ import annotations

import json
import os
import datetime as dt

def _utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def main() -> None:
    try:
        import exchange_calendars as xcals
        import pandas as pd
    except Exception as e:
        raise SystemExit(f"[calendar] missing deps. install exchange-calendars, pandas. err={e}")

    cal = xcals.get_calendar("XNYS")

    # Cover past + future so UI can find "previous close" and "next open" robustly.
    today = dt.date.today()
    start = today - dt.timedelta(days=30)
    end = today + dt.timedelta(days=120)

    sched = cal.schedule(start_date=start, end_date=end)  # UTC tz-aware columns
    # Convert to America/New_York
    try:
        et = "America/New_York"
        opens = sched["open"].dt.tz_convert(et)
        closes = sched["close"].dt.tz_convert(et)
    except Exception:
        opens = sched["open"]
        closes = sched["close"]

    sessions = []
    for idx, o, c in zip(sched.index, opens, closes):
        # idx is session date (Timestamp)
        d = idx.date().isoformat()
        sessions.append({
            "date": d,
            "open": o.replace(microsecond=0).isoformat(),
            "close": c.replace(microsecond=0).isoformat(),
        })

    out = {
        "schema": "calendar.v1",
        "tz": "America/New_York",
        "generated_at": _utc_now_iso(),
        "sessions": sessions,
    }

    out_path = os.path.join("public", "data", "calendar.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"[calendar] wrote {out_path} sessions={len(sessions)} generated_at={out['generated_at']}")

if __name__ == "__main__":
    main()
