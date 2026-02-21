import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeProbabilitiesSpec,
  computeReliabilityCSpec,
  computeRegime7Spec,
  computeTodayScoreSpec,
} from "../core/engine.daily";
import { buildReasoningTags } from "../core/tags";
import { normalizeLatest } from "../core/normalize.latest";
import { upperTriangleAvgCorrMock } from "../core/mock";
import { logger } from "../core/logger";
import { idbGet, idbSet } from "../storage/idb";
// -----------------------------
// Helpers (module-level)
// -----------------------------

function num(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

/**
 * Build a "daily" pack from featuresZ using the spec functions.
 * This is used both for the 252D (today) and for period packs (20D/60D/252D).
 * It intentionally does not depend on backend-provided "daily" fields so the UI stays robust
 * when daily_latest.json is missing or has older schema.
 */
function buildDailyFromFeaturesZ(featuresZ, meta = {}, intraday = null) {
  if (!featuresZ || typeof featuresZ !== "object") return null;

  const V = [featuresZ.x, featuresZ.y, featuresZ.rates, featuresZ.usd, featuresZ.vix, featuresZ.goldFear].map((v) => num(v, 0));

  const latencyMin = meta?.latencyMin ?? meta?.latencyMinutes ?? meta?.latency ?? null;
  const healthLevel = meta?.dataHealth?.level ?? meta?.dataHealthLevel ?? null;

  const dataOk = Number.isFinite(latencyMin) ? latencyMin <= 30 : true;
  const dataOkFinal = dataOk && !["BAD", "DOWN", "ERROR"].includes(String(healthLevel ?? "").toUpperCase());

  const corrAvgDaily = intraday?.corrAvg ?? meta?.intraday?.corrAvg ?? upperTriangleAvgCorrMock();
  const corrSurgeDaily = Boolean(intraday?.corrSurge ?? meta?.intraday?.corrSurge ?? false);
  const zShortDaily = Number.isFinite(intraday?.zShort)
    ? intraday.zShort
    : Number.isFinite(meta?.intraday?.zShort)
      ? meta.intraday.zShort
      : 0;

  const { probs, passedKeys } = computeProbabilitiesSpec(V);
  const rel = computeReliabilityCSpec({ dataOk: dataOkFinal, corrAvg: corrAvgDaily, corrSurge: corrSurgeDaily, zShort: zShortDaily, V, probs });
  const Cfinal = rel.C;
  const regime7 = computeRegime7Spec({ passedKeys, Cfinal, V });
  const scorePack = computeTodayScoreSpec({ probs, Cfinal, corrAvg: corrAvgDaily, V, regime7 });

  const topEntry = Object.entries(probs).sort((a, b) => b[1] - a[1])[0];
  const topK = topEntry ? Number(topEntry[0]) : null;

  const tags = buildReasoningTags({ V, corrAvg: corrAvgDaily, corrSurge: corrSurgeDaily, zShort: zShortDaily, probs, Cfinal });

  return {
    score: scorePack.score,
    Cfinal,
    regime7,
    topK,
    probs,
    tags,
    V,
    meta: {
      source: meta?.source ?? null,
      inputsRaw: meta?.inputsRaw ?? null,
      dataHealthLevel: meta?.dataHealthLevel ?? meta?.dataHealth?.level ?? null,
    },
  };
}

function buildPeriodMapFromLatest(latest, dailySnapshot, intraday) {
  const periods = latest?.periods && typeof latest.periods === "object" ? latest.periods : null;
  if (!periods) return null;

  const out = {};
  for (const [k, obj] of Object.entries(periods)) {
    const fz = obj?.featuresZ;
    if (!fz || typeof fz !== "object") continue;
    const label = String(k).toLowerCase();
    const daily = buildDailyFromFeaturesZ(fz, { ...(latest || {}), ...(latest?.meta || {}), forceAsOf: latest?.asOf ?? null }, intraday);
    if (daily) out[label] = { daily };
  }

  if (!out["252d"] && dailySnapshot?.daily) out["252d"] = { daily: dailySnapshot.daily };
  return Object.keys(out).length ? out : null;
}


/**
 * Mobile-only data source:
 *  - public/data/daily_latest.json     (EOD / on-push)
 *  - public/data/intraday_latest.json  (market hours)
 *  - (fallback) public/data/latest.json (legacy single-file)
 *  - public/data/calendar.json (optional; used to temporarily increase refresh frequency around events)
 *
 * NOTE: We always add a cache-busting query param + request no-store to avoid stale SW/HTTP caches.
 */

// NOTE:
// - import.meta.env.BASE_URL is usually a PATH (e.g. "/Regime-Lookout/") in production.
// - new URL(relative, base) requires an *absolute* base, otherwise browsers throw
//   "Failed to construct 'URL': Invalid base URL".
// So we first anchor BASE_URL to window.location.origin.
const APP_BASE = import.meta.env.BASE_URL ?? "/";
const ABS_BASE = new URL(APP_BASE, document.baseURI).toString();

const DAILY_URL = new URL("data/daily_latest.json", ABS_BASE).toString();
const INTRADAY_URL = new URL("data/intraday_latest.json", ABS_BASE).toString();
const LEGACY_LATEST_URL = new URL("data/latest.json", ABS_BASE).toString();
const CAL_URL = new URL("data/calendar.json", ABS_BASE).toString();

// Display latency buckets (minutes)
function latencyTone(latencyMin) {
  if (latencyMin == null || !Number.isFinite(latencyMin)) return { tone: "neutral", label: "DATA --:--" };
  if (latencyMin <= 10) return { tone: "good", label: `DATA ${latencyMin}m` };
  if (latencyMin <= 20) return { tone: "warn", label: `DATA ${latencyMin}m` };
  if (latencyMin <= 30) return { tone: "bad", label: `DATA ${latencyMin}m` };
  return { tone: "bad", label: `DATA ${latencyMin}m+` };
}

function toDateSafe(x) {
  try {
    const d = new Date(x);
    return Number.isFinite(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}


async function fetchJson(url, { timeoutMs = 12_000, retries = 2 } = {}) {
  const attemptOnce = async (attempt) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const started = performance.now();
    try {
      logger.debug("net.fetch_start", { url, attempt, timeoutMs });
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: ctrl.signal,
      });
      const text = await res.text();
      const size = text?.length ?? 0;

      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { _nonJson: true, text: text?.slice(0, 5000) };
      }

      if (!res.ok) {
        const msg = data?.detail ? String(data.detail) : `HTTP ${res.status}`;
        throw new Error(`${msg} @ ${url}`);
      }

      logger.debug("net.fetch_ok", {
        url,
        attempt,
        ms: Math.round(performance.now() - started),
        bytes: size,
      });
      return data;
    } finally {
      clearTimeout(t);
    }
  };

  let lastErr = null;
  for (let attempt = 1; attempt <= Math.max(1, retries); attempt++) {
    try {
      return await attemptOnce(attempt);
    } catch (e) {
      lastErr = e;
      const msg = e?.name === "AbortError" ? "timeout_abort" : "fetch_error";
      logger.warn("net.fetch_failed", { url, attempt, message: e?.message ?? String(e), kind: msg });

      // small backoff (attempt 1 -> 250ms, attempt 2 -> 600ms)
      const backoff = attempt === 1 ? 250 : 600;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr ?? new Error(`fetch failed @ ${url}`);
}

function num(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

// Event calendar: { "events":[{"date":"YYYY-MM-DD","time":"HH:MM","name":"CPI"}] }
function parseCalendar(cal) {
  const events = Array.isArray(cal?.events) ? cal.events : [];
  return events
    .map((e) => ({
      name: String(e?.name || "").trim() || "Event",
      date: String(e?.date || "").trim(),
      time: String(e?.time || "").trim(),
    }))
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && /^\d{2}:\d{2}$/.test(e.time));
}

function isInEventWindow(now, events, windowMin = 15) {
  // Interpret date+time in US/Eastern because the original policy is ET-based.
  // We avoid heavy TZ libs and approximate by using the embedded asOf in latest.json if provided.
  // If your latest.json includes tz info, this still behaves safely (windowing by local Date parsing).
  const wms = windowMin * 60_000;
  for (const e of events) {
    // Parse as if it's local; for exact ET, the Actions script should also include `eventWindowActive`.
    const dt = toDateSafe(`${e.date}T${e.time}:00`);
    if (!dt) continue;
    const diff = Math.abs(now.getTime() - dt.getTime());
    if (diff <= wms) return { active: true, event: e, diffMs: diff };
  }
  return { active: false, event: null, diffMs: null };
}


function isMarketOpenET(now) {
  // US/Eastern regular hours: 09:30 - 16:00 ET, Mon-Fri
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const wd = get("weekday") || "";
    if (wd === "Sat" || wd === "Sun") return false;
    const h = Number(get("hour"));
    const m = Number(get("minute"));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
    const mins = h * 60 + m;
    return mins >= (9 * 60 + 30) && mins < (16 * 60);
  } catch {
    return false;
  }
}

function getTZOffsetMinutes(date, timeZone) {
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return (utcDate - tzDate) / 60000;
}

function makeDateInTimeZone({ year, month, day, hour, minute, timeZone }) {
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const off1 = getTZOffsetMinutes(guessUtc, timeZone);
  const pass1 = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) + off1 * 60_000);
  const off2 = getTZOffsetMinutes(pass1, timeZone);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) + off2 * 60_000);
}

function getETParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const out = {};
  for (const p of parts) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: out.weekday,
  };
}

function etDateKey(date) {
  const p = getETParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function computeMarketClock(now = new Date()) {
  const p = getETParts(now);
  const wd = p.weekday;
  const isWeekend = wd === "Sat" || wd === "Sun";
  const mins = p.hour * 60 + p.minute;

  const PRE = 4 * 60;
  const OPEN = 9 * 60 + 30;
  const CLOSE = 16 * 60;

  let phase = "CLOSED";
  if (!isWeekend) {
    if (mins >= PRE && mins < OPEN) phase = "PREMARKET";
    else if (mins >= OPEN && mins < CLOSE) phase = "OPEN";
    else phase = "CLOSED";
  }

  let y = p.year, m = p.month, d = p.day;
  const dayIndexMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let dow = dayIndexMap[wd] ?? 0;

  function addDaysET(n) {
    const base = makeDateInTimeZone({ year: y, month: m, day: d, hour: 12, minute: 0, timeZone: "America/New_York" });
    const moved = new Date(base.getTime() + n * 24 * 60 * 60 * 1000);
    const pp = getETParts(moved);
    y = pp.year; m = pp.month; d = pp.day;
    dow = dayIndexMap[pp.weekday] ?? dow;
  }

  let openDayOffset = 0;
  if (isWeekend) {
    openDayOffset = (8 - dow) % 7;
    if (openDayOffset === 0) openDayOffset = 1;
  } else {
    if (mins < OPEN) openDayOffset = 0;
    else {
      openDayOffset = 1;
      if (dow === 5) openDayOffset = 3;
      if (dow === 6) openDayOffset = 2;
    }
  }

  if (openDayOffset) addDaysET(openDayOffset);
  if (dow === 0) addDaysET(1);
  if (dow === 6) addDaysET(2);

  const nextOpen = makeDateInTimeZone({ year: y, month: m, day: d, hour: 9, minute: 30, timeZone: "America/New_York" });
  const nextPremarket = makeDateInTimeZone({ year: y, month: m, day: d, hour: 4, minute: 0, timeZone: "America/New_York" });

  const secondsToOpen = Math.max(0, Math.floor((nextOpen.getTime() - now.getTime()) / 1000));
  const secondsToPremarket = Math.max(0, Math.floor((nextPremarket.getTime() - now.getTime()) / 1000));

  const openToday = makeDateInTimeZone({ year: p.year, month: p.month, day: p.day, hour: 9, minute: 30, timeZone: "America/New_York" });
  const minutesSinceOpen = phase === "OPEN" ? Math.max(0, Math.floor((now.getTime() - openToday.getTime()) / 60000)) : null;

  return {
    phase,
    nextOpenISO: nextOpen.toISOString(),
    nextPremarketISO: nextPremarket.toISOString(),
    secondsToOpen,
    secondsToPremarket,
    minutesSinceOpen,
  };
}

function formatHMS(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}




function computeNextHalfHour(now) {
  const d = new Date(now.getTime());
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  const nextM = m < 30 ? 30 : 60;
  if (nextM === 60) {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  } else {
    d.setMinutes(30);
  }
  return d;
}

export function useMRIState() {
  const [daily, setDaily] = useState(null);
  const [intraday, setIntraday] = useState(null);
  const [period, setPeriod] = useState(null);
  const [status, setStatus] = useState(null);
  const latestRef = useRef(null); // last latest.json payload
  const dailyScenarioRef = useRef(null); // last daily scenario pack for intraday reuse
  const calRef = useRef({ events: [], loaded: false });
  const healthRef = useRef({ lastOkAt: null, lastError: null, lastErrorAt: null, schema: null });
  const buildDailyFromFeatures = ({ featuresZ, meta }) => {
    return buildDailyFromFeaturesZ(featuresZ, meta, intraday);
  };
    dailyScenarioRef.current = scenarioPack;

    const snapshot = {
      scenario: dailyScenarioRef.current,
      // core outputs
      V,
      probs,
      passedKeys,
      topK,
      topProb: scorePack.pTop,
      Cfinal,
      caps: rel.caps,
      regime7,
      // UI-friendly fields (legacy UIs expect these at top-level)
      asOf: meta?.asOf ?? null,
      regime: (regime7 ?? (topK != null ? String(topK) : null)),
      score: scorePack.score,
      pEff: scorePack.pEff,
      penaltyApplied: scorePack.penaltyApplied,
      flags: scorePack.flags,

      // convenience fields for UI/export (avoid deep meta chains)
      asOf: meta?.asOf ?? null,
      lastTradingDay: meta?.lastTradingDay ?? null,
      fetchedAt: meta?.fetchedAt ?? null,
      source: meta?.source ?? null,
      dataHealthLevel: meta?.dataHealthLevel ?? null,

      // diagnostics
      corrAvgDaily,
      tags,
      meta,

      ts: new Date(),
    };

    setDaily(snapshot);
    try {
      const pMap = buildPeriodMapFromLatest(latestRef.current, snapshot);
      setPeriod(pMap);
    } catch (e) {
      logger.warn("period.build_failed", { message: e?.message });
      setPeriod(null);
    }

    idbSet("dailyResult", { daily: snapshot, savedAt: new Date().toISOString() }).catch((e) =>
      logger.warn("idb.daily_write_failed", { message: e?.message })
    );


// Self-checks (helps catch corrupted data / engine regressions)
try {
  const sumP = Object.values(probs).reduce((a,b)=>a+(typeof b==="number"?b:0),0);
  if (!Number.isFinite(sumP) || Math.abs(sumP - 1) > 0.02) {
    logger.warn("engine.prob_sum_suspicious", { sumP, probs });
  }
  if (!Number.isFinite(Cfinal) || Cfinal < 0 || Cfinal > 100) {
    logger.warn("engine.confidence_out_of_range", { Cfinal, caps: rel.caps });
  }
} catch (e) {
  logger.warn("engine.selfcheck_failed", { message: e?.message });
}
    logger.debug("state.daily_refresh_ok", {
      ms: Math.round(performance.now() - started),
      topK,
      score: scorePack.score,
      Cfinal,
      regime7,
      asOf: meta?.asOf,
      source: meta?.source,
    });
  };

  const setIntradayFromLatest = (latest) => {
    const i = latest?.intraday || null;
    if (!i) return;
    const zShortVal = i?.zShort;
    const corrAvg = i?.corrAvg;

    const deviationReasons = [];

    const alert =
      Boolean(i?.corrSurge) || (typeof zShortVal === "number" && Number.isFinite(zShortVal) && Math.abs(zShortVal) > 2.5);

    if (Boolean(i?.corrSurge)) deviationReasons.push("Correlation surge");
    if (typeof zShortVal === "number" && Number.isFinite(zShortVal) && Math.abs(zShortVal) > 2.5) deviationReasons.push("Short-term dislocation (|z|>2.5)");


    const snapshot = {
      scenario: dailyScenarioRef.current,
      zShort: typeof zShortVal === "number" ? zShortVal : null,
      zShortPct: i?.zShortPct ?? null,
      corrAvg: typeof corrAvg === "number" ? corrAvg : null,
      corrSurge: Boolean(i?.corrSurge),
      intervalUsed: i?.intervalUsed ?? null,
      prices: i?.prices ?? null,
      meta: { cached: Boolean(latest?.cached), latencyMs: latest?.latencyMs ?? null, dataHealthLevel: latest?.dataHealth?.level ?? null },
      dataHealthLevel: latest?.dataHealth?.level ?? null,
      alert,
      deviationReasons,
      deviation: Boolean(alert),
      ts: new Date(),
    };

    setIntraday(snapshot);

    idbSet("intradayCache", { intraday: snapshot, savedAt: new Date().toISOString() }).catch((e) =>
      logger.warn("idb.intraday_write_failed", { message: e?.message })
    );
  };

  const refreshLatest = async () => {
    const started = performance.now();
    const bust = `?t=${Date.now()}`;

    // Prefer split files (daily + intraday). If not present, fall back to legacy single-file.
    const [daily, intraday] = await Promise.all([
      fetchJson(`${DAILY_URL}${bust}`, { timeoutMs: 15_000 }).catch(() => null),
      fetchJson(`${INTRADAY_URL}${bust}`, { timeoutMs: 15_000 }).catch(() => null),
    ]);

    const raw = daily || intraday
      ? {
          schemaVersion: daily?.schemaVersion || intraday?.schemaVersion || "2.3",
          asOf: daily?.asOf || intraday?.asOf || null,
          lastTradingDay: daily?.lastTradingDay || null,
          // Daily inputs
          featuresZ: daily?.featuresZ || null,
          periods: daily?.periods || null,
          // Intraday inputs
          intraday: intraday?.intraday || null,
          // Meta
          dataHealth: daily?.dataHealth || intraday?.dataHealth || null,
          latencyMin:
            typeof intraday?.latencyMin === "number"
              ? intraday.latencyMin
              : typeof daily?.latencyMin === "number"
                ? daily.latencyMin
                : null,
          fetchedAt: intraday?.fetchedAt || daily?.fetchedAt || null,
          _sources: { daily: !!daily, intraday: !!intraday },
        }
      : await fetchJson(`${LEGACY_LATEST_URL}${bust}`, { timeoutMs: 15_000 });

    const norm = normalizeLatest(raw);
    if (!norm.ok) {
      const errMsg = norm.error || "data files invalid";
      healthRef.current = {
        ...healthRef.current,
        lastError: errMsg,
        lastErrorAt: new Date().toISOString(),
        schema: norm.schema ?? null,
      };
      throw new Error(errMsg);
    }

    const latest = norm.latest;
    latestRef.current = latest;

    // Mark OK
    healthRef.current = {
      ...healthRef.current,
      lastOkAt: new Date().toISOString(),
      lastError: null,
      lastErrorAt: null,
      schema: norm.schema ?? null,
    };

    // intraday first (so daily can use corrAvg if present)
    setIntradayFromLatest(latest);

    buildDailyFromFeatures({
      featuresZ: latest.featuresZ,
      meta: {
        source: latest?.dataHealth?.source ?? "actions",
        dataHealthLevel: latest?.dataHealth?.level ?? null,
        asOf: latest?.asOf ?? null,
        lastTradingDay: latest?.lastTradingDay ?? null,
        latencyMs: latest?.latencyMs ?? null,
        latencyMin: latest?.latencyMin ?? null,
        cached: Boolean(latest?.cached),
        intraday: latest?.intraday ?? null,
        eventWindowActive: Boolean(latest?.eventWindowActive),
        schema: norm?.schema ?? null,
        fetchedAt: new Date().toISOString(),
      },
    });

    logger.info("data.latest_ok", { ms: Math.round(performance.now() - started), asOf: latest?.asOf });
    return latest;
  };

  const refreshCalendar = async () => {
    try {
      const bust = `?t=${Date.now()}`;
      const cal = await fetchJson(`${CAL_URL}${bust}`, { timeoutMs: 10_000 });
      calRef.current = { events: parseCalendar(cal), loaded: true };
      return calRef.current.events;
    } catch (e) {
      // Calendar is optional. Keep silent unless debug.
      calRef.current = { events: [], loaded: false };
      return [];
    }
  };

  // Stable interval helper (prevents stale closures + duplicated intervals)
  function useStableInterval(callback, delayMs, enabled = true) {
    const cbRef = useRef(callback);
    cbRef.current = callback;

    useEffect(() => {
      if (!enabled || delayMs == null) return;
      let id = null;

      const tick = () => cbRef.current && cbRef.current();
      id = setInterval(tick, delayMs);

      return () => {
        if (id) clearInterval(id);
      };
    }, [delayMs, enabled]);
  }

  // 1) cold-start from cache + initial fetch
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cachedDaily = await idbGet("dailyResult");
        if (!cancelled && cachedDaily?.daily) setDaily(cachedDaily.daily);
      } catch {}

      try {
        const cachedIntra = await idbGet("intradayCache");
        if (!cancelled && cachedIntra?.intraday) setIntraday(cachedIntra.intraday);
      } catch {}

      await refreshCalendar();
      try {
        await refreshLatest();
      } catch (e) {
        logger.warn("data.latest_failed", { message: e?.message });
      }
    })();

    const onVis = () => {
      // Refresh immediately when user comes back (prevents "stuck old data" feeling)
      if (document.visibilityState === "visible") {
        refreshLatest().catch(() => {});
        refreshCalendar().catch(() => {});
      }
    };
    window.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) polling policy:
  // - normal: every 5 minutes (cheap fetch of a small json)
  // - during event window: every 2 minutes (to catch 15-min updates)
  // - when hidden: browser will naturally throttle intervals; we also refresh on visibilitychange
  const [pollMs, setPollMs] = useState(300_000);

  useStableInterval(
    async () => {
      try {
        const now = new Date();
        const events = calRef.current.events || [];
        const latest = latestRef.current;
        const eventActive =
          Boolean(latest?.eventWindowActive) || isInEventWindow(now, events, 15).active;

        const desired = eventActive ? 120_000 : 300_000;
        if (desired !== pollMs) { logger.info('poll.interval_change',{from: pollMs, to: desired, eventActive}); setPollMs(desired); }

        await refreshLatest();
      } catch (e) {
        logger.debug("poll.latest_failed", { message: e?.message });
      }
    },
    pollMs,
    true
  );

  // 3) UI timer state (for countdown display)
  const [nowMs, setNowMs] = useState(Date.now());
  useStableInterval(() => setNowMs(Date.now()), 1000, true);

    const statusComputed = useMemo(() => {
    const latest = latestRef.current;
    const meta = daily?.meta || latest?.meta || {};

    const asOfStr = meta?.asOf || latest?.asOf || null;
    const asOfDate = asOfStr ? toDateSafe(asOfStr) : null;
    const fetchedAtStr = meta?.fetchedAt || latest?.fetchedAt || null;
    const fetchedAtDate = fetchedAtStr ? toDateSafe(fetchedAtStr) : null;

    // Market hours + timers
    const marketOpen = Boolean(latest?.status?.marketOpen ?? latest?.marketOpen ?? false);
    const marketClock = latest?.status?.marketClock ?? latest?.marketClock ?? null;

    const nextUpdateInSec = num(latest?.timers?.nextUpdateInSec ?? latest?.status?.timers?.nextUpdateInSec ?? null, null);
    const countdown = String(latest?.timers?.countdown ?? latest?.status?.timers?.countdown ?? "--:--");

    // Data health
    const h = latest?.dataHealth || latest?.status?.dataHealth || null;

    const ageMin = (() => {
      const ref = fetchedAtDate || asOfDate;
      if (!ref) return null;
      return Math.max(0, Math.round((Date.now() - ref.getTime()) / 60000));
    })();

    // Score gating policy (kept conservative)
    const scoreLocked = Boolean(h?.level && String(h.level).toUpperCase() === "BAD");
    const scoreLockReason = scoreLocked ? "data_health_bad" : null;

    // Market tone label (best-effort)
    let topLabel = "--";
    let tone = "gray";
    try {
      const sc = daily?.score;
      if (Number.isFinite(sc)) {
        if (sc >= 67) { tone = "good"; topLabel = "CALM"; }
        else if (sc >= 34) { tone = "warn"; topLabel = "WATCH"; }
        else { tone = "bad"; topLabel = "RISK"; }
      }
    } catch {}

    const health = {
      label: h?.level ?? null,
      tone: h?.level && String(h.level).toUpperCase() === "BAD" ? "bad" : "gray",
      ageMin,
      lastOkAt: h?.lastOkAt ?? null,
      lastError: h?.lastError ?? null,
      lastErrorAt: h?.lastErrorAt ?? null,
      schema: h?.schema ?? null,
    };

    return {
      market: {
        tone,
        label: topLabel,
        latencyMin: meta?.latencyMin ?? meta?.latencyMinutes ?? null,
        asOf: asOfStr,
        fetchedAt: fetchedAtStr,
      },
      health,
      timers: {
        nextUpdateInSec,
        countdown,
        pollMs,
      },
      marketOpen,
      marketClock,
      scoreLocked,
      scoreLockReason,
      events: calRef.current.events || [],
      eventWindow: latest?.eventWindow ?? null,
    };
  }, [daily?.meta, nowMs, pollMs]);

  // Keep status in state for existing UI compatibility
  useEffect(() => {
    setStatus(statusComputed);
  }, [statusComputed]);

  return {
    // Back-compat: expose both top-level and nested "mri" so UI pages can safely read api.mri.*
    mri: { daily, intraday, period, status: statusComputed, refreshLatest },
    daily,
    intraday,
    period,
    status: statusComputed,
    refreshLatest,
    logger,
  };
}
