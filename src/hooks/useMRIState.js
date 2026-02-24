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

// Prefer fetching data from the dedicated `data` branch (raw.githubusercontent.com)
// so GitHub Pages deploy does NOT rebuild on every 5-min data refresh.
const DEFAULT_DATA_REPO = "Quem332/Regime-Lookout";
const DATA_REPO = import.meta.env.VITE_DATA_REPO || DEFAULT_DATA_REPO;
const DATA_BRANCH = import.meta.env.VITE_DATA_BRANCH || "data";
const DATA_RAW_BASE =
  import.meta.env.VITE_DATA_RAW_BASE ||
  `https://raw.githubusercontent.com/${DATA_REPO}/${DATA_BRANCH}/public/data/`;

const rawUrl = (name) => new URL(name, DATA_RAW_BASE).toString();
const pagesUrl = (name) => new URL(`data/${name}`, ABS_BASE).toString();

const DAILY_URLS = [rawUrl("daily_latest.json"), pagesUrl("daily_latest.json")];
const INTRADAY_URLS = [rawUrl("intraday_latest.json"), pagesUrl("intraday_latest.json")];
const LEGACY_LATEST_URLS = [rawUrl("latest.json"), pagesUrl("latest.json")];
const CAL_URLS = [rawUrl("calendar.json"), pagesUrl("calendar.json")];

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

function makeDateInTimeZone({ year, month, day, hour, minute, second = 0, timeZone }) {
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
  const off1 = getTZOffsetMinutes(guessUtc, timeZone);
  const pass1 = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0) + off1 * 60_000);
  const off2 = getTZOffsetMinutes(pass1, timeZone);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0) + off2 * 60_000);
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


function nthWeekdayOfMonth(year, month /*1-12*/, weekday /*0=Sun..6*/, n /*1..*/ ) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstW = first.getUTCDay();
  const delta = (weekday - firstW + 7) % 7;
  const day = 1 + delta + (n - 1) * 7;
  return day;
}

function lastWeekdayOfMonth(year, month /*1-12*/, weekday /*0=Sun..6*/) {
  const last = new Date(Date.UTC(year, month, 0)); // last day of month
  const lastW = last.getUTCDay();
  const delta = (lastW - weekday + 7) % 7;
  return last.getUTCDate() - delta;
}

// Anonymous Gregorian algorithm for Easter (UTC date)
function easterSundayUTC(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Apr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

// Minimal NYSE-holiday approximation: covers most closures (no early closes).
function isNyseHolidayET(dateKey /*YYYY-MM-DD*/) {
  if (!dateKey) return false;
  const [Y, M, D] = dateKey.split("-").map((x) => Number(x));
  if (!Y || !M || !D) return false;

  // Weekend handled elsewhere, but keep safe.
  const dow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
  if (dow === 0 || dow === 6) return false;

  // Helper: observed fixed holiday (Sat -> Fri, Sun -> Mon)
  const isObservedFixed = (month, day) => {
    const dt = new Date(Date.UTC(Y, month - 1, day));
    const w = dt.getUTCDay();
    let obs = { month, day };
    if (w === 6) {
      // Saturday -> Friday
      const prev = new Date(Date.UTC(Y, month - 1, day - 1));
      obs = { month: prev.getUTCMonth() + 1, day: prev.getUTCDate() };
    } else if (w === 0) {
      // Sunday -> Monday
      const next = new Date(Date.UTC(Y, month - 1, day + 1));
      obs = { month: next.getUTCMonth() + 1, day: next.getUTCDate() };
    }
    return obs.month === M && obs.day === D;
  };

  // New Year's Day (Jan 1)
  if (isObservedFixed(1, 1)) return true;

  // Martin Luther King Jr. Day: 3rd Monday in Jan
  if (M === 1 && D === nthWeekdayOfMonth(Y, 1, 1, 3)) return true;

  // Presidents' Day: 3rd Monday in Feb
  if (M === 2 && D === nthWeekdayOfMonth(Y, 2, 1, 3)) return true;

  // Good Friday: 2 days before Easter Sunday
  const easter = easterSundayUTC(Y);
  const easterDt = new Date(Date.UTC(Y, easter.month - 1, easter.day));
  const goodFriday = new Date(easterDt.getTime() - 2 * 24 * 3600 * 1000);
  if (M === goodFriday.getUTCMonth() + 1 && D === goodFriday.getUTCDate()) return true;

  // Memorial Day: last Monday in May
  if (M === 5 && D === lastWeekdayOfMonth(Y, 5, 1)) return true;

  // Juneteenth: June 19 (observed)
  if (isObservedFixed(6, 19)) return true;

  // Independence Day: July 4 (observed)
  if (isObservedFixed(7, 4)) return true;

  // Labor Day: 1st Monday in Sep
  if (M === 9 && D === nthWeekdayOfMonth(Y, 9, 1, 1)) return true;

  // Thanksgiving: 4th Thursday in Nov
  if (M === 11 && D === nthWeekdayOfMonth(Y, 11, 4, 4)) return true;

  // Christmas: Dec 25 (observed)
  if (isObservedFixed(12, 25)) return true;

  return false;
}


function computeMarketClock(now) {
  // Regular hours (ET): 09:30 - 16:00
  // IMPORTANT: Do NOT try to construct ET dates by passing a Date into makeDateInTimeZone;
  // makeDateInTimeZone expects explicit parts.
  const p = getETParts(now);
  const y = p.year;
  const M = p.month;
  const D = p.day;
  const dateKey = `${String(y).padStart(4, "0")}-${String(M).padStart(2, "0")}-${String(D).padStart(2, "0")}`;

  const wd = p.weekday; // "Mon".."Sun"
  const isWeekend = wd === "Sat" || wd === "Sun";
  const isHoliday = isNyseHolidayET(dateKey);

  const minutes = (Number.isFinite(p.hour) ? p.hour : 0) * 60 + (Number.isFinite(p.minute) ? p.minute : 0);
  const openMin = 9 * 60 + 30;
  const closeMin = 16 * 60;

  let phase = "CLOSED";
  if (!isWeekend && !isHoliday) {
    if (minutes >= openMin && minutes < closeMin) phase = "OPEN";
    else if (minutes < openMin) phase = "PREMARKET";
    else phase = "CLOSED";
  } else {
    phase = "CLOSED";
  }

  // Find next session dateKey (skip weekends + holiday)
  const nextSessionDateKey = () => {
    let dt = new Date(Date.UTC(y, M - 1, D, 12, 0, 0)); // noon UTC as anchor
    for (let i = 0; i < 15; i++) {
      dt = new Date(dt.getTime() + 24 * 3600 * 1000);
      const yy = dt.getUTCFullYear();
      const mm = dt.getUTCMonth() + 1;
      const dd = dt.getUTCDate();
      const dk = `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      const dow = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
      const weekend = dow === 0 || dow === 6;
      if (!weekend && !isNyseHolidayET(dk)) return dk;
    }
    return null;
  };

  let secondsToOpen = null;
  let secondsToClose = null;
  let nextKind = "OPEN";
  let secondsToNext = null;

  const etNow = makeDateInTimeZone({
    year: y,
    month: M,
    day: D,
    hour: p.hour,
    minute: p.minute,
    second: Number.isFinite(p.second) ? p.second : 0,
    timeZone: "America/New_York",
  });

  // Track elapsed time since open with seconds precision (useful for "data 준비중" window)
  const openET_forElapsed = makeDateInTimeZone({ year: y, month: M, day: D, hour: 9, minute: 30, second: 0, timeZone: "America/New_York" });
  const secondsSinceOpen = Math.max(0, Math.floor((etNow.getTime() - openET_forElapsed.getTime()) / 1000));

  if (phase === "OPEN") {
    // time to today's close
    const closeET = makeDateInTimeZone({ year: y, month: M, day: D, hour: 16, minute: 0, second: 0, timeZone: "America/New_York" });
    secondsToClose = Math.max(0, Math.floor((closeET.getTime() - etNow.getTime()) / 1000));
    nextKind = "CLOSE";
    secondsToNext = secondsToClose;
  } else {
    // time to next open (today if premarket, else next session day)
    let targetKey = dateKey;
    if (phase !== "PREMARKET") {
      const nk = nextSessionDateKey();
      if (nk) targetKey = nk;
    }
    // build target 09:30 ET
    const [ty, tm, td] = targetKey.split("-").map((x) => Number(x));
    const openET = makeDateInTimeZone({ year: ty, month: tm, day: td, hour: 9, minute: 30, second: 0, timeZone: "America/New_York" });

    secondsToOpen = Math.max(0, Math.floor((openET.getTime() - etNow.getTime()) / 1000));
    nextKind = "OPEN";
    secondsToNext = secondsToOpen;
  }

  const minutesSinceOpen =
    phase === "OPEN" ? Math.max(0, Math.floor((minutes - openMin))) : null;

  return {
    phase,
    isHoliday,
    dateKey,
    secondsToOpen,
    secondsToClose,
    nextKind, // "OPEN" | "CLOSE"
    secondsToNext,
    minutesSinceOpen,
    secondsSinceOpen,
  };
}

function formatHMS(totalSec) {
  if (typeof totalSec !== "number" || !Number.isFinite(totalSec)) return "--:--";
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
  const [status, setStatus] = useState(null);
  const latestRef = useRef(null); // last latest.json payload
  const calRef = useRef({ events: [], loaded: false });
  const healthRef = useRef({ lastOkAt: null, lastError: null, lastErrorAt: null, schema: null });
  const buildDailyFromFeatures = ({ featuresZ, meta }) => {
    const started = performance.now();
    const V = [featuresZ.x, featuresZ.y, featuresZ.rates, featuresZ.usd, featuresZ.vix, featuresZ.goldFear].map((v) => num(v, 0));

    const isAllZeroV = V.every((v) => v === 0);
    if (isAllZeroV && daily && daily?.meta?.dataHealthLevel !== "MOCK") {
      return;
    }

    const latencyMin = meta?.latencyMin ?? meta?.latencyMinutes ?? meta?.latency ?? null;
const healthLevel = meta?.dataHealth?.level ?? meta?.dataHealthLevel ?? null;

// Data considered OK if not stale and not explicitly marked bad.
const dataOk =
  Number.isFinite(latencyMin) ? latencyMin <= 30 : true;
const dataOkFinal =
  dataOk && !["BAD", "DOWN", "ERROR"].includes(String(healthLevel ?? "").toUpperCase());
    const corrAvgDaily = intraday?.corrAvg ?? meta?.intraday?.corrAvg ?? upperTriangleAvgCorrMock();

const corrSurgeDaily = Boolean(intraday?.corrSurge ?? meta?.intraday?.corrSurge ?? false);
const zShortDaily = Number.isFinite(intraday?.zShort) ? intraday.zShort : Number.isFinite(meta?.intraday?.zShort) ? meta.intraday.zShort : 0;


    const { probs, passedKeys } = computeProbabilitiesSpec(V);
    const rel = computeReliabilityCSpec({ dataOk: dataOkFinal, corrAvg: corrAvgDaily, corrSurge: corrSurgeDaily, zShort: zShortDaily, V, probs });
    const Cfinal = rel.C;
    const regime7 = computeRegime7Spec({ passedKeys, Cfinal, V });
    const scorePack = computeTodayScoreSpec({ probs, Cfinal, corrAvg: corrAvgDaily, V, regime7 });

    const topEntry = Object.entries(probs).sort((a, b) => b[1] - a[1])[0];
    const topK = topEntry ? Number(topEntry[0]) : null;

    const tags = buildReasoningTags({ V, corrAvg: corrAvgDaily, corrSurge: corrSurgeDaily, zShort: zShortDaily, probs, Cfinal });

    // buildScenarioPackFromIntraday expects a "latest-like" payload (featuresZ + intraday + dataHealth).
    // During daily rebuild, the normalized payload lives in latestRef.current; fall back to the inputs we have
    // to avoid ReferenceError("latest is not defined") and to keep the UI stable.
    const latestLike =
      latestRef.current ||
      {
        featuresZ,
        intraday: meta?.intraday ?? null,
        dataHealth: { level: meta?.dataHealthLevel ?? null },
      };

    const snapshot = {
      scenario: buildScenarioPackFromIntraday(latestLike),
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
  const buildScenarioPackFromIntraday = (latest) => {
    const i = latest?.intraday || null;
    const zShortVal = i?.zShort;
    const corrAvg = i?.corrAvg;

    // Base V from latest daily features if available.
    const fz = latest?.featuresZ || {};
    const baseV = [
      num(fz.x, 0),
      num(fz.y, 0),
      num(fz.rates, 0),
      num(fz.usd, 0),
      num(fz.vix, 0),
      num(fz.goldFear, 0),
    ];

    const vTrack = [...baseV];
    if (typeof zShortVal === "number" && Number.isFinite(zShortVal)) {
      // Track "y" intraday using zShort (clamped)
      vTrack[1] = Math.max(-3, Math.min(3, zShortVal));
    }

    const { probs: probsTrack, passedKeys: passedKeysTrack } = computeProbabilitiesSpec(vTrack);

    const healthLevel = latest?.dataHealth?.level ?? null;
    const dataOk =
      !["BAD", "DOWN", "ERROR", "NONE"].includes(String(healthLevel ?? "").toUpperCase());

    const relTrack = computeReliabilityCSpec({
      dataOk,
      corrAvg: typeof corrAvg === "number" && Number.isFinite(corrAvg) ? corrAvg : 0.5,
      corrSurge: Boolean(i?.corrSurge),
      zShort: typeof zShortVal === "number" && Number.isFinite(zShortVal) ? zShortVal : 0,
      V: vTrack,
      probs: probsTrack,
    });

    const CfinalTrack = relTrack?.C ?? 0;
    const regime7Track = computeRegime7Spec({ passedKeys: passedKeysTrack, Cfinal: CfinalTrack, V: vTrack });
    const tagsTrack = buildReasoningTags({
      V: vTrack,
      corrAvg: typeof corrAvg === "number" && Number.isFinite(corrAvg) ? corrAvg : null,
      corrSurge: Boolean(i?.corrSurge),
      zShort: typeof zShortVal === "number" && Number.isFinite(zShortVal) ? zShortVal : null,
      probs: probsTrack,
      Cfinal: CfinalTrack,
      isIntraday: true,
    });

    return {
      score: computeTodayScoreSpec({
        probs: probsTrack,
        Cfinal: CfinalTrack,
        corrAvg: typeof corrAvg === "number" && Number.isFinite(corrAvg) ? corrAvg : 0.5,
        V: vTrack,
        regime7: regime7Track,
      })?.score ?? null,
      Cfinal: CfinalTrack,
      regime7: regime7Track,
      topK: Number(Object.entries(probsTrack).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1),
      probs: probsTrack,
      tags: tagsTrack,
      V: vTrack,
      meta: { source: "intradayTracking" },
    };
  };



  const setIntradayFromLatest = (latest) => {
    const i = latest?.intraday || null;
    if (!i) return;
    const zShortVal = i?.zShort;
    const corrAvg = i?.corrAvg;

    const alert =
      Boolean(i?.corrSurge) || (typeof zShortVal === "number" && Number.isFinite(zShortVal) && Math.abs(zShortVal) > 2.5);

    const snapshot = {
      scenario: buildScenarioPackFromIntraday(latest),
      zShort: typeof zShortVal === "number" ? zShortVal : null,
      zShortPct: i?.zShortPct ?? null,
      corrAvg: typeof corrAvg === "number" ? corrAvg : null,
      corrSurge: Boolean(i?.corrSurge),
      intervalUsed: i?.intervalUsed ?? null,
      prices: i?.prices ?? null,
      meta: { cached: Boolean(latest?.cached), latencyMs: latest?.latencyMs ?? null, dataHealthLevel: latest?.dataHealth?.level ?? null },
      dataHealthLevel: latest?.dataHealth?.level ?? null,
      alert,
      ts: new Date(),
    };

    setIntraday(snapshot);

    idbSet("intradayCache", { intraday: snapshot, savedAt: new Date().toISOString() }).catch((e) =>
      logger.warn("idb.intraday_write_failed", { message: e?.message })
    );
  };

  // Try a list of URLs in order; returns first successful result + context for diagnostics.
const fetchFirstInfo = async (urlList, opts) => {
  const errors = [];
  for (const url of urlList) {
    try {
      const data = await fetchJson(url, opts);
      return { data, url, errors };
    } catch (e) {
      errors.push({
        url,
        message: e?.message || String(e),
      });
    }
  }
  const err = new Error("All data sources failed");
  err.errors = errors;
  throw err;
};

// Back-compat helper (existing code expects only data)
const fetchFirst = async (urlList, opts) => {
  const info = await fetchFirstInfo(urlList, opts);
  return info.data;
};


  const refreshLatest = async () => {
    const started = performance.now();
    const bust = `?t=${Date.now()}`;

    // Prefer split files (daily + intraday). If not present, fall back to legacy single-file.
const [dailyInfo, intradayInfo] = await Promise.all([
  fetchFirstInfo(DAILY_URLS.map((u) => `${u}${bust}`), { timeoutMs: 15_000 }).catch((e) => ({
    data: null,
    url: null,
    errors: e?.errors || [{ url: "(daily)", message: e?.message || String(e) }],
  })),
  fetchFirstInfo(INTRADAY_URLS.map((u) => `${u}${bust}`), { timeoutMs: 15_000 }).catch((e) => ({
    data: null,
    url: null,
    errors: e?.errors || [{ url: "(intraday)", message: e?.message || String(e) }],
  })),
]);

const daily = dailyInfo?.data || null;
const intraday = intradayInfo?.data || null;

const sources = {
  daily: { ok: !!daily, url: dailyInfo?.url || null, errors: dailyInfo?.errors || [] },
  intraday: { ok: !!intraday, url: intradayInfo?.url || null, errors: intradayInfo?.errors || [] },
  legacy: { ok: false, url: null, errors: [] },
  mode: (daily || intraday) ? "split" : "legacy",
};

// If split isn't available, attempt legacy.
const legacyInfo = (daily || intraday)
  ? null
  : await fetchFirstInfo(LEGACY_LATEST_URLS.map((u) => `${u}${bust}`), { timeoutMs: 15_000 }).catch((e) => ({
      data: null,
      url: null,
      errors: e?.errors || [{ url: "(legacy)", message: e?.message || String(e) }],
    }));

const legacy = legacyInfo?.data || null;
if (legacy) {
  sources.legacy = { ok: true, url: legacyInfo?.url || null, errors: legacyInfo?.errors || [] };
} else if (legacyInfo) {
  sources.legacy = { ok: false, url: legacyInfo?.url || null, errors: legacyInfo?.errors || [] };
}

// Emit diagnostics to console/log so "준비중" never hides the why.
const compactErrs = (arr) => (arr || []).map((x) => ({ url: x.url, message: x.message }));
if (!sources.daily.ok && sources.daily.errors.length) logger.warn("data.fetch_fail.daily", compactErrs(sources.daily.errors));
if (!sources.intraday.ok && sources.intraday.errors.length) logger.warn("data.fetch_fail.intraday", compactErrs(sources.intraday.errors));
if (sources.mode === "legacy" && sources.legacy.errors.length) logger.warn("data.fetch_fail.legacy", compactErrs(sources.legacy.errors));
logger.info("data.fetch_summary", {
  mode: sources.mode,
  dailyUrl: sources.daily.url,
  intradayUrl: sources.intraday.url,
  legacyUrl: sources.legacy.url,
});

const raw = (daily || intraday)
  ? {
      daily,
      intraday,
      fetchedAt: intraday?.fetchedAt || daily?.fetchedAt || null,
      asof: intraday?.asof || daily?.asof || null,
      _sources: {
        daily: !!daily,
        intraday: !!intraday,
        dailyUrl: sources.daily.url,
        intradayUrl: sources.intraday.url,
        legacyUrl: null,
        mode: sources.mode,
      },
    }
  : (legacy
      ? {
          ...legacy,
          _sources: {
            ...(legacy?._sources || {}),
            daily: false,
            intraday: false,
            dailyUrl: null,
            intradayUrl: null,
            legacyUrl: sources.legacy.url,
            mode: sources.mode,
          },
        }
      : null);

healthRef.current = { ...healthRef.current, sources };

    if (!raw) throw new Error("Failed to load MRI data (daily/intraday/legacy all failed)");

    // If split files didn't exist AND legacy is also missing/invalid, normalizeLatest will fail.
    // That case is handled below with a clear "data pending" UI message.

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
      const cal = await fetchFirst(CAL_URLS.map((u) => `${u}${bust}`), { timeoutMs: 10_000 });
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

    const latencyMin =
      (meta?.latencyMin ?? latest?.latencyMin) ??
      (meta?.latencyMs ?? latest?.latencyMs ? Math.round(((meta?.latencyMs ?? latest?.latencyMs) / 60000) * 10) / 10 : null);

    const tonePack = latencyTone(latencyMin);

    const now = new Date(nowMs);
    const marketClock = computeMarketClock(now);

    const asOfETKey = asOfDate ? etDateKey(asOfDate) : null;
    const nowETKey = etDateKey(now);
    const dataIsToday = !!asOfETKey && asOfETKey === nowETKey;

    const scoreLocked =
      marketClock.phase === "PREMARKET" || (marketClock.phase === "OPEN" && !dataIsToday);

    const scoreLockReason =
      marketClock.phase === "PREMARKET"
        ? { kind: "PREMARKET", eta: formatHMS(marketClock.secondsToOpen) }
        : marketClock.phase === "OPEN" && !dataIsToday
          ? { kind: "OPEN_WARMUP", minutesSinceOpen: marketClock.minutesSinceOpen ?? null }
          : null;
    const marketOpen = marketClock.phase === "OPEN";
    const eventWindow = marketOpen ? isInEventWindow(now, calRef.current.events || [], 15) : { active: false, event: null, diffMs: null };
    const secs = marketClock.secondsToNext ?? 0;
    const countdown = formatHMS(secs)

    // top bar label priority:
    // 1) fetchedAt (always reflects the *latest fetch attempt* on this device)
    // 2) asOf (server/data timestamp)
    // 3) latency bucket
    const fetchedLabel = fetchedAtDate
      ? `${String(fetchedAtDate.getHours()).padStart(2, "0")}:${String(fetchedAtDate.getMinutes()).padStart(2, "0")}`
      : null;

    const asOfLabel = asOfDate
      ? `${String(asOfDate.getHours()).padStart(2, "0")}:${String(asOfDate.getMinutes()).padStart(2, "0")}`
      : null;

    const topLabel = fetchedLabel ? `SYNC ${fetchedLabel}` : asOfLabel ? `DATA ${asOfLabel}` : tonePack.label;

    // Health badge: color-only (legacy thresholds)
// - <=10m: green
// - <=20m: yellow
// - <=30m: red
// - >30m or no reference: black
    const h = healthRef.current || {};
    const nowT = now.getTime();
    const asOfT = asOfDate ? asOfDate.getTime() : null;
    const refT = asOfT ?? (h?.lastOkAt ? new Date(h.lastOkAt).getTime() : null);
    const ageMin = refT ? (nowT - refT) / (60 * 1000) : Infinity;
    const hasNewerError =
      h?.lastError &&
      (!h?.lastOkAt ||
        (h.lastErrorAt &&
          new Date(h.lastErrorAt).getTime() >
            new Date(h.lastOkAt).getTime()));

    let healthLabel = "OK";
    let healthTone = "good";

    if (!Number.isFinite(ageMin)) {
      healthLabel = hasNewerError ? "FETCH_FAIL" : "NO_DATA";
      healthTone = "black";
    } else if (ageMin <= 10) {
      healthLabel = "OK";
      healthTone = "good";
    } else if (ageMin <= 20) {
      healthLabel = "STALE";
      healthTone = "warn";
    } else if (ageMin <= 30) {
      healthLabel = hasNewerError ? "FETCH_FAIL" : "STALE";
      healthTone = "bad";
    } else {
      healthLabel = hasNewerError ? "FETCH_FAIL" : "STALE";
      healthTone = "black";
    }

    // If a newer fetch error exists, do not show green/yellow.
    if (hasNewerError && (healthTone === "good" || healthTone === "warn")) {
      healthLabel = "FETCH_FAIL";
      healthTone = ageMin > 30 ? "black" : "bad";
    }

    const health = {
      label: healthLabel,
      tone: healthTone,
      ageMin,
      lastOkAt: h?.lastOkAt ?? null,
      lastError: h?.lastError ?? null,
      lastErrorAt: h?.lastErrorAt ?? null,
      schema: h?.schema ?? null,
      sources: h?.sources ?? null,
    };

    return {
      market: {
        tone: tonePack.tone,
        label: topLabel,
        latencyMin,
        asOf: asOfStr,
        fetchedAt: fetchedAtStr,
      },
      health,
      timers: {
        nextUpdateInSec: secs,
        countdown,
        nextKind: marketClock.nextKind,
        pollMs,
      },
      marketOpen,
    marketClock,
    scoreLocked,
    scoreLockReason,
      events: calRef.current.events || [],
      eventWindow,
    };
  }, [daily?.meta, nowMs, pollMs]);

  // Keep status in state for existing UI compatibility
  useEffect(() => {
    setStatus(statusComputed);
  }, [statusComputed]);

  return {
    // Back-compat: expose both top-level and nested "mri" so UI pages can safely read api.mri.*
    mri: { daily, intraday, status: statusComputed, refreshLatest },
    daily,
    intraday,
    status: statusComputed,
    refreshLatest,
    logger,
  };
}