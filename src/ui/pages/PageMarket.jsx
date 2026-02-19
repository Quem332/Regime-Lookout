import React, { useEffect, useRef } from "react";
import { Card } from "../components/Card";
import { isMarketOpenET } from "../../core/time.et";

function isInteractiveTarget(el) {
  try {
    return Boolean(el?.closest?.("button, a, input, textarea, select, [role='button'], [data-stop-toggle='1']"));
  } catch {
    return false;
  }
}

function isTapLike(start, end) {
  const dx = Math.abs((end?.x ?? 0) - (start?.x ?? 0));
  const dy = Math.abs((end?.y ?? 0) - (start?.y ?? 0));
  const dt = (end?.t ?? 0) - (start?.t ?? 0);
  return dx < 10 && dy < 10 && dt < 400;
}

export function PageMarket({ api, tab, setTab, t }) {
  const mri = api?.mri;
  const daily = mri?.daily || null;
  const intraday = mri?.intraday || null;

  // Two internal views: daily | intraday
  const view = tab ?? "daily";

  // Default: if market is closed -> daily, even if intraday exists.
  useEffect(() => {
    if (tab) return;
    const open = isMarketOpenET(new Date());
    const hasIntra = Boolean(intraday);
    setTab?.(open && hasIntra ? "intraday" : "daily");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tap-to-toggle internal view
  const downRef = useRef(null);
  const onPointerDown = (e) => {
    if (isInteractiveTarget(e.target)) return;
    downRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = (e) => {
    if (isInteractiveTarget(e.target)) return;
    const start = downRef.current;
    downRef.current = null;
    const end = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!start) return;
    if (!isTapLike(start, end)) return;
    setTab?.((v) => (v === "daily" ? "intraday" : "daily"));
  };

  const intra = intraday || {};
  const zShort = Number.isFinite(intra?.zShort) ? intra.zShort : null;
  const corrAvg = Number.isFinite(intra?.corrAvg) ? intra.corrAvg : null;
  const corrSurge = Boolean(intra?.corrSurge);

  const score = Number.isFinite(daily?.score) ? daily.score : null;
  const Cfinal = Number.isFinite(daily?.Cfinal) ? daily.Cfinal : null;

  return (
    <div className="px-4 pb-6" onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ touchAction: "pan-y" }}>
      {view === "daily" ? (
        <div className="grid gap-3">
          <Card title={t?.("pages.A", "Daily") ?? "Daily"} subtitle="Anchor view">
            <div className="flex items-end gap-3">
              <div className="text-4xl font-extrabold text-white">{score == null ? "--" : String(Math.round(score))}</div>
              <div className="text-sm text-white/70 pb-1">C {Cfinal == null ? "--" : String(Math.round(Cfinal))}</div>
            </div>
          </Card>

          <Card title="Inputs (Z)" subtitle="x, y, rates, usd, vix, goldFear">
            <div className="text-xs text-white/70 whitespace-pre-wrap">
              {Array.isArray(daily?.V)
                ? JSON.stringify(
                    daily.V.map((v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null)),
                    null,
                    0
                  )
                : "--"}
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-3">
          <Card title={t?.("pages.D", "Intraday") ?? "Intraday"} subtitle="Fast signals">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm text-white/90">z_short</div>
                <div className="text-sm text-white/70">{zShort == null ? "--" : zShort.toFixed(2)}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-white/90">corrAvg</div>
                <div className="text-sm text-white/70">{corrAvg == null ? "--" : corrAvg.toFixed(2)}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-white/90">corrSurge</div>
                <div className="text-sm text-white/70">{corrSurge ? "YES" : "NO"}</div>
              </div>
            </div>
          </Card>

          <Card title="Note" subtitle="Off-hours behavior">
            <div className="text-sm text-white/70 leading-relaxed">
              {t?.("ui.intradayNote", "Off-hours, the app defaults to Daily view. Intraday is for market-hours diagnostics only.") ?? "Off-hours, the app defaults to Daily view. Intraday is for market-hours diagnostics only."}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
