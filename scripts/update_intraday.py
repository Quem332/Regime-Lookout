import os
import json

import urllib.request

def _write_stub(path: str, reason: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    stub = {
        'schema': 'intraday.v1',
        'asOf': None,
        'status': 'unavailable',
        'reason': reason,
        'generatedAt': datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z'),
    }
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(stub, f, ensure_ascii=False, separators=(',', ':'))

def _try_copy_previous(path: str) -> bool:
    # Try to reuse last good file from data branch to avoid breaking UI when yfinance is flaky.
    repo = os.environ.get('GITHUB_REPOSITORY')  # e.g. Quem332/Regime-Lookout
    if not repo:
        return False
    url = f'https://raw.githubusercontent.com/{repo}/data/public/data/intraday_latest.json'
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = r.read()
        if not data or len(data) < 20:
            return False
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(data)
        print('[intraday] reused previous intraday_latest.json from data branch')
        return True
    except Exception as e:
        print(f'[intraday] failed to reuse previous file: {e}')
        return False
import datetime
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import yfinance as yf

def _download_single_1d(ticker: str, days_back: int = 30):
    start = datetime.datetime.now(tz=ET) - datetime.timedelta(days=days_back)
    end = datetime.datetime.now(tz=ET)
    try:
        df = yf.download(
            [ticker],
            start=start.date().isoformat(),
            end=(end.date() + datetime.timedelta(days=1)).isoformat(),
            interval="1d",
            auto_adjust=False,
            progress=False,
            group_by="ticker",
            threads=False,
        )
        if df is None or len(df) == 0:
            return None
        if "Close" in df.columns:
            s = df["Close"]
        elif hasattr(df.columns, "get_level_values") and ticker in df.columns.get_level_values(0):
            s = df[ticker]["Close"]
        else:
            return None
        s = s.dropna()
        if len(s) < 2:
            return None
        last = float(s.iloc[-1])
        prev = float(s.iloc[-2])
        if prev == 0 or not (last == last and prev == prev):
            return None
        return {"last": last, "prevClose": prev, "changePct": float((last - prev) / prev)}
    except Exception:
        return None


def _fred_last_prev(series_id: str):
    key = os.environ.get("FRED_API_KEY") or os.environ.get("FRED_KEY")
    if not key:
        return None
    import urllib.parse, urllib.request
    url = "https://api.stlouisfed.org/fred/series/observations?" + urllib.parse.urlencode({
        "series_id": series_id,
        "api_key": key,
        "file_type": "json",
        "sort_order": "desc",
        "limit": 10,
    })
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            j = json.loads(r.read().decode("utf-8"))
        obs = j.get("observations") or []
        vals = []
        for o in obs:
            v = o.get("value")
            try:
                fv = float(v)
                if fv == fv:
                    vals.append(fv)
            except Exception:
                continue
        if len(vals) < 2:
            return None
        return (vals[0], vals[1])
    except Exception:
        return None


def _build_daily_fallback(repo_root: str):
    # Prefer daily_latest.json prices if present; else fetch 1D for TNX/VIX.
    out = {}
    # 1) read daily_latest.json
    try:
        p = os.path.join(repo_root, "public", "data", "daily_latest.json")
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                j = json.load(f)
            prices = j.get("prices") or {}
            for k in ["TNX", "^TNX", "VIX", "^VIX"]:
                v = prices.get(k)
                if isinstance(v, dict) and isinstance(v.get("last"), (int, float)) and isinstance(v.get("prevClose"), (int, float)):
                    out[k] = {"last": float(v["last"]), "prevClose": float(v["prevClose"]), "changePct": float(v.get("changePct", 0.0))}
    except Exception:
        pass

    # 2) yfinance 1D fallback
    if "TNX" not in out and "^TNX" not in out:
        v = _download_single_1d("^TNX")
        if v: 
            out["^TNX"] = v
            out["TNX"] = v
    if "VIX" not in out and "^VIX" not in out:
        v = _download_single_1d("^VIX")
        if v:
            out["^VIX"] = v
            out["VIX"] = v

    # 3) last resort: FRED (requires key)
    if ("TNX" not in out and "^TNX" not in out):
        fp = _fred_last_prev("DGS10")
        if fp is not None:
            last, prev = fp
            # DGS10 in percent; TNX usually yield*10
            last10 = float(last) * 10.0
            prev10 = float(prev) * 10.0
            if prev10 != 0:
                out["TNX"] = out["^TNX"] = {"last": last10, "prevClose": prev10, "changePct": float((last10 - prev10)/prev10)}
    if ("VIX" not in out and "^VIX" not in out):
        fp = _fred_last_prev("VIXCLS")
        if fp is not None:
            last, prev = fp
            lastv = float(last); prevv=float(prev)
            if prevv != 0:
                out["VIX"] = out["^VIX"] = {"last": lastv, "prevClose": prevv, "changePct": float((lastv - prevv)/prevv)}

    # 4) carry forward from previous intraday_latest.json in this repo (if exists)
    try:
        p = os.path.join(repo_root, "public", "data", "intraday_latest.json")
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                j = json.load(f)
            prev = j.get("dailyFallback") or {}
            for k in ["TNX","^TNX","VIX","^VIX"]:
                if k not in out and isinstance(prev.get(k), dict):
                    out[k] = prev[k]
    except Exception:
        pass

    return out



# ============================================================
# Intraday data builder (market hours / on-demand)
#
# Writes: public/data/intraday_latest.json
# - schemaVersion: 2.3
# - asOf: ET timestamp for the most recent intraday bar
# - intraday: { intervalUsed, prices, zShort, corrAvg, corrSurge }
#
# NOTE
# - We keep this intentionally lightweight: UI/engine will decide how to
#   combine it with Daily regime outputs.
# ============================================================

ET = ZoneInfo("America/New_York")

INTRADAY_TICKERS = {
    "VOO": "VOO",
    "QQQM": "QQQM",
    "XLP": "XLP",
    "UUP": "UUP",
    "GLD": "GLD",
}


def _zscore_last(series: pd.Series) -> float:
    s = series.dropna()
    if len(s) < 10:
        return 0.0
    mu = float(s.mean())
    sd = float(s.std(ddof=0))
    if sd == 0.0 or np.isnan(sd):
        return 0.0
    return float((s.iloc[-1] - mu) / sd)


def _corr_avg(prices_df: pd.DataFrame) -> float:
    # Correlation across assets on returns
    rets = prices_df.pct_change().dropna(how="any")
    if len(rets) < 10:
        return 0.0
    c = rets.corr().values
    # exclude diagonal
    n = c.shape[0]
    if n <= 1:
        return 0.0
    mask = ~np.eye(n, dtype=bool)
    vals = c[mask]
    vals = vals[np.isfinite(vals)]
    if len(vals) == 0:
        return 0.0
    return float(np.clip(vals.mean(), -1.0, 1.0))


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    out_path = os.path.join(repo_root, "public", "data", "intraday_latest.json")

    now_et = datetime.datetime.now(tz=ET)

    # Use 15m bars, enough for 1-5 day window without hammering rate limits
    interval = "15m"
    period = "5d"

    df = None
    last_exc = None
    for _try in range(3):
        try:
            df = yf.download(
                list(INTRADAY_TICKERS.values()),
                period=period,
                interval=interval,
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
            # simple backoff to avoid hammering Yahoo
            try:
                import time
                time.sleep(0.8 * (2 ** _try))
            except Exception:
                pass

    if df is None or len(df) == 0:
        # Yahoo sometimes blocks CI or returns non-JSON/HTML (JSONDecodeError).
        # We MUST NOT fail the workflow: keep previous file if present, otherwise write
        # a minimal stub so UI can show "data unavailable" instead of breaking.
        msg = str(last_exc or "yfinance empty")[:180]

        stub = {
            "schemaVersion": "2.3",
            "asOf": now_et.isoformat(),
            "fetchedAt": now_et.isoformat(),
            "dataHealth": {"level": "DOWN", "source": "yfinance", "msg": msg},
            "intraday": None,
        }

        os.makedirs(os.path.dirname(out_path), exist_ok=True)

        if os.path.exists(out_path):
            try:
                with open(out_path, "r", encoding="utf-8") as f:
                    prev = json.load(f)
                prev["fetchedAt"] = now_et.isoformat()
                prev["dataHealth"] = {"level": "DEGRADED", "source": "cache", "msg": msg}
                # keep previous intraday payload as-is
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(prev, f, ensure_ascii=False, indent=2)
                print("[WARN] Intraday fetch failed; kept previous intraday_latest.json (DEGRADED)")
                return
            except Exception as e:
                stub["dataHealth"] = {"level": "DOWN", "source": "cache", "msg": f"failed to read previous file: {e}"[:180]}

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(stub, f, ensure_ascii=False, indent=2)
        print("[WARN] Intraday fetch failed; wrote stub intraday_latest.json (DOWN)")
        return

    close = pd.DataFrame(index=df.index)
    for k, t in INTRADAY_TICKERS.items():
        if t in df.columns.get_level_values(0):
            close[k] = df[t]["Close"]
    close = close.dropna(how="all")
    close = close.dropna(how="any")
    if len(close) < 20:
        raise RuntimeError("Insufficient intraday bars")

    asof_ts = close.index[-1].to_pydatetime().replace(tzinfo=ET)
    latency_min = round((now_et - asof_ts).total_seconds() / 60.0, 1)

    # zShort: short-horizon position of risk-on ratio within last ~2 sessions
    ratio = np.log(close["QQQM"] / close["XLP"]).tail(52)  # ~13h on 15m
    z_short = _zscore_last(ratio)

    # corrAvg: average cross-asset correlation on returns
    corr_avg = _corr_avg(close.tail(80))
    corr_surge = bool(corr_avg >= 0.80)

    # Minimal prices payload for UI sparkline (last 80)
    tail = close.tail(80)
    prices_payload = {
        "ts": [t.to_pydatetime().replace(tzinfo=ET).isoformat() for t in tail.index],
        "close": {k: [float(x) for x in tail[k].values] for k in tail.columns},
    }

    payload = {
        "schemaVersion": "2.3",
        "asOf": asof_ts.isoformat(),
        "intervalUsed": interval,
        "latencyMin": latency_min,
        "intraday": {
            "zShort": float(np.nan_to_num(z_short, nan=0.0)),
            "corrAvg": float(np.nan_to_num(corr_avg, nan=0.0)),
            "corrSurge": corr_surge,
            "intervalUsed": interval,
            "prices": prices_payload,
        },
        "dataHealth": {"level": "OK", "source": "yfinance"},
        "fetchedAt": now_et.isoformat(),
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print("[OK] Wrote intraday_latest.json", out_path)


if __name__ == "__main__":
    main()
