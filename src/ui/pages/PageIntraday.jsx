import React from "react";
import { Pill } from "../components/Pill";

function fmt(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toFixed(digits);
}

export function PageIntraday({ t, intraday, marketOpen, marketCountdown, state, topbarH = 56 }) {
  // Compatibility: prefer explicit props, else derive from state
  const intra = intraday ?? state?.intraday ?? null;
  const status = state?.status ?? null;
  const isOpen = typeof marketOpen === "boolean" ? marketOpen : Boolean(status?.marketOpen);
  const countdown =
    marketCountdown ?? status?.timers?.countdown ?? status?.timers?.nextUpdateInSec ?? "--:--";

  if (!intra) return null;

  const zShort = intra.zShort;
  const corrAvg = intra.corrAvg;
  const alert = Boolean(intra.alert);

  const zTone = zShort >= 1.5 ? "green" : zShort <= -1.5 ? "red" : "yellow";
  const cTone = corrAvg >= 0.8 ? "red" : corrAvg >= 0.65 ? "yellow" : "green";

  return (
    <div
      className="h-full flex flex-col gap-3 px-4 pb-6 overflow-y-auto"
      style={{ paddingTop: topbarH + 10, touchAction: "pan-y" }}
    >
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-gray-400">{t.intraday.title}</div>
            <div className="text-sm font-semibold mt-1">{countdown}</div>
            <div className="text-[11px] text-gray-500 mt-1">US Eastern Time (ET)</div>
          </div>
          <div className="text-right">
            <Pill tone={isOpen ? "green" : "red"}>{isOpen ? t.open : t.closed}</Pill>
            {alert ? (
              <div className="text-xs text-red-300 mt-2">{t.intraday.crisis}</div>
            ) : (
              <div className="text-xs text-gray-400 mt-2">{t.intraday.autoRefresh}</div>
            )}
          </div>
        </div>
      </div>

      
      {scenario ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.intraday?.scenarioTitle ?? "분봉 시나리오(추적)"}</CardTitle>
            <CardDescription>
              {(t.intraday?.scenarioDesc ??
                "일봉 팩터를 유지하면서 오늘 장중(zShort)로 시나리오 확률을 '추적'합니다.") +
                ` • Shield ${scenario.Cfinal} • Regime ${scenario.regime7}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {Object.entries(scenario.probs || {})
                .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                .slice(0, 3)
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{k}</span>
                    <span>{Math.round((v ?? 0) * 100)}%</span>
                  </div>
                ))}
              {Array.isArray(scenario.tags) && scenario.tags.length > 0 ? (
                <div className="pt-2 text-sm text-muted-foreground">
                  {scenario.tags.slice(0, 2).map((tg, idx) => (
                    <div key={idx}>{tg?.label}</div>
                  ))}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

<div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-gray-400">{t.intraday.zTitle}</div>
          <div className="text-2xl font-extrabold mt-2">{fmt(zShort)}σ</div>
          <div className="mt-2">
            <Pill tone={zTone}>{zShort >= 0 ? "+" : ""}{fmt(zShort)}σ</Pill>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-gray-400">{t.intraday.corrTitle}</div>
          <div className="text-2xl font-extrabold mt-2">{fmt(corrAvg, 2)}</div>
          <div className="mt-2">
            <Pill tone={cTone}>
              {corrAvg >= 0.8 ? t.intraday.levelHigh : corrAvg >= 0.65 ? t.intraday.levelElevated : t.intraday.levelNormal}
            </Pill>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex-1 flex flex-col">
        <div className="text-xs text-gray-400">{t.intraday.crisisDesc}</div>
        <div className="flex-1 flex items-center justify-center text-xs text-gray-600">
          {intra.note || "—"}
        </div>
      </div>
    </div>
  );
}
