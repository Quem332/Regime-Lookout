import React, { useMemo, useState } from "react";

import { useMRIState } from "../hooks/useMRIState";
import { useH3DragNav } from "../hooks/useH3DragNav";

import { PageHome } from "../ui/pages/PageHome";
import { PageMarket } from "../ui/pages/PageMarket";
import { PageHub } from "../ui/pages/PageHub";

import { StatusPill } from "../ui/components/StatusPill";

export function MRIMarketDashboard() {
  const api = useMRIState();
  const status = api?.status ?? {};
  const market = status?.market ?? {};

  // Inner tabs
  const [homeTab, setHomeTab] = useState("overview"); // overview | scenarios
  const [marketTab, setMarketTab] = useState("daily"); // daily | intraday

  const pages = useMemo(
    () => [
      <PageHome key="home" api={api} tab={homeTab} setTab={setHomeTab} />,
      <PageMarket key="market" api={api} tab={marketTab} setTab={setMarketTab} />,
      <PageHub key="hub" api={api} />,
    ],
    [api, homeTab, marketTab]
  );

  const nav = useH3DragNav({ initialIndex: 0, thresholdPx: 90 });

  const title = nav.index === 0 ? "HOME" : nav.index === 1 ? "MARKET" : "HUB";
  const subtitle =
    nav.index === 0
      ? homeTab === "overview"
        ? "Today"
        : "Scenarios"
      : nav.index === 1
      ? marketTab === "daily"
        ? "Daily"
        : "Intraday"
      : "Info";

  return (
    <div className="relative h-[100dvh] w-[100dvw] overflow-hidden bg-slate-950 text-white select-none">
      {/* Top status bar */}
      <div className="absolute left-0 right-0 top-0 z-40 flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold leading-tight">{title}</div>
          <div className="text-xs opacity-70">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill market={status?.market} timers={status?.timers} health={status?.health} marketOpen={status?.marketOpen} eventWindow={status?.eventWindow} />
        </div>
      </div>

      {/* Viewport */}
      <div {...nav.bind} className="h-full w-full" style={{ touchAction: "none" }}>
        <div
          className="flex h-full"
          style={{
            width: "300vw",
            transform: `translate3d(calc(${-nav.index * 100}vw + ${nav.dragX}px),0,0)`,
            transition: nav.isDragging ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {pages.map((p, i) => (
            <div key={i} className="h-[100dvh] w-[100dvw] overflow-x-hidden overflow-y-auto pt-16">
              {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MRIMarketDashboard;

