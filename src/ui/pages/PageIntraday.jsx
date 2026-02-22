import React, { useMemo } from "react";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { tSafe } from "../render/mriPipeline";

function fmt(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function PageIntraday({ t, lang, api, state, topbarH = 56 }) {
  const isKo = String(lang || "").toLowerCase().startsWith("ko");
  const L = (ko, en) => (isKo ? ko : en);

  const intra = state?.intraday ?? state?.mri?.intraday ?? api?.mri?.intraday ?? null;
  const status = state?.status ?? state?.mri?.status ?? api?.mri?.status ?? null;

  const marketOpen = Boolean(status?.marketOpen ?? status?.raw?.marketOpen ?? api?.mri?.status?.marketOpen ?? api?.mri?.marketOpen);
  const countdown = status?.timers?.countdown ?? api?.mri?.status?.timers?.countdown ?? "--:--";

  const diag = useMemo(() => {
    return {
      zShort: intra?.zShort ?? null,
      corrAvg: intra?.corrAvg ?? null,
      corrSurge: Boolean(intra?.corrSurge),
      deviation: Boolean(intra?.deviation ?? intra?.alert),
      reasons: Array.isArray(intra?.deviationReasons) ? intra.deviationReasons : [],
      asOf: intra?.meta?.asOf ?? intra?.ts ?? null,
    };
  }, [intra]);

  const showLock = !marketOpen;

  return (
    <div className="px-4 pb-6 min-h-[calc(100dvh-4rem)]" style={{ paddingTop: Math.max(8, (topbarH || 56) - 48) }}>
      {showLock ? (
        <Card title={tSafe(t, "market.closed", L("장 마감", "Market Closed"))} subtitle={tSafe(t, "a2.lockSub", L("장 외 시간에는 인트라데이 신호가 비활성화됩니다.", "Intraday is disabled off-hours"))}>
          <div className="text-xs text-white/70">
            {tSafe(t, "market.opensIn", "Opens in")} <span className="font-mono">{countdown}</span> <span className="text-white/50">(09:30 ET)</span>
          </div>
          <div className="mt-2 text-[11px] text-white/55">
            {tSafe(t, "market.noteDaily", "Daily interpretation remains available off-hours.")}
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          <Card title={tSafe(t, "a2.title", "Intraday Diagnostics")} subtitle={tSafe(t, "a2.subtitle", "Deviation watch vs daily scenario")}>
            <div className="flex items-center gap-2">
              {diag.deviation ? (
                <Pill tone="yellow" label={tSafe(t, "a2.deviation", "Deviation")} msg={tSafe(t, "a2.devMsg", "Intraday signals deviate from baseline. Avoid single-scenario calls.")} lang={lang} />
              ) : (
                <Pill tone="gray" label={tSafe(t, "a2.normal", "Within range")} msg={tSafe(t, "a2.normMsg", "No strong intraday dislocation flags detected.")} lang={lang} />
              )}
              {diag.corrSurge ? <Pill tone="yellow" label="corrSurge" msg={tSafe(t, "a2.corrMsg", "Cross-asset correlation is spiking.")} lang={lang} /> : null}
            </div>

            {diag.reasons?.length ? (
              <div className="mt-2 text-xs text-white/60 leading-snug">
                {tSafe(t, "a2.reasons", "Reasons")}: {diag.reasons.join(" · ")}
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/75">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="text-[11px] text-white/55">zShort</div>
                <div className="font-mono text-sm">{fmt(diag.zShort, 2)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="text-[11px] text-white/55">corrAvg</div>
                <div className="font-mono text-sm">{fmt(diag.corrAvg, 2)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="text-[11px] text-white/55">{tSafe(t, "a2.refresh", "Refresh")}</div>
                <div className="font-mono text-sm">{countdown}</div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
