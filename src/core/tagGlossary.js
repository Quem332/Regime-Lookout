// Bilingual (EN/KR) tooltip strings for reasoning tags.
// Keep labels stable; match by label prefix (emoji + text) as emitted by core/tags.js.

const MAP = {
  "⚡ Correlation Surge": {
    koLabel: "⚡ 상관 급등",
    koMsg: "자산 간 동조화가 커져 분산효과가 약해짐(평균 상관 > 0.8).",
  },
  "🔥 Panic Confirmed": {
    koLabel: "🔥 패닉 확증",
    koMsg: "현금 선호가 급증하는 조합(y↓, 달러↑, 변동성↑).",
  },
  "🚨 Defense Broken (proxy)": {
    koLabel: "🚨 방어선 붕괴(프록시)",
    koMsg: "광범위한 리스크오프 징후(정확한 확인은 XLP 절대값 필요).",
  },
  "⚡ Correlation Surge (intraday)": {
    koLabel: "⚡ 장중 상관 급등",
    koMsg: "장중에도 자산 동조화가 급등(분산효과 약화).",
  },
  "⚠️ Rates Lagging": {
    koLabel: "⚠️ 금리 지표 지연",
    koMsg: "금리 변화가 다른 신호 대비 뒤처지는 패턴.",
  },
  "⚠️ VIX Mismatch": {
    koLabel: "⚠️ VIX 불일치",
    koMsg: "가격/모멘텀 대비 변동성 지표가 따로 노는 상태.",
  },
  "👀 Haven Divergence": {
    koLabel: "👀 헤지 수요 괴리",
    koMsg: "달러/금/변동성 등 헤지 프록시 간 방향이 엇갈림.",
  },
  "⚠️ Forced Deleveraging (gold lag)": {
    koLabel: "⚠️ 강제 디레버리징(금 지연)",
    koMsg: "리스크오프인데 금(헤지)이 못 따라오는 패턴.",
  },
  "⚠️ Rates Headwind": {
    koLabel: "⚠️ 금리 역풍",
    koMsg: "금리 압력이 위험자산/성장에 부담으로 작용.",
  },
  "⚠️ FX Shock Mismatch": {
    koLabel: "⚠️ FX 쇼크 불일치",
    koMsg: "달러 급변 신호와 다른 변수들이 충돌.",
  },
  "⚠️ Volatility Shock": {
    koLabel: "⚠️ 변동성 쇼크",
    koMsg: "변동성이 급격히 확대되는 스트레스 구간.",
  },
  "⚠️ Intraday Dislocation": {
    koLabel: "⚠️ 장중 괴리",
    koMsg: "장중 위치(z_short)와 일봉 맥락이 크게 어긋남.",
  },
  "⚠️ Signal Conflict": {
    koLabel: "⚠️ 신호 충돌",
    koMsg: "핵심 변수들이 서로 다른 레짐을 가리킴.",
  },
  "ℹ️ Low Conviction (entropy)": {
    koLabel: "ℹ️ 낮은 확신(엔트로피)",
    koMsg: "확률이 분산되어 결론 집중도가 낮음.",
  },
  "🌊 Liquidity Tailwind": {
    koLabel: "🌊 유동성 순풍",
    koMsg: "달러 약세/리스크 선호 조합으로 유동성 환경이 우호적.",
  },
  "🛡️ Defensive Stable (proxy)": {
    koLabel: "🛡️ 방어적 안정(프록시)",
    koMsg: "방어 성향이 우세하지만 급격한 스트레스는 제한적.",
  },
  "⚠️ Reliability Low": {
    koLabel: "⚠️ 신뢰도 낮음",
    koMsg: "신뢰도(C)가 낮아 점수가 캡/감점되는 상태.",
  },
};

export function getTagBilingual(tag) {
  const label = tag?.label ?? tag?.text ?? "";
  const msg = tag?.msg ?? "";
  const entry = MAP[label];

  return {
    enLabel: label,
    enMsg: msg,
    koLabel: entry?.koLabel ?? label,
    koMsg: entry?.koMsg ?? "",
  };
}
