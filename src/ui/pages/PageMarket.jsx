import React, { useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { loadLookback, saveLookback } from "../../storage/localSettings";
import { buildMriViewModel, tSafe } from "../render/mriPipeline";
import { buildPeriodCopy } from "../../core/verdict";
import FactorBars from "../components/FactorBars";

function probParts(v) {
  // Supports:
  // - number: p
  // - [p, c]
  // - { p, c } or { prob, c } or { p, C } etc.
  try {
    if (typeof v === "number" && Number.isFinite(v)) return { p: v, c: null };
    if (Array.isArray(v)) {
      const p = typeof v[0] === "number" ? v[0] : null;
      const c = typeof v[1] === "number" ? v[1] : null;
      return { p, c };
    }
    if (v && typeof v === "object") {
      const p =
        typeof v.p === "number"
          ? v.p
          : typeof v.prob === "number"
            ? v.prob
            : typeof v.value === "number"
              ? v.value
              : null;
      const c =
        typeof v.c === "number"
          ? v.c
          : typeof v.C === "number"
            ? v.C
            : typeof v.conf === "number"
              ? v.conf
              : typeof v.confidence === "number"
                ? v.confidence
                : null;
      return { p, c };
    }
  } catch {}
  return { p: null, c: null };
}


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
export function PageMarket({ api, tab, setTab, t, lang }) {
  const L = (ko, en) => (String(lang || "").startsWith("ko") ? ko : en);

  // Common short labels
  const W_PROB = L("확률", "Prob.");
  const W_CONF = L("신뢰도", "Conf.");
  const W_SCORE = L("점수", "Score");

  const clamp01 = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  };

  const topKFromScenario = (scn) => {
    if (!scn) return null;
    if (Number.isFinite(scn.topK)) return Number(scn.topK);
    const pObj = scn?.probs && typeof scn.probs === "object" ? scn.probs : null;
    if (!pObj) return null;
    const top = Object.entries(pObj)
      .map(([k, v]) => [Number(k), probParts(v).p])
      .filter(([k, p]) => Number.isFinite(k) && typeof p === "number" && Number.isFinite(p))
      .sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  };

  const vm = useMemo(() => buildMriViewModel({ api, t }), [api, t]);
  const daily = vm.raw.daily;
  const intraday = vm.raw?.intraday ?? vm.intraday ?? null;
  const marketOpen = Boolean(vm.raw?.marketOpen ?? marketOpen ?? false);

  // Forward-compatible period support: accept both legacy (single daily) and new schema (daily.periods).
  const [lookback, setLookback] = useState(() =>
    loadLookback(daily?.periods ? "60d" : "20d")
  );
  const dailyRoot = daily ?? null;
  const dailyPeriods = dailyRoot?.periods ?? null;
  const sources = api?.health?.sources ?? null;
  const pendingPeriods = ["20D", "60D", "252D"].filter((k) => {
    const available = !!dailyPeriods?.[k] || (!dailyPeriods && k === "20D");
    return !available;
  });
  const lbKey = String(lookback || (daily?.periods ? "60d" : "20d")).toUpperCase(); // "60D"
  const periodDaily = (dailyPeriods && dailyPeriods[lbKey]) ? dailyPeriods[lbKey] : (!dailyPeriods && lbKey === "20D" ? dailyRoot : null);

  // "Data ready" check for the currently selected period.
  // IMPORTANT: keep this as local constants so JSX never references undeclared identifiers.
  const periodReady = !!(
    periodDaily &&
    (Array.isArray(periodDaily?.V) || periodDaily?.probs || Number.isFinite(periodDaily?.score) || Number.isFinite(periodDaily?.Cfinal))
  );
  const dataMissing = !periodReady;
  const periodTags = Array.isArray(periodDaily?.tags) ? periodDaily.tags : [];
  const periodCopy = useMemo(() => {
    return buildPeriodCopy({
      Cfinal: Number.isFinite(periodDaily?.Cfinal) ? periodDaily.Cfinal : null,
      regime7: periodDaily?.regime7 ?? null,
      probs: periodDaily?.probs ?? null,
      tags: periodDaily?.tags ?? null,
      lookbackKey: lookback,
      t,
      lang: lang || "en",
    });
  }, [periodDaily?.Cfinal, periodDaily?.regime7, periodDaily?.probs, periodDaily?.tags, lookback, t]);
  const viewModel = periodDaily || daily;

  // B-1 Score/Confidence should reflect the same "today scenario" logic used in A-1.
  // If intraday scenario exists during market hours, use it; otherwise use the selected period pack.
  const hasIntradayScenario = Boolean(marketOpen && intraday?.scenario);
  const b1Scenario = hasIntradayScenario ? intraday.scenario : periodDaily;
  const b1Score = Number.isFinite(b1Scenario?.score)
    ? Number(b1Scenario.score)
    : (Number.isFinite(periodDaily?.score) ? Number(periodDaily.score) : null);
  const b1CfinalBase = Number.isFinite(b1Scenario?.Cfinal)
    ? Number(b1Scenario.Cfinal)
    : (Number.isFinite(periodDaily?.Cfinal) ? Number(periodDaily.Cfinal) : null);

  // Consistency penalty (same idea as A-1): if intraday top scenario is unlikely under daily distribution,
  // reduce confidence conservatively.
  const b1Cfinal = (() => {
    if (!Number.isFinite(b1CfinalBase)) return null;
    if (!hasIntradayScenario) return b1CfinalBase;
    const tk = topKFromScenario(intraday?.scenario);
    if (tk == null) return b1CfinalBase;
    const pRaw = dailyRoot?.probs?.[String(tk)];
    const p = probParts(pRaw).p;
    if (!(typeof p === "number" && Number.isFinite(p))) return b1CfinalBase;
    const consistency = clamp01(p);
    const penalized = b1CfinalBase - (1 - consistency) * 20;
    return Math.round(Math.max(0, Math.min(100, penalized)));
  })();

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
      .filter(([, v]) => {
            const pp = probParts(v);
            return typeof pp.p === "number" && Number.isFinite(pp.p);
          })
      .sort((a, b) => {
            const pa = probParts(a[1]).p || 0;
            const pb = probParts(b[1]).p || 0;
            return pb - pa;
          })
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
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="text-xs text-white/60">
          {dataMissing ? tSafe(t, "b.na", L("데이터 없음", "No data")) : ""}
        </div>
        <div className="flex items-center gap-1">
          {[
            { k: "20d", label: "20D" },
            { k: "60d", label: "60D" },
            { k: "252d", label: "252D" },
          ].map((opt) => {
            const key = opt.label; // "20D/60D/252D"
            const available = !!dailyPeriods?.[key] || (!dailyPeriods && opt.k === "20d");
            const label = available ? opt.label : tSafe(t, "period.btn.pending", L(`${opt.label} (준비중)`, `${opt.label} (pending)`));
            return (
              <button
                key={opt.k}
                disabled={!available}
                onClick={() => {
                  if (!available) return;
                  setLookback(opt.k);
                  saveLookback(opt.k);
                }}
                className={[
                  "px-3 py-1.5 rounded-full text-sm border",
                  lookback === opt.k ? "bg-white/10 border-white/20" : "bg-transparent border-white/10 hover:bg-white/5",
                  !available ? "opacity-40 cursor-not-allowed hover:bg-transparent" : "",
                ].join(" ")}
                title={!available ? tSafe(t, "period.pending", L("데이터 준비 중", "Data pending")) : ""}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {sources && sources.mode === "legacy" ? (
        <div className="mb-3 text-[11px] text-white/45">
          mode={sources.mode} · legacy={sources.legacy?.url || "-"}
        </div>
      ) : null}

      {view === "b1" ? (
        <div className="grid gap-4">
          <Card title={tSafe(t, "b1.title", L("기간 해석", "Period Interpretation"))} subtitle={tSafe(t, "b1.subtitle", L("구조 + 분포 (점수 없음)", "Structure + distribution (no score)"))}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] text-white/60 tabular-nums whitespace-nowrap">
                {marketOpen ? L("오늘 장", "Live") : L("마감", "Close")}
                {Number.isFinite(b1Score) ? ` ${W_SCORE} ${Math.round(b1Score)}` : ""}
                {Number.isFinite(b1Cfinal) ? ` · ${W_CONF} ${Math.round(b1Cfinal)}` : ""}
              </div>
            </div>

            <div className="text-sm text-white/85 leading-relaxed">
              {periodCopy?.summary ?? "--"}
            </div>
{periodCopy?.warning ? <div className="mt-1 text-xs text-white/60 leading-snug">{periodCopy.warning}</div> : null}

{Array.isArray(periodCopy?.reasonTags) && periodCopy.reasonTags.length ? (
  <div className="mt-2 flex flex-wrap gap-2">
    {periodCopy.reasonTags.map((tg, i) => (
      <Pill key={`p-${i}`} tone={tg.tone || "gray"} label={tg.label} msg={tg.msg} />
    ))}
  </div>
) : null}

<div className="mt-3" />

            <div className="space-y-2">
              {probList.length ? (
                probList.map(([k, v]) => {
                  const label = t?.(`scenarios.${k}`, `S${k}`) ?? `S${k}`;
                  const pp = probParts(v);
                        const pct = Math.round((pp.p ?? 0) * 100);
                  return (
                    <div key={k} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span className="truncate">{label}</span>
                        <span className="tabular-nums">{`${W_PROB} ${pct}%`}</span>
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
          <Card title={tSafe(t, "b2.factors", L("요인 (기간)", "Period Factors"))} subtitle={`${tSafe(t, "b2.factorsSub", L("요인(6D) + 맵", "Factors (6D) + map"))} · ${lbKey}`}>
            {dataMissing ? (
              <div className="py-6 text-sm text-white/60">
                {tSafe(t, "ui.dataMissing", L("데이터가 없어 표시할 수 없습니다. (Actions에서 데이터 업데이트를 실행하세요)", "Data is missing. (Run a data update workflow in Actions)"))}
              </div>
            ) : (
              <FactorBars lang={lang} V={viewModel?.V} raw={periodDaily?.inputsRaw ?? dailyRoot?.inputsRaw ?? dailyRoot?.meta?.inputsRaw ?? null} />
            )}
          </Card>

          <Card title={tSafe(t, "ui.quadrant", L("포지션 맵", "Position Map"))} subtitle={tSafe(t, "quadrant.subtitle", L("성장↔방어, 유입↔유출", "Growth↔Defense, Inflow↔Outflow"))}>
            <div className="relative w-full aspect-[16/9] rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="absolute inset-0">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
              </div>

              {/* Edge labels (more intuitive than corners) */}
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-white/60">{tSafe(t, "quadrant.defense", L("방어", "Defense"))}</div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/60">{tSafe(t, "quadrant.growth", L("성장", "Growth"))}</div>
              <div className="absolute left-1/2 top-2 -translate-x-1/2 text-[10px] text-white/60">{tSafe(t, "quadrant.inflow", L("유입", "Inflow"))}</div>
              <div className="absolute left-1/2 bottom-2 -translate-x-1/2 text-[10px] text-white/60">{tSafe(t, "quadrant.outflow", L("유출", "Outflow"))}</div>

              <div
                className="absolute w-3 h-3 rounded-full bg-white/70 shadow"
                style={{ left: `calc(${dotPos.left}% - 6px)`, top: `calc(${dotPos.top}% - 6px)` }}
                title={tSafe(t, "quadrant.tip", L("성장↔방어 / 유입↔유출", "Growth↔Defense / Inflow↔Outflow"))}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
