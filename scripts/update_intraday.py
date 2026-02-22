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
