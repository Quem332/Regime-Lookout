import { checkLatestSchema } from "./schema";

function isPlainObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeLatest(raw) {
  const schema = checkLatestSchema(raw);
  if (!schema.ok) return { ok: false, error: schema.error, schema };

  const featuresZ = isPlainObject(raw.featuresZ) ? raw.featuresZ : null;
  if (!featuresZ) return { ok: false, error: "latest.json invalid featuresZ", schema };

  const out = {
    ...raw,
    schemaVersion: raw.schemaVersion ?? "legacy",
    asOf: raw.asOf ?? null,
    lastTradingDay: raw.lastTradingDay ?? null,
    latencyMs: numOrNull(raw.latencyMs),
    latencyMin: numOrNull(raw.latencyMin),
    dataHealth: isPlainObject(raw.dataHealth) ? raw.dataHealth : (raw.dataHealth ? { level: String(raw.dataHealth) } : null),
    intraday: isPlainObject(raw.intraday) ? raw.intraday : null,
    periods: isPlainObject(raw.periods) ? raw.periods : null,
    featuresZ,
  };

  return { ok: true, latest: out, schema };
}
