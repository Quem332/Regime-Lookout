export const I18N = {
  en: {
    appName: "MRI",
    pages: { A: "Daily", B: "Score", C: "Hub", D: "Intraday" },
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
    scenarios: {
      1: "Healthy Correction",
      2: "Panic Collapse",
      3: "Fake Rally",
      4: "Goldilocks",
      5: "Liquidity Party",
      6: "Stagflation",
    },
  },
  ko: {
    appName: "MRI",
    pages: { A: "일봉", B: "스코어", C: "허브", D: "분봉" },
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
    scenarios: {
      1: "건전한 조정",
      2: "패닉 붕괴",
      3: "가짜 반등",
      4: "골디락스",
      5: "유동성 파티",
      6: "스태그플레이션",
    },
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
