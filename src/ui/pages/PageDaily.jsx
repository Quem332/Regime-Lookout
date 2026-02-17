import React, { useMemo } from "react";
import { Card } from "../components/Card";
import { Bar } from "../components/Bar";
import { I18N, createT } from "../../core/i18n";

function detectLang() {
  try {
    const l = (navigator.language || "en").toLowerCase();
    return l.startsWith("ko") ? "ko" : "en";
  } catch {
    return "en";
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function QuadrantMap({ x = 0, y = 0, t }) {
  // x: growth(+) vs defense(-)
  // y: inflow(+) vs outflow(-)
  const nx = (clamp(x, -2, 2) + 2) / 4; // 0..1
  const ny = (clamp(y, -2, 2) + 2) / 4; // 0..1
  const left = `${nx * 100}%`;
  const top = `${(1 - ny) * 100}%`;

  return (
    <div className="relative w-full h-full rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      {/* grid */}
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
      </div>

      {/* corner labels */}
      <div className="absolute left-3 top-3 text-xs text-white/60">{TT("daily.quad.def_in", "방어·유입")}</div>
      <div className="absolute right-3 top-3 text-xs text-white/60 text-right">{TT("daily.quad.growth_in", "성장·유입")}</div>
      <div className="absolute left-3 bottom-3 text-xs text-white/60">{TT("daily.quad.def_out", "방어·유출")}</div>
      <div className="absolute right-3 bottom-3 text-xs text-white/60 text-right">{TT("daily.quad.growth_out", "성장·유출")}</div>

      {/* dot */}
      <div
        className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
        style={{ left, top }}
      />

      {/* axis labels */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/40">{TT("daily.defense", "방어")}</div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 text-right">{TT("daily.growth", "성장")}</div>
      <div className="absolute left-1/2 top-3 -translate-x-1/2 text-xs text-white/40">{TT("daily.inflow", "유입")}</div>
      <div className="absolute left-1/2 bottom-3 -translate-x-1/2 text-xs text-white/40">{TT("daily.outflow", "유출")}</div>
    </div>
  );
}

function MetricRow({ label, sub, z, t }) {
  const zNum = typeof z === "number" && Number.isFinite(z) ? z : null;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-white/70">{label}</div>
          <div className="text-base font-semibold text-white">{sub}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/50">z</div>
          <div className="text-base font-semibold text-white">{zNum === null ? "—" : `${zNum.toFixed(2)}σ`}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <Bar value={zNum ?? 0} />
        </div>
      </div>
    </Card>
  );
}

function getQuad(x, y, t) {
  const xi = x >= 0;
  const yi = y >= 0;
  if (xi && yi) {
    return {
      label: TT("daily.quad.growth_in", "성장·유입"),
      blurb: TT("daily.quad.growth_in_blurb", "리스크 선호가 강하고, 시장 전체로 자금이 들어오는 흐름"),
    };
  }
  if (xi && !yi) {
    return {
      label: TT("daily.quad.growth_out", "성장·유출"),
      blurb: TT("daily.quad.growth_out_blurb", "성장 편향은 남아있지만, 시장 총량은 줄어드는 흐름"),
    };
  }
  if (!xi && yi) {
    return {
      label: TT("daily.quad.defense_in", "방어·유입"),
      blurb: TT("daily.quad.defense_in_blurb", "방어 선호가 강하고, 자금은 남아있는 ‘리스크 오프’ 흐름"),
    };
  }
  return {
    label: TT("daily.quad.defense_out", "방어·유출"),
    blurb: TT("daily.quad.defense_out_blurb", "방어로 피난 중인데, 시장 총량도 줄어드는 압박 구간"),
  };
}

export function PageDaily({ state, t }) {
  // Ensure `t` is always callable.
  const lang = detectLang();
  const TT = useMemo(() => {
    if (typeof t === "function") return t;
    if (t && typeof t === "object") return createT(t);
    return createT(lang === "ko" ? I18N.ko : I18N.en);
  }, [t, lang]);
  const v = state?.daily?.vector ?? [0, 0, 0, 0, 0, 0];
  const [x, y, rates, usd, vix, goldFear] = v;

  const today = useMemo(() => {
    const xNum = typeof x === "number" && Number.isFinite(x) ? x : null;
    const yNum = typeof y === "number" && Number.isFinite(y) ? y : null;
    if (xNum !== null && yNum !== null) return getQuad(xNum, yNum, t);
    const label = state?.daily?.today?.label ?? TT("daily.today", "오늘");
    const blurb = state?.daily?.today?.blurb ?? TT("daily.blurb", "시장 기울기 · 자금 흐름");
    return { label, blurb };
  }, [state, t]);

  const topScenario = state?.daily?.top?.label ?? "—";
  const topP = typeof state?.daily?.top?.p === "number" ? state.daily.top.p : null;

  return (
    <div className="h-screen overflow-hidden flex flex-col gap-3 px-4 pt-4 pb-3">
      <div className="grid grid-cols-2 gap-3" style={{ gridTemplateRows: "minmax(180px, 1fr)" }}>
        <Card className="p-3">
          <div className="text-xs text-white/60 mb-2">{TT("daily.anchor", "일봉 앵커")}</div>
          <div className="h-[160px]">
            <QuadrantMap x={x ?? 0} y={y ?? 0} t={t} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-white/70">
            <div>x: {typeof x === "number" ? `${x.toFixed(2)}σ` : "—"}</div>
            <div>y: {typeof y === "number" ? `${y.toFixed(2)}σ` : "—"}</div>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs text-white/60">{TT("daily.today_title", "오늘")}</div>
            <div className="text-2xl font-extrabold text-white mt-1">{today.label}</div>
            <div className="text-sm text-white/60 mt-1">{today.blurb}</div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-white/60">{TT("daily.top", "Top 시나리오")}</div>
            <div className="text-right">
              <div className="text-sm font-semibold text-white">{topScenario}</div>
              <div className="text-xs text-white/60">{topP === null ? "—" : `${Math.round(topP * 100)}%`}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 gap-3">
        <MetricRow label={TT("metrics.rates", "금리 압박")} sub={TT("metrics.rates_sub", "20D 변화(bp) / z-score")} z={rates} t={t} />
        <MetricRow label={TT("metrics.usd", "달러 강도")} sub={TT("metrics.usd_sub", "달러 모멘텀")} z={usd} t={t} />
        <MetricRow label={TT("metrics.vix", "VIX")} sub={TT("metrics.vix_sub", "공포 변화")} z={vix} t={t} />
        <MetricRow label={TT("metrics.gold", "구조적 공포")} sub={TT("metrics.gold_sub", "달러 보정")} z={goldFear} t={t} />
      </div>
    </div>
  );
}
