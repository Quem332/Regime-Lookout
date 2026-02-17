// Minimal, production-safe logger with in-memory ring buffer + lightweight persistence for debugging.
// - Keeps logs accessible from UI (Hub -> Debug)
// - Mirrors to console
// - Persists recent warn/error logs in localStorage so logs survive reloads/crashes (best-effort)

const MAX_LOGS = 800;
const MAX_PERSIST = 220;
const PERSIST_KEY = "mri_logs_persist_v1";
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function nowIso() { return new Date().toISOString(); }

function safeStringify(value, maxLen = 20_000) {
  try {
    const seen = new WeakSet();
    const json = JSON.stringify(
      value,
      (k, v) => {
        if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
        if (typeof v === "bigint") return v.toString();
        if (v && typeof v === "object") {
          if (seen.has(v)) return "[Circular]";
          seen.add(v);
        }
        return v;
      },
      2
    );
    if (json.length <= maxLen) return json;
    return json.slice(0, maxLen) + `\n... (truncated, ${json.length} chars)`;
  } catch (e) {
    return `"[Unserializable: ${String(e)}]"`;
  }
}

function readLevel() {
  try {
    const v = localStorage.getItem("mri_log_level");
    if (v && LEVELS[v] != null) return v;
  } catch (_) {}
  return "info";
}

function readPersisted() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Basic shape guard
    return arr.filter((e) => e && typeof e.ts === "string" && typeof e.level === "string" && typeof e.event === "string");
  } catch (_) {
    return [];
  }
}

function persist(entries) {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(entries.slice(-MAX_PERSIST)));
  } catch (_) {
    // ignore (quota/private mode)
  }
}

let currentLevel = readLevel();
let buffer = [];
const listeners = new Set();

// Session metadata (best-effort; safe in older browsers)
const session = (() => {
  const s = {
    id: `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`,
    ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
    lang: typeof navigator !== "undefined" ? navigator.language : "",
    tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } })(),
    startedAt: nowIso(),
  };
  return s;
})();

// bootstrap with persisted warn/error so "crash then reload" still shows useful logs
const persisted = readPersisted().map((e) => ({ ...e, persisted: true }));
buffer = persisted.slice(-MAX_PERSIST);

function emit() {
  // Defensive: never let a bad subscriber crash the whole app.
  for (const fn of Array.from(listeners)) {
    if (typeof fn !== "function") {
      try { listeners.delete(fn); } catch (_) {}
      continue;
    }
    try { fn(); } catch (_) {}
  }
}

// Debounced persistence (write at most once every 1.2s)
let persistTimer = null;
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const keep = buffer.filter((e) => e.level === "warn" || e.level === "error").slice(-MAX_PERSIST);
    persist(keep);
  }, 1200);
}

function push(entry) {
  buffer.push(entry);
  if (buffer.length > MAX_LOGS) buffer = buffer.slice(buffer.length - MAX_LOGS);
  if (entry.level === "warn" || entry.level === "error") schedulePersist();
  emit();
}

export const logger = {
  levels: Object.keys(LEVELS),
  session,
  getLevel() { return currentLevel; },
  setLevel(level) {
    if (LEVELS[level] == null) return;
    currentLevel = level;
    try { localStorage.setItem("mri_log_level", level); } catch (_) {}
    this.info("logger.level", { level });
  },
  subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  clear({ includePersisted = true } = {}) {
    buffer = [];
    emit();
    if (includePersisted) {
      try { localStorage.removeItem(PERSIST_KEY); } catch (_) {}
    }
  },
  getLogs() { return buffer.slice(); },
  exportText() {
    const header = [
      `MRI Debug Export`,
      `session.id=${session.id}`,
      `session.startedAt=${session.startedAt}`,
      `tz=${session.tz}`,
      `lang=${session.lang}`,
      `ua=${session.ua}`,
      ``,
    ].join("\n");
    const body = buffer.map((e) => {
      const data = e.data == null ? "" : safeStringify(e.data);
      const persistedTag = e.persisted ? " (persisted)" : "";
      return `${e.ts} [${e.level}]${persistedTag} ${e.event}${data ? `\n${data}` : ""}`;
    }).join("\n\n");
    return header + body;
  },
  downloadText(filename = null) {
    try {
      const text = this.exportText();
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = filename || `mri-debug-${stamp}.log.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      this.info("debug.download_logs", { size: text.length });
    } catch (e) {
      this.warn("debug.download_failed", { message: String(e) });
    }
  },
  log(level, event, data) {
    const lvl = LEVELS[level] ?? LEVELS.info;
    if (lvl < (LEVELS[currentLevel] ?? LEVELS.info)) return;

    const entry = { ts: nowIso(), level, event, data };
    push(entry);

    // Mirror to console (never throw)
    try {
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn(`[MRI] ${event}`, data ?? "");
    } catch (_) {}
  },
  debug(event, data) { this.log("debug", event, data); },
  info(event, data) { this.log("info", event, data); },
  warn(event, data) { this.log("warn", event, data); },
  error(event, data) { this.log("error", event, data); },
};

// Convenience for capturing errors uniformly
export function normalizeError(err) {
  if (!err) return { name: "Error", message: "(empty)", stack: "" };
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack || "" };
  return { name: typeof err, message: String(err), stack: "" };
}

// Small helper: mark app start
logger.info("app.boot", { session: logger.session });
