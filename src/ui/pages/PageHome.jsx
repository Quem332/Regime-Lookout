import React, { useMemo, useRef } from "react";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import FactorBars from "../components/FactorBars";
import { buildOneLineVerdict, buildScoreCopy } from "../../core/verdict";
import { buildMriViewModel, tSafe } from "../render/mriPipeline";

function isInteractiveTarget(el) {
  try {
    return Boolean(
      el?.closest?.("button, a, input, textarea, select, [role='button'], [data-stop-toggle='1']")
    );
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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function clamp01(v) {
  return clamp(v, 0, 1);
}

function parseProbEntry(v) {
  if (typeof v === "number" && Number.isFinite(v)) return { p: v, c: null };
  if (Array.isArray(v) && typeof v[0] === "number") {
    const p = Number(v[0]);
    const c = typeof v[1] === "number" ? Number(v[1]) : null;
    return { p: Number.isFinite(p) ? p : null, c: Number.isFinite(c) ? c : null };
  }
  if (v && typeof v === "object") {
    const p = v.p ?? v.prob ?? v.value;
    const c = v.c ?? v.conf ?? v.confidence;
    const pp = typeof p === "number" ? p : null;
    const cc = typeof c === "number" ? c : null;
    return { p: Number.isFinite(pp) ? pp : null, c: Number.isFinite(cc) ? cc : null };
  }
  return { p: null, c: null };
}

export function PageHome({ api, tab, setTab, t, lang }) {
  const isKo = String(lang || "").toLowerCase().startsWith("ko");
  const L = (ko, en) => (isKo ? ko : en);

  const W_PROB = L("확률", "Probability");
  const W_CONF = L("신뢰도", "Confidence");

  const vm = useMemo(() => buildMriViewModel({ api, t }), [api, t]);

  const daily = vm.raw?.daily ?? vm.daily ?? null;
  const intraday = vm.raw?.intraday ?? vm.intraday ?? null;
  const status = vm.raw?.status ?? vm.status ?? null;

  const asOf = vm.meta?.asOf ?? daily?.meta?.asOf ?? "";
  const marketOpen = Boolean(vm.raw?.marketOpen ?? status?.marketOpen ?? false);
  const countdown = vm.raw?.timers?.countdown ?? status?.timers?.countdown ?? "--:--";

  // "a1" (Daily) <-> "a2" (Intraday)
  const view = tab ?? "a1";

  // Tap toggles view (ignores interactive elements)
  const downRef = useRef(null);
  const onPointerDown = (e) => {
    if (isInteractiveTarget(e.target)) return;
    downRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = (e) => {
    if (isInteractiveTarget(e.target)) return;
    const start = downRef.current;
    downRef.current = null;
    if (!start) return;
    const end = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!isTapLike(start, end)) return;
    setTab?.((v) => (v === "a1" ? "a2" : "a1"));
  };

  // Daily core
  const score = Number.isFinite(daily?.score) ? daily.score : null;
  const Cfinal = Number.isFinite(daily?.Cfinal) ? daily.Cfinal : null;
  const regime7 = daily?.regime7 ?? "--";

  const V = daily?.V || daily?.vec || daily?.featuresZ || null;
  const x = Array.isArray(V) ? V[0] : V && typeof V === "object" ? V.x : null;
  const y = Array.isArray(V) ? V[1] : V && typeof V === "object" ? V.y : null;

  const scoreLabel = useMemo(() => {
    if (score == null || Number.isNaN(score)) return "--";
    const s = Number(score);
    if (s >= 67) return tSafe(lang, "scoreLabels.calm", L("안정", "Calm"));
    if (s >= 34) return tSafe(lang, "scoreLabels.watch", L("관찰", "Watch"));
    return tSafe(lang, "scoreLabels.risk", L("주의", "Risk"));
  }, [score, lang]);

  const oneLine = useMemo(() => {
    return buildOneLineVerdict({
      score: typeof score === "number" ? score : null,
      Cfinal: typeof Cfinal === "number" ? Cfinal : null,
      regime7: daily?.regime7 ?? null,
      tags: daily?.tags ?? null,
      t,
    });
  }, [score, Cfinal, daily?.regime7, daily?.tags, t]);

  const scoreCopy = useMemo(() => {
    return buildScoreCopy({
      score: typeof score === "number" ? score : null,
      Cfinal: typeof Cfinal === "number" ? Cfinal : null,
      regime7: daily?.regime7 ?? null,
      probs: daily?.probs ?? null,
      tags: daily?.tags ?? null,
      t,
      lang,
    });
  }, [score, Cfinal, daily?.regime7, daily?.probs, daily?.tags, t, lang]);

  // Scenario probabilities (supports {p,c} entries)
  const probs = daily?.probs && typeof daily.probs === "object" ? daily.probs : {};
  const probList = useMemo(() => {
    return Object.entries(probs)
      .map(([k, v]) => [k, parseProbEntry(v)])
      .filter(([, obj]) => typeof obj?.p === "number" && Number.isFinite(obj.p))
      .sort((a, b) => b[1].p - a[1].p)
      .slice(0, 6);
  }, [daily?.probs]);

  // Quadrant dot
  const dotPos = useMemo(() => {
    const xx = x == null ? 0 : clamp(Number(x), -3, 3);
    const yy = y == null ? 0 : clamp(Number(y), -3, 3);
    return { left: ((xx + 3) / 6) * 100, top: (1 - (yy + 3) / 6) * 100 };
  }, [x, y]);

  const nextOpenInfo = useMemo(() => {
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
    <div
      className="relative px-4 pb-6 min-h-[calc(100dvh-4rem)]"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ touchAction: "pan-y" }}
    >
      {/* A-1 (Daily) */}
      {view === "a1" ? (
        <div className="grid gap-3">
          <Card title={tSafe(lang, "a1.title", L("오늘", "Today"))} subtitle={tSafe(lang, "a1.subtitle", L("위험조정 해석", "Risk-adjusted interpretation"))}>
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-end gap-3">
                <div className="text-5xl font-extrabold text-white leading-none">{score == null ? "--" : String(Math.round(score))}</div>
                <div className="pb-1">
                  <div className="text-sm font-semibold text-white/90">{scoreLabel}</div>
                  <div className="text-xs text-white/70">
                    🛡 {tSafe(lang, "score.confidence", L("신뢰도", "Confidence"))} {Cfinal == null ? "--" : String(Math.round(Cfinal))}
                    {daily?.rel?.capped ? ` (${tSafe(lang, "score.capped", L("상한", "Capped"))})` : ""}
                  </div>
                </div>
              </div>

              <div className="pb-1 text-right">
                <div className="text-xs text-white/70">
                  {tSafe(lang, "score.regime", L("레짐", "Regime"))} {String(regime7)}
                </div>
                <div className="text-xs text-white/60">{asOf || "--"}</div>
              </div>
            </div>

            <div className="mt-2 text-sm text-white/85 leading-snug">{scoreCopy?.summary ?? oneLine ?? ""}</div>
            <div className="mt-1 text-xs text-white/60 leading-snug">{scoreCopy?.warning ?? ""}</div>
            <div className="mt-1 text-xs text-white/55 leading-snug">{scoreCopy?.reasonsText ?? ""}</div>

            {Array.isArray(scoreCopy?.reasonTags) && scoreCopy.reasonTags.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {scoreCopy.reasonTags.map((tg, i) => (
                  <Pill key={`rt-${i}`} tone={tg.tone || "gray"} label={tg.label} msg={tg.msg} lang={lang} />
                ))}
              </div>
            ) : null}

            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-white/40"
                style={{ width: `${Math.round(clamp01((Number(score ?? 0) || 0) / 100) * 100)}%` }}
              />
            </div>
          </Card>

          <Card title={tSafe(lang, "ui.probabilities", L("시나리오 확률", "Scenario Probabilities"))} subtitle={tSafe(lang, "daily.topScenario", L("확률 분포", "Probability distribution"))}>
            <div className="space-y-2">
              {probList.length ? (
                probList.map(([k, obj]) => {
                  const label = t?.(`scenarios.${k}`, `S${k}`) ?? `S${k}`;
                  const pct = Math.round(obj.p * 100);
                  const cShown = Number.isFinite(obj.c) ? obj.c : Cfinal;
                  return (
                    <div key={k} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span className="truncate">{label}</span>
                        <span className="tabular-nums">
                          {`${W_PROB} ${pct}%`}{Number.isFinite(cShown) ? ` · ${W_CONF} ${Math.round(cShown)}` : ""}
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
        // A-2 (Intraday) — always accessible (no lock overlay)
        <div className="grid gap-3">
            </Card>
          ) : null}

          <Card title={tSafe(lang, "a2.factors", L("요인 (6D)", "Factors (6D)"))} subtitle={tSafe(lang, "a2.factorsSub", L("z-score + raw", "z-score + raw snapshot"))}>
            <FactorBars V={daily?.V} raw={api?.mri?.inputsRaw ?? api?.mri?.daily?.inputsRaw ?? api?.mri?.meta?.inputsRaw} />
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
                title={tSafe(lang, "quadrant.tip", L("성장↔방어 / 유입↔유출", "Growth↔Defense / Inflow↔Outflow"))}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-white/70">
              <span>{tSafe(lang, "factors.growthDefense", L("QQQM(성장) ↔ XLP(방어)", "QQQM (Growth) ↔ XLP (Defense)"))}: {x == null ? "--" : Number(x).toFixed(2)}</span>
              <span>{tSafe(lang, "factors.inflowOutflow", L("VOO(유입 ↔ 유출)", "VOO (Inflow ↔ Outflow)"))}: {y == null ? "--" : Number(y).toFixed(2)}</span>
            </div>
          </Card>

          <Card title={tSafe(lang, "a2.intra", L("장중 진단", "Intraday Diagnostics"))} subtitle={marketOpen ? tSafe(lang, "a2.intraOpen", L("실시간", "Live")) : tSafe(lang, "a2.intraClosed", L("장 외", "Off-hours"))}>
            {intraday?.intraday ? (
              <div className="text-xs text-white/70 space-y-1">
                <div>z_short: {Number.isFinite(intraday?.intraday?.zShort) ? Number(intraday.intraday.zShort).toFixed(2) : "--"}</div>
                <div>corrAvg: {Number.isFinite(intraday?.intraday?.corrAvg) ? Number(intraday.intraday.corrAvg).toFixed(2) : "--"}</div>
                <div>corrSurge: {intraday?.intraday?.corrSurge ? "YES" : "NO"}</div>
              </div>
            ) : (
              <div className="text-xs text-white/60">--</div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}