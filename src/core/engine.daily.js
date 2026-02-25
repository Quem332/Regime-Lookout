import { SCENARIOS } from "./constants";
import { clamp, softmaxFromNegDistance, renormalize } from "./math";

// Layer 1 + Layer 2 (Spec-Strict)

export function hardGatePass(k, V) {
  const [x, y, rates, usd, vix, goldFear] = V;

  switch (Number(k)) {
    case 1:
      return x < 0 && rates >= 0.5;
    case 2:
      return y < -1.0 && vix >= 0.5 && usd >= 0.5;
    case 3:
      return x > 0.5 && (rates >= 0.5 || usd >= 0.5);
    case 4:
      return y > 0 && rates <= -0.5 && usd <= -0.5;
    case 5:
      return y > 0.5 && usd <= -0.5;
    case 6:
      // Spec: rates >= 0.5 AND goldFear >= 0.5 AND (x < 0 OR y < 0)
      return rates >= 0.5 && goldFear >= 0.5 && (x < 0 || y < 0);
    default:
      return false;
  }
}

export function euclid(V, S) {
  let sum = 0;
  for (let i = 0; i < V.length; i++) {
    const d = V[i] - S[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function scenarioDistance(k, V) {
  const vec = SCENARIOS?.[k]?.vector;
  if (!Array.isArray(vec) || vec.length !== V.length) return Number.POSITIVE_INFINITY;
  return euclid(V, vec);
}

export function computeProbabilitiesSpec(V) {
  const keysAll = Object.keys(SCENARIOS);

  // 1) Gate pass keys
  const passed = [];
  for (const k of keysAll) {
    if (hardGatePass(k, V)) passed.push(k);
  }

  // 2) Candidate set for probability calculation:
  //    - Normal: only passed keys
  //    - 7C path (none passed): use ALL keys to avoid a 0-sum distribution
  const cand = passed.length > 0 ? passed : keysAll;

  // 3) Softmax over distances -> probability
  const distMap = {};
  for (const k of cand) distMap[k] = scenarioDistance(k, V);

  const raw = {};
  for (const k of cand) {
    const d = distMap[k];
    // smaller distance => larger prob
    raw[k] = Number.isFinite(d) ? Math.exp(-d) : 0;
  }

  // Normalize safely
  const sum = Object.values(raw).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

  const probs = {};
  for (const k of keysAll) probs[k] = 0;

  if (sum <= 0 || !Number.isFinite(sum)) {
    // final fallback: uniform distribution across all scenarios
    const u = 1 / Math.max(1, keysAll.length);
    for (const k of keysAll) probs[k] = u;
  } else {
    for (const k of cand) probs[k] = raw[k] / sum;
  }

  return { probs, passedKeys: passed };
}


export function entropyConcentrationH(probs) {
  // Proxy for "concentration" because true Top10 H is unavailable in mock.
  // Normalized entropy in [0..1] (higher => more spread, less concentrated conviction).
  let H = 0;
  const vals = Object.values(probs);
  const K = vals.length;
  for (const p of vals) {
    if (p > 0) H += -p * Math.log2(p);
  }
  const Hnorm = K > 1 ? H / Math.log2(K) : 0;
  return Hnorm;
}

export function computeReliabilityCSpec({ dataOk, corrAvg, corrSurge = false, zShort = 0, V, probs }) {
  // Hard caps
  if (!dataOk) return { C: 30, caps: { data: true, panic: false, corr: false } };

  const [x, y, rates, usd, vix, goldFear] = V;

  const panicConfirmed = y < -1.0 && usd > 0.5 && vix > 0.5; // aligned with spec tag definition
  if (panicConfirmed) return { C: 35, caps: { data: false, panic: true, corr: false } };

  if (corrAvg > 0.8) return { C: 40, caps: { data: false, panic: false, corr: true } };

  let C = 100;

  // ------------- Soft deductions (robust to real-world divergences) -------------

  // 0) Identify top scenario key
  const topK = Object.entries(probs).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? null;

  // 1) Concentration(H) — using entropy proxy:
  const H = entropyConcentrationH(probs);
  // If distribution is too spread (low conviction), deduct.
  if (H > 0.7) C -= 6;

  // 2) Divergence (quiet drift / distribution suspicion)
  const divergence = Math.abs(y) > 1.0 && Math.abs(vix) < 0.3;
  if (divergence) C -= 6;

  // 3) VIX mismatch
  const vixMismatch = y < 0 && vix < 0.2;
  if (vixMismatch) C -= 6;

  // 4) Safe-haven divergence (policy/event-driven decoupling)
  // Risk-on-ish top scenario but USD is strong and goldFear is negative -> "USD-only flight / Gold lag"
  const havenDivergence =
    (topK === "4" || topK === "5") && usd > 0.4 && goldFear < -0.7 && vix < 0.5;
  if (havenDivergence) C -= 8;

  // 5) Panic without gold confirmation (forced deleveraging can sell gold too; don't flip regime, just reduce C)
  const panicNoGold = topK === "2" && usd > 0.4 && vix > 0.3 && goldFear < -0.2;
  if (panicNoGold) C -= 6;

  // 6) Rates headwind against risk-on (risk-on but yields rising fast)
  const ratesHeadwind = (topK === "4" || topK === "5") && y > 0.5 && rates > 0.8;
  if (ratesHeadwind) C -= 6;

  // 7) FX shock style mismatch (USD spike without vol spike) — common around policy headlines
  const fxShockMismatch = usd > 0.8 && vix < 0.2 && Math.abs(y) < 0.6;
  if (fxShockMismatch) C -= 6;

  // 8) Macro ambiguity buckets (where simple factor models can misread the dominant narrative)
  // Inflation shock (rates up + equities/flows down) vs. growth shock vs. policy headline noise.
  // We do NOT flip regimes here; we only reduce reliability so the UI communicates uncertainty.
  const inflationShockAmbig =
    y < -0.4 && rates > 0.9 && usd > 0.2 && vix < 0.9;
  if (inflationShockAmbig) C -= 8;

  const growthShockAmbig =
    y < -0.4 && rates < -0.8 && usd > 0.2 && goldFear > 0.3 && vix < 1.2;
  if (growthShockAmbig) C -= 8;

  // Policy/FX whipsaw: big USD + big rates, but equity flow signal is muted (often headline-driven, hard to interpret)
  const policyWhipsaw = Math.abs(usd) > 0.9 && Math.abs(rates) > 0.9 && Math.abs(y) < 0.4;
  if (policyWhipsaw) C -= 6;

  // Commodity/real-yield cross-currents: gold and USD both strong without fear spike (can be CPI/real-yield story)
  const usdGoldTogether = usd > 0.6 && goldFear > 0.6 && vix < 0.6;
  if (usdGoldTogether) C -= 6;


// 8) Event-like dislocation signals (indicator-only; no calendar dependency)
//    These do NOT flip regime; they only reduce reliability because the market is "less interpretable".
const zShortAbs = Math.abs(Number.isFinite(zShort) ? zShort : 0);

// Volatility shock (daily)
if (vix > 1.2) C -= 8;

// Correlation surge flag (intraday)
if (corrSurge) C -= 10;

// Intraday extreme move (often headline-driven)
if (zShortAbs > 1.5) C -= 6;

// 9) Unified signal-conflict score (small penalties, additive; designed to keep top scenario stable)
//    Think of this as "how many axes disagree with the top narrative".
let conflict = 0;
const isRiskOnTone = topK === "4" || topK === "5"; // Goldilocks / Liquidity Party
const isPanicTone = topK === "2";
const isStagTone = topK === "6";

if (isRiskOnTone) {
  if (usd > 0.6) conflict += 1;        // USD strength against risk-on narrative
  if (goldFear < -0.7) conflict += 1;  // safe-haven non-confirmation
  if (vix > 0.7) conflict += 1;        // fear too high for "stable" tone
  if (rates > 0.9) conflict += 1;      // yields rising fast
} else if (isPanicTone) {
  // Panic should have fear/flight confirmation; if missing, reduce reliability but don't flip.
  if (vix < 0.3) conflict += 1;
  if (usd < 0.2) conflict += 1;
} else if (isStagTone) {
  // Stagflation should look like rates pressure + weak flow; if not, reduce reliability.
  if (rates < 0.5) conflict += 1;
  if (y > 0.3) conflict += 1;
}

// Also apply a mild global mismatch check independent of scenario:
// Down flow without fear spike (quiet distribution) OR fear spike without flow (headline vol).
if (y < -0.8 && vix < 0.2) conflict += 1;
if (vix > 1.2 && Math.abs(y) < 0.4) conflict += 1;

conflict = clamp(conflict, 0, 4);

// Small penalties per conflict, but allow a larger hit only when multiple conflicts stack.
if (conflict > 0) {
  C -= conflict * 4;        // 4~16
  if (conflict >= 3) C -= 4; // extra only for heavy multi-signal disagreement
}

  return { C: clamp(C, 5, 100), caps: { data: false, panic: false, corr: false } };
}

export function computeRegime7Spec({ passedKeys, Cfinal, V }) {
  // Check order per spec:
  // 7C: passed set empty
  // 7B: C < 45
  // 7A: vector magnitude fail
  if (!passedKeys || passedKeys.length === 0) return "7C";
  if (Cfinal < 45) return "7B";
  // Spec text: “벡터 크기 미달” — for Market Neutral we use x,y magnitude (fits “map neutral”)
  const xyMag = Math.sqrt(V[0] ** 2 + V[1] ** 2);
  if (xyMag < 0.5) return "7A";
  return null;
}

export function computeTodayScoreSpec({ probs, Cfinal, corrAvg, V, regime7 }) {
  const pTop = Math.max(...Object.values(probs));
  const pEff = pTop * (Cfinal / 100);
  const base = pEff * 100;

  const [x, y, , usd, vix] = V;

  const Icorr = corrAvg > 0.8 ? 1 : 0;
  const Ipanic = y < -1.0 && usd > 0.5 && vix > 0.5 ? 1 : 0;

  // Defense Broken (spec wants x<0 AND XLP<0). We don’t have XLP absolute in mock.
  // Proxy: x<0 AND y<0 indicates broad risk-off with defensive underperforming (approx).
  // Replace with real XLP return later.
  const Idefense = x < 0 && y < 0 ? 1 : 0;

  const penaltyRaw = 25 * Icorr + 15 * Ipanic + 15 * Idefense;
  const penaltyApplied = penaltyRaw * (Cfinal / 100);

  let score = clamp(base - penaltyApplied, 0, 100);

  // Safe cap for 7-series
  if (regime7) score = Math.min(score, 60);

  return {
    score: Math.round(score),
    pTop,
    pEff,
    flags: { Icorr, Ipanic, Idefense },
    penaltyApplied,
  };
}

