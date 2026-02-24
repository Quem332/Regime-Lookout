export const I18N = {
  en: {
    appName: "MRI",
    pages: { A: "Daily", B: "Score", C: "Hub", D: "Intraday" },
    b: { lookback: "Lookback", na: "(data not available yet)" },
    dataPreparingTitle: "Data is being prepared",
    dataPreparingBody: "Latest daily data isn’t available yet. Try again in a moment.",
    dataPreparingBodyMarket: "Market view data isn’t available yet. Try again in a moment.",
    open: "OPEN",
    closed: "CLOSED",
    marketOpen: "Market Open",
    marketClosed: "Market Closed",
    opensAt: "Opens 09:30 ET",
    swipeHint: "Swipe ← → for loop • Swipe ↑ ↓ for pair switch",
    daily: {
      anchorTitle: "Daily Anchor",
      todayStatus: "Today",
      topScenario: "Top Scenario",
      confidence: "confidence",
      quad: {
        growthIn: "Growth + Inflow",
        growthOut: "Growth + Outflow",
        defenseIn: "Defense + Inflow",
        defenseOut: "Defense + Outflow",
        growth: "Growth tilted",
        defense: "Defense tilted",
        moneyIn: "Money inflow",
        moneyOut: "Money outflow",
      },
      bars: {
        rates: "Rate Pressure",
        ratesHint: "20D change (raw) / z-score",
        usd: "USD Strength",
        usdHint: "Dollar momentum",
        vix: "VIX",
        vixHint: "Fear level change",
        goldFear: "Gold Fear",
        goldFearHint: "Gold vs USD-adjusted",
      },
    },
    score: {
      titleTop: "TODAY SCORE",
      reliability: "Reliability",
      topScenarios: "Top Scenarios",
      regimeSignalConflict: "Signal Conflict (7B)",
      regimeNeutral: "Market Neutral (7A)",
      regimeGateFail: "Undefined / Gate Fail (7C)",
      mixedSignals: "C < 45 (low reliability)",
      lowMagnitude: "Low (x,y) magnitude",
      gateFail: "No scenario passed hard gates",
    },
    intraday: {
      title: "Intraday",
      zTitle: "z_short (60D intraday position)",
      corrTitle: "Correlation Surge",
      crisis: "CRISIS DETECTION",
      crisisDesc: "Correlation spike / abnormal intraday move",
      autoRefresh: "Auto-refresh",
      levelHigh: "High",
      levelElevated: "Elevated",
      levelNormal: "Normal",
    },
    hub: {
      title: "MRI System Hub",
      version: "v2.3 Final Gold Master",
      dataSources: "Data Sources",
      logic: "System Logic",
      nav: "Navigation",
      disclaimer: "Disclaimer",
      philosophy: "Philosophy",
      settings: "Settings",
      language: "Language",
      refreshMock: "Refresh",
      about: "About",
      discText:
        "Informational only. Not financial advice. Use at your own risk. Data sources may change or become unavailable. If a data provider requests removal/changes, the project will comply immediately.",
      philText: "Interpretation, not prediction. Survival, not speculation.",
      navText1: "Swipe ← →: Main loop (A→B→D→C)",
      navText2: "Swipe ↑ ↓: Pair switch (A↔C, B↔D)",
    },
    scoreLabels: { calm: "Calm", watch: "Watch", risk: "Risk" },
    ui: {
      copyExport: "Copy Export",
      openLogs: "Open Logs",
      copyLogs: "Copy Logs",
      clearLocal: "Clear Local",
      debug: "Debug",
      reasoningTags: "Reasoning Tags",
      probabilities: "Scenario Probabilities",
      quadrant: "Position Map",
      intradayNote: "Off-hours, the app defaults to Daily view. Intraday is for market-hours diagnostics only.",
      langToggle: "K/E",
    },
    verdict: {
      na: "No score signal.",
      r7c: "Undefined regime (hard gates failed). Treat this as low-conviction interpretation.",
      r7b: "Signal conflict regime. Avoid single-scenario interpretation; use the distribution + tags.",
      r7a: "Neutral/low-magnitude regime. Interpretation should remain conservative.",
      calm: "Conditions look relatively stable (risk-adjusted).",
      watch: "Mixed/transition regime; watch risk structure.",
      risk: "Risk pressure is elevated (risk-adjusted).",
      calmLowC: "Looks calm, but confidence is limited.",
      watchLowC: "Mixed signals; keep interpretation cautious.",
      riskLowC: "Risky tone, and confidence is limited.",
      entropyCalm: "Stable tilt, but scenario conviction is dispersed (high entropy).",
      entropyWatch: "Mixed signals with dispersed scenarios (high entropy). Keep it cautious.",
      entropyRisk: "Risk pressure is elevated, but scenario conviction is dispersed (high entropy).",
    },
    hubUi: {
      copyExport: "Copy Export",
      debugTitle: "Debug",
      debugSub: "Logs / export",
      aboutTitle: "About",
      aboutSub: "Interpretation, not prediction",
      aboutText: "Informational only. Not financial advice. Use at your own risk. Data may be delayed or unavailable.",
      logsTitle: "Logs",
      copy: "Copy",
      close: "Close",
      cleared: "Cleared local storage.",
      copyFailed: "Copy failed.",
    },
    scenarios: {
      1: "Healthy Correction",
      2: "Panic Collapse",
      3: "Fake Rally",
      4: "Goldilocks",
      5: "Liquidity Party",
      6: "Stagflation",
    },
    // A-1 copy pack (3-layer)
    "copy.summary.na": "Insufficient data for a firm read.",
    "copy.summary.high": "Conditions look relatively stable (risk-adjusted).",
    "copy.summary.mid": "Mixed/transition conditions are observed; avoid forcing a single narrative.",
    "copy.summary.low": "Risk pressure is elevated; treat the environment as fragile.",
    "copy.summary.7c": "Undefined regime (hard gates not satisfied). Treat the read as low-conviction.",
    "copy.summary.7b": "Signal-conflict regime (7B). Avoid single-scenario interpretation.",
    "copy.summary.7a": "Low-magnitude / neutral regime (7A). Expect smaller signal content.",
    "copy.warn.low": "Reliability is low: treat this as watch-only interpretation.",
    "copy.warn.mid": "Reliability is moderate: keep conclusions conservative.",
    "copy.warn.high": "Signal consistency is relatively good, but overconfidence is still a risk.",
    "copy.warn.dispersed": "Scenario probabilities are dispersed: single-scenario conviction is limited.",
    "copy.reasons.na": "No clear single driver dominates.",

  },
  ko: {
    appName: "MRI",
    pages: { A: "일봉", B: "스코어", C: "허브", D: "분봉" },
    b: { lookback: "기간", na: "(데이터 준비 전)" },
    scoreLabels: { calm: "안정", watch: "주의", risk: "위험" },
    ui: {
      copyExport: "내보내기 복사",
      openLogs: "로그 열기",
      copyLogs: "로그 복사",
      clearLocal: "로컬 초기화",
      debug: "디버그",
      reasoningTags: "근거 태그",
      probabilities: "시나리오 확률",
      quadrant: "포지션 지도",
      intradayNote: "장외 시간에는 일봉을 기본으로 표시합니다. 분봉은 장중 진단용입니다.",
      langToggle: "K/E",
    },
    open: "열림",
    closed: "닫힘",
    marketOpen: "장 열림",
    marketClosed: "장 닫힘",
    opensAt: "09:30 ET 개장",
    swipeHint: "← →: 루프 • ↑ ↓: 페어 전환",
    daily: {
      anchorTitle: "일봉 앵커",
      todayStatus: "오늘",
      topScenario: "Top 시나리오",
      confidence: "신뢰",
      quad: {
        growthIn: "성장·유입",
        growthOut: "성장·유출",
        defenseIn: "방어·유입",
        defenseOut: "방어·유출",
        growth: "성장 기울기",
        defense: "방어 기울기",
        moneyIn: "자금 유입",
        moneyOut: "자금 유출",
      },
      bars: {
        rates: "금리 압박",
        ratesHint: "20D 변화(bp) / z-score",
        usd: "달러 강도",
        usdHint: "달러 모멘텀",
        vix: "VIX",
        vixHint: "공포 변화",
        goldFear: "구조적 공포",
        goldFearHint: "달러 보정",
      },
    },
    score: {
      titleTop: "TODAY SCORE",
      reliability: "신뢰도",
      topScenarios: "상위 시나리오",
      regimeSignalConflict: "신호 충돌 (7B)",
      regimeNeutral: "시장 중립 (7A)",
      regimeGateFail: "정의 불가/게이트 탈락 (7C)",
      mixedSignals: "C < 45 (낮은 신뢰도)",
      lowMagnitude: "(x,y) 크기 부족",
      gateFail: "모든 시나리오가 게이트 탈락",
    },
    intraday: {
      title: "분봉",
      zTitle: "z_short (60일 동일시점 분포)",
      corrTitle: "상관 급등",
      crisis: "위기 감지",
      crisisDesc: "상관 급등 / 비정상 장중 변동",
      autoRefresh: "자동 갱신",
      levelHigh: "높음",
      levelElevated: "상승",
      levelNormal: "정상",
    },
    hub: {
      title: "MRI 허브",
      version: "v2.3 Final Gold Master",
      dataSources: "데이터 소스",
      logic: "시스템 로직",
      nav: "네비게이션",
      disclaimer: "면책",
      philosophy: "철학",
      settings: "설정",
      language: "언어",
      refreshMock: "새로고침",
      about: "정보",
      discText:
        "본 앱은 정보 제공/교육 목적이며 투자 자문이 아닙니다. 데이터 지연/변경/중단 가능성이 있으며, 투자 결과에 대한 책임은 사용자에게 있습니다. 데이터 제공자가 삭제/변경을 요청하면 즉시 준수합니다.",
      philText: "예측이 아니라 해석, 투기가 아니라 생존.",
      navText1: "← →: 메인 루프 (A→B→D→C)",
      navText2: "↑ ↓: 페어 전환 (A↔C, B↔D)",
    },
    verdict: {
      na: "점수 신호 없음.",
      r7c: "레짐 정의 불가(게이트 탈락). 확신도를 낮추고 분포/태그 중심으로 해석하세요.",
      r7b: "신호 충돌 레짐. 단일 시나리오로 단정하지 말고 분포/태그를 보세요.",
      r7a: "중립/저강도 레짐. 해석을 보수적으로 유지하세요.",
      calm: "상대적으로 안정적인 컨디션(위험조정 기준)입니다.",
      watch: "전환/혼조 구간일 수 있어 구조 리스크를 관찰하세요.",
      risk: "리스크 압력이 높습니다(위험조정 기준).",
      calmLowC: "안정적으로 보이지만 신뢰도가 제한됩니다.",
      watchLowC: "혼조 신호입니다. 해석을 보수적으로 유지하세요.",
      riskLowC: "리스크 톤 + 신뢰도 제한이 동시에 있습니다.",
      entropyCalm: "안정 쪽으로 기울었지만 시나리오 확신도가 분산(엔트로피↑)돼 있습니다.",
      entropyWatch: "혼조 + 시나리오 분산(엔트로피↑)입니다. 보수적으로 해석하세요.",
      entropyRisk: "리스크 압력은 높지만 시나리오 확신도가 분산(엔트로피↑)돼 있습니다.",
    },
    hubUi: {
      copyExport: "내보내기 복사",
      debugTitle: "디버그",
      debugSub: "로그 / 내보내기",
      aboutTitle: "정보",
      aboutSub: "예측이 아니라 해석",
      aboutText: "본 앱은 투자 자문이 아닙니다. 데이터 지연/중단 가능성이 있으며 책임은 사용자에게 있습니다.",
      logsTitle: "로그",
      copy: "복사",
      close: "닫기",
      cleared: "로컬 저장소를 초기화했습니다.",
      copyFailed: "복사 실패.",
    },

    // Period interpretation (B-1)
    "period.summary.r7": "이 기간에서는 구조가 혼재/정의 불가 상태입니다. 확신도를 낮추고 분포 중심으로 해석하세요.",
    "period.summary.dispersed": "시나리오 확률이 분산되어 있습니다. 단일 스토리로 단정하지 말고 태그/분포를 함께 보세요.",
    "period.summary.lowc": "신호는 있으나 신뢰도가 제한됩니다. 문구/해석을 보수적으로 유지하세요.",
    "period.summary.base": "구조가 비교적 일관적입니다. 태그/분포를 통해 동인을 확인하세요.",
    "period.warn.verylow": "신뢰도 매우 낮음: 단정 대신 분포를 우선하고 구조가 정리될 때까지 기다리세요.",
    "period.warn.low": "신뢰도 낮음: 어떤 내러티브도 잠정적으로만 받아들이세요.",
    "period.warn.dispersed": "분산이 큼: 레짐 라벨이 안정적으로 보여도 시나리오 확신은 약합니다.",
    "period.reasons.top": "상위 시나리오",
    "period.reasons.entropy": "분산도(엔트로피)",
    "period.reasons.regime": "레짐",
    "period.btn.pending": "준비중",
    "period.pending": "데이터 준비 중",
    "ui.dataMissing": "데이터가 없어 표시할 수 없습니다. (Actions에서 데이터 업데이트를 실행하세요)",
    scenarios: {
      1: "건전한 조정",
      2: "패닉 붕괴",
      3: "가짜 반등",
      4: "골디락스",
      5: "유동성 파티",
      6: "스태그플레이션",
    },
        "period.meta.period": "기간",
        "period.meta.conf": "신뢰도",
        "period.summary.lowc": "{p} 신호는 있으나 확신은 제한적입니다. 문구는 보수적으로 유지하세요.",
        "period.warn.verylow": "신뢰도 매우 낮음: 분산/관망을 우선하고 구조가 정리되길 기다리세요.",
        "period.warn.low": "신뢰도 낮음: 단정은 피하고 추가 확인을 권장합니다.",
    // A-1 문구(3층 구조: 요약/신뢰도 경고/근거)
    "copy.summary.na": "단정할 만큼의 데이터가 충분하지 않습니다.",
    "copy.summary.high": "리스크 조정 관점에서 비교적 안정 신호가 우세합니다.",
    "copy.summary.mid": "혼조/전환 신호가 관측됩니다. 단일 내러티브로 단정하지 마세요.",
    "copy.summary.low": "리스크 압력이 강화되어 환경이 취약할 수 있습니다.",
    "copy.summary.7c": "정의 불가(게이트 미달, 7C) 구간입니다. 과도한 해석을 피하세요.",
    "copy.summary.7b": "신호 충돌(7B) 구간입니다. 단일 시나리오로 결론 내리기 어렵습니다.",
    "copy.summary.7a": "저신호/중립(7A) 구간입니다. 해석 강도를 낮추는 편이 안전합니다.",
    "copy.warn.low": "신뢰도가 낮습니다. 관찰 중심으로 해석 강도를 낮추세요.",
    "copy.warn.mid": "신뢰도가 중간입니다. 결론은 보수적으로 유지하세요.",
    "copy.warn.high": "신호 일관성은 양호하지만, 과신은 여전히 위험합니다.",
    "copy.warn.dispersed": "시나리오 확률이 분산되어 확신도가 제한됩니다.",
    "copy.reasons.na": "뚜렷한 단일 근거가 지배적이지 않습니다.",

  },
};

// -----------------------------------------------------------------------------
// createT(dict):
// Many pages historically used `t("key")` (function), while some newer pages
// access structured groups like `t.hub.title` (object).
//
// To keep compatibility (and avoid runtime crashes like "t is not a function"),
// we expose a translator function that also carries the raw dictionary as
// properties.
// -----------------------------------------------------------------------------
export function createT(dict) {
  const safeDict = (dict && typeof dict === "object") ? dict : I18N.en;

  const t = (key, fallback = "") => {
    try {
      if (!key) return fallback;
      const v = safeDict[key];
      if (typeof v === "string") return v;
      // allow nested access via dot notation: "hub.title"
      if (typeof key === "string" && key.includes(".")) {
        const parts = key.split(".");
        let cur = safeDict;
        for (const p of parts) {
          if (!cur || typeof cur !== "object") return fallback || key;
          cur = cur[p];
        }
        return (typeof cur === "string") ? cur : (fallback || key);
      }
      return fallback || key;
    } catch {
      return fallback || key;
    }
  };

  // Expose structured groups (e.g. t.intraday.*, t.hub.*)
  // and also allow direct access to any plain keys on the dictionary.
  try {
    Object.assign(t, safeDict);
  } catch {
    // ignore
  }

  // Attach groups for pages that do `t.hub.*`
  // Functions are objects in JS, so this is safe.
  t.dict = safeDict;
  t.lang = safeDict === I18N.ko ? "ko" : "en";
  t.hub = safeDict.hub || I18N.en.hub;
  return t;
}
