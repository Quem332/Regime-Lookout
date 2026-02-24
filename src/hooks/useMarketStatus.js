import { useEffect, useState } from "react";
import { isMarketOpenET } from "../core/time.et";
import { logger } from "../core/logger";

export function useMarketStatus() {
  const [marketOpen, setMarketOpen] = useState(() => isMarketOpenET());

  useEffect(() => {
    const tick = () => {
      const next = isMarketOpenET();
      setMarketOpen((prev) => {
        if (prev !== next) logger.info("market.status_change", { marketOpen: next });
        return next;
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { marketOpen };
}
