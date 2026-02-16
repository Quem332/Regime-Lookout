# Regime-Lookout — MRI Market Interpretation Engine
**Mobile-first risk-aware market interpretation system based on the MRI framework.**
모바일 중심 MRI(Market Regime Interpreter) 기반 시장 해석 시스템.

## Overview | 개요
**Regime-Lookout is not a prediction model and does not provide trading signals.**
It interprets macro-financial conditions to describe the current market regime.

* **Regime-Lookout은 예측 모델이 아니며 종목 추천 시스템도 아닙니다.**
* 현재 매크로 환경을 분석해 지금 시장 상태를 해석합니다.

The goal is behavioral stability through structured interpretation of macro signals.
(매크로 신호를 구조화하여 감정적 투자 판단을 줄이는 것이 목표입니다.)

---

## Core Principles | 핵심 철학
1.  **Interpretation over Prediction**
    * 현재 시장 진단 중심.
2.  **Risk-Adjusted Confidence**
    * 신호 충돌 시 자동 신뢰도 감소.
3.  **Behavior-First Design**
    * 거래 신호가 아니라 의사결정 안정화 도구.

---

## Methodology | 분석 방법

### Feature Standardization | 변수 표준화
Public Yahoo Finance data are standardized using rolling z-scores.

* `x` = z( ln(QQQM / XLP) )
* `y` = z( VOO 20d return )
* `rates` = z( TNX change )
* `usd` = z( UUP change )
* `vix` = z( VIX change )
* `goldFear` = z(GLD) − 0.5*z(UUP)

> ✔ Gold-USD decoupling 적용
> ✔ 달러 영향 제거 후 안전자산 신호 추출

### Regime Classification | 시장 레짐 분류
Distance-based probabilistic matching to predefined prototypes:

* Risk-On
* Panic
* Stagflation
* Goldilocks
* Defensive
* Liquidity Crisis

*Single prediction is not used.* (확률 분포 형태로 출력됩니다.)

### Confidence Engine | 신뢰도 엔진
Confidence is reduced when cross-asset signals conflict.
Examples of penalty triggers:

* Risk-On + rising VIX
* Goldilocks + weak gold response
* Correlation surge across equities
* Liquidity stress + USD spike
* Divergent safe-asset behavior

**Multiple triggers → larger penalty.**
(이벤트를 직접 탐지하지 않고도 지표 간 불일치로 신뢰도 조정.)

---

## Output | 결과
* Today Score (0–100)
* Regime probability distribution
* Reasoning tags
* Confidence level
* *현재 시장 상태 설명만 제공.*

---

## Mobile-First Architecture | 모바일 중심 구조
Regime-Lookout is designed as a serverless progressive web app.

* **GitHub Actions** → `data/latest.json` update
* **GitHub Pages** → Web App
* **Mobile Browser** → PWA install

> ✔ 개인 서버 불필요
> ✔ 자동 데이터 업데이트
> ✔ 모바일 중심 UI

### Tech Stack
* **Frontend:** React + Vite + PWA, IndexedDB snapshot caching, Swipe navigation without routing
* **Data Pipeline:** Yahoo Finance (yfinance), GitHub Actions scheduled updates, JSON snapshots
* **Optional Backend:** FastAPI (local testing only)

---

## Why This Matters | 왜 중요한가
Investors face indicator overload and conflicting news.
Regime-Lookout compresses macro complexity into a clear regime signal.

It helps users:
* Pause when risk rises
* Avoid panic selling
* Avoid reckless FOMO

(행동 안정화 도구로 설계되었습니다.)

---

## Data Source and Disclaimer
* Data source: Yahoo Finance via `yfinance`.
* Data may be delayed or incomplete.
* **Regime-Lookout is an analytical interpretation tool, not financial advice.**

## Project Status
Active development.
Current focus:
* Mobile PWA stability
* Confidence calibration
* GitHub Actions data update
* UI simplification