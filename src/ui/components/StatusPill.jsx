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
export function StatusPill({ market, timers, health, marketOpen, eventWindow }) {
  const toneToPill = (t) => {
    if (t === "good") return "green";
    if (t === "warn") return "yellow";
    if (t === "bad") return "red";
    if (t === "black") return "black";
    return "gray";
  };

  const dataTone = toneToPill(market?.tone);
  const dataLabel = market?.label || "DATA --:--";
  const rawCountdown = timers?.countdown;
  const safeCountdown = typeof rawCountdown === "string" && !rawCountdown.includes("NaN") ? rawCountdown : null;
  const nextLabel = safeCountdown ? `NEXT ${safeCountdown}` : "NEXT --:--";
  const healthTone = toneToPill(health?.tone);
  return (
    <div className="flex items-center gap-2">
      <Pill tone={dataTone}>{dataLabel}</Pill>
      <span className={`status-dot ${healthTone === "green" ? "bg-green-400" : healthTone === "yellow" ? "bg-yellow-300" : healthTone === "red" ? "bg-red-400" : healthTone === "black" ? "bg-black" : "bg-gray-400"} ${marketOpen ? (eventWindow?.active ? "status-dot-blink-fast" : "status-dot-blink") : ""}`} title={eventWindow?.active ? (eventWindow?.event?.name ? `Event: ${eventWindow.event.name}` : "Event window") : ""} />
      <Pill tone="blue">{nextLabel}</Pill>
    </div>
  );
}
