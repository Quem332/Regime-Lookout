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

// B: "Daily/Period" pages
// - B-1: scenarios focus (no score)
// - B-2: breakdown (inputs + quadrant)
export function PageMarket({ api, tab, setTab, t, lang }) {
  const isKo = String(lang || "").toLowerCase().startsWith("ko");
  const L = (ko, en) => (isKo ? ko : en);

  const vm = useMemo(() => buildMriViewModel({ api, t }), [api, t]);
  const daily = vm?.raw?.daily ?? null;

  const [lookback, setLookback] = useState(() => loadLookback("252d"));

  // Period payload: future-compatible (may be absent)
  const period = api?.mri?.period?.[lookback] || vm?.raw?.period?.[lookback] || null;
  const periodDaily = period?.daily ?? period ?? null;

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
  }, [periodDaily?.Cfinal, periodDaily?.regime7, periodDaily?.probs, periodDaily?.tags, lookback, t, lang]);

  const viewModel = periodDaily || daily;
  const view = tab ?? "b1"; // b1 | b2

  // tap toggles b1 <-> b2
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
    <div
      className="px-4 pb-6 min-h-[calc(100dvh-4rem)]"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ touchAction: "pan-y" }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs text-white/60">
          {tSafe(lang, "b.lookback", L("기간", "Lookback"))}: {String(lookback).toUpperCase()}
          {periodDaily ? "" : ` · ${tSafe(lang, "b.na", L("(데이터 준비중)", "(data not available yet)"))}`}
        </div>

        <div className="flex items-center gap-1">
          {[{ k: "20d", label: "20D" }, { k: "60d", label: "60D" }, { k: "252d", label: "252D" }].map((opt) => (
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
              className={`px-2 py-1 rounded-full text-[11px] border ${
                lookback === opt.k ? "bg-white/20 border-white/30" : "bg-white/5 border-white/10"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {view === "b1" ? (
        <div className="grid gap-3">
          <Card
            title={tSafe(lang, "b1.title", L("기간 해석", "Period Interpretation"))}
            subtitle={tSafe(lang, "b1.subtitle", L("구조 + 분포 (점수 없음)", "Structure + distribution (no score)"))}
          >
            <div className="text-sm text-white/85 leading-snug">{periodCopy?.summary ?? "--"}</div>
            {periodCopy?.warning ? <div className="mt-1 text-xs text-white/60 leading-snug">{periodCopy.warning}</div> : null}
            {periodCopy?.reasonsText ? <div className="mt-1 text-xs text-white/55 leading-snug">{periodCopy.reasonsText}</div> : null}

            {Array.isArray(periodCopy?.reasonTags) && periodCopy.reasonTags.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {periodCopy.reasonTags.map((tg, i) => (
                  <Pill key={`p-${i}`} tone={tg.tone || "gray"} label={tg.label} msg={tg.msg} lang={lang} />
                ))}
              </div>
            ) : null}

            <div className="mt-3 space-y-2">
              {probList.length ? (
                probList.map(([k, v]) => {
                  const label = t?.(`scenarios.${k}`, `S${k}`) ?? `S${k}`;
                  const pp = probParts(v);
                  const pct = Math.round((pp.p ?? 0) * 100);
                  const cAll = Number.isFinite(periodDaily?.Cfinal) ? periodDaily.Cfinal : null;
                  const ci = Number.isFinite(pp.c) ? pp.c : cAll;
                  return (
                    <div key={k} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span className="truncate">{label}</span>
                        <span className="tabular-nums">
                          {pct}%{Number.isFinite(ci) ? ` · C${Math.round(ci)}` : ""}
                        </span>
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
          <Card
            title={tSafe(lang, "b2.factors", L("기간 분해", "Period Breakdown"))}
            subtitle={`${tSafe(lang, "b2.factorsSub", L("6D 팩터 + 맵", "Factors (6D) + map"))} · ${String(lookback).toUpperCase()}`}
          >
            <FactorBars V={viewModel?.V} raw={api?.mri?.inputsRaw ?? api?.mri?.daily?.inputsRaw ?? api?.mri?.meta?.inputsRaw} />
          </Card>

          <Card title={tSafe(lang, "ui.quadrant", L("포지션 맵", "Position Map"))} subtitle={tSafe(lang, "quadrant.subtitle", L("성장↔방어, 유입↔유출", "Growth↔Defense, Inflow↔Outflow"))}>
            <div className="relative w-full aspect-[16/9] rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="absolute inset-0">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
              </div>

              <div className="absolute left-3 top-2 text-[10px] text-white/60">{tSafe(lang, "quadrant.defense", L("방어", "Defense"))}</div>
              <div className="absolute right-3 top-2 text-[10px] text-white/60">{tSafe(lang, "quadrant.growth", L("성장", "Growth"))}</div>
              <div className="absolute left-3 bottom-2 text-[10px] text-white/60">{tSafe(lang, "quadrant.outflow", L("유출", "Outflow"))}</div>
              <div className="absolute right-3 bottom-2 text-[10px] text-white/60">{tSafe(lang, "quadrant.inflow", L("유입", "Inflow"))}</div>

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
