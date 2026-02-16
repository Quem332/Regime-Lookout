import React from "react";

// index mapping (must match MRIMarketDashboard PAGES order):
// 0: A Daily     -> (col 0, row 0)
// 1: B Score     -> (col 1, row 0)
// 2: C Hub       -> (col 0, row 1)
// 3: D Intraday  -> (col 1, row 1)
const POS = {
  0: [0, 0],
  1: [1, 0],
  2: [0, 1],
  3: [1, 1],
};

export function CubeIndicator({ active = 0 }) {
  const [ax, ay] = POS[active] || [0, 0];

  return (
    <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-1">
      <div className="grid grid-cols-2 grid-rows-2 gap-1">
        {[0, 1, 2, 3].map((i) => {
          const [x, y] = POS[i];
          const on = x === ax && y === ay;
          return (
            <div
              key={i}
              className={
                "h-2.5 w-2.5 rounded-sm " +
                (on ? "bg-sky-400/90" : "bg-white/15")
              }
            />
          );
        })}
      </div>
    </div>
  );
}
