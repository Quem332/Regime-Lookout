import React, { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { Gauge } from "../components/Gauge";
import { TagList } from "../components/TagList";
import { Modal } from "../components/Modal";

const SCENARIO_NAME = {
  1: "Risk-On",
  2: "Panic",
  3: "Stagflation",
  4: "Goldilocks",
  5: "Defensive",
  6: "Liquidity Crisis",
  7: "Mixed",
  "7A": "Risk-On (Capped)",
  "7B": "Defensive (Capped)",
  "7C": "Panic (Capped)",
};


function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-2 rounded-xl text-sm " +
        (active ? "bg-slate-800/80" : "bg-slate-900/40 opacity-80 hover:opacity-100")
      }
    >
      {children}
    </button>
  );
}

export function PageHome({ api, tab, setTab }) {
  const daily = api?.daily ?? null;
  const score = daily?.score ?? 0;
  const cFinal = daily?.reliability?.C_final ?? daily?.C_final ?? 0;
  const topK = Number.isFinite(daily?.topK) ? daily.topK : null;
  const probs = daily?.probs ?? {};
  const tags = Array.isArray(daily?.tags) ? daily.tags : [];

  // Modal for long tag lists
  const [showAllTags, setShowAllTags] = useState(false);

  const topTags = useMemo(() => (Array.isArray(tags) ? tags.slice(0, 4) : []), [tags]);
  const hasMoreTags = Array.isArray(tags) && tags.length > topTags.length;

  const scenarios = useMemo(() => {
    // Normalize to [{k,name,p}] from either probs object or array.
    // Expected keys: 1..7 (incl 7A/7B/7C may be strings)
    const out = [];
    if (Array.isArray(daily?.scenarioList)) {
      return daily.scenarioList;
    }
    if (Array.isArray(daily?.probsArray)) {
      return daily.probsArray;
    }
    if (probs && typeof probs === "object") {
      for (const [k, p] of Object.entries(probs)) {
        out.push({ k, p });
      }
    }
    // map scenario ids to stable display names (never depend on topK shape)
    return out
      .map((s) => ({ ...s, name: SCENARIO_NAME[String(s.k)] || s.name || ("Scenario " + s.k) }))
      .sort((a, b) => (b.p ?? 0) - (a.p ?? 0));
  }, [daily, probs]);

  return (
    <div className="h-full w-full pt-16 px-4 pb-4 overflow-hidden flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>Overview</TabButton>
          <TabButton active={tab === "scenarios"} onClick={() => setTab("scenarios")}>Scenarios</TabButton>
        </div>
        <div className="text-xs opacity-70">C: {Math.round(cFinal)}</div>
      </div>

      {tab === "overview" ? (
        <>
          <Card className="flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="text-sm opacity-80">Today Score</div>
              <div className="text-xs opacity-60">(0–100)</div>
            </div>
            <div className="mt-2 flex-1 flex items-center justify-center">
              <Gauge value={score} />
            </div>
          </Card>

          <Card className="shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-sm opacity-80">Reasoning</div>
              {hasMoreTags ? (
                <button className="text-xs underline opacity-70" onClick={() => setShowAllTags(true)}>
                  More
                </button>
              ) : null}
            </div>
            <div className="mt-2">
              <TagList tags={topTags} compact />
            </div>
          </Card>

          <Modal open={showAllTags} onClose={() => setShowAllTags(false)} title="All Reasoning Tags">
            <TagList tags={tags} />
          </Modal>
        </>
      ) : (
        <>
          <Card className="flex-1 overflow-hidden">
            <div className="text-sm opacity-80">Scenario probabilities</div>
            <div className="mt-2 text-xs opacity-60">(p = distance-softmax; C = reliability cap)
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {scenarios.slice(0, 7).map((s) => (
                <div key={String(s.k)} className="flex items-center justify-between rounded-xl bg-slate-900/50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{s.name || `Scenario ${s.k}`}</div>
                    <div className="text-[11px] opacity-60">k = {String(s.k)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">{Math.round((s.p ?? 0) * 100)}%</div>
                    <div className="text-[11px] opacity-60">C {Math.round(cFinal)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="shrink-0">
            <div className="text-sm opacity-80">Top regime</div>
            <div className="mt-1 text-xs opacity-70">
              {(daily?.regimeLabel || daily?.regime || "-") + (daily?.regimeReason ? ` — ${daily.regimeReason}` : "")}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
