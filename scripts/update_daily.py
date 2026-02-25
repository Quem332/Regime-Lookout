import os
import json
import urllib.request

def _write_stub_daily(path: str, reason: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    stub = {
        'schema': 'daily.v1',
        'asOf': None,
        'status': 'unavailable',
        'reason': reason,
        'generatedAt': datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z'),
    }
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(stub, f, ensure_ascii=False, separators=(',', ':'))

def _try_copy_previous_daily(path: str) -> bool:
    repo = os.environ.get('GITHUB_REPOSITORY')
    if not repo:
        return False
    url = f'https://raw.githubusercontent.com/{repo}/data/public/data/daily_latest.json'
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            data = r.read()
        if not data or len(data) < 20:
            return False
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(data)
        print('[daily] reused previous daily_latest.json from data branch')
        return True
    except Exception as e:
        print(f'[daily] failed to reuse previous file: {e}')
        return False
import datetime
import math

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


# ---------- Daily engine (Python port; keeps parity with src/core/engine.daily.js) ----------

SCENARIOS = {
    "1": [-1.0, 0.0, +1.0, 0.0, 0.0, 0.0],
    "2": [0.0, -2.0, 0.0, +1.0, +1.0, 0.0],
    "3": [+1.0, 0.0, +1.0, +0.5, 0.0, 0.0],
    "4": [0.0, +1.0, -1.0, -1.0, 0.0, 0.0],
    "5": [0.0, +1.0, 0.0, -1.0, 0.0, 0.0],
    "6": [-0.5, -0.5, +1.0, 0.0, 0.0, +1.0],
}

def _clamp(v, lo, hi):
    return max(lo, min(hi, v))

def _hard_gate_pass(k: str, V):
    x, y, rates, usd, vix, goldFear = V
    kk = int(k)
    if kk == 1:
        return x < 0 and rates >= 0.5
    if kk == 2:
        return y < -1.0 and vix >= 0.5 and usd >= 0.5
    if kk == 3:
        return x > 0.5 and (rates >= 0.5 or usd >= 0.5)
    if kk == 4:
        return y > 0 and rates <= -0.5 and usd <= -0.5
    if kk == 5:
        return y > 0.5 and usd <= -0.5
    if kk == 6:
        return rates >= 0.5 and goldFear >= 0.5 and (x < 0 or y < 0)
    return False

def _euclid(V, S):
    return float(np.sqrt(np.sum((np.array(V, dtype=float) - np.array(S, dtype=float)) ** 2)))

def _compute_probs_spec(V):
    keys_all = list(SCENARIOS.keys())
    passed = [k for k in keys_all if _hard_gate_pass(k, V)]
    cand = passed if len(passed) > 0 else keys_all

    raw = {}
    for k in cand:
        d = _euclid(V, SCENARIOS[k])
        raw[k] = math.exp(-d) if math.isfinite(d) else 0.0

    s = sum(raw.values())
    probs = {k: 0.0 for k in keys_all}
    if s <= 0 or (not math.isfinite(s)):
        u = 1.0 / max(1, len(keys_all))
        for k in keys_all:
            probs[k] = u
    else:
        for k in cand:
            probs[k] = raw[k] / s
    return probs, passed

def _entropy_norm(probs: dict):
    vals = list(probs.values())
    K = len(vals)
    H = 0.0
    for p in vals:
        if p > 0:
            H += -p * math.log(p, 2)
    return (H / math.log(K, 2)) if K > 1 else 0.0

def _compute_C_spec(data_ok: bool, corr_avg: float, corr_surge: bool, z_short: float, V, probs: dict):
    # Hard caps
    if not data_ok:
        return 30, {"data": True, "panic": False, "corr": False}

    x, y, rates, usd, vix, goldFear = V

    panic_confirmed = (y < -1.0 and usd > 0.5 and vix > 0.5)
    if panic_confirmed:
        return 35, {"data": False, "panic": True, "corr": False}

    if corr_avg > 0.8:
        return 40, {"data": False, "panic": False, "corr": True}

    C = 100.0

    # Top scenario
    topk = max(probs.items(), key=lambda kv: kv[1])[0] if probs else None

    # 1) entropy spread
    H = _entropy_norm(probs)
    if H > 0.7:
        C -= 6

    # 2) divergence
    divergence = (abs(y) > 1.0 and abs(vix) < 0.3)
    if divergence:
        C -= 6

    # 3) VIX mismatch
    vix_mismatch = (y < 0 and vix < 0.2)
    if vix_mismatch:
        C -= 6

    # 4) haven divergence
    haven_div = (topk in ("4","5") and usd > 0.4 and goldFear < -0.7 and vix < 0.5)
    if haven_div:
        C -= 8

    # 5) panic w/o gold
    panic_no_gold = (topk == "2" and usd > 0.4 and vix > 0.3 and goldFear < -0.2)
    if panic_no_gold:
        C -= 6

    # 6) rates headwind
    rates_headwind = (topk in ("4","5") and y > 0.5 and rates > 0.8)
    if rates_headwind:
        C -= 6

    # 7) fx shock mismatch
    fx_shock = (usd > 0.8 and vix < 0.2 and abs(y) < 0.6)
    if fx_shock:
        C -= 6

    zabs = abs(z_short) if math.isfinite(z_short) else 0.0
    if vix > 1.2:
        C -= 8
    if corr_surge:
        C -= 10
    if zabs > 1.5:
        C -= 6

    conflict = 0
    is_risk_on = topk in ("4","5")
    is_panic = topk == "2"
    is_stag = topk == "6"
    if is_risk_on:
        if usd > 0.6: conflict += 1
        if goldFear < -0.7: conflict += 1
        if vix > 0.7: conflict += 1
        if rates > 0.9: conflict += 1
    elif is_panic:
        if vix < 0.3: conflict += 1
        if usd < 0.2: conflict += 1
    elif is_stag:
        if rates < 0.5: conflict += 1
        if y > 0.3: conflict += 1

    if y < -0.8 and vix < 0.2: conflict += 1
    if vix > 1.2 and abs(y) < 0.4: conflict += 1

    conflict = int(_clamp(conflict, 0, 4))
    if conflict > 0:
        C -= conflict * 4
        if conflict >= 3:
            C -= 4

    return int(round(_clamp(C, 5, 100))), {"data": False, "panic": False, "corr": False}

def _compute_regime7_spec(passed_keys, Cfinal: int, V):
    if not passed_keys or len(passed_keys) == 0:
        return "7C"
    if Cfinal < 45:
        return "7B"
    xy_mag = math.sqrt(V[0]**2 + V[1]**2)
    if xy_mag < 0.5:
        return "7A"
    return None

def _compute_score_spec(probs: dict, Cfinal: int, corr_avg: float, V, regime7):
    p_top = max(probs.values()) if probs else 0.0
    p_eff = p_top * (Cfinal / 100.0)
    base = p_eff * 100.0

    x, y, _, usd, vix, _ = V
    Icorr = 1 if corr_avg > 0.8 else 0
    Ipanic = 1 if (y < -1.0 and usd > 0.5 and vix > 0.5) else 0
    Idefense = 1 if (x < 0 and y < 0) else 0
    penalty_raw = 25*Icorr + 15*Ipanic + 15*Idefense
    penalty_applied = penalty_raw * (Cfinal / 100.0)

    score = _clamp(base - penalty_applied, 0, 100)
    if regime7:
        score = min(score, 60)
    return int(round(score)), {"Icorr": Icorr, "Ipanic": Ipanic, "Idefense": Idefense}

def compute_today_pack(featuresZ: dict):
    # V in canonical order
    V = [
        float(featuresZ.get("x", 0.0)),
        float(featuresZ.get("y", 0.0)),
        float(featuresZ.get("rates", 0.0)),
        float(featuresZ.get("usd", 0.0)),
        float(featuresZ.get("vix", 0.0)),
        float(featuresZ.get("goldFear", 0.0)),
    ]
    probs, passed = _compute_probs_spec(V)
    Cfinal, caps = _compute_C_spec(True, 0.0, False, 0.0, V, probs)
    regime7 = _compute_regime7_spec(passed, Cfinal, V)

    score, flags = _compute_score_spec(probs, Cfinal, 0.0, V, regime7)

    # Scenario-specific confidence Ci: top scenario gets Cfinal; others scale by p/pTop
    p_top = max(probs.values()) if probs else 0.0
    probs_with_c = {}
    for k, p in probs.items():
        if p_top > 0:
            ci = int(round(_clamp(Cfinal * (p / p_top), 5, 100)))
        else:
            ci = int(round(_clamp(Cfinal, 5, 100)))
        probs_with_c[str(k)] = {"p": float(p), "c": ci}

    return {
        "score": int(score),
        "Cfinal": int(Cfinal),
        "regime7": regime7 or "--",
        "probs": probs_with_c,
        "caps": caps,
        "flags": flags,
        "vec": V,
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

    try:
        close = _download_daily()
        if close is None or len(close) == 0:
            raise RuntimeError("No daily data fetched from yfinance")

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

        # Compute engine outputs (score/Cfinal/regime7/probs{p,c}) for each period
        daily_pack = compute_today_pack(periods_payload["252D"]["featuresZ"])
        for key in periods_payload.keys():
            periods_payload[key]["daily"] = compute_today_pack(periods_payload[key]["featuresZ"])


        # Minimal price snapshot for UI (prevClose anchor for "today move" on indices like ^TNX/^VIX)
        prices_payload = {}
        try:
            # close is a DataFrame with columns like QQQM/XLP/VOO/UUP/GLD/TNX/VIX
            for k in close.columns:
                s = close[k].dropna()
                if len(s) < 2:
                    continue
                last = float(s.iloc[-1])
                prev = float(s.iloc[-2])
                if prev == 0 or not (last == last and prev == prev):
                    continue
                ch = (last - prev) / prev
                prices_payload[k] = {"last": last, "prevClose": prev, "changePct": float(ch)}
        except Exception:
            prices_payload = {}

        payload = {
            "schemaVersion": "2.3",
            "asOf": asof_ts.isoformat(),
            "lastTradingDay": _last_trading_day_et(now_et),
            "prices": prices_payload,
            "featuresZ": periods_payload["252D"]["featuresZ"],
            "daily": daily_pack,
            "periods": periods_payload,
            "dataHealth": {"level": "OK", "source": "yfinance"},
            "latencyMin": latency_min,
            "fetchedAt": now_et.isoformat(),
        }

        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        print("[OK] Wrote daily_latest.json", out_path)
        return

    except Exception as e:
        # Yahoo sometimes blocks CI or returns empty/HTML.
        # Do NOT fail the workflow: reuse previous file if possible, else write a stub.
        msg = str(e)[:180]
        print(f"[daily][WARN] build failed: {msg}")

        if os.path.exists(out_path):
            print("[daily] keeping existing daily_latest.json (no overwrite)")
            return

        # try reuse previous from data branch (best effort)
        if _try_copy_previous_daily(out_path):
            return

        _write_stub_daily(out_path, msg)
        print("[daily] wrote stub daily_latest.json to keep UI stable")
        return


if __name__ == "__main__":
    main()
