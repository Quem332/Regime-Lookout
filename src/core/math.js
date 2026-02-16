export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function softmaxFromNegDistance(distMap) {
  // distMap: {k: d}
  const keys = Object.keys(distMap);
  if (!keys.length) return {};
  const exps = {};
  let sum = 0;
  for (const k of keys) {
    const v = Math.exp(-distMap[k]);
    exps[k] = v;
    sum += v;
  }
  const probs = {};
  for (const k of keys) probs[k] = sum > 0 ? exps[k] / sum : 0;
  return probs;
}

export function renormalize(probs) {
  const sum = Object.values(probs).reduce((a, b) => a + b, 0);
  if (sum <= 0) return probs;
  const out = {};
  for (const k of Object.keys(probs)) out[k] = probs[k] / sum;
  return out;
}

