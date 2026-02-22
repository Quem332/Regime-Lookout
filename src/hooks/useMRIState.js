import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeLatest } from "../core/normalize.latest";
import { logger as defaultLogger } from "../core/logger";

function baseUrl() {
  try {
    const b = (import.meta && import.meta.env && import.meta.env.BASE_URL) || "/";
    return b.endsWith("/") ? b : `${b}/`;
  } catch {
    return "/";
  }
}

// Prefer same-origin `/data/*` but fall back to the `data` branch on GitHub.
// This prevents intraday (5m) updates from triggering Pages rebuilds.
function guessRawDataBase() {
  try {
    if (typeof window === "undefined") return null;
    const host = window.location.hostname || "";
    if (!host.endsWith(".github.io")) return null;
    const owner = host.split(".")[0];
    const parts = (window.location.pathname || "").split("/").filter(Boolean);
    const repo = parts[0];
    if (!owner || !repo) return null;
    // data branch hosts `public/data/*`.
    return `https://raw.githubusercontent.com/${owner}/${repo}/data/public/`;
  } catch {
    return null;
  }
}

function withTs(url) {
  const u = String(url);
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}ts=${Date.now()}`;
}

async function fetchJson(url) {
  const res = await fetch(withTs(url), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return await res.json();
}

async function fetchJsonWithFallback(path, log = console) {
  const b = baseUrl();
  const envBase = (import.meta && import.meta.env && import.meta.env.VITE_DATA_BASE_URL) || "";
  const raw = guessRawDataBase();

  const candidates = [];
  // 1) same-origin (works if you ship data with dist)
  candidates.push(`${b}data/${path}`);
  // 2) explicit override
  if (typeof envBase === "string" && envBase.trim()) {
    const eb = envBase.endsWith("/") ? envBase : `${envBase}/`;
    candidates.push(`${eb}${path}`);
  }
  // 3) GH raw data branch
  if (raw) candidates.push(`${raw}data/${path}`);

  let lastErr = null;
  for (const u of Array.from(new Set(candidates))) {
    try {
      const json = await fetchJson(u);
      log?.info?.("[MRI] fetched", path, "from", u);
      return json;
    } catch (e) {
      lastErr = e;
      log?.warn?.("[MRI] fetch failed", path, "from", u, String(e?.message || e));
    }
  }
  throw lastErr || new Error(`Failed to fetch ${path}`);
}

function safeStr(v, d = null) {
  if (v == null) return d;
  const s = String(v);
  return s.length ? s : d;
}

function safeNum(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function pickFirst(...vals) {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return null;
}

export function useMRIState({ pollMs = 15000, logger = defaultLogger } = {}) {
  const [latest, setLatest] = useState(null);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);
  const mountedRef = useRef(false);

  const refreshLatest = useCallback(async () => {
    setError(null);

    try {
      // Prefer latest.json (one-file schema), but fall back gracefully.
      let obj = null;
      try {
        obj = await fetchJsonWithFallback("latest.json", logger);
      } catch {
        obj = null;
      }

      if (!obj) {
        const [daily, intraday] = await Promise.allSettled([
          fetchJsonWithFallback("daily_latest.json", logger),
          fetchJsonWithFallback("intraday_latest.json", logger),
        ]);
        obj = {
          schema: "fallback",
          daily: daily.status === "fulfilled" ? daily.value : null,
          intraday: intraday.status === "fulfilled" ? intraday.value : null,
          meta: {
            fetchedAt: new Date().toISOString(),
            asOf: pickFirst(
              daily.status === "fulfilled" ? daily.value?.meta?.asOf : null,
              intraday.status === "fulfilled" ? intraday.value?.meta?.asOf : null
            ),
          },
        };
      }

      // Normalize to one internal model.
      const norm = normalizeLatest(obj || {});
      if (!mountedRef.current) return;
      setLatest(norm);
      logger?.info?.("mri.refresh_ok", { asOf: norm?.meta?.asOf || null, schema: norm?.meta?.schema || null });
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e);
      logger?.warn?.("mri.refresh_fail", { msg: String(e?.message || e) });
    }
  }, [logger]);

  // Poll loop
  useEffect(() => {
    mountedRef.current = true;
    refreshLatest();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      refreshLatest();
    }, Math.max(5000, Number(pollMs) || 15000));

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [refreshLatest, pollMs]);

  // Derive daily/intraday/period/status
  const raw = latest?.raw || {};
  const daily = raw?.daily || latest?.daily || null;
  const intraday = raw?.intraday || latest?.intraday || null;

  // Period packs: expect keys like 20D/60D/252D
  const period = useMemo(() => {
    const p = raw?.periods || latest?.periods || null;
    if (!p || typeof p !== "object") return {};
    return p;
  }, [raw?.periods, latest?.periods]);

  const status = useMemo(() => {
    const st = raw?.status || latest?.status || {};
    const marketOpen = Boolean(pickFirst(st?.marketOpen, raw?.marketOpen, latest?.marketOpen, false));

    const timers = {
      countdown: safeStr(pickFirst(st?.timers?.countdown, raw?.timers?.countdown), "--:--"),
      nextUpdateInSec: safeNum(pickFirst(st?.timers?.nextUpdateInSec, raw?.timers?.nextUpdateInSec), null),
      pollMs: Number(pollMs) || 15000,
    };

    const meta = latest?.meta || {};
    const health = pickFirst(st?.dataHealth, raw?.dataHealth, null);

    return {
      marketOpen,
      timers,
      marketClock: st?.marketClock || null,
      meta: {
        asOf: safeStr(meta?.asOf, safeStr(daily?.meta?.asOf, null)),
        fetchedAt: safeStr(meta?.fetchedAt, null),
        schema: safeStr(meta?.schema, null),
      },
      dataHealth: health,
      error: error ? String(error?.message || error) : null,
    };
  }, [raw?.status, latest?.status, latest?.meta, daily?.meta, error, pollMs]);

  // Expose back-compat shape expected by pages
  return {
    daily,
    intraday,
    period,
    status,
    raw,
    meta: latest?.meta || {},
    refreshLatest,
  };
}
