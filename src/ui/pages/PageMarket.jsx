import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { isMarketOpenET } from "../../core/time.et";

function isTapLike(start, end) {
  const dx = Math.abs((end?.x ?? 0) - (start?.x ?? 0));
  const dy = Math.abs((end?.y ?? 0) - (start?.y ?? 0));
  const dt = (end?.t ?? 0) - (start?.t ?? 0);
  return dx < 10 && dy < 10 && dt < 400;
}

export function PageMarket({ api, tab, setTab }) {
  const mri = api?.mri;
  const daily = mri?.daily || null;
  const intraday = mri?.intraday || null;
  const status = mri?.status || null;

  // Two internal views inside MARKET:
  // - daily: day-level view
  // - intraday: live diagnostics (only meaningful during market hours)
  const [view, setView] = useState("daily"); // "daily" | "intraday"

  // Support controlled tab from dashboard if provided (keeps state in one place)
  const activeView = tab ?? view;
  const setActiveView = setTab ?? setView;

  useEffect(() => {
    // Default on first mount: if market is open and intraday exists -> intraday else daily
    const open = isMarketOpenET();
    const hasIntra = Boolean(intraday);
    setActiveView(open && hasIntra ? "intraday" : "daily");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tap-anywhere toggle
  const downRef = useRef(null);
  const onPointerDown = (e) => {
    downRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = (e) => {
    const start = downRef.current;
    downRef.current = null;
    const end = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!start) return;
    if (!isTapLike(start, end)) return;
    setActiveView((v) => (v === "daily" ? "intraday" : "daily"));
  };

  const marketLabel = status?.market?.label ?? "DATA --:--";

  const intra = intraday || {};
  const zShort = Number.isFinite(intra?.zShort) ? intra.zShort : null;
  const corrAvg = Number.isFinite(intra?.corrAvg) ? intra.corrAvg : null;
  const corrSurge = Boolean(intra?.corrSurge);

  const score = Number.isFinite(daily?.score) ? daily.score : null;
  const Cfinal = Number.isFinite(daily?.Cfinal) ? daily.Cfinal : null;

  return (
    <div
      className="px-4 pb-6"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ touchAction: "pan-y" }}
    >
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-xl font-bold tracking-tight text-white">MARKET</div>
          <div className="text-sm text-white/70">{activeView === "daily" ? "Daily" : "Intraday"}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/60">{marketLabel}</div>
          <div className="text-xs text-white/60">Tap anywhere to toggle</div>
        </div>
      </div>

      {activeView === "daily" ? (
        <div className="grid gap-3">
          <Card title="Daily score" subtitle="From latest.json">
            <div className="flex items-end gap-3">
              <div className="text-4xl font-extrabold text-white">{score == null ? "--" : String(Math.round(score))}</div>
              <div className="text-sm text-white/70 pb-1">C {Cfinal == null ? "--" : String(Math.round(Cfinal))}</div>
            </div>
          </Card>

          <Card title="Inputs (Z)" subtitle="x, y, rates, usd, vix, goldFear">
            <div className="text-xs text-white/70 whitespace-pre-wrap">
              {daily?.V ? JSON.stringify(daily.V.map((v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null)), null, 0) : "--"}
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-3">
          <Card title="Intraday diagnostics" subtitle="Fast signals">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm text-white/90">zShort</div>
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

          <Card title="Note" subtitle="Market hours">
            <div className="text-sm text-white/70 leading-relaxed">
              Intraday view is most meaningful during US market hours. Off-hours the app defaults to Daily on first open.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}