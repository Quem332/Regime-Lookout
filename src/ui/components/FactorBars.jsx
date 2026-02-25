import React from "react";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmtPct(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return "--";
  const v = Number(x);
  return `${v.toFixed(2)}%`;
}


function L(lang, m) {
  return (lang || "en").startsWith("ko") ? (m.ko ?? m.en) : (m.en ?? m.ko);
}

function fmtNum(x, d = 2) {
  if (x === null || x === undefined || Number.isNaN(x)) return "--";
  return Number(x).toFixed(d);
}

// Renders 6D factors as bars, and (if available) raw inputs next to them.
// Designed to never crash even if fields are missing.
export default function FactorBars({ V, raw, lang }) {
  const v = Array.isArray(V) && V.length === 6 ? V : [0, 0, 0, 0, 0, 0];
  const r = raw && typeof raw === "object" ? raw : null;

  const items = [
    {
      key: "x",
      label: L(lang, { en: "XLP (Defense) ↔ QQQM (Growth)", ko: "XLP(방어) ↔ QQQM(성장)" }),
      z: v[0],
      rawText: r
        ? `ln(QQQM/XLP) ${fmtNum(r?.x?.ln)} | ratio ${fmtNum(r?.x?.ratio, 3)}`
        : "",
    },
    {
      key: "y",
      label: L(lang, { en: "VOO (Outflow ↔ Inflow)", ko: "VOO(유출 ↔ 유입)" }),
      z: v[1],
      rawText: r ? `VOO 20D ${fmtPct(r?.y?.voo_20d_pct)}` : "",
    },
    {
      key: "rates",
      label: L(lang, { en: "^TNX (Rates: down ↔ up)", ko: "^TNX(금리: 하락 ↔ 상승)" }),
      z: v[2],
      rawText: r ? `TNX 20D ${fmtPct(r?.rates?.tnx_20d_pct)} | lvl ${fmtNum(r?.levels?.TNX)}` : "",
    },
    {
      key: "usd_gold",
      label: L(lang, { en: "USD (UUP) ↔ Gold (GLD)", ko: "달러(UUP) ↔ 금(GLD)" }),
      z: ((v[3] ?? 0) - (v[5] ?? 0)) * 0.5,
      rawText: r ? `UUP 20D ${fmtPct(r?.usd?.uup_20d_pct)} | GLD 20D ${fmtPct(r?.gold?.gld_20d_pct)}` : "",
    },
    {
      key: "vix",
      label: L(lang, { en: "^VIX (Fear: down ↔ up)", ko: "^VIX(공포: 하락 ↔ 상승)" }),
      z: v[4],
      rawText: r ? `VIX 5D ${fmtPct(r?.vix?.vix_5d_pct)} | lvl ${fmtNum(r?.levels?.VIX)}` : "",
    },

  ];

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const z = Number(it.z ?? 0);
        const mag = clamp(Math.abs(z) / 3, 0, 1); // z=±3 maps to 100%
        const dir = z >= 0 ? 1 : -1;
        const pos = 50 + clamp(z / 3, -1, 1) * 50;
        return (
          <div key={it.key} className="space-y-1">
            <div className="flex items-end justify-between">
              <div className="text-sm text-white/80">{it.label}</div>
              <div className="text-sm tabular-nums text-white/80">z {fmtNum(z, 2)}</div>
            </div>

            <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
              <div
                className="absolute top-0 bottom-0 rounded-full bg-white/25"
                style={{
                  width: `${mag * 50}%`,
                  left: dir >= 0 ? "50%" : `${50 - mag * 50}%`,
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/70 shadow"
                style={{ left: `calc(${pos}% - 6px)` }}
              />
            </div>

            {it.rawText ? <div className="text-xs text-white/55">{it.rawText}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
