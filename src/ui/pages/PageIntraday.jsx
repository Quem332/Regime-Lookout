import React from "react";
import { Pill } from "../components/Pill";
import { tSafe } from "../render/mriPipeline";

function fmt(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function PageIntraday({ t, intraday, marketOpen, marketCountdown, state, topbarH = 56, lang }) {
  // Prefer explicit props, else derive from state
  const intra = intraday ?? state?.intraday ?? state?.mri?.intraday ?? null;
  const status = state?.status ?? state?.mri?.status ?? null;

  const isOpen = typeof marketOpen === "boolean" ? marketOpen : Boolean(status?.marketOpen);
  const countdown =
    marketCountdown ??
    status?.timers?.countdown ??
    (Number.isFinite(status?.timers?.nextUpdateInSec) ? `${Math.round(status.timers.nextUpdateInSec)}s` : null) ??
    "--:--";

  if (!intra) {
    return (
      <div className="h-full flex flex-col px-4 pb-6 overflow-y-auto" style={{ paddingTop: topbarH + 10 }}>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
          {tSafe(t, "intraday.empty", "No intraday snapshot yet.")}
        </div>
      </div>
    );
  }

  const zShort = intra?.zShort ?? intra?.z_short ?? null;
  const corrAvg = intra?.corrAvg ?? intra?.corr_avg ?? null;
  const alert = Boolean(intra?.alert ?? intra?.corrSurge ?? false);
  const note = intra?.note ?? intra?.message ?? "—";

  const zTone = Number(zShort) >= 1.5 ? "green" : Number(zShort) <= -1.5 ? "red" : "yellow";
  const cTone = Number(corrAvg) >= 0.8 ? "red" : Number(corrAvg) >= 0.65 ? "yellow" : "green";

  return (
    <div
      className="h-full flex flex-col gap-3 px-4 pb-6 overflow-y-auto"
      style={{ paddingTop: topbarH + 10, touchAction: "pan-y" }}
    >
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-white/60">{tSafe(t, "intraday.title", "Intraday")}</div>
            <div className="text-sm font-semibold mt-1 text-white/90">
              {tSafe(t, "intraday.nextUpdate", "Next update")}: <span className="font-mono">{countdown}</span>
            </div>
            <div className="text-[11px] text-white/45 mt-1">{tSafe(t, "intraday.timezone", "US Eastern Time (ET)")}</div>
          </div>

          <div className="text-right">
            <Pill tone={isOpen ? "green" : "red"} label={isOpen ? tSafe(t, "market.open", "Open") : tSafe(t, "market.closed", "Closed")} />
            {alert ? (
              <div className="text-xs text-red-300 mt-2">{tSafe(t, "intraday.alert", "Correlation surge detected.")}</div>
            ) : (
              <div className="text-xs text-white/55 mt-2">{tSafe(t, "intraday.autoRefresh", "Auto-refreshing during market hours.")}</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">{tSafe(t, "intraday.zShort", "z_short")}</div>
          <div className="text-2xl font-extrabold mt-2 text-white/90">{fmt(zShort)}σ</div>
          <div className="mt-2">
            <Pill tone={zTone} label={`${Number(zShort) >= 0 ? "+" : ""}${fmt(zShort)}σ`} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">{tSafe(t, "intraday.corrAvg", "corrAvg")}</div>
          <div className="text-2xl font-extrabold mt-2 text-white/90">{fmt(corrAvg, 2)}</div>
          <div className="mt-2">
            <Pill
              tone={cTone}
              label={
                Number(corrAvg) >= 0.8
                  ? tSafe(t, "intraday.levelHigh", "High")
                  : Number(corrAvg) >= 0.65
                    ? tSafe(t, "intraday.levelElevated", "Elevated")
                    : tSafe(t, "intraday.levelNormal", "Normal")
              }
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex-1 flex flex-col">
        <div className="text-xs text-white/60">{tSafe(t, "intraday.note", "Note")}</div>
        <div className="flex-1 flex items-center justify-center text-xs text-white/50 text-center px-2">
          {String(note || "—")}
        </div>
      </div>
    </div>
  );
}
