#!/usr/bin/env python3

import json, os, sys, math
from datetime import datetime, timedelta, timezone
import pytz
import numpy as np
import pandas as pd
import yfinance as yf

ET = pytz.timezone("America/New_York")

# ---- Config ----
WINDOW_Z = 252
DELAY_MIN = 10            # "10 min delayed"
SCHEDULE_MIN = 30         # normal cadence
EVENT_WINDOW_MIN = 15     # during event: update every 15 min (Actions still runs every 15 min; we decide whether to write)

TICKERS_DAILY = {
  "QQQM": "QQQM",
  "XLP": "XLP",
  "VOO": "VOO",
  "UUP": "UUP",
  "GLD": "GLD",
  "VIX": "^VIX",
  "TNX": "^TNX",
}

def zscore(series: pd.Series) -> float:
  s = series.dropna()
  if len(s) < 30:
    return float("nan")
  mu = s.mean()
  sd = s.std(ddof=0)
  if sd == 0 or not np.isfinite(sd):
    return float("nan")
  return float((s.iloc[-1] - mu) / sd)

def last_trading_day(dt_et: datetime) -> str:
  # Simple: last weekday. (Holiday handling is intentionally avoided for robustness without external calendars)
  d = dt_et.date()
  while d.weekday() >= 5:
    d = d - timedelta(days=1)
  return d.isoformat()

def should_write(now_et: datetime, events) -> bool:
  # write on normal cadence: minute == 0 or 30, AND at least DELAY_MIN minutes after boundary
  m = now_et.minute
  on_slot = (m in (0, 30))
  if on_slot:
    # if m==0, boundary is top of hour; require now >= hh:DELAY
    if m == 0:
      return now_et.minute >= 0 and now_et.second >= 0 and (now_et.minute >= DELAY_MIN)
    # if m==30, require >= hh:30+DELAY => minute >= 30+DELAY not possible; so handle by checking minutes since 30
    # better: minutes_since_halfhour = m - 30
    return (m - 30) >= DELAY_MIN

  # Event window: +/- EVENT_WINDOW_MIN around each event time
  for e in events:
    try:
      dt = ET.localize(datetime.fromisoformat(f"{e['date']}T{e['time']}:00"))
    except Exception:
      continue
    if abs((now_et - dt).total_seconds()) <= EVENT_WINDOW_MIN * 60:
      return True

  return False

def event_window_active(now_et: datetime, events) -> bool:
  for e in events:
    try:
      dt = ET.localize(datetime.fromisoformat(f"{e['date']}T{e['time']}:00"))
    except Exception:
      continue
    if abs((now_et - dt).total_seconds()) <= EVENT_WINDOW_MIN * 60:
      return True
  return False

def load_events(path: str):
  try:
    with open(path, "r", encoding="utf-8") as f:
      cal = json.load(f)
    events = cal.get("events", [])
    out=[]
    for e in events:
      if isinstance(e, dict) and "date" in e and "time" in e:
        out.append({"date": str(e["date"]), "time": str(e["time"]), "name": str(e.get("name","Event"))})
    return out
  except Exception:
    return []

def fetch_daily_prices(period="2y"):
  # We fetch all tickers in one call for speed.
  tickers = " ".join(TICKERS_DAILY.values())
  df = yf.download(tickers, period=period, interval="1d", auto_adjust=True, group_by="ticker", threads=True, progress=False)
  if df is None or df.empty:
    raise RuntimeError("yfinance download returned empty daily data")
  # Normalize to close prices dataframe with columns = symbols
  close = {}
  for k, sym in TICKERS_DAILY.items():
    if (sym, "Close") in df.columns:
      close[k] = df[(sym, "Close")].rename(k)
    elif "Close" in df.columns and sym in df.columns.get_level_values(0):
      close[k] = df[sym]["Close"].rename(k)
  out = pd.concat(close.values(), axis=1).dropna(how="all")
  return out

def fetch_intraday_prices():
  # Optional: intraday summary. We keep it minimal to reduce failure modes.
  # If intraday fails, we still write daily-only.
  try:
    sym = "QQQM"
    t = yf.Ticker(sym)
    intr = t.history(period="2d", interval="5m")
    if intr is None or intr.empty:
      return None
    # zShort: position of last price within 2d mean/std (rough)
    px = intr["Close"].dropna()
    if len(px) < 30:
      return None
    zshort = float((px.iloc[-1] - px.mean()) / (px.std(ddof=0) + 1e-9))
    return {
      "zShort": round(zshort, 4),
      "corrAvg": None,
      "corrSurge": False,
      "intervalUsed": "5m"
    }
  except Exception:
    return None

def main():
  repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
  out_path = os.path.join(repo_root, "public", "data", "latest.json")
  cal_path = os.path.join(repo_root, "public", "data", "calendar.json")

  now_utc = datetime.now(timezone.utc)
  now_et = now_utc.astimezone(ET)

  events = load_events(cal_path)

  if not should_write(now_et, events):
    print("[SKIP] Not in scheduled slot or event window.")
    return 0

  # "asOf" = now - DELAY, as ET ISO string (with offset)
  asof_utc = now_utc - timedelta(minutes=DELAY_MIN)
  asof_et = asof_utc.astimezone(ET)

  # Fetch daily series, compute features
  close = fetch_daily_prices(period="3y")

  # Align window
  close = close.dropna(subset=["QQQM","XLP","VOO","UUP","GLD"], how="any")
  if len(close) < WINDOW_Z + 25:
    raise RuntimeError(f"Insufficient daily history: {len(close)} rows")

  # x = z( ln(QQQM/XLP) )
  ratio = np.log(close["QQQM"] / close["XLP"])
  x = zscore(ratio.tail(WINDOW_Z))

  # y = z( VOO 20d return )
  voo_ret20 = close["VOO"].pct_change(20)
  y = zscore(voo_ret20.tail(WINDOW_Z))

  # usd = z( UUP 20d change )
  uup_chg20 = close["UUP"].pct_change(20)
  usd = zscore(uup_chg20.tail(WINDOW_Z))

  # rates = z( TNX 20d change )  (TNX is an index; yfinance provides a "Close" level)
  tnx = close["TNX"].dropna()
  rates_chg20 = tnx.pct_change(20)  # robust, avoids units issue
  rates = zscore(rates_chg20.tail(WINDOW_Z))

  # vix = z( VIX 5d change )
  vix = close["VIX"].dropna()
  vix_chg5 = vix.pct_change(5)
  vix_z = zscore(vix_chg5.tail(WINDOW_Z))

  # goldFear = z(GLD 20d chg) - 0.5*z(UUP 20d chg)   (USD effect removal)
  gld_chg20 = close["GLD"].pct_change(20)
  gld_z = zscore(gld_chg20.tail(WINDOW_Z))
  goldFear = gld_z - 0.5 * usd

  featuresZ = {
    "x": float(np.nan_to_num(x, nan=0.0)),
    "y": float(np.nan_to_num(y, nan=0.0)),
    "rates": float(np.nan_to_num(rates, nan=0.0)),
    "usd": float(np.nan_to_num(usd, nan=0.0)),
    "vix": float(np.nan_to_num(vix_z, nan=0.0)),
    "goldFear": float(np.nan_to_num(goldFear, nan=0.0)),
  }

  # latency (minutes) vs "asOf"
  latency_min = round((now_et - asof_et).total_seconds() / 60.0, 1)

  payload = {
    "asOf": asof_et.isoformat(),
    "lastTradingDay": last_trading_day(now_et),
    "featuresZ": featuresZ,
    "intraday": fetch_intraday_prices(),
    "dataHealth": {"level": "OK", "source": "yfinance"},
    "latencyMin": latency_min,
    "eventWindowActive": event_window_active(now_et, events),
  }

  os.makedirs(os.path.dirname(out_path), exist_ok=True)
  with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

  print("[OK] Wrote latest.json", out_path)
  return 0

if __name__ == "__main__":
  raise SystemExit(main())
