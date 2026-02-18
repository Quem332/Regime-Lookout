import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/Card";
import { isMarketOpenET } from "../../core/time.et";
import { TagList } from "../components/TagList";
import { logger } from "../../core/logger";

/**
 * MARKET page:
 * - Swipe (handled by app nav): A-B-C etc.
 * - Tap anywhere (non-interactive) toggles internal views: Daily <-> Intraday
 * - When market is CLOSED or intraday data missing -> force Daily
 */

function isTapLike(start, end) {
  const dx = Math.abs((end?.x ?? 0) - (start?.x ?? 0));
  const dy = Math.abs((end?.y ?? 0) - (start?.y ?? 0));
  const dt = (end?.t ?? 0) - (start?.t ?? 0);
  return dx < 10 && dy < 10 && dt < 400;
}

function isInteractiveTarget(el) {
  if (!el) return false;
  // explicit opt-out
  if (el.closest?.('[data-stop-toggle="1"]')) return true;
  const tag = (el.tagName || "").toLowerCase();
  if (["button", "a", "input", "select", "textarea", "label"].includes(tag)) return true;
  if (el.isContentEditable) return true;
  if (el.closest?.("button,a,input,select,textarea,label")) return true;
  return false;
}

export function PageMarket({ api, tab, setTab, lang = "en", t }) {
  // Back-compat: api.mri.* or flattened api.* (older runners)
  const mri = api?.mri ?? api ?? null;
  const daily = mri?.daily ?? null;
  const intraday = mri?.intraday ?? null;
  const status = mri?.status ?? null;

  // internal view: controlled (via tab) if provided; else local state.
  const [localView, setLocalView] = useState("daily"); // "daily" | "intraday"
  const view = (tab === "daily" || tab === "intraday") ? tab : localView;
  const setView = (next) => {
    const v = typeof next === "function" ? next(view) : next;
    if (setTab) setTab(v);
    else setLocalView(v);
  };

  // On mount: choose default view. If market open AND intraday exists -> intraday, else daily.
  useEffect(() => {
    const open = isMarketOpenET();
    const hasIntra = Boolean(intraday);
    const desired = open && hasIntra ? "intraday" : "daily";
    setView(desired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force DAILY when market is closed or intraday data missing.
  useEffect(() => {
    const open = isMarketOpenET();
    const hasIntra = Boolean(intraday);
    if (!open || !hasIntra) {
      if (view !== "daily") setView("daily");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intraday]);

  // tap-anywhere toggle (ignore interactive targets)
  const downRef = useRef(null);
  const onPointerDown = (e) => {
    if (isInteractiveTarget(e.target)) return;
    downRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = (e) => {
    const start = downRef.current;
    downRef.current = null;
    if (!start) return;
    if (isInteractiveTarget(e.target)) return;
    const end = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!isTapLike(start, end)) return;
    setView((v) => (v === "daily" ? "intraday" : "daily"));
  };

  const marketLabel = status?.market?.label ?? "DATA --:--";

  const intra = intraday || {};
  const zShort = Number.isFinite(intra?.zShort) ? intra.zShort : null;
  const corrAvg = Number.isFinite(intra?.corrAvg) ? intra.corrAvg : null;
  const corrSurge = Boolean(intra?.corrSurge);

  const score = Number.isFinite(daily?.score) ? daily.score : null;
  const Cfinal = Number.isFinite(daily?.Cfinal) ? daily.Cfinal : null;

  const tags = Array.isArray(daily?.tags) ? daily.tags : [];

  const open = isMarketOpenET();
  const hasIntra = Boolean(intraday);
  const hint = useMemo(() => {
    if (!open || !hasIntra) return "Daily only (market closed)";
    return "Tap anywhere to toggle";
  }, [open, hasIntra]);

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
          <div className="text-sm text-white/70">{view === "daily" ? "Daily" : "Intraday"}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/60">{marketLabel}</div>
          <div className="text-xs text-white/60">{hint}</div>
        </div>
      </div>

      {view === "daily" ? (
        <div className="grid gap-3">
          <Card title="Daily score" subtitle="From latest.json">
            <div className="flex items-end gap-3">
              <div className="text-4xl font-extrabold text-white">
                {score == null ? "--" : String(Math.round(score))}
              </div>
              <div className="text-sm text-white/70 pb-1">
                C {Cfinal == null ? "--" : String(Math.round(Cfinal))}
              </div>
            </div>
          </Card>

          <Card title="Reasoning tags" subtitle="Why the score looks like this">
            <TagList tags={tags} lang={lang} />
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
                <div className="text-sm text-white/70">{corrSurge ? "YES" : "no"}</div>
              </div>
            </div>
          </Card>

          <Card title="Note" subtitle="Intraday is meaningful mainly during market hours">
            <div className="text-xs text-white/70">
              {open ? "Market open (ET). Updates should be flowing." : "Market closed (ET). Intraday view is disabled."}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}