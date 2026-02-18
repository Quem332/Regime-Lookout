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
 *  - public/data/latest.json   (updated by GitHub Actions)
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

const LATEST_URL = new URL("data/latest.json", ABS_BASE).toString();
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

    const snapshot = {
      V,
      probs,
      passedKeys,
      topK,
      topProb: scorePack.pTop,
      Cfinal,
      caps: rel.caps,
      regime7,
      score: scorePack.score,
      pEff: scorePack.pEff,
      penaltyApplied: scorePack.penaltyApplied,
      flags: scorePack.flags,
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

  const setIntradayFromLatest = (latest) => {
    const i = latest?.intraday || null;
    if (!i) return;
    const zShortVal = i?.zShort;
    const corrAvg = i?.corrAvg;

    const alert =
      Boolean(i?.corrSurge) || (typeof zShortVal === "number" && Number.isFinite(zShortVal) && Math.abs(zShortVal) > 2.5);

    const snapshot = {
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

  const refreshLatest = async () => {
    const started = performance.now();
    const bust = `?t=${Date.now()}`;
    const raw = await fetchJson(`${LATEST_URL}${bust}`, { timeoutMs: 15_000 });

    const norm = normalizeLatest(raw);
    if (!norm.ok) {
      const errMsg = norm.error || "latest.json invalid";
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

    const latencyMin =
      (meta?.latencyMin ?? latest?.latencyMin) ??
      (meta?.latencyMs ?? latest?.latencyMs ? Math.round(((meta?.latencyMs ?? latest?.latencyMs) / 60000) * 10) / 10 : null);

    const tonePack = latencyTone(latencyMin);

    const now = new Date(nowMs);
    const marketOpen = isMarketOpenET(now);
    const eventWindow = marketOpen ? isInEventWindow(now, calRef.current.events || [], 15) : { active: false, event: null, diffMs: null };
    const next = computeNextHalfHour(now);
    const secs = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));

    const hh = String(Math.floor(secs / 3600)).padStart(2, "0");
    const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");

    const countdown = secs >= 3600 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;

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
        pollMs,
      },
      marketOpen,
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