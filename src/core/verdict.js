import { getTagBilingual } from "./tagGlossary";

// Build observational, non-predictive verdict copy for the UI.
//
// Inputs are intentionally loose because latest.json evolved over time.
// Keep this function null-safe and side-effect free.

function hasEntropyTag(tags) {
  if (!Array.isArray(tags)) return false;
  return tags.some((t) => {
    if (!t) return false;
    if (typeof t === "string") return /entropy/i.test(t) || /low\s*conviction/i.test(t);
    const label = String(t.label ?? t.key ?? t.name ?? "");
    const msg = String(t.msg ?? t.message ?? "");
    return /entropy/i.test(label) || /entropy/i.test(msg) || /low\s*conviction/i.test(label) || /low\s*conviction/i.test(msg);
  });
}

function isRegime7(regime7) {
  const r = String(regime7 ?? "");
  return r.startsWith("7");
}

export function buildOneLineVerdict({ score, Cfinal, regime7, tags, t }) {
  const tr = (k, fallback) => (typeof t === "function" ? (t(k, fallback) ?? fallback) : fallback);

  const s = Number.isFinite(score) ? Number(score) : null;
  const c = Number.isFinite(Cfinal) ? Number(Cfinal) : null;
  const lowC = c != null && c < 45;
  const entropy = hasEntropyTag(tags);
  const r7 = isRegime7(regime7);

  if (s == null) return tr("verdict.na", "No score signal.");

  // Regime-7 overrides: the engine itself is calling "mixed/undefined".
  if (r7) {
    if (String(regime7) === "7C") {
      return tr(
        "verdict.r7c",
        "Undefined regime (hard gates failed). Treat this as low-conviction interpretation."
      );
    }
    if (String(regime7) === "7B") {
      return tr(
        "verdict.r7b",
        "Signal conflict regime. Avoid single-scenario interpretation; use the distribution + tags."
      );
    }
    if (String(regime7) === "7A") {
      return tr(
        "verdict.r7a",
        "Neutral/low-magnitude regime. Interpretation should remain conservative."
      );
    }
  }

  // Entropy is a special tag: probabilities are dispersed.
  // Even if Cfinal is high, we keep the wording cautious.
  if (entropy) {
    if (s >= 67) return tr("verdict.entropyCalm", "Stable tilt, but scenario conviction is dispersed (high entropy)." );
    if (s >= 34) return tr("verdict.entropyWatch", "Mixed signals with dispersed scenarios (high entropy). Keep it cautious.");
    return tr("verdict.entropyRisk", "Risk pressure is elevated, but scenario conviction is dispersed (high entropy)." );
  }

  // Generic: score bucket + confidence.
  if (s >= 67) {
    return lowC
      ? tr("verdict.calmLowC", "Looks calm, but confidence is limited.")
      : tr("verdict.calm", "Conditions look relatively stable (risk-adjusted)." );
  }
  if (s >= 34) {
    return lowC
      ? tr("verdict.watchLowC", "Mixed signals; keep interpretation cautious.")
      : tr("verdict.watch", "Mixed/transition regime; watch risk structure.");
  }
  return lowC
    ? tr("verdict.riskLowC", "Risky tone, and confidence is limited.")
    : tr("verdict.risk", "Risk pressure is elevated (risk-adjusted)." );
}



function tSafe(t, key, fallback) {
  try {
    return typeof t === "function" ? (t(key, fallback) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function entropyNormFromProbs(probs) {
  try {
    if (!probs || typeof probs !== "object") return null;
    const ps = Object.values(probs)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    const n = ps.length;
    if (n < 2) return 0;
    const H = -ps.reduce((s, p) => s + p * Math.log(p), 0);
    const Hmax = Math.log(n);
    return Hmax > 0 ? H / Hmax : 0;
  } catch {
    return null;
  }
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((x) => {
      if (!x) return null;
      if (typeof x === "string") return { level: "neutral", label: x, msg: "" };
      if (typeof x === "object") {
        return {
          level: String(x.level ?? x.tone ?? x.severity ?? "neutral"),
          label: String(x.label ?? x.key ?? x.name ?? ""),
          msg: String(x.msg ?? x.message ?? ""),
        };
      }
      return { level: "neutral", label: String(x), msg: "" };
    })
    .filter(Boolean);
}

function pickReasonTags(tags, lang = "en", maxN = 3) {
  const list = normalizeTagList(tags);
  if (!list.length) return [];

  const weightLevel = (lvl) => {
    const s = String(lvl || "").toLowerCase();
    if (s.includes("red") || s.includes("bad") || s.includes("danger")) return 3;
    if (s.includes("yellow") || s.includes("warn")) return 2;
    if (s.includes("green") || s.includes("good")) return 1;
    return 0;
  };

  // Prefer these objective “risk / reliability cap” tags first.
  const PRIORITY = [
    "Correlation Surge",
    "Panic Confirmed",
    "Defense Broken",
    "Signal Conflict",
    "Low Conviction",
    "Reliability Low",
    "Intraday Dislocation",
    "Volatility Shock",
    "Rates Headwind",
    "Rates Lagging",
    "VIX Mismatch",
    "Haven Divergence",
    "Forced Deleveraging",
    "FX Shock",
    "Liquidity Tailwind",
    "Defensive Stable",
  ];

  const scorePri = (label) => {
    const L = String(label || "");
    const idx = PRIORITY.findIndex((p) => L.includes(p));
    return idx === -1 ? 999 : idx;
  };

  const scored = list
    .map((t) => {
      const bi = getTagBilingual(t);
      const label = lang === "ko" ? (bi.koLabel || bi.enLabel) : (bi.enLabel || bi.koLabel);
      const msg = lang === "ko" ? (bi.koMsg || bi.enMsg || t.msg) : (bi.enMsg || t.msg || bi.koMsg);
      return {
        tone: (String(t.level || "").toLowerCase().includes("red") ? "red" :
               String(t.level || "").toLowerCase().includes("yellow") ? "yellow" :
               String(t.level || "").toLowerCase().includes("green") ? "green" : "gray"),
        label,
        msg,
        _pri: scorePri(t.label),
        _lvl: weightLevel(t.level),
      };
    })
    .sort((a, b) => {
      // higher level first, then priority list, then stable
      if (b._lvl !== a._lvl) return b._lvl - a._lvl;
      if (a._pri !== b._pri) return a._pri - b._pri;
      return String(a.label).localeCompare(String(b.label));
    });

  const out = [];
  const seen = new Set();
  for (const x of scored) {
    const key = x.label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tone: x.tone, label: x.label, msg: x.msg });
    if (out.length >= maxN) break;
  }
  return out;
}

/**
 * buildScoreCopy (A-1/B-1 copy pack)
 * - 3-layer structure:
 *   1) summary (what is observed)
 *   2) reliability warning (how much to trust)
 *   3) reasons (3 objective drivers)
 * - Never uses predictive or trade action language.
 */
export function buildScoreCopy({ score, Cfinal, regime7, probs, tags, t, lang = "en" }) {
  const s = numOrNull(score);
  const c = numOrNull(Cfinal);
  const r = String(regime7 ?? "");
  const Hn = entropyNormFromProbs(probs);
  const dispersed = Number.isFinite(Hn) ? Hn >= 0.85 : false;

  const scoreBand = s == null ? "na" : s >= 67 ? "high" : s >= 34 ? "mid" : "low";
  const confBand = c == null ? "na" : c >= 70 ? "high" : c >= 45 ? "mid" : "low";

  // 1) Summary
  let summary = tSafe(t, "copy.summary.na", "Insufficient data for a firm read.");
  if (scoreBand === "high") summary = tSafe(t, "copy.summary.high", "Conditions look relatively stable on a risk-adjusted basis.");
  if (scoreBand === "mid") summary = tSafe(t, "copy.summary.mid", "Mixed/transition conditions are observed; avoid forcing a single narrative.");
  if (scoreBand === "low") summary = tSafe(t, "copy.summary.low", "Risk pressure is elevated; treat the environment as fragile.");

  // Regime-7 overlay
  if (r === "7C") summary = tSafe(t, "copy.summary.7c", "Undefined regime (hard gates not satisfied). Treat the read as low-conviction.");
  else if (r === "7B") summary = tSafe(t, "copy.summary.7b", "Signal-conflict regime (7B). Avoid single-scenario interpretation.");
  else if (r === "7A" && scoreBand !== "na") summary = tSafe(t, "copy.summary.7a", "Low-magnitude / neutral regime (7A). Expect smaller signal content.");

  // 2) Reliability warning
  let warning = "";
  if (confBand === "low") warning = tSafe(t, "copy.warn.low", "Reliability is low: treat this as watch-only interpretation.");
  else if (confBand === "mid") warning = tSafe(t, "copy.warn.mid", "Reliability is moderate: keep conclusions conservative.");
  else if (confBand === "high") warning = tSafe(t, "copy.warn.high", "Signal consistency is relatively good, but overconfidence is still a risk.");
  if (dispersed) warning = tSafe(t, "copy.warn.dispersed", "Scenario probabilities are dispersed: single-scenario conviction is limited.");

  // 3) Reasons (3 tags)
  const reasonTags = pickReasonTags(tags, lang, 3);
  const reasonsText = reasonTags.length
    ? reasonTags.map((x) => x.label.replace(/^\s*[-•]\s*/g, "")).join(lang === "ko" ? " · " : " · ")
    : tSafe(t, "copy.reasons.na", "No clear single driver dominates.");

  return { summary, warning, reasonsText, reasonTags, entropyNorm: Hn };
}

// Period interpretation copy (B-1). No score, no single-call framing.
// Focuses on regime structure, dispersion, confidence, and tags.
export function buildPeriodCopy({ Cfinal, regime7, probs, tags, lookbackKey, t, lang }) {
  const tr = (k, fallback) => tSafe(t, k, fallback);
  const c = numOrNull(Cfinal);
  const lowC = c != null && c < 45;
  const entropy = entropyNormFromProbs(probs);
  const dispersed = typeof entropy === "number" ? entropy >= 0.72 : hasEntropyTag(tags);

  const lb = String(lookbackKey || "").toUpperCase();
  const head = lb ? `${lb} ` : "";
  const r7 = isRegime7(regime7);

  // Top scenario (if any)
  let topLabel = null;
  let topP = null;
  try {
    if (probs && typeof probs === "object") {
      const top = Object.entries(probs)
        .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
        .sort((a, b) => b[1] - a[1])[0];
      if (top) {
        topLabel = top[0];
        topP = top[1];
      }
    }
  } catch {
    // ignore
  }

  const summary = (() => {
    if (r7) {
      return tr("period.summary.r7", `${head}Structure is mixed/undefined over this window. Treat interpretation as low-conviction.`);
    }
    if (dispersed) {
      return tr("period.summary.dispersed", `${head}Scenarios are dispersed. Avoid a single-story interpretation; use tags + distribution.`);
    }
    if (lowC) {
      return tr("period.summary.lowc", `${head}Signal is present, but confidence is limited. Keep wording conservative.`);
    }
    return tr("period.summary.base", `${head}Structure looks internally consistent. Use tags + distribution to understand drivers.`);
  })();

  const warning = (() => {
    if (c == null) return "";
    if (c < 35) return tr("period.warn.verylow", "Very low confidence: prefer distribution and wait for cleaner structure.");
    if (c < 45) return tr("period.warn.low", "Low confidence: treat any narrative as tentative.");
    if (dispersed) return tr("period.warn.dispersed", "High dispersion: scenario conviction is weak even if the regime label looks stable.");
    return "";
  })();

  const reasonTags = pickReasonTags(tags, lang, 4).map((x) => ({
    tone: String(x.level || "neutral").includes("red") ? "red" : String(x.level || "").includes("yellow") ? "yellow" : "gray",
    label: x.label,
    msg: x.msg,
  }));

  const reasonsText = (() => {
    const parts = [];
    if (topLabel != null && topP != null) {
      const pct = Math.round(topP * 100);
      parts.push(tr("period.reasons.top", `Top scenario: S${topLabel} (~${pct}%)`));
    }
    if (typeof entropy === "number") {
      parts.push(tr("period.reasons.entropy", `Dispersion (entropy): ${entropy.toFixed(2)}`));
    }
    if (c != null) {
      parts.push(tr("period.reasons.c", `Confidence: ${Math.round(c)}`));
    }
    if (regime7 != null) {
      parts.push(tr("period.reasons.regime", `Regime: ${String(regime7)}`));
    }
    return parts.filter(Boolean).slice(0, 4).join(" · ");
  })();

  return { summary, warning, reasonsText, reasonTags };
}
