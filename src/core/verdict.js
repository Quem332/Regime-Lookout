// Build observational, non-predictive one-line verdict text for the UI.
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
