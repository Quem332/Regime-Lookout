import os
import json
import datetime
import urllib.request
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import yfinance as yf

ET = ZoneInfo("America/New_York")

REQUIRED = {
    "VOO": "VOO",
    "QQQM": "QQQM",
    "XLP": "XLP",
    "UUP": "UUP",
    "GLD": "GLD",
}

OPTIONAL = {
    "TNX": "^TNX",
    "VIX": "^VIX",
}

MIN_BARS_REQUIRED = 20   # ~5h on 15m, enough for UI bars
TAIL_BARS = 80           # UI payload tail length


def _write_stub(path: str, reason: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    stub = {
        "schemaVersion": "2.3",
        "asOf": None,
        "intervalUsed": "15m",
        "latencyMin": None,
        "intraday": {
            "zShort": 0.0,
            "corrAvg": 0.0,
            "corrSurge": False,
            "intervalUsed": "15m",
            "prices": {"ts": [], "close": {}},
            "dailyFallback": {},
        },
        "dataHealth": {"level": "UNAVAILABLE", "source": "yfinance", "reason": reason},
        "fetchedAt": datetime.datetime.now(tz=ET).isoformat(),
    }
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(stub, f, ensure_ascii=False, indent=2)


def _try_copy_previous(path: str) -> bool:
    """
    Reuse last good file from data branch so UI doesn't freeze when yfinance is flaky.
    """
    repo = os.environ.get("GITHUB_REPOSITORY")  # e.g. Quem332/Regime-Lookout
    if not repo:
        return False
    url = f"https://raw.githubusercontent.com/{repo}/data/public/data/intraday_latest.json"
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = r.read()
        if not data or len(data) < 200:
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
    s = pd.to_numeric(series, errors="coerce").dropna()
    if len(s) < 10:
        return 0.0
    m = float(s.mean())
    sd = float(s.std(ddof=0))
    if not np.isfinite(sd) or sd <= 1e-12:
        return 0.0
    return float((s.iloc[-1] - m) / sd)


def _corr_avg(close_df: pd.DataFrame) -> float:
    try:
        r = close_df.pct_change().dropna(how="any")
        if len(r) < 20 or r.shape[1] < 2:
            return 0.0
        c = r.corr().values
        if c.size == 0:
            return 0.0
        # mean of upper triangle (excluding diag)
        n = c.shape[0]
        vals = []
        for i in range(n):
            for j in range(i + 1, n):
                v = c[i, j]
                if np.isfinite(v):
                    vals.append(float(v))
        return float(np.mean(vals)) if vals else 0.0
    except Exception:
        return 0.0


def _daily_last_prev(symbol: str):
    """
    Fetch last and previous daily closes for a Yahoo symbol.
    Returns {"last": float, "prevClose": float} or None.

    Notes:
    - For indices like ^TNX/^VIX, yfinance intraday can be sparse. We use 1d bars here.
    - Use auto_adjust=False for indices to avoid occasional empty/NaN series.
    """
    try:
        df = yf.download(
            symbol,
            period="30d",
            interval="1d",
            auto_adjust=False,
            progress=False,
            threads=False,
        )
        if df is None or len(df) == 0:
            return None

        # Common shapes:
        # 1) Single ticker (string) -> columns: Open/High/Low/Close/Adj Close/Volume
        # 2) MultiIndex can still appear in some edge cases; handle conservatively
        s = None
        try:
            if "Close" in df.columns:
                s = df["Close"]
            elif hasattr(df.columns, "get_level_values"):
                # MultiIndex: (Ticker, Field)
                if "Close" in df.columns.get_level_values(-1):
                    # try to pick the first "Close" column
                    close_cols = [c for c in df.columns if isinstance(c, tuple) and c[-1] == "Close"]
                    if close_cols:
                        s = df[close_cols[0]]
        except Exception:
            s = None

        if s is None:
            return None

        s = pd.to_numeric(s, errors="coerce").dropna()
        if len(s) < 2:
            return None

        last = float(s.iloc[-1])
        prev = float(s.iloc[-2])
        if not (np.isfinite(last) and np.isfinite(prev)):
            return None
        return {"last": last, "prevClose": prev}
    except Exception:
        return None


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    out_path = os.path.join(repo_root, "public", "data", "intraday_latest.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    now_et = datetime.datetime.now(tz=ET)
    interval = "15m"

    req_symbols = list(REQUIRED.values())
    opt_symbols = list(OPTIONAL.values())

    # Fetch required set
    req_df = yf.download(
        req_symbols,
        period="5d",
        interval=interval,
        auto_adjust=True,
        progress=False,
        threads=False,
        group_by="column",
    )

    if req_df is None or len(req_df) == 0:
        if _try_copy_previous(out_path):
            return
        _write_stub(out_path, "empty required intraday response")
        return

    # Extract Close frame for required
    close_req = None
    try:
        if isinstance(req_df.columns, pd.MultiIndex):
            close_req = req_df["Close"]
        else:
            close_req = req_df[["Close"]].rename(columns={"Close": req_symbols[0]}) if "Close" in req_df.columns else None
    except Exception:
        close_req = None

    if close_req is None or len(close_req) == 0:
        if _try_copy_previous(out_path):
            return
        _write_stub(out_path, "missing Close for required")
        return

    # Rename required columns to UI keys (VOO, QQQM, ...)
    inv_required = {v: k for k, v in REQUIRED.items()}
    close_req = close_req.rename(columns=inv_required)
    close_req = close_req.dropna(how="all")
    # Require completeness only on required tickers
    close_req_clean = close_req.dropna(subset=list(REQUIRED.keys()), how="any")

    if close_req_clean is None or len(close_req_clean) < MIN_BARS_REQUIRED:
        # yfinance sometimes returns too few bars (or NaNs). Reuse previous to avoid breaking UI.
        if _try_copy_previous(out_path):
            return
        _write_stub(out_path, f"insufficient intraday bars (required<{MIN_BARS_REQUIRED})")
        return

    # Tail index based on required clean series
    tail_idx = close_req_clean.index[-TAIL_BARS:]
    close_req_tail = close_req_clean.reindex(tail_idx)

    # Optional fetch (TNX/VIX) – best effort, won't block output
    close_opt_tail = pd.DataFrame(index=tail_idx)
    try:
        opt_df = yf.download(
            opt_symbols,
            period="5d",
            interval=interval,
            auto_adjust=True,
            progress=False,
            threads=False,
            group_by="column",
        )
        if opt_df is not None and len(opt_df) > 0:
            if isinstance(opt_df.columns, pd.MultiIndex):
                close_opt = opt_df["Close"]
            else:
                close_opt = None
            if close_opt is not None and len(close_opt) > 0:
                # rename to TNX/VIX keys
                inv_optional = {v: k for k, v in OPTIONAL.items()}
                close_opt = close_opt.rename(columns=inv_optional)
                close_opt = close_opt.reindex(tail_idx).ffill()
                # keep only cols with at least one finite value
                for c in list(close_opt.columns):
                    s = pd.to_numeric(close_opt[c], errors="coerce")
                    if not np.isfinite(s).any():
                        continue
                    close_opt_tail[c] = s
    except Exception as e:
        print(f"[intraday] optional fetch failed: {e}")

    # Combine tail closes
    close_tail = pd.concat([close_req_tail, close_opt_tail], axis=1)

    # Compute asOf from last available timestamp in required tail index
    asof_ts = pd.Timestamp(tail_idx[-1]).to_pydatetime().replace(tzinfo=ET)
    latency_min = int(round((now_et - asof_ts).total_seconds() / 60.0))

    # zShort on risk-on ratio (QQQM/XLP) – use required raw (cleaned)
    ratio = np.log(close_req_clean["QQQM"] / close_req_clean["XLP"]).tail(52)
    z_short = _zscore_last(ratio)

    corr_avg = _corr_avg(close_req_clean[list(REQUIRED.keys())].tail(80))
    corr_surge = bool(corr_avg >= 0.80)

    # Prices payload
    prices_payload = {
        "ts": [pd.Timestamp(t).to_pydatetime().replace(tzinfo=ET).isoformat() for t in tail_idx],
        "close": {
            k: [float(x) if np.isfinite(x) else None for x in pd.to_numeric(close_tail[k], errors="coerce").values]
            for k in close_tail.columns
        },
    }

    # Daily fallback for TNX/VIX (and both key variants for safety)
    daily_fallback = {}
    try:
        tnx = _daily_last_prev("^TNX")
        vix = _daily_last_prev("^VIX")
        if tnx:
            daily_fallback["TNX"] = tnx
            daily_fallback["^TNX"] = tnx
        if vix:
            daily_fallback["VIX"] = vix
            daily_fallback["^VIX"] = vix
    except Exception:
        daily_fallback = {}

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
            "dailyFallback": daily_fallback,
        },
        "dataHealth": {"level": "OK", "source": "yfinance"},
        "fetchedAt": now_et.isoformat(),
    }

    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print("[OK] Wrote intraday_latest.json", out_path)


if __name__ == "__main__":
    main()
