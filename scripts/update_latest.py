#!/usr/bin/env python3
"""
Merge already-built JSONs into a single public/data/latest.json for the UI.

Inputs (optional):
  public/data/daily_latest.json
  public/data/intraday_latest.json
  public/data/period_20d.json
  public/data/period_60d.json
  public/data/period_252d.json
  public/data/calendar.json

Output:
  public/data/latest.json
"""
from __future__ import annotations

import json
import os
import datetime as dt
from typing import Any, Dict, Optional

def _read_json(path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None

def _write_json(path: str, obj: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

def _utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")

def _max_asof(*items: Optional[Dict[str, Any]]) -> Optional[str]:
    # pick max lexicographically among ISO strings (works for same format)
    vals = []
    for it in items:
        if not isinstance(it, dict):
            continue
        v = it.get("asOf") or it.get("asof") or it.get("as_of")
        if isinstance(v, str) and v.strip():
            vals.append(v.strip())
    return max(vals) if vals else None

def main() -> None:
    daily = _read_json(os.path.join("public","data","daily_latest.json"))
    intraday = _read_json(os.path.join("public","data","intraday_latest.json"))
    p20 = _read_json(os.path.join("public","data","period_20d.json"))
    p60 = _read_json(os.path.join("public","data","period_60d.json"))
    p252 = _read_json(os.path.join("public","data","period_252d.json"))
    cal = _read_json(os.path.join("public","data","calendar.json"))

    latest: Dict[str, Any] = {
        "schema": "2.4",
        "generatedAt": _utc_now_iso(),
        "asOf": _max_asof(daily, intraday, p20, p60, p252),
        "daily": daily,
        "intraday": intraday,
        "period": {
            "20d": p20,
            "60d": p60,
            "252d": p252,
        },
        "calendar": cal,
    }

    _write_json(os.path.join("public","data","latest.json"), latest)
    print("[latest] wrote public/data/latest.json",
          f"asOf={latest['asOf']}",
          f"has_daily={bool(daily)} has_intraday={bool(intraday)}")

if __name__ == "__main__":
    main()
