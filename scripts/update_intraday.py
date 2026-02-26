#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import json
import math
import datetime
import urllib.request
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import yfinance as yf

ET = ZoneInfo("America/New_York")
UTC = datetime.timezone.utc

# Required intraday tickers (must have bars)
INTRADAY_TICKERS = {
    "VOO": "VOO",
    "QQQM": "QQQM",
    "XLP": "XLP",
    "UUP": "UUP",
    "GLD": "GLD",
}

# Optional (best-effort, may be sparse/unavailable)
OPTIONAL_1D = {
    "TNX": "^TNX",
    "VIX": "^VIX",
}

def _iso_utc(dt: datetime.datetime) -> str:
    return dt.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")

def _write_json(path: str, payload: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def _try_copy_previous(path: str) -> bool:
    # Reuse last good file from data branch to avoid breaking UI when yfinance is flaky.
    repo = os.environ.get("GITHUB_REPOSITORY")  # e.g. Quem332/Regime-Lookout
    if not repo:
        return False
    url = f"https://raw.githubusercontent.com/{repo}/data/public/data/intraday_latest.json"
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = r.read()
        if not data or len(data) < 50:
            return False
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        print("[intraday] reused previous intraday_latest.json from data branch")
        return True
    except Exception as e:
        print(f"[intraday] failed to reuse previous file: {e}")
        return False

def _zscore_last(series: pd.Series) -> float:
    s = series.dropna()
    if len(s) < 10:
        return 0.0
    mu = float(s.mean())
    sd = float(s.std(ddof=0))
    if sd == 0.0 or (not math.isfinite(sd)):
        return 0.0
    return float((s.iloc[-1] - mu) / sd)

def _corr_avg(prices_df: pd.DataFrame) -> float:
    # average pairwise correlation on returns for the last ~1 day (intraday)
    if prices_df is None or prices_df.empty:
        return 0.0
    rets = prices_df.pct_change().dropna(how="any")
    if len(rets) < 5:
        return 0.0
    corr = rets.corr()
    if corr.shape[0] < 2:
        return 0.0
    vals = corr.values
    n = vals.shape[0]
    # upper triangle excluding diagonal
    triu = vals[np.triu_indices(n, k=1)]
    triu = triu[np.isfinite(triu)]
    if triu.size == 0:
        return 0.0
    return float(np.mean(triu))

def _download_intraday(symbols: list[str], interval: str, period: str) -> pd.DataFrame | None:
    last_exc = None
    for _ in range(3):
        try:
            df = yf.download(
                symbols,
                period=period,
                interval=interval,
                auto_adjust=True,
                progress=False,
                group_by="ticker",
                threads=False,
            )
            if df is None or len(df) == 0:
                last_exc = RuntimeError("empty dataframe")
                continue
            return df
        except Exception as e:
            last_exc = e
    print(f"[intraday] download failed: {last_exc}")
    return None

def _extract_close(df: pd.DataFrame, symbols_by_key: dict[str, str]) -> pd.DataFrame:
    # yfinance group_by='ticker' -> MultiIndex columns: (ticker, field)
    closes = {}
    for key, sym in symbols_by_key.items():
        try:
            if isinstance(df.columns, pd.MultiIndex):
                s = df[(sym, "Close")]
            else:
                # single ticker fallback
                if "Close" in df.columns:
                    s = df["Close"]
                else:
                    s = None
            if s is None:
                continue
            closes[key] = pd.to_numeric(s, errors="coerce")
        except Exception:
            continue
    if not closes:
        return pd.DataFrame()
    out = pd.DataFrame(closes)
    out.index = pd.to_datetime(out.index)
    return out

def _load_prev_daily_fallback_from_data_branch() -> dict:
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        return {}
    url = f"https://raw.githubusercontent.com/{repo}/data/public/data/daily_latest.json"
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = json.loads(r.read().decode("utf-8"))
        prices = data.get("prices") or (data.get("daily") or {}).get("prices") or {}
        if not isinstance(prices, dict):
            return {}
        return prices
    except Exception as e:
        print(f"[intraday] daily_latest.json read failed: {e}")
        return {}

def _fetch_1d_last_prev(sym: str) -> dict | None:
    # Use auto_adjust=False to keep index values stable; handle multiindex/series variations.
    try:
        df = yf.download(
            sym,
            period="5d",
            interval="1d",
            auto_adjust=False,
            progress=False,
            threads=False,
        )
        if df is None or len(df) < 2:
            return None
        s = pd.to_numeric(df["Close"], errors="coerce").dropna()
        if len(s) < 2:
            return None
        last = float(s.iloc[-1])
        prev = float(s.iloc[-2])
        if not (math.isfinite(last) and math.isfinite(prev)) or prev == 0:
            return None
        return {"last": last, "prevClose": prev, "changePct": (last - prev) / prev}
    except Exception:
        return None

def _build_daily_fallback(repo_root: str) -> dict:
    # 1) from data-branch daily_latest.json if it has prices
    out: dict = {}
    prices = _load_prev_daily_fallback_from_data_branch()
    for k in ["TNX", "^TNX"]:
        if isinstance(prices.get(k), dict):
            out[k] = prices[k]
    for k in ["VIX", "^VIX"]:
        if isinstance(prices.get(k), dict):
            out[k] = prices[k]

    # 2) yfinance 1D direct if still missing
    if not any(k in out for k in ["TNX", "^TNX"]):
        p = _fetch_1d_last_prev("^TNX")
        if isinstance(p, dict):
            out["TNX"] = p
            out["^TNX"] = p
    if not any(k in out for k in ["VIX", "^VIX"]):
        p = _fetch_1d_last_prev("^VIX")
        if isinstance(p, dict):
            out["VIX"] = p
            out["^VIX"] = p

    # 3) carry-forward from previous intraday_latest.json in working tree, if present
    try:
        p = os.path.join(repo_root, "public", "data", "intraday_latest.json")
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                j = json.load(f)
            prev = (j.get("dailyFallback") or (j.get("intraday") or {}).get("dailyFallback") or {})
            if isinstance(prev, dict):
                for k in ["TNX","^TNX","VIX","^VIX"]:
                    if k not in out and isinstance(prev.get(k), dict):
                        out[k] = prev[k]
    except Exception:
        pass

    return out

def main() -> None:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    out_path = os.path.join(repo_root, "public", "data", "intraday_latest.json")

    now_et = datetime.datetime.now(ET).replace(microsecond=0)

    interval = os.environ.get("INTRADAY_INTERVAL", "15m")
    period = os.environ.get("INTRADAY_PERIOD", "5d")

    df = _download_intraday(list(INTRADAY_TICKERS.values()), interval=interval, period=period)
    if df is None:
        if _try_copy_previous(out_path):
            return
        raise SystemExit("intraday download failed")

    close = _extract_close(df, INTRADAY_TICKERS)
    # Require bars only for required symbols
    req = close[list(INTRADAY_TICKERS.keys())].dropna(how="any")
    if len(req) < 2:
        # keep previous file (degraded)
        if _try_copy_previous(out_path):
            return
        raise SystemExit("insufficient intraday bars")

    tail = req.tail(80)
    asof_ts = tail.index[-1]
    latency_min = int(max(0, round((now_et - asof_ts.tz_localize(ET) if asof_ts.tzinfo is None else now_et - asof_ts.astimezone(ET)).total_seconds() / 60)))

    # Basic intraday indicators
    z_short = _zscore_last(tail["VOO"].pct_change().dropna())
    corr_avg = _corr_avg(tail)
    corr_surge = bool(corr_avg >= 0.8)

    prices_payload = {
        "ts": [t.to_pydatetime().replace(tzinfo=ET).isoformat() for t in tail.index],
        "close": {k: [float(x) for x in tail[k].values] for k in tail.columns},
    }

    daily_fallback = _build_daily_fallback(repo_root)

    # Ensure optional indices (^VIX/^TNX) are available to the UI even when intraday bars are unavailable.
    # We stitch the latest daily close into the intraday series as a flat (constant) line.
    try:
        n = len(prices_payload.get("ts") or [])
        if n > 0:
            def _fb_last(sym: str):
                d = daily_fallback.get(sym) or daily_fallback.get(sym.replace("^","")) or None
                if isinstance(d, dict) and isinstance(d.get("last"), (int, float)) and math.isfinite(float(d["last"])):
                    return float(d["last"])
                return None
            def _fb_prev(sym: str):
                d = daily_fallback.get(sym) or daily_fallback.get(sym.replace("^","")) or None
                if isinstance(d, dict) and isinstance(d.get("prevClose"), (int, float)) and math.isfinite(float(d["prevClose"])):
                    return float(d["prevClose"])
                return None

            for sym in ["^VIX", "^TNX"]:
                if sym not in prices_payload["close"]:
                    lv = _fb_last(sym)
                    if lv is not None:
                        prices_payload["close"][sym] = [lv] * n

            # Optional: attach prevClose map for more accurate "vs prev close" computations.
            prev_map = {}
            for sym in ["VOO","QQQM","XLP","UUP","GLD","^VIX","^TNX"]:
                pv = _fb_prev(sym)
                if pv is not None:
                    prev_map[sym] = pv
            if prev_map:
                prices_payload["prevClose"] = prev_map
    except Exception as e:
        print(f"[intraday] warning: optional indices stitch failed: {e}")

    payload = {
        "schemaVersion": "2.3",
        "asOf": asof_ts.to_pydatetime().replace(tzinfo=ET).isoformat(),
        "intervalUsed": interval,
        "latencyMin": latency_min,
        "intraday": {
            "zShort": float(np.nan_to_num(z_short, nan=0.0)),
            "corrAvg": float(np.nan_to_num(corr_avg, nan=0.0)),
            "corrSurge": corr_surge,
            "intervalUsed": interval,
            "prices": prices_payload,
            "dailyFallback": daily_fallback,
        },
        # backward compat
        "dailyFallback": daily_fallback,
        "dataHealth": {"level": "OK", "source": "yfinance"},
        "fetchedAt": now_et.isoformat(),
    }

    _write_json(out_path, payload)
    print("[OK] Wrote intraday_latest.json", out_path)

if __name__ == "__main__":
    main()
