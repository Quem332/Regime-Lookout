import React, { useMemo, useState } from "react";

import { useMRIState } from "../hooks/useMRIState";
import { useH3DragNav } from "../hooks/useH3DragNav";

import { PageHome } from "../ui/pages/PageHome";
import { PageMarket } from "../ui/pages/PageMarket";
import { PageHub } from "../ui/pages/PageHub";

import { StatusPill } from "../ui/components/StatusPill";

import { I18N, createT } from "../core/i18n";
import { loadLang, saveLang } from "../storage/localSettings";
import { logger } from "../core/logger";

function detectLang() {
  try {
    const l = (navigator.language || "en").toLowerCase();
    return l.startsWith("ko") ? "ko" : "en";
  } catch {
    return "en";
  }
}

export function MRIMarketDashboard() {
  const mri = useMRIState();

  // Backward-compat facade: some pages expect api.mri.* and api.logger
  const api = useMemo(() => ({ mri, logger }), [mri]);

  const status = mri?.status ?? {};

  // Language (single source of truth)
  const [lang, setLang] = useState(() => loadLang(detectLang()));
  const tFn = useMemo(() => createT(lang === "ko" ? I18N.ko : I18N.en), [lang]);

  const onToggleLang = () => {
    setLang((cur) => {
      const next = cur === "ko" ? "en" : "ko";
      saveLang(next);
      logger.info?.("ui.lang_set", { lang: next });
      return next;
    });
  };

  // Inner tabs
  // A: intraday evaluation (A-1 Score, A-2 Breakdown)
  const [homeTab, setHomeTab] = useState("a1"); // a1 | a2
  // B: daily/period view (B-1 Scenarios, B-2 Breakdown)
  const [marketTab, setMarketTab] = useState("b1"); // b1 | b2

  const pages = useMemo(
    () => [
      <PageHome key="home" api={api} tab={homeTab} setTab={setHomeTab} t={tFn} lang={lang} />,
      <PageMarket key="market" api={api} tab={marketTab} setTab={setMarketTab} t={tFn} lang={lang} />,
      <PageHub key="hub" api={api} t={tFn} lang={lang} onToggleLang={onToggleLang} />,
    ],
    [api, homeTab, marketTab, tFn, lang]
  );

  // Swipe-only loop navigation. (No tap-to-cycle.)
  const nav = useH3DragNav({ initialIndex: 0, thresholdPx: 110, tapToCycle: false, edgeSwipePx: 24 });

  const title = nav.index === 0 ? (tFn("nav.home","HOME")) : nav.index === 1 ? (tFn("nav.market","MARKET")) : (tFn("nav.hub","HUB"));
  const subtitle =
    nav.index === 0
      ? homeTab === "a1"
        ? tFn("nav.a1", "Score")
        : tFn("nav.a2", "Breakdown")
      : nav.index === 1
      ? marketTab === "b1"
        ? tFn("nav.b1", "Scenarios")
        : tFn("nav.b2", "Data")
      : tFn("hub.title", "Info");

  return (
    <div {...nav.bind} className="relative h-[100dvh] w-[100dvw] overflow-hidden bg-slate-950 text-white select-none" style={{ touchAction: "pan-y" }}>
      {/* Top status bar */}
      <div className="absolute left-0 right-0 top-0 z-40 flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold leading-tight">{title}</div>
          <div className="text-xs opacity-70">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill
            market={status?.market}
            timers={status?.timers}
            health={status?.health}
            marketOpen={status?.marketOpen}
            eventWindow={status?.eventWindow}
          />
        </div>
      </div>

      {/* Viewport: allow vertical scroll inside pages; our nav only engages on clear horizontal swipe */}
      <div className="h-full w-full">
        <div
          className="flex h-full"
          style={{
            width: "300vw",
            transform: `translate3d(calc(${-nav.index * 100}vw + ${nav.dragX}px),0,0)`,
            transition: nav.isDragging ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {pages.map((p, i) => (
            <div key={i} className="h-[100dvh] w-[100dvw] overflow-x-hidden overflow-y-auto pt-16" style={{ touchAction: "pan-y" }}>
              {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MRIMarketDashboard;