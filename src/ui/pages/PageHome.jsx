import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";

function isTapLike(start, end) {
  const dx = Math.abs((end?.x ?? 0) - (start?.x ?? 0));
  const dy = Math.abs((end?.y ?? 0) - (start?.y ?? 0));
  const dt = (end?.t ?? 0) - (start?.t ?? 0);
  return dx < 10 && dy < 10 && dt < 400;
}

export function PageHome({ api }) {
  const mri = api?.mri;
  const daily = mri?.daily || null;
  const status = mri?.status || null;

  // two internal views (A has 2 screens)
  const [view, setView] = useState("overview"); // "overview" | "scenarios"

  // tap-anywhere toggle (doesn't interfere with horizontal swipe; we only toggle on true taps)
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
    setView((v) => (v === "overview" ? "scenarios" : "overview"));
  };

  const score = Number.isFinite(daily?.score) ? daily.score : null;
  const Cfinal = Number.isFinite(daily?.Cfinal) ? daily.Cfinal : null;
  const regime7 = daily?.regime7 ?? "7C";
  const topK = daily?.topK ?? null;

  const probs = daily?.probs && typeof daily.probs === "object" ? daily.probs : {};
  const probList = useMemo(() => {
    return Object.entries(probs)
      .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [daily?.probs]);

  const tags = Array.isArray(daily?.tags) ? daily.tags : [];

  const countdown = status?.timers?.countdown ?? "--:--";
  const marketLabel = status?.market?.label ?? "DATA --:--";

  return (
    <div
      className="px-4 pb-6"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ touchAction: "pan-y" }}
    >
      {/* Compact fixed header space handled in dashboard (pt-16). Keep local top spacing small */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-xl font-bold tracking-tight text-white">HOME</div>
          <div className="text-sm text-white/70">{view === "overview" ? "Today" : "Scenarios"}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/60">{marketLabel}</div>
          <div className="text-xs text-white/60">NEXT {countdown}</div>
        </div>
      </div>

      {view === "overview" ? (
        <div className="grid gap-3">
          <Card title="Score" subtitle="Risk-adjusted confidence">
            <div className="flex items-end gap-3">
              <div className="text-4xl font-extrabold text-white">
                {score == null ? "--" : String(Math.round(score))}
              </div>
              <div className="text-sm text-white/70 pb-1">
                C {Cfinal == null ? "--" : String(Math.round(Cfinal))}
              </div>
              <div className="text-sm text-white/70 pb-1">
                Regime {String(regime7)}
              </div>
            </div>
            <div className="mt-2 text-xs text-white/60">
              Tap anywhere to toggle Overview ↔ Scenarios
            </div>
          </Card>

          <Card title="Top scenario" subtitle="Most likely today">
            <div className="text-lg text-white">
              {topK == null ? "--" : `S${String(topK)}`}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {probList.slice(0, 3).map(([k, v]) => (
                <span key={k} className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/80">
                  {k}: {(v * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </Card>

          <Card title="Reasoning tags" subtitle="Key drivers">
            <div className="flex flex-wrap gap-2">
              {tags.length ? (
                tags.map((x, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/80">
                    {x}
                  </span>
                ))
              ) : (
                <span className="text-xs text-white/60">--</span>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid gap-3">
          <Card title="Scenario probabilities" subtitle="Top 5">
            <div className="space-y-2">
              {probList.length ? (
                probList.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <div className="text-sm text-white/90">{k}</div>
                    <div className="text-sm text-white/70">{(v * 100).toFixed(1)}%</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/60">No probabilities available.</div>
              )}
            </div>
          </Card>

          <Card title="Notes" subtitle="7C path behavior">
            <div className="text-sm text-white/70 leading-relaxed">
              If no scenario passes hard gates, the engine labels today as <b>7C</b>. In that case we still show a
              normalized probability distribution so the UI can render a score + top scenario consistently.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
