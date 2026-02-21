import os
import json
import datetime

import numpy as np
import pandas as pd
import yfinance as yf
from zoneinfo import ZoneInfo


# ============================================================
# Daily data builder (EOD / on-demand)
#
# Writes: public/data/daily_latest.json
# - schemaVersion: 2.3
# - asOf: ET timestamp
# - lastTradingDay: YYYY-MM-DD (ET)
# - featuresZ: the "canonical" (252D) z-features
# - periods: {"20D": {featuresZ}, "60D":{featuresZ}, "252D":{featuresZ}}
# - dataHealth + latency
#
# NOTE
# - We keep the *same feature definitions* as the original engine:
#   x, y, usd, rates, vix, goldFear
# - Only the z-score window changes per period.
# ============================================================

ET = ZoneInfo("America/New_York")

TICKERS = {
    "QQQM": "QQQM",
    "XLP": "XLP",
    "VOO": "VOO",
    "UUP": "UUP",
    "GLD": "GLD",
    "TNX": "^TNX",
    "VIX": "^VIX",
}


def _zscore(series: pd.Series) -> float:
    s = series.dropna()
    if len(s) < 5:
        return 0.0
    mu = float(s.mean())
    sd = float(s.std(ddof=0))
    if sd == 0.0 or np.isnan(sd):
        return 0.0
    return float((s.iloc[-1] - mu) / sd)


def _last_trading_day_et(now_et: datetime.datetime) -> str:
    # Simple rule: if today is Sat/Sun => last Fri.
    # If weekday, use today.
    d = now_et.date()
    if d.weekday() == 5:
        d = d - datetime.timedelta(days=1)
    elif d.weekday() == 6:
        d = d - datetime.timedelta(days=2)
    return d.isoformat()


def _download_daily(days_back: int = 420):
    end = datetime.datetime.now(tz=ET)
    start = end - datetime.timedelta(days=days_back)

    last_err = None
    for attempt in range(3):
        try:
            df = yf.download(
                list(TICKERS.values()),
                start=start.date().isoformat(),
                end=(end.date() + datetime.timedelta(days=1)).isoformat(),
                interval="1d",
                auto_adjust=True,
                progress=False,
                group_by="ticker",
                threads=False,
            )
            if df is None or len(df) == 0:
                raise RuntimeError("empty yfinance response")

            close = pd.DataFrame(index=df.index)
            for k, t in TICKERS.items():
                if hasattr(df.columns, "get_level_values") and t in df.columns.get_level_values(0):
                    close[k] = df[t]["Close"]
                else:
                    if "Close" in df.columns and k in df.columns:
                        close[k] = df[k]["Close"]

            close = close.dropna(how="all")
            if close is None or len(close) == 0:
                raise RuntimeError("no close series built")
            return close
        except Exception as e:
            last_err = e
            import time as _time
            _time.sleep(1.5 * (attempt + 1))

    print("[WARN] yfinance daily download failed:", repr(last_err))
    return None


def _compute_featuresZ(close: pd.DataFrame, z_window: int) -> dict:
    # Align required columns
    req = ["QQQM", "XLP", "VOO", "UUP", "GLD"]
    miss = [c for c in req if c not in close.columns]
    if miss:
        raise RuntimeError(f"Missing daily columns: {miss}")
    close = close.dropna(subset=req, how="any")
    if len(close) < max(z_window, 80):
        raise RuntimeError(f"Insufficient daily history: {len(close)} rows")

    # Feature definitions (same as legacy update_latest.py)
    ratio = np.log(close["QQQM"] / close["XLP"])  # risk-on vs staples
    x = _zscore(ratio.tail(z_window))

    voo_ret20 = close["VOO"].pct_change(20)
    y = _zscore(voo_ret20.tail(z_window))

    uup_chg20 = close["UUP"].pct_change(20)
    usd = _zscore(uup_chg20.tail(z_window))

    rates = 0.0
    if "TNX" in close.columns:
        tnx = close["TNX"].dropna()
        rates_chg20 = tnx.pct_change(20)
        rates = _zscore(rates_chg20.tail(z_window))

    vix_z = 0.0
    if "VIX" in close.columns:
        vix = close["VIX"].dropna()
        vix_chg5 = vix.pct_change(5)
        vix_z = _zscore(vix_chg5.tail(z_window))

    gld_chg20 = close["GLD"].pct_change(20)
    gld_z = _zscore(gld_chg20.tail(z_window))
    goldFear = gld_z - 0.5 * usd

    return {
        "x": float(np.nan_to_num(x, nan=0.0)),
        "y": float(np.nan_to_num(y, nan=0.0)),
        "rates": float(np.nan_to_num(rates, nan=0.0)),
        "usd": float(np.nan_to_num(usd, nan=0.0)),
        "vix": float(np.nan_to_num(vix_z, nan=0.0)),
        "goldFear": float(np.nan_to_num(goldFear, nan=0.0)),
    }


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    out_path = os.path.join(repo_root, "public", "data", "daily_latest.json")

    now_et = datetime.datetime.now(tz=ET)
    close = _download_daily()
    if close is None or len(close) == 0:
        prev_path = os.path.join('public','data','daily_latest.json')
        if os.path.exists(prev_path):
            print('[WARN] Keeping previous daily_latest.json (no new data)')
            return
        raise RuntimeError('No daily data fetched from yfinance')

    # Use the latest row timestamp as asOf (ET)
    asof_ts = close.index[-1].to_pydatetime().replace(tzinfo=ET)
    latency_min = round((now_et - asof_ts).total_seconds() / 60.0, 1)

    periods = {
        "20D": 20,
        "60D": 60,
        "252D": 252,
    }

    periods_payload = {}
    for key, win in periods.items():
        periods_payload[key] = {"featuresZ": _compute_featuresZ(close, win)}

    payload = {
        "schemaVersion": "2.3",
        "asOf": asof_ts.isoformat(),
        "lastTradingDay": _last_trading_day_et(now_et),
        "featuresZ": periods_payload["252D"]["featuresZ"],
        "periods": periods_payload,
        "dataHealth": {"level": "OK", "source": "yfinance"},
        "latencyMin": latency_min,
        "fetchedAt": now_et.isoformat(),
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print("[OK] Wrote daily_latest.json", out_path)


if __name__ == "__main__":
    main()
