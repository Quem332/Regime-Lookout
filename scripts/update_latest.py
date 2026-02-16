import json
import math
import os
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import yfinance as yf


# ================
# Config (MRI Spec)
# ================
TICKERS = {
    "QQQM": "QQQM",
    "XLP": "XLP",
    "VOO": "VOO",
    "UUP": "UUP",
    "GLD": "GLD",
    "VIX": "^VIX",
    "TNX": "^TNX",
}

LOOKBACK_Z = 252  # trading days for z-score baseline
RET_20 = 20
VIX_CHG_5 = 5

OUT_PATH = os.path.join("public", "data", "latest.json")
CAL_PATH = os.path.join("public", "data", "calendar.json")


def zscore_last(series: pd.Series) -> float:
    s = series.dropna()
    if len(s) < 30:
        return float("nan")
    mu = float(s.mean())
    sd = float(s.std(ddof=0))
    if sd == 0:
        return 0.0
    return float((s.iloc[-1] - mu) / sd)


def safe_ln_ratio(a: pd.Series, b: pd.Series) -> pd.Series:
    a = a.replace(0, np.nan)
    b = b.replace(0, np.nan)
    return np.log(a / b)


def ensure_calendar_exists():
    # 형식만 만들고 비워두는 기본값
    if not os.path.exists(CAL_PATH):
        os.makedirs(os.path.dirname(CAL_PATH), exist_ok=True)
        with open(CAL_PATH, "w", encoding="utf-8") as f:
            json.dump({"events": []}, f, ensure_ascii=False, indent=2)


def should_write_now(now_utc: datetime) -> bool:
    """
    실행은 15분마다 하되, 실제로 파일을 '갱신'하는 타이밍은:
    - 30분 봉 기준 + 10분 지연: 대략 :10 / :40 부근
    - Actions 스케줄 지터 고려해서 윈도우를 ±4분로 잡음
    """
    m = now_utc.minute
    # allowed windows: [6..14] and [36..44]
    return (6 <= m <= 14) or (36 <= m <= 44)


def main():
    ensure_calendar_exists()

    now_utc = datetime.now(timezone.utc)
    # 15분마다 실행되지만, 파일 쓰기는 30분+10분 지연 윈도우에서만
    if not should_write_now(now_utc):
        print(f"[SKIP] Not in write window. UTC={now_utc.isoformat()}")
        return

    print(f"[RUN] Updating latest.json. UTC={now_utc.isoformat()}")

    tickers = list(TICKERS.values())

    # Use Adj Close when available
    df = yf.download(
        tickers=tickers,
        period="2y",   # enough to cover 252 trading days robustly
        interval="1d",
        auto_adjust=True,
        group_by="ticker",
        threads=True,
        progress=False,
    )

    # Normalize shape: df may be multiindex columns
    def get_close(sym: str) -> pd.Series:
        if isinstance(df.columns, pd.MultiIndex):
            # yfinance: (field, ticker) or (ticker, field) depending on group_by
            if ("Close", sym) in df.columns:
                return df[("Close", sym)]
            if (sym, "Close") in df.columns:
                return df[(sym, "Close")]
            if ("Adj Close", sym) in df.columns:
                return df[("Adj Close", sym)]
            if (sym, "Adj Close") in df.columns:
                return df[(sym, "Adj Close")]
        # single index fallback
        for col in ["Close", "Adj Close"]:
            if col in df.columns:
                return df[col]
        raise RuntimeError(f"Could not find Close series for {sym}")

    qqqm = get_close(TICKERS["QQQM"])
    xlp = get_close(TICKERS["XLP"])
    voo = get_close(TICKERS["VOO"])
    uup = get_close(TICKERS["UUP"])
    gld = get_close(TICKERS["GLD"])
    vix = get_close(TICKERS["VIX"])
    tnx = get_close(TICKERS["TNX"])

    # Align index and keep last ~ (LOOKBACK_Z + buffer)
    # Convert to DataFrame for easy shifting
    data = pd.DataFrame({
        "qqqm": qqqm,
        "xlp": xlp,
        "voo": voo,
        "uup": uup,
        "gld": gld,
        "vix": vix,
        "tnx": tnx,
    }).dropna()

    # Use last 400-ish rows for safety
    data = data.tail(max(LOOKBACK_Z + 80, 360))

    # Features (raw series)
    # x = z( ln(QQQM/XLP) )
    x_raw = safe_ln_ratio(data["qqqm"], data["xlp"])

    # y = z( VOO 20d return )
    y_raw = data["voo"].pct_change(RET_20)

    # usd = z( UUP 20d change )
    usd_raw = data["uup"].pct_change(RET_20)

    # rates = z( TNX 20d change )  (use diff; for yields, diff is common)
    rates_raw = data["tnx"].diff(RET_20)

    # vix = z( VIX 5d change )
    vix_raw = data["vix"].diff(VIX_CHG_5)

    # goldFear = z(GLD 20d chg) - 0.5*z(UUP 20d chg)
    gld_chg = data["gld"].pct_change(RET_20)
    uup_chg = usd_raw

    # z-score baseline window = last 252 valid points
    def last_window(s: pd.Series) -> pd.Series:
        s2 = s.dropna()
        return s2.tail(LOOKBACK_Z)

    x_z = zscore_last(last_window(x_raw))
    y_z = zscore_last(last_window(y_raw))
    usd_z = zscore_last(last_window(usd_raw))
    rates_z = zscore_last(last_window(rates_raw))
    vix_z = zscore_last(last_window(vix_raw))
    gld_z = zscore_last(last_window(gld_chg))
    uup_z = zscore_last(last_window(uup_chg))
    goldFear_z = gld_z - 0.5 * uup_z  # 확정

    featuresZ = {
        "x": x_z,
        "y": y_z,
        "rates": rates_z,
        "usd": usd_z,
        "vix": vix_z,
        "goldFear": goldFear_z,
    }

    # validate finite
    bad = [k for k, v in featuresZ.items() if not (isinstance(v, (int, float)) and math.isfinite(v))]
    if bad:
        raise RuntimeError(f"Non-finite featuresZ: {bad} -> {featuresZ}")

    payload = {
        "asOfUTC": now_utc.isoformat(),
        "featuresZ": featuresZ,
        # optional: intraday placeholders (front can handle absence)
        "intraday": {
            "zShort": None,
            "corrAvg": None,
            "corrSurge": None,
            "intervalUsed": None,
        },
        "dataHealth": {"level": "GOOD", "source": "yfinance"},
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    # Only write if changed meaningfully (avoid noisy commits)
    old = None
    if os.path.exists(OUT_PATH):
        try:
            with open(OUT_PATH, "r", encoding="utf-8") as f:
                old = json.load(f)
        except Exception:
            old = None

    def rounded_feat(d):
        return {k: round(float(v), 6) for k, v in d.items()}

    if old and "featuresZ" in old:
        if rounded_feat(old["featuresZ"]) == rounded_feat(featuresZ):
            print("[NOOP] featuresZ unchanged (rounded).")
            return

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"[OK] Wrote {OUT_PATH}")
    print(json.dumps(payload["featuresZ"], ensure_ascii=False))


if __name__ == "__main__":
    main()
