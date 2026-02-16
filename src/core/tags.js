import { entropyConcentrationH } from "./engine.daily";

// Layer 3: Reasoning Tags

export function buildReasoningTags({ V, corrAvg, corrSurge = false, zShort = 0, probs, Cfinal }) {
  const [x, y, rates, usd, vix, goldFear] = V;
  const tags = [];

  // 🔴 Critical (logic off / avoid)
  if (corrAvg > 0.8) {
    tags.push({
      level: "red",
      label: "⚡ Correlation Surge",
      msg: "Diversification collapses (avg corr > 0.8).",
    });
  }
  if (y < -1.0 && usd > 0.5 && vix > 0.5) {
    tags.push({
      level: "red",
      label: "🔥 Panic Confirmed",
      msg: "Cash preference spikes (y↓, usd↑, vix↑).",
    });
  }
  // Defense Broken requires XLP absolute. Proxy tag:
  if (x < 0 && y < 0) {
    tags.push({
      level: "red",
      label: "🚨 Defense Broken (proxy)",
      msg: "Broad risk-off (needs XLP absolute to confirm).",
    });
  }

  
// Intraday correlation surge flag (if provided)
if (corrSurge) {
  tags.push({
    level: "red",
    label: "⚡ Correlation Surge (intraday)",
    msg: "Intraday co-movement spiked; regime signals may be less reliable.",
  });
}
// 🟡 Warning (deductions / caution)
  // Rates Lagging: scenario 4 or 5 AND rates > -0.3  (needs knowing top scenario)
  const topK = Object.entries(probs).sort((a, b) => b[1] - a[1])[0]?.[0];
  if ((topK === "4" || topK === "5") && V[2] > -0.3) {
    tags.push({
      level: "yellow",
      label: "⚠️ Rates Lagging",
      msg: "Risk-on but easing not strong enough (rates > -0.3).",
    });
  }
  if (y < 0 && vix < 0.2) {
    tags.push({
      level: "yellow",
      label: "⚠️ VIX Mismatch",
      msg: "Down move without fear spike (quiet distribution risk).",
    });
  }


// Haven divergence (Gold lag / USD-only flight) — common around policy/event headlines
if ((topK === "4" || topK === "5") && usd > 0.4 && goldFear < -0.7 && vix < 0.5) {
  tags.push({
    level: "yellow",
    label: "👀 Haven Divergence",
    msg: "Risk-on regime but safe-haven (gold) does not confirm; potential policy/event-driven decoupling.",
  });
}

// Panic without gold confirmation (forced deleveraging can suppress gold)
if (topK === "2" && usd > 0.4 && vix > 0.3 && goldFear < -0.2) {
  tags.push({
    level: "yellow",
    label: "⚠️ Forced Deleveraging (gold lag)",
    msg: "Stress signals present, but gold response is weak; forced selling/liquidity effects may dominate.",
  });
}

// Rates headwind against risk-on
if ((topK === "4" || topK === "5") && y > 0.5 && rates > 0.8) {
  tags.push({
    level: "yellow",
    label: "⚠️ Rates Headwind",
    msg: "Risk-on tone with fast-rising yields; regime may be fragile.",
  });
}

// FX shock mismatch (USD spike without VIX spike)
if (usd > 0.8 && vix < 0.2 && Math.abs(y) < 0.6) {
  tags.push({
    level: "yellow",
    label: "⚠️ FX Shock Mismatch",
    msg: "USD spike without fear/flow confirmation; headline-driven FX move suspected.",
  });
}


// Event-like dislocation (indicator-only)
const zShortAbs = Math.abs(Number.isFinite(zShort) ? zShort : 0);
if (vix > 1.2) {
  tags.push({
    level: "yellow",
    label: "⚠️ Volatility Shock",
    msg: "VIX is elevated vs baseline; headline risk / discontinuity likely.",
  });
}
if (zShortAbs > 1.5) {
  tags.push({
    level: "yellow",
    label: "⚠️ Intraday Dislocation",
    msg: "Short-horizon move is extreme (|zShort| > 1.5); interpretation risk increases.",
  });
}

// Signal conflict summary tag (helps explain why C is lower)
let conflict = 0;
const isRiskOnTone = topK === "4" || topK === "5";
const isPanicTone = topK === "2";
const isStagTone = topK === "6";
if (isRiskOnTone) {
  if (usd > 0.6) conflict += 1;
  if (goldFear < -0.7) conflict += 1;
  if (vix > 0.7) conflict += 1;
  if (rates > 0.9) conflict += 1;
} else if (isPanicTone) {
  if (vix < 0.3) conflict += 1;
  if (usd < 0.2) conflict += 1;
} else if (isStagTone) {
  if (rates < 0.5) conflict += 1;
  if (y > 0.3) conflict += 1;
}
if (y < -0.8 && vix < 0.2) conflict += 1;
if (vix > 1.2 && Math.abs(y) < 0.4) conflict += 1;

if (conflict >= 2) {
  tags.push({
    level: "yellow",
    label: "⚠️ Signal Conflict",
    msg: "Multiple indicators disagree with the top narrative; confidence reduced.",
  });
}
  // Concentration (entropy proxy)
  const H = entropyConcentrationH(probs);
  if (H > 0.7) {
    tags.push({
      level: "yellow",
      label: "ℹ️ Low Conviction (entropy)",
      msg: `Scenario probabilities are spread (H=${H.toFixed(2)}).`,
    });
  }

  // 🟢 Positive (tailwinds)
  if (usd < -0.5) {
    tags.push({
      level: "green",
      label: "🌊 Liquidity Tailwind",
      msg: "USD weakness supports risk assets (usd < -0.5).",
    });
  }
  // Defensive Stable requires XLP abs return; proxy:
  if (x < 0 && y >= 0) {
    tags.push({
      level: "green",
      label: "🛡️ Defensive Stable (proxy)",
      msg: "Growth underperforms while market flow not negative.",
    });
  }

  // Add a compact reliability hint
  if (Cfinal < 45) {
    tags.push({
      level: "yellow",
      label: "⚠️ Reliability Low",
      msg: "C < 45 → regime 7B (signal conflict).",
    });
  }

  // Keep order: red -> yellow -> green
  const order = { red: 0, yellow: 1, green: 2 };
  tags.sort((a, b) => order[a.level] - order[b.level]);

  return tags;
}

