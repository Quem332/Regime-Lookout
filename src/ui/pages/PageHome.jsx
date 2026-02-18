import React, { useMemo, useRef } from "react";
import { Card } from "../components/Card";

function isInteractiveTarget(el) {
  try {
    return Boolean(el?.closest?.("button, a, input, textarea, select, [role='button'], [data-stop-toggle='1']"));
  } catch {
    return false;
  }
}

function isTapLike(start, end, maxDist = 10, maxMs = 320) {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const dt = end.t - start.t;
  return dx <= maxDist && dy <= maxDist && dt <= maxMs;
}

export function PageHome({ api, tab, setTab, t }) {
  const mri = api?.mri;
  const daily = mri?.daily || null;

  const view = tab ?? "overview"; // overview | scenarios

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
    setTab?.((v) => (v === "overview" ? "scenarios" : "overview"));
  };

  const score = Number.isFinite(daily?.score) ? daily.score : null;
  const Cfinal = Number.isFinite(daily?.Cfinal) ? daily.Cfinal : null;
  const regime7 = daily?.regime7 ?? "--";
  const topK = daily?.topK ?? null;

  const probs = daily?.probs && typeof daily.probs === "object" ? daily.probs : {};
  const probList = useMemo(() => {
    return Object.entries(probs)
      .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [daily?.probs]);

  const tags = Array.isArray(daily?.tags) ? daily.tags : [];

  return (
    <div className="px-4 pb-6" onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ touchAction: "pan-y" }}>
      {/* No local page title; top bar handles it */}

      {view === "overview" ? (
        <div className="grid gap-3">
          <Card title={t?.("score.titleTop", "Today Score") ?? "Today Score"} subtitle="Risk-adjusted market condition">
            <div className="flex items-end gap-3">
              <div className="text-4xl font-extrabold text-white">{score == null ? "--" : String(Math.round(score))}</div>
              <div className="text-sm text-white/70 pb-1">C {Cfinal == null ? "--" : String(Math.round(Cfinal))}</div>
              <div className="text-sm text-white/70 pb-1">{String(regime7)}</div>
            </div>
          </Card>

          <Card title={t?.("daily.topScenario", "Top Scenario") ?? "Top Scenario"} subtitle="Most likely today">
            <div className="text-lg text-white">{topK == null ? "--" : `S${String(topK)}`}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {probList.slice(0, 3).map(([k, v]) => (
                <span key={k} className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/80">
                  {k}: {(v * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </Card>

          <Card title="Reasoning" subtitle="Key drivers">
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
          <Card title={t?.("score.topScenarios", "Top Scenarios") ?? "Top Scenarios"} subtitle="Probability distribution">
            <div className="space-y-2">
              {probList.length ? (
                probList.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <div className="text-sm text-white/90">{k}</div>
                    <div className="text-sm text-white/70">{(v * 100).toFixed(1)}%</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/60">--</div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
