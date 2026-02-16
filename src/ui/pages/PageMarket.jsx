import React, { useState } from "react";
import { PageDaily } from "./PageDaily";
import { PageIntraday } from "./PageIntraday";

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-2 rounded-xl text-sm " +
        (active
          ? "bg-white/10 border border-white/10"
          : "bg-transparent border border-transparent")
      }
    >
      {children}
    </button>
  );
}

export function PageMarket({ mri }) {
  const [tab, setTab] = useState("daily");

  return (
    <div className="h-full overflow-hidden flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm opacity-80">Market</div>
        <div className="flex gap-2">
          <TabButton active={tab === "daily"} onClick={() => setTab("daily")}>
            Daily
          </TabButton>
          <TabButton
            active={tab === "intraday"}
            onClick={() => setTab("intraday")}
          >
            Intraday
          </TabButton>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "daily" ? <PageDaily mri={mri} /> : <PageIntraday mri={mri} />}
      </div>
    </div>
  );
}
