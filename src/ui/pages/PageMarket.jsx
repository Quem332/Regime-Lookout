import React, { useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { loadLookback, saveLookback } from "../../storage/localSettings";
import { buildMriViewModel, tSafe } from "../render/mriPipeline";
import FactorBars from "../components/FactorBars";

function isInteractiveTarget(el) {
  try {
    return Boolean(el?.closest?.("button, a, input, textarea, select, [role='button'], [data-stop-toggle='1']"));
  } catch {
    return false;
  }
}

function isTapLike(start, end, maxDist = 10, maxMs = 320) {
  const dx = Math.abs((end?.x ?? 0) - (start?.x ?? 0));
  const dy = Math.abs((end?.y ?? 0) - (start?.y ?? 0));
  const dt = (end?.t ?? 0) - (start?.t ?? 0);
  return dx <= maxDist && dy <= maxDist && dt <= maxMs;
}

// B: "Daily" / "Period" view (not intraday)
// - B-1: scenarios focus (no score)
// - B-2: breakdown (inputs + quadrant)
export function PageMarket({ api, tab, setTab, t }) {
  const vm = useMemo(() => buildMriViewModel({ api, t }), [api, t]);
  const daily = vm.raw.daily;

  // Forward-compatible period support.
  // If backend emits period aggregates later, attach them under mri.period.
  const [lookback, setLookback] = useState(() => loadLookback("252d"));
  const period = api?.mri?.period?.[lookback] || null;

  // Period payload can be either the object itself or wrapped in { daily: ... } depending on pipeline version.
  const periodDaily = period?.daily ?? period ?? null;
  const periodTags = Array.isArray(periodDaily?.tags) ? periodDaily.tags : [];
  const periodOneLine = useMemo(() => {
    return buildOneLineVerdict({
      score: Number.isFinite(periodDaily?.score) ? periodDaily.score : null,
      Cfinal: Number.isFinite(periodDaily?.Cfinal) ? periodDaily.Cfinal : null,
      regime7: periodDaily?.regime7 ?? null,
      tags: periodDaily?.tags ?? null,
      t,
    });
  }, [periodDaily?.score, periodDaily?.Cfinal, periodDaily?.regime7, periodDaily?.tags, t]);
  const viewModel = period || daily;

  const view = tab ?? "b1"; // b1 | b2

  const downRef = useRef(null);
  const onPointerDown = (e) => {
    if (isInteractiveTarget(e.target)) return;
    downRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = (e) => {
    if (isInteractiveTarget(e.target)) return;
    const start = downRef.current;
    downRef.current = null;
    const end = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!start) return;
    if (!isTapLike(start, end)) return;
    setTab?.((v) => (v === "b1" ? "b2" : "b1"));
  };

  const probs = viewModel?.probs && typeof viewModel.probs === "object" ? viewModel.probs : {};
  const probList = useMemo(() => {
    return Object.entries(probs)
      .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [viewModel?.probs]);

  const V = viewModel?.V || viewModel?.vec || viewModel?.featuresZ || null;
  const x = Array.isArray(V) ? V[0] : (V && typeof V === "object" ? V.x : null);
  const y = Array.isArray(V) ? V[1] : (V && typeof V === "object" ? V.y : null);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dotPos = useMemo(() => {
    const xx = x == null ? 0 : clamp(Number(x), -3, 3);
    const yy = y == null ? 0 : clamp(Number(y), -3, 3);
    return { left: ((xx + 3) / 6) * 100, top: (1 - (yy + 3) / 6) * 100 };
  }, [x, y]);

  return (
    <div className="px-4 pb-6 min-h-[calc(100dvh-4rem)]" onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ touchAction: "pan-y" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs text-white/60">
          {t?.("b.lookback", "Lookback") ?? "Lookback"}: {lookback.toUpperCase()}
          {period ? "" : ` · ${t?.("b.na", "(data not available yet)") ?? "(data not available yet)"}`}
        </div>
        <div className="flex items-center gap-1">
          {[
            { k: "20d", label: "20D" },
            { k: "60d", label: "60D" },
            { k: "252d", label: "252D" },
          ].map((opt) => (
            <button
              key={opt.k}
              type="button"
              data-stop-toggle="1"
              onClick={(e) => {
                e.stopPropagation();
                setLookback(opt.k);
                saveLookback(opt.k);
                api?.logger?.info?.("ui.market_set_lookback", { lookback: opt.k });
              }}
              className={`px-2 py-1 rounded-full text-[11px] border ${lookback === opt.k ? "bg-white/20 border-white/30" : "bg-white/5 border-white/10"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {view === "b1" ? (
        <div className="grid gap-3">
          <Card title={t?.("b1.title", "Daily Scenarios") ?? "Daily Scenarios"} subtitle={t?.("b1.subtitle", "Distribution view (no single-call)") ?? "Distribution view (no single-call)"}>
            <div className="space-y-2">
              {probList.length ? (
                probList.map(([k, v]) => {
                  const label = t?.(`scenarios.${k}`, `S${k}`) ?? `S${k}`;
                  const pct = Math.round(v * 100);
                  return (
                    <div key={k} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span className="truncate">{label}</span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-white/30" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <span className="text-xs text-white/60">--</span>
              )}
            </div>
          </Card>

          {/* Removed English note strip; disclaimer/policy lives in Hub. */}
        </div>
      ) : (
        <div className="grid gap-3">
          <Card title={t?.("b2.factors", "Factors (6D)") ?? "Factors (6D)"} subtitle={t?.("b2.factorsSub", "z-score + raw snapshot") ?? "z-score + raw snapshot"}>
            <FactorBars V={viewModel?.V} raw={api?.mri?.inputsRaw ?? api?.mri?.daily?.inputsRaw ?? api?.mri?.meta?.inputsRaw} />
          </Card>

          <Card title={t?.("ui.quadrant", "Position Map") ?? "Position Map"} subtitle={t?.("quadrant.subtitle", "Growth↔Defense, Inflow↔Outflow") ?? "Growth↔Defense, Inflow↔Outflow"}>
            <div className="relative w-full aspect-[16/9] rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="absolute inset-0">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
              </div>

              <div className="absolute left-3 top-2 text-[10px] text-white/60">{t?.("quadrant.defense", "Defense") ?? "Defense"}</div>
              <div className="absolute right-3 top-2 text-[10px] text-white/60">{t?.("quadrant.growth", "Growth") ?? "Growth"}</div>
              <div className="absolute left-3 bottom-2 text-[10px] text-white/60">{t?.("quadrant.outflow", "Outflow") ?? "Outflow"}</div>
              <div className="absolute right-3 bottom-2 text-[10px] text-white/60">{t?.("quadrant.inflow", "Inflow") ?? "Inflow"}</div>

              <div
                className="absolute w-3 h-3 rounded-full bg-white/70 shadow"
                style={{ left: `calc(${dotPos.left}% - 6px)`, top: `calc(${dotPos.top}% - 6px)` }}
                title={`x=${x == null ? "--" : Number(x).toFixed(2)}, y=${y == null ? "--" : Number(y).toFixed(2)}`}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-white/70">
              <span>x: {x == null ? "--" : Number(x).toFixed(2)}</span>
              <span>y: {y == null ? "--" : Number(y).toFixed(2)}</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
