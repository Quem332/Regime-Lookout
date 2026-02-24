// Standard render pipeline for MRI UI.
// Goal: UI should never crash when JSON/schema evolves.
// Produces a "view model" with visible flags and safe strings.

function isPlainObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function tSafe(t, key, fallback) {
  try {
    return typeof t === "function" ? (t(key, fallback) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}

export function scoreLabel(score, t) {
  const s = numOrNull(score);
  if (s == null) return tSafe(t, "scoreLabels.na", "—");
  if (s >= 67) return tSafe(t, "scoreLabels.calm", "Calm");
  if (s >= 34) return tSafe(t, "scoreLabels.watch", "Watch");
  return tSafe(t, "scoreLabels.risk", "Risk");
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((x) => {
      if (!x) return null;
      if (typeof x === "string") return { level: "neutral", label: x, msg: "" };
      if (isPlainObject(x)) {
        const level = String(x.level ?? x.tone ?? x.severity ?? "neutral");
        const label = String(x.label ?? x.key ?? x.name ?? "").trim();
        const msg = String(x.msg ?? x.message ?? "").trim();
        return { level, label: label || msg || "Tag", msg };
      }
      return { level: "neutral", label: String(x), msg: "" };
    })
    .filter(Boolean);
}

export function normalizeProbs(probs) {
  if (!isPlainObject(probs)) return [];
  const items = Object.entries(probs)
    .map(([k, v]) => ({ k: String(k), p: numOrNull(v) }))
    .filter((x) => x.p != null)
    .sort((a, b) => b.p - a.p);
  return items;
}

export function normalizeV(daily) {
  // Prefer daily.V (array), fallback to featuresZ-like objects.
  const V = Array.isArray(daily?.V) ? daily.V : null;
  if (V && V.length >= 2) {
    return V.map((x) => Number.isFinite(Number(x)) ? Number(x) : 0);
  }
  const fz = daily?.featuresZ || daily?.features || daily?.z || null;
  if (isPlainObject(fz)) {
    const arr = [fz.x, fz.y, fz.rates, fz.usd, fz.vix, fz.goldFear].map((x) => Number(x));
    return arr.map((n) => (Number.isFinite(n) ? n : 0));
  }
  return [0, 0, 0, 0, 0, 0];
}

export function quadrantFromV(V) {
  const x = numOrNull(V?.[0]) ?? 0;
  const y = numOrNull(V?.[1]) ?? 0;
  // UI clamp (z-scores are usually within [-3,3])
  const xc = clamp(x, -3, 3);
  const yc = clamp(y, -3, 3);
  const noSignal = Math.abs(xc) < 1e-6 && Math.abs(yc) < 1e-6;
  return { x: xc, y: yc, noSignal };
}

export function buildMriViewModel({ api, t }) {
  const mri = api?.mri ?? api ?? null;
  // Prefer a pre-selected primary lookback when provided by the hook.
  const daily = mri?.dailyPrimary ?? mri?.daily ?? null;
  const intraday = mri?.intraday ?? null;
  const status = mri?.status ?? null;

  const score = numOrNull(daily?.score ?? daily?.todayScore ?? daily?.TodayScore);
  const Cfinal = numOrNull(daily?.Cfinal ?? daily?.confidence ?? daily?.C);
  const regime7 = daily?.regime7 ?? daily?.regime ?? daily?.Regime ?? null;
  const asOf = daily?.asOf ?? mri?.asOf ?? mri?.latest?.asOf ?? null;

  const tags = normalizeTags(daily?.tags);
  const probs = normalizeProbs(daily?.probs);
  const V = normalizeV(daily);
  const quad = quadrantFromV(V);

  const marketOpen = Boolean(status?.marketOpen ?? mri?.marketOpen ?? daily?.marketOpen);
  const timers = status?.timers ?? mri?.timers ?? null;

  return {
    raw: { daily, intraday, status },
    meta: { marketOpen, timers, asOf, regime7, score, Cfinal },
    scorePack: {
      visible: score != null,
      score,
      label: scoreLabel(score, t),
    },
    confidence: {
      visible: Cfinal != null,
      Cfinal,
      low: Cfinal != null ? Cfinal < 45 : false,
    },
    tags: {
      visible: tags.length > 0,
      items: tags,
    },
    probs: {
      visible: probs.length > 0,
      items: probs,
    },
    quadrant: {
      visible: true,
      ...quad,
      V,
    },
    intraday: {
      visible: Boolean(intraday),
      data: intraday,
    },
    status: {
      visible: Boolean(status),
      data: status,
    },
  };
}
