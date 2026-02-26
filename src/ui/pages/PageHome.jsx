import React, { useMemo, useRef } from "react";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { TagList } from "../components/TagList";
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

  // Short-term scenario shift signal: compare 20D vs 60D (daily packs)
  const getPeriodPack = (p) => {
    const periods = daily?.periods && typeof daily.periods === "object" ? daily.periods : null;
    if (!periods) return null;
    return periods[p] ?? periods[String(p).toUpperCase()] ?? periods[String(p).toLowerCase()] ?? null;
  };

  const getTopKFromPack = (pack) => {
    if (!pack) return null;
    const tk = pack?.topK;
    if (Number.isFinite(tk)) return Number(tk);
    const pObj = pack?.probs && typeof pack.probs === "object" ? pack.probs : null;
    if (!pObj) return null;
    const top = Object.entries(pObj)
      .map(([k, v]) => [Number(k), parseProbEntry(v).p])
      .filter(([k, p]) => Number.isFinite(k) && typeof p === "number" && Number.isFinite(p))
      .sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  };

  const pack20 = getPeriodPack("20D") || getPeriodPack("20d");
  const pack60 = getPeriodPack("60D") || getPeriodPack("60d");

  const topK20 = getTopKFromPack(pack20);
  const topK60 = getTopKFromPack(pack60);

  const shortTermShiftTag =
    topK20 != null && topK60 != null && topK20 !== topK60
      ? (isKo ? `ℹ️ 시나리오 변경 시그널` : `ℹ️ Scenario Change Signal`)
      : null;


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
    const base = Array.isArray(scoreCopy?.reasonTags)
      ? scoreCopy.reasonTags.filter((v) => typeof v === "string" && v.trim())
      : [];

    if (typeof shortTermShiftTag === "string" && shortTermShiftTag.trim()) {
      base.unshift(shortTermShiftTag);
    }

    return base;
  }, [scoreCopy, shortTermShiftTag]);
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

  // A-2: show intraday factors as "since previous close" moves (more intuitive for same-day checks)
  const a2Moves = useMemo(() => {
    const prices = intraday?.prices ?? null;
    const ts = Array.isArray(prices?.ts) ? prices.ts : null;
    const close = prices?.close && typeof prices.close === "object" ? prices.close : null;
    if (!ts || ts.length < 3 || !close) return null;

    const lastTs = ts[ts.length - 1];
    const lastDay = typeof lastTs === "string" ? lastTs.slice(0, 10) : null;
    if (!lastDay) return null;

    // Anchor = earliest timestamp within the lastDay segment (after our prev-close anchor injection).
    let anchorIdx = -1;
    let anchorTime = Infinity;
    for (let i = 0; i < ts.length; i++) {
      const d = typeof ts[i] === "string" ? ts[i].slice(0, 10) : null;
      if (d !== lastDay) continue;
      const tms = Date.parse(ts[i]);
      if (Number.isFinite(tms) && tms < anchorTime) {
        anchorTime = tms;
        anchorIdx = i;
      }
    }
    if (anchorIdx < 0) return null;

    const lastIdx = ts.length - 1;

    const pct = (sym) => {
      const arr = close?.[sym];
      if (!Array.isArray(arr) || arr.length !== ts.length) return null;
      const a = arr[anchorIdx];
      const b = arr[lastIdx];
      if (typeof a !== "number" || typeof b !== "number" || !Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
      return (b - a) / a; // fraction
    };

    const pQQQM = pct("QQQM");
    const pXLP = pct("XLP");
    const pVOO = pct("VOO");
    const pUUP = pct("UUP");
    const pGLD = pct("GLD");

    const pctDaily = (keys) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) {
        const v = daily?.prices?.[k]?.changePct;
        if (typeof v === "number" && Number.isFinite(v)) return v;
        const vf = intraday?.dailyFallback?.[k]?.changePct;
        if (typeof vf === "number" && Number.isFinite(vf)) return vf;
      }
      return null;
    };

    const lpDaily = (key) => {
      const p = daily?.prices?.[key] ?? intraday?.dailyFallback?.[key];
      if (!p || typeof p !== "object") return null;
      const last = typeof p.last === "number" && Number.isFinite(p.last) ? p.last : null;
      const prev = typeof p.prevClose === "number" && Number.isFinite(p.prevClose) ? p.prevClose : null;
      if (last == null || prev == null) return null;
      return { last, prev };
    };

    const lpSeries = (sym) => {
      const arr = close?.[sym];
      if (!Array.isArray(arr) || arr.length !== ts.length) return null;
      const prev = arr[anchorIdx];
      const last = arr[lastIdx];
      if (typeof prev !== "number" || typeof last !== "number" || !Number.isFinite(prev) || !Number.isFinite(last)) return null;
      return { last, prev };
    };

    const lp = (sym, dailyKeys = []) => {
      return (
        lpSeries(sym) ||
        dailyKeys.map((k) => lpDaily(k)).find(Boolean) ||
        null
      );
    };

    const pTNX = pct("^TNX") ?? pct("TNX") ?? pctDaily(["TNX", "^TNX"]);
    const pVIX = pct("^VIX") ?? pct("VIX") ?? pctDaily(["VIX", "^VIX"]);

    const fmtPct = (p) => (p == null ? "--" : `${(p * 100).toFixed(2)}%`);
    const fmtLevel = (last, prev, decimals = 2, fallbackZero = false) => {
      const L0 = fallbackZero ? 0 : null;
      const a = (last == null || !Number.isFinite(last)) ? L0 : last;
      const b = (prev == null || !Number.isFinite(prev)) ? L0 : prev;
      if (a == null) return "--";
      if (b == null) return `${a.toFixed(decimals)}`;
      const diff = a - b;
      const sign = diff >= 0 ? "+" : "";
      return `${a.toFixed(decimals)} (${sign}${diff.toFixed(decimals)})`;
    };
    const fmtVixLevel = (v, fallbackZero = false) => {
      const vv = (v == null || !Number.isFinite(v)) ? (fallbackZero ? 0 : null) : v;
      if (vv == null) return "--";
      const label = vv < 15 ? L("낮음", "Low") : vv < 25 ? L("중간", "Mid") : L("높음", "High");
      const suffix = (v == null || !Number.isFinite(v)) && fallbackZero ? L("중립", "Neutral") : label;
      return `${vv.toFixed(1)} (${suffix})`;
    };

    const qqqmLP = lp("QQQM", ["QQQM"]);
    const xlpLP = lp("XLP", ["XLP"]);
    const vooLP = lp("VOO", ["VOO"]);
    const uupLP = lp("UUP", ["UUP"]);
    const gldLP = lp("GLD", ["GLD"]);
    const tnxLP = lp("^TNX", ["TNX", "^TNX"]) || lp("TNX", ["TNX", "^TNX"]);
    const vixLP = lp("^VIX", ["VIX", "^VIX"]) || lp("VIX", ["VIX", "^VIX"]);

    // VIX bar should represent LEVEL (low↔high), not % change.
    const vixLevel = vixLP?.last;
    const vixBar = (typeof vixLevel === "number" && Number.isFinite(vixLevel))
      ? (Math.max(-1, Math.min(1, (vixLevel - 20) / 10)) * 0.03)
      : null;

    return {
      lastDay,
      lastTs,
      // Pairs (fraction)
      qqqmMinusXlp: pQQQM != null && pXLP != null ? (pQQQM - pXLP) : null,
      voo: pVOO,
      uupMinusGld: pUUP != null && pGLD != null ? (pUUP - pGLD) : null,
      tnx: (pTNX == null ? null : pTNX),
      vix: vixBar,
      // Right-side display texts
      texts: {
        xlpQqqm: `${fmtLevel(qqqmLP?.last, qqqmLP?.prev, 2)} / ${fmtLevel(xlpLP?.last, xlpLP?.prev, 2)}`,
        voo: fmtLevel(vooLP?.last, vooLP?.prev, 2),
        tnx: fmtLevel(tnxLP?.last, tnxLP?.prev, 2, false),
        usdGold: `${fmtLevel(uupLP?.last, uupLP?.prev, 2)} / ${fmtLevel(gldLP?.last, gldLP?.prev, 2)}`,
        vix: fmtVixLevel(vixLP?.last, false),
      },
      // For tooltip/debug
      _raw: { pQQQM, pXLP, pVOO, pUUP, pGLD, pTNX, pVIX, anchorIdx, lastIdx },
      fmt: fmtPct,
    };
  }, [intraday?.prices, daily?.prices]);

  const A2Bar = ({ label, value, rightText }) => {
    const vmax = 0.03; // 3% full-scale (A is allowed to be volatile)
    const v = typeof value === "number" && Number.isFinite(value) ? value : 0; // default neutral
    const mag = Math.min(1, Math.abs(v) / vmax);
    const dir = v >= 0 ? 1 : -1;

    const pctText = `${(v * 100).toFixed(2)}%`;

    return (
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>{label}</span>
          <span className="tabular-nums">{rightText ?? pctText}</span>
        </div>

        {/* Centered bar (like B-2): left=down, right=up */}
        <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden relative flex">
          <div className="w-1/2 h-full flex justify-end">
            {dir < 0 ? (
              <div className="h-full bg-white/40" style={{ width: `${Math.round(mag * 100)}%` }} />
            ) : null}
          </div>
          <div className="w-1/2 h-full flex justify-start">
            {dir > 0 ? (
              <div className="h-full bg-white/40" style={{ width: `${Math.round(mag * 100)}%` }} />
            ) : null}
          </div>
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
        </div>
      </div>
    );
  };

  const a2Meta = useMemo(() => {
    if (!a2Moves?.lastTs) return { sessionET: a2Moves?.lastDay ?? "--", lastLocal: "--", lastET: "--" };
    const ms = Date.parse(a2Moves.lastTs);
    if (!Number.isFinite(ms)) return { sessionET: a2Moves?.lastDay ?? "--", lastLocal: String(a2Moves.lastTs), lastET: String(a2Moves.lastTs) };
    const d = new Date(ms);
    const lastLocal = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
    const lastET = new Intl.DateTimeFormat(undefined, { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
    return { sessionET: a2Moves?.lastDay ?? "--", lastLocal, lastET };
  }, [a2Moves?.lastDay, a2Moves?.lastTs]);



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
        <div>
          <Card title={tSafe(t, "a2.factors", L("요인 (당일 변동)", "Factors (Today move)"))} subtitle={tSafe(t, "a2.factorsSub", L("전일 종가 대비", "vs previous close"))}>

            {a2Moves ? (
              <div>
                <A2Bar label={L("XLP(방어) ↔ QQQM(성장)", "XLP(Defense) ↔ QQQM(Growth)")} value={a2Moves.qqqmMinusXlp} rightText={a2Moves?.texts?.xlpQqqm} />
                <A2Bar label={L("VOO(시장: 하락 ↔ 상승)", "VOO(Market: down ↔ up)")} value={a2Moves.voo} rightText={a2Moves?.texts?.voo} />
                <A2Bar label={L("^TNX(금리: 하락 ↔ 상승)", "^TNX(Rates: down ↔ up)")} value={a2Moves.tnx} rightText={a2Moves?.texts?.tnx} />
                <A2Bar label={L("달러(UUP) ↔ 금(GLD)", "USD(UUP) ↔ Gold(GLD)")} value={a2Moves.uupMinusGld} rightText={a2Moves?.texts?.usdGold} />
                <A2Bar label={L("^VIX(공포: 하락 ↔ 상승)", "^VIX(Fear: down ↔ up)")} value={a2Moves.vix} rightText={a2Moves?.texts?.vix} />
                <div className="mt-2 text-[10px] text-white/50">
                  {L("기준일", "Session")}: {a2Moves.lastDay} · {L("마지막", "Last")}: {String(a2Moves.lastTs).slice(0, 19).replace("T", " ")}
                </div>
              </div>
            ) : (
              <div className="text-xs text-white/60">{L("장중 데이터가 없어 당일 변동을 계산할 수 없습니다.", "Intraday data not available to compute today's move.")}</div>
            )}
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