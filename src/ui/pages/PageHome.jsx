import React, { useMemo, useRef } from "react";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import FactorBars from "../components/FactorBars";
import { buildOneLineVerdict } from "../../core/verdict";
import { buildMriViewModel, tSafe } from "../render/mriPipeline";

function isInteractiveTarget(el) {
  try {
    return Boolean(el?.closest?.("button, a, input, textarea, select, [role='button'], [data-stop-toggle='1']"));
  } catch {
    return false;
  }
}

function isTapLike(start, end, maxDist = 10, maxMs = 320) {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const dt = end.t - start.t;
  return dx <= maxDist && dy <= maxDist && dt <= maxMs;
}

export function PageHome({ api, tab, setTab, t, lang }) {
  const vm = useMemo(() => buildMriViewModel({ api, t }), [api, t]);
  const daily = vm.raw.daily;
  const status = vm.raw.status;
  const asOf = vm.meta.asOf ?? "";

  // Two internal views:
  // A-1: score-centric summary (score+confidence+tags+probs)
  // A-2: breakdown (inputs/quadrant/intraday diagnostics)
  const view = tab ?? "a1"; // a1 | a2

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
    setTab?.((v) => (v === "a1" ? "a2" : "a1"));
  };

  const score = Number.isFinite(daily?.score) ? daily.score : null;
  const Cfinal = Number.isFinite(daily?.Cfinal) ? daily.Cfinal : null;
  const regime7 = daily?.regime7 ?? "--";
  const topK = daily?.topK ?? null;

  const probs = daily?.probs && typeof daily.probs === "object" ? daily.probs : {};
  const probList = useMemo(() => {
    return Object.entries(probs)
      .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1);
  }, [daily?.probs]);

  const tags = Array.isArray(daily?.tags) ? daily.tags : [];

  
const V = daily?.V || daily?.vec || daily?.featuresZ || null;
const x = Array.isArray(V) ? V[0] : (V && typeof V === "object" ? V.x : null);
const y = Array.isArray(V) ? V[1] : (V && typeof V === "object" ? V.y : null);

const scoreLabel = useMemo(() => {
  if (score == null || Number.isNaN(score)) return "--";
  const s = Number(score);
  if (s >= 67) return t?.("scoreLabels.calm", "Calm") ?? "Calm";
  if (s >= 34) return t?.("scoreLabels.watch", "Watch") ?? "Watch";
  return t?.("scoreLabels.risk", "Risk") ?? "Risk";
}, [score, t]);

const oneLine = useMemo(() => {
  return buildOneLineVerdict({
    score: typeof score === "number" ? score : null,
    Cfinal: typeof Cfinal === "number" ? Cfinal : null,
    regime7: daily?.regime7 ?? null,
    tags: daily?.tags ?? null,
    t,
  });
}, [score, Cfinal, daily?.regime7, daily?.tags, t]);

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const dotPos = useMemo(() => {
  const xx = x == null ? 0 : clamp(Number(x), -3, 3);
  const yy = y == null ? 0 : clamp(Number(y), -3, 3);
  // map [-3,3] -> [0,100]
  return { left: ((xx + 3) / 6) * 100, top: (1 - (yy + 3) / 6) * 100 };
}, [x, y]);

  const intraday = vm.intraday.data;
  const marketOpen = vm.meta.marketOpen;
  const countdown = status?.timers?.countdown ?? "--:--";

  const nextOpenInfo = useMemo(() => {
    // Best-effort: convert countdown (HH:MM) -> estimated open timestamp.
    // (Holiday handling is intentionally not attempted here.)
    if (marketOpen) return null;
    const m = String(countdown || "").match(/^(\d+):(\d{2})$/);
    if (!m) return { countdown: countdown || "--:--", openAt: null, openAtET: null };
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return { countdown: countdown || "--:--", openAt: null, openAtET: null };
    const ms = (hh * 60 + mm) * 60 * 1000;
    const openAt = new Date(Date.now() + ms);
    const openAtLocal = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(openAt);
    const openAtET = new Intl.DateTimeFormat(undefined, { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" }).format(openAt);
    return { countdown: `${hh}:${String(mm).padStart(2, "0")}`, openAt: openAtLocal, openAtET };
  }, [marketOpen, countdown]);

return (
    <div className="relative px-4 pb-6 min-h-[calc(100dvh-4rem)]" onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ touchAction: "pan-y" }}>
      {/* No local page title; top bar handles it */}

      {/* Off-hours overlay (A is still readable; overlay is informational) */}
      {!marketOpen ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative mx-6 w-full max-w-sm rounded-2xl border border-white/15 bg-slate-950/80 p-4 text-center">
            <div className="text-sm font-semibold text-white/90">{t?.("market.closed", "Market Closed") ?? "Market Closed"}</div>
            <div className="mt-1 text-xs text-white/70">
              {t?.("market.opensIn", "Opens in") ?? "Opens in"} {nextOpenInfo?.countdown ?? countdown}
            </div>
            {nextOpenInfo?.openAt ? (
              <div className="mt-1 text-[11px] text-white/60">
                {t?.("market.openAt", "Open") ?? "Open"}: {nextOpenInfo.openAtET} ET · {nextOpenInfo.openAt} {t?.("market.local", "local") ?? "local"}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {view === "a1" ? (
  <div className="grid gap-3">
    {/* A-1: Score summary */}
    <Card
      title={t?.("a1.title", "Today") ?? "Today"}
      subtitle={t?.("a1.subtitle", "Risk-adjusted interpretation") ?? "Risk-adjusted interpretation"}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <div className="text-5xl font-extrabold text-white leading-none">{score == null ? "--" : String(Math.round(score))}</div>
          <div className="pb-1">
            <div className="text-sm font-semibold text-white/90">{scoreLabel}</div>
            <div className="text-xs text-white/70">
              🛡 {t?.("score.confidence", "Confidence") ?? "Confidence"} {Cfinal == null ? "--" : String(Math.round(Cfinal))}
              {daily?.rel?.capped ? ` (${t?.("score.capped", "Capped") ?? "Capped"})` : ""}
            </div>
          </div>
        </div>

        <div className="pb-1 text-right">
          <div className="text-xs text-white/70">{t?.("score.regime", "Regime") ?? "Regime"} {String(regime7)}</div>
          <div className="text-xs text-white/60">{asOf || "--"}</div>
        </div>
      </div>

      <div className="mt-2 text-sm text-white/80 leading-snug">{oneLine}</div>

      {/* Gauge */}
      <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-white/40"
          style={{ width: `${Math.round(clamp01((Number(score ?? 0) || 0) / 100) * 100)}%` }}
        />
      </div>
    </Card>

    {/* Tags first (readability) */}
    <Card title={t?.("ui.reasoningTags", "Reasoning Tags") ?? "Reasoning Tags"} subtitle={t?.("tags.subtitle", "Key drivers") ?? "Key drivers"}>
      <div className="flex flex-wrap gap-2">
        {tags.length ? (
          tags.map((x, i) => {
            const key = typeof x === "string" ? x : (x?.key ?? x?.label ?? x?.text ?? x?.name ?? "");
            const label = typeof x === "string" ? x : (x?.label ?? x?.text ?? x?.name ?? String(key));
            return <Pill key={`${key}-${i}`} tagKey={String(key || label)} label={String(label)} lang={lang} />;
          })
        ) : (
          <span className="text-xs text-white/60">--</span>
        )}
      </div>
    </Card>

    {/* Scenarios (bottom) */}
    <Card title={t?.("ui.probabilities", "Scenario Probabilities") ?? "Scenario Probabilities"} subtitle={t?.("daily.topScenario", "Top scenario (today)") ?? "Top scenario (today)"}>
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
  </div>
) : (
  <div className="grid gap-3">
    {/* A-2: Breakdown */}
    <Card title={t?.("a2.factors", "Factors (6D)") ?? "Factors (6D)"} subtitle={t?.("a2.factorsSub", "z-score + raw snapshot") ?? "z-score + raw snapshot"}>
      <FactorBars V={daily?.V} raw={api?.mri?.inputsRaw ?? api?.mri?.daily?.inputsRaw ?? api?.mri?.meta?.inputsRaw} />
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

    {/* Intraday diagnostics are relevant only when market is open */}
    <Card title={t?.("a2.intra", "Intraday Diagnostics") ?? "Intraday Diagnostics"} subtitle={marketOpen ? (t?.("a2.intraOpen", "Live (market hours)") ?? "Live (market hours)") : (t?.("a2.intraClosed", "Off-hours") ?? "Off-hours")}>
      {marketOpen ? (
        <div className="text-xs text-white/70">
          <div>z_short: {Number.isFinite(intraday?.zShort) ? Number(intraday?.zShort).toFixed(2) : "--"}</div>
          <div>corrAvg: {Number.isFinite(intraday?.corrAvg) ? Number(intraday?.corrAvg).toFixed(2) : "--"}</div>
          <div>corrSurge: {intraday?.corrSurge ? "YES" : "NO"}</div>
        </div>
      ) : (
        <div className="text-sm text-white/70 leading-relaxed">
          {t?.("a2.intraNote", "Intraday signals are disabled off-hours. Daily interpretation remains available.") ?? "Intraday signals are disabled off-hours. Daily interpretation remains available."}
        </div>
      )}
    </Card>
  </div>
)}
    </div>
  );
}
