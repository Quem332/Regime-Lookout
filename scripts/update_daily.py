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
    """Fetch daily adjusted close data.

    Primary: yfinance (with retries, threads disabled for stability on CI)
    Fallback: Stooq daily CSV (for US ETFs) to avoid total failure when Yahoo blocks CI.
    If both fail, we fall back to the previously written daily_latest.json (if present)
    and raise only if nothing exists.
    """
    end = datetime.datetime.now(tz=ET)
    start = end - datetime.timedelta(days=days_back)

    tickers = list(TICKERS.values())

    # --- 1) Try yfinance (retry) ---
    last_exc = None
    df = None
    for _try in range(3):
        try:
            df = yf.download(
                tickers,
                start=start.date().isoformat(),
                end=(end.date() + datetime.timedelta(days=1)).isoformat(),
                interval="1d",
                auto_adjust=True,
                progress=False,
                group_by="ticker",
                threads=False,
            )
            if df is not None and len(df) > 0:
                break
        except Exception as e:
            last_exc = e
            df = None

    close = None
    if df is not None and len(df) > 0:
        close = pd.DataFrame(index=df.index)
        for k, t in TICKERS.items():
            try:
                if hasattr(df.columns, "get_level_values") and t in df.columns.get_level_values(0):
                    close[k] = df[t]["Close"]
                else:
                    # Some yfinance versions return single-level columns
                    if "Close" in df.columns and k in df.columns:
                        close[k] = df[k]["Close"]
            except Exception:
                pass
        close = close.dropna(how="all")

    # --- 2) Fallback to Stooq if required cols missing or yfinance empty ---
    def _stooq_symbol(sym: str) -> str:
        # Stooq uses lower-case symbols; US equities/ETFs often have ".us"
        s = sym.replace("^", "").lower()
        if sym.startswith("^"):
            return s  # indices sometimes exist as plain symbols
        return f"{s}.us"

    def _read_stooq_close(sym: str) -> pd.Series | None:
        url = f"https://stooq.com/q/d/l/?s={_stooq_symbol(sym)}&i=d"
        try:
            d = pd.read_csv(url)
            if d is None or len(d) == 0:
                return None
            if "Date" not in d.columns or "Close" not in d.columns:
                return None
            d["Date"] = pd.to_datetime(d["Date"], errors="coerce")
            d = d.dropna(subset=["Date"]).sort_values("Date")
            s = pd.Series(d["Close"].values, index=pd.DatetimeIndex(d["Date"]))
            s = s.astype(float, errors="ignore")
            return s
        except Exception:
            return None

    req_syms = ["QQQM", "XLP", "VOO", "UUP", "GLD"]
    need_fallback = close is None or any((c not in close.columns) for c in req_syms) or len(close) == 0
    if need_fallback:
        stooq_close = pd.DataFrame()
        for k in req_syms:
            ser = _read_stooq_close(TICKERS[k])
            if ser is not None:
                stooq_close[k] = ser
        stooq_close = stooq_close.sort_index()
        if close is None or len(close) == 0:
            close = stooq_close
        else:
            # fill missing required columns from stooq
            for k in req_syms:
                if k not in close.columns and k in stooq_close.columns:
                    close[k] = stooq_close[k]
            close = close.sort_index()

    if close is None or len(close) == 0:
        # --- 3) Final fallback: keep last file if exists (avoid 404) ---
        raise RuntimeError("No daily data fetched from yfinance/stooq")

    return close


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
    try:
        close = _download_daily()
        data_source = "yfinance"
    except Exception as e:
        # Try to keep previous output to avoid breaking UI/Actions
        if os.path.exists(out_path):
            with open(out_path, "r", encoding="utf-8") as f:
                prev = json.load(f)
            prev["dataHealth"] = {"level": "DEGRADED", "source": "cache", "msg": str(e)[:180]}
            prev["fetchedAt"] = now_et.isoformat()
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(prev, f, ensure_ascii=False, indent=2)
            print("[WARN] Daily fetch failed; kept previous daily_latest.json")
            return
        raise

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
        "dataHealth": {"level": "OK", "source": data_source},
        "latencyMin": latency_min,
        "fetchedAt": now_et.isoformat(),
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print("[OK] Wrote daily_latest.json", out_path)


if __name__ == "__main__":
    main()
