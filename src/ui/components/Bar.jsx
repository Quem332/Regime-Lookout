import React from "react";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Bar
 * - value: z-score (roughly -3..+3)
 * - label: string
 * - hint: optional subtitle
 */
export function Bar({ label, hint, value = 0, rightText, className = "" }) {
  const v = Number.isFinite(value) ? value : 0;
  const pct = (clamp(v, -3, 3) + 3) / 6; // 0..1
  const sign = v >= 0 ? "+" : "";
  const valText = rightText ?? `${sign}${v.toFixed(2)}σ`;

  return (
    <div className={"w-full " + className}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-white/80">{label}</div>
          {hint ? <div className="text-xs text-white/45 mt-1">{hint}</div> : null}
        </div>
        <div className="shrink-0 text-sm font-semibold text-white/85">{valText}</div>
      </div>

      <div className="mt-3 h-3 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={"h-full rounded-full " + (v >= 0 ? "bg-emerald-500/80" : "bg-rose-500/80")}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
    </div>
  );
}
