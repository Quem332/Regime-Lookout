import React, { useMemo, useRef } from "react";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { TagList } from "../components/TagList";
import FactorBars from "../components/FactorBars";
import { buildOneLineVerdict, buildScoreCopy } from "../../core/verdict";
import { buildMriViewModel, tSafe, L } from "../render/mriPipeline";

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

  const fmtMMSS = (sec) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (hh > 0) return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const W_PROB = L("확률", "Probability");
  const W_CONF = L("신뢰도", "Confidence");

  const vm = useMemo(() => buildMriViewModel({ api, t }), [api, t]);

  const daily = vm.raw?.daily ?? vm.daily ?? null;
  const intraday = vm.raw?.intraday ?? vm.intraday ?? null;
  const status = vm.raw?.status ?? vm.status ?? null;

  const asOf = vm.meta?.asOf ?? daily?.meta?.asOf ?? "";
  const fmtAsOfDate = (s) => {
    if (!s || typeof s !== "string") return "";
    if (s.includes("T")) return s.split("T")[0];
    return s;
  };
  const marketOpen = Boolean(vm.raw?.marketOpen ?? status?.marketOpen ?? false);
  const countdown = vm.raw?.timers?.countdown ?? status?.timers?.countdown ?? "--:--";

  const scoreLocked = !!api?.statusComputed?.scoreLocked;
  const scoreLockReason = api?.statusComputed?.scoreLockReason || "";
  const mc = api?.statusComputed?.marketClock || null;

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

  // Daily core (anchor) + Intraday (today tape)
  const dailyScore = Number.isFinite(daily?.score) ? daily.score : null;
  const dailyC = Number.isFinite(daily?.Cfinal) ? daily.Cfinal : null;

  const hasIntradayScenario = Boolean(marketOpen && intraday?.scenario);
  const todayScenario = hasIntradayScenario ? intraday.scenario : daily;

  const score = Number.isFinite(todayScenario?.score) ? todayScenario.score : dailyScore;
  const baseCfinal = Number.isFinite(todayScenario?.Cfinal) ? todayScenario.Cfinal : dailyC;
  const regime7 = todayScenario?.regime7 ?? daily?.regime7 ?? "--";

  const todayProbs = (todayScenario?.probs && typeof todayScenario.probs === "object") ? todayScenario.probs : (daily?.probs ?? {});
  const todayTags = Array.isArray(todayScenario?.tags) ? todayScenario.tags : (Array.isArray(daily?.tags) ? daily.tags : []);

  // Consistency: how well does today's intraday scenario align with the daily (60D) distribution?
  const intradayTopK = (() => {
    const tk = todayScenario?.topK;
    if (Number.isFinite(tk)) return Number(tk);
    const pObj = todayScenario?.probs && typeof todayScenario.probs === "object" ? todayScenario.probs : null;
    if (!pObj) return null;
    const top = Object.entries(pObj)
      .map(([k, v]) => [Number(k), parseProbEntry(v).p])
      .filter(([k, p]) => Number.isFinite(k) && typeof p === "number" && Number.isFinite(p))
      .sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  })();

  const consistencyP = (hasIntradayScenario && intradayTopK != null)
    ? (typeof daily?.probs?.[String(intradayTopK)] === "number" ? Number(daily.probs[String(intradayTopK)]) : null)
    : null;

  const consistency = typeof consistencyP === "number" && Number.isFinite(consistencyP) ? clamp01(consistencyP) : null;

  // Reflect consistency into confidence: divergence reduces confidence (max -20 when fully inconsistent).
  const Cfinal = (() => {
    if (!Number.isFinite(baseCfinal)) return null;
    if (!hasIntradayScenario || consistency == null) return baseCfinal;
    const penalized = Number(baseCfinal) - (1 - consistency) * 20;
    return Math.round(clamp(penalized, 0, 100));
  })();

  const V = daily?.V || daily?.vec || daily?.featuresZ || null;
  const x = Array.isArray(V) ? V[0] : V && typeof V === "object" ? V.x : null;
  const y = Array.isArray(V) ? V[1] : V && typeof V === "object" ? V.y : null;

  const scoreLabel = useMemo(() => {
    if (score == null || Number.isNaN(score)) return "--";
    const s = Number(score);
    if (s >= 67) return tSafe(t, "scoreLabels.calm", L("안정", "Calm"));
    if (s >= 34) return tSafe(t, "scoreLabels.watch", L("관찰", "Watch"));
    return tSafe(t, "scoreLabels.risk", L("주의", "Risk"));
  }, [score, lang]);

  const oneLine = useMemo(() => {
    return buildOneLineVerdict({
      score: typeof score === "number" ? score : null,
      Cfinal: typeof Cfinal === "number" ? Cfinal : null,
      regime7: regime7 ?? null,
      tags: todayTags ?? null,
      t,
    });
  }, [score, Cfinal, regime7, todayTags, t]);

  const scoreCopy = useMemo(() => {
    return buildScoreCopy({
      score: typeof score === "number" ? score : null,
      Cfinal: typeof Cfinal === "number" ? Cfinal : null,
      regime7: regime7 ?? null,
      probs: todayProbs ?? null,
      tags: todayTags ?? null,
      t,
      lang,
    });
  }, [score, Cfinal, regime7, todayProbs, todayTags, t, lang]);
  const mergedReasonTags = useMemo(() => {
    const base = Array.isArray(scoreCopy?.reasonTags) ? [...scoreCopy.reasonTags] : [];
    if (hasIntradayScenario && typeof consistency === "number") {
      const dTop = Number.isFinite(daily?.topK) ? Number(daily.topK) : null;
      const iTop = intradayTopK != null ? intradayTopK : null;
      if (dTop != null && iTop != null && dTop !== iTop) {
        const msgKo = `일봉 #${dTop} ↔ 장중 #${iTop} (일치도 ${Math.round(consistency * 100)}%)`;
        const msgEn = `Daily #${dTop} ↔ Intraday #${iTop} (consistency ${Math.round(consistency * 100)}%)`;
        base.unshift({
          level: consistency < 0.15 ? "red" : "yellow",
          label: L("⚠️ 장중 괴리", "⚠️ Intraday drift"),
          msg: L(msgKo, msgEn),
        });
      }
    }
    return base;
  }, [scoreCopy?.reasonTags, hasIntradayScenario, consistency, intradayTopK, daily?.topK, lang]);



  // Scenario probabilities (supports {p,c} entries)
  const probs = todayProbs;
  const probList = useMemo(() => {
    return Object.entries(probs)
      .map(([k, v]) => [k, parseProbEntry(v)])
      .filter(([, obj]) => typeof obj?.p === "number" && Number.isFinite(obj.p))
      .sort((a, b) => b[1].p - a[1].p)
      .slice(0, 6);
  }, [todayScenario?.probs, daily?.probs]);

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
      <div className={scoreLocked ? "pointer-events-none" : ""}>
      {/* A-1 (Daily) */}
      {view === "a1" ? (
        <div className="grid gap-3">
          <Card title={tSafe(t, "a1.title", L("오늘", "Today"))} subtitle={tSafe(t, "a1.subtitle", L("위험조정 해석", "Risk-adjusted interpretation"))}>
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-end gap-3">
                <div className="text-5xl font-extrabold text-white leading-none">{score == null ? "--" : String(Math.round(score))}</div>
                <div className="pb-1">
                  <div className="text-sm font-semibold text-white/90">{scoreLabel}</div>
                  <div className="text-xs text-white/70">
                    🛡 {tSafe(t, "score.confidence", L("신뢰도", "Confidence"))} {Cfinal == null ? "--" : String(Math.round(Cfinal))}
                    {daily?.rel?.capped ? ` (${tSafe(t, "score.capped", L("상한", "Capped"))})` : ""}
                  </div>
                </div>
              </div>

              <div className="pb-1 text-right">
                <div className="text-xs text-white/70">
                  {tSafe(t, "score.regime", L("레짐", "Regime"))} {String(regime7)}
                </div>
                <div className="text-xs text-white/60">{fmtAsOfDate(asOf) || "--"}</div>
              </div>
            </div>

            <div className="mt-2 text-sm text-white/85 leading-snug">{scoreCopy?.summary ?? oneLine ?? ""}</div>
            <div className="mt-1 text-xs text-white/60 leading-snug">{scoreCopy?.warning ?? ""}</div>

            {Array.isArray(mergedReasonTags) && mergedReasonTags.length ? (
              <div className="mt-2">
                <TagList tags={mergedReasonTags} lang={lang} />
              </div>
            ) : null}

            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-white/40"
                style={{ width: `${Math.round(clamp01((Number(score ?? 0) || 0) / 100) * 100)}%` }}
              />
            </div>
          </Card>
        </div>
      ) : (
        // A-2 (Intraday)
        <div className="grid gap-3">

          <Card title={tSafe(t, "a2.factors", L("요인 (6D)", "Factors (6D)"))} subtitle={tSafe(t, "a2.factorsSub", L("z-score + raw", "z-score + raw snapshot"))}>
            <FactorBars lang={lang} V={daily?.V} raw={api?.mri?.inputsRaw ?? api?.mri?.daily?.inputsRaw ?? api?.mri?.meta?.inputsRaw} />
          </Card>

          <Card title={tSafe(t, "ui.quadrant", L("포지션 맵", "Position Map"))} subtitle={tSafe(t, "quadrant.subtitle", L("성장↔방어, 유입↔유출", "Growth↔Defense, Inflow↔Outflow"))}>
            <div className="relative w-full aspect-[16/9] rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="absolute inset-0">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
              </div>

              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-white/60">{tSafe(t, "quadrant.defense", L("방어", "Defense"))}</div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/60">{tSafe(t, "quadrant.growth", L("성장", "Growth"))}</div>
              <div className="absolute left-1/2 bottom-2 -translate-x-1/2 text-[10px] text-white/60">{tSafe(t, "quadrant.outflow", L("유출", "Outflow"))}</div>
              <div className="absolute left-1/2 top-2 -translate-x-1/2 text-[10px] text-white/60">{tSafe(t, "quadrant.inflow", L("유입", "Inflow"))}</div>

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

          <Card title={tSafe(t, "a2.intra", L("장중 진단", "Intraday Diagnostics"))} subtitle={marketOpen ? tSafe(t, "a2.intraOpen", L("실시간", "Live")) : tSafe(t, "a2.intraClosed", L("장 외", "Off-hours"))}>
            {intraday?.intraday ? (
              <div className="text-xs text-white/70 space-y-1">
                <div>z_short: {Number.isFinite(intraday?.intraday?.zShort) ? Number(intraday.intraday.zShort).toFixed(2) : "--"}</div>
                <div>corrAvg: {Number.isFinite(intraday?.intraday?.corrAvg) ? Number(intraday.intraday.corrAvg).toFixed(2) : "--"}</div>
                <div>corrSurge: {intraday?.intraday?.corrSurge ? "YES" : "NO"}</div>
              </div>
	            ) : null}
          </Card>
        </div>
      )}

      </div>

      {scoreLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative px-5 py-4 rounded-2xl bg-black/70 border border-white/10 text-white max-w-[90%]">
            {scoreLockReason === "PREMARKET" ? (
              <>
                <div className="text-sm opacity-80">{L("프리장", "Premarket")}</div>
                <div className="text-2xl font-semibold mt-1">{L("개장까지 ", "Opens in ")}{fmtMMSS(mc?.secondsToOpen || 0)}</div>
                <div className="text-xs opacity-70 mt-2">{L("개장 전에는 스코어/시나리오를 잠시 비활성화합니다.", "Scores are hidden before the open.")}</div>
              </>
            ) : scoreLockReason === "OPEN_WARMUP" ? (
              <>
                <div className="text-sm opacity-80">{L("데이터 준비중", "Warming up")}</div>
                <div className="text-2xl font-semibold mt-1">{L("개장 후 ", "Since open: ")}{fmtMMSS(mc?.secondsSinceOpen || 0)}</div>
                <div className="text-xs opacity-70 mt-2">{L("첫 스냅샷이 반영되면 자동으로 활성화됩니다.", "Will unlock after the first snapshot.")}</div>
              </>
            ) : (
              <>
                <div className="text-sm opacity-80">{L("데이터 상태", "Data status")}</div>
                <div className="text-2xl font-semibold mt-1">{L("잠시 비활성화", "Temporarily locked")}</div>
                <div className="text-xs opacity-70 mt-2">{L("네트워크/배포 상태를 확인하세요.", "Check network/deploy status.")}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
