import React from "react";
import { Pill } from "./Pill";

/**
 * Top-bar status:
 * - Left pill: DATA HH:MM (or DATA Xm) with latency tone
 * - Right pill: NEXT mm:ss (until next half-hour)
 *
 * api.statusComputed provides:
 *  status.market: {tone,label,latencyMin,asOf}
 *  status.timers: {countdown,pollMs}
 */
export function StatusPill({ market, timers }) {
  const toneToPill = (t) => {
    if (t === "good") return "green";
    if (t === "warn") return "yellow";
    if (t === "bad") return "red";
    return "gray";
  };

  const dataTone = toneToPill(market?.tone);
  const dataLabel = market?.label || "DATA --:--";
  const nextLabel = timers?.countdown ? `NEXT ${timers.countdown}` : "NEXT --:--";

  return (
    <div className="flex items-center gap-2">
      <Pill tone={dataTone}>{dataLabel}</Pill>
      <Pill tone="blue">{nextLabel}</Pill>
    </div>
  );
}
