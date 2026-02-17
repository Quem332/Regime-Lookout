import React, { useMemo, useRef } from "react";
import { PageDaily } from "./PageDaily";
import { PageIntraday } from "./PageIntraday";

/**
 * Market page: no explicit tab buttons.
 * - Swipe left/right toggles Daily <-> Intraday.
 * - Tap empty space toggles (ignores taps on interactive elements).
 *
 * Props are controlled by MRIMarketDashboard:
 *  - api: MRI state from useMRIState()
 *  - tab: "daily" | "intraday"
 *  - setTab: setter
 *  - t: translator (function + groups)
 */
export function PageMarket({ api, tab, setTab, t, topbarH = 56 }) {
  const rootRef = useRef(null);

  const isIntraday = tab === "intraday";
  const nextTab = isIntraday ? "daily" : "intraday";

  const swipe = useMemo(() => {
    return {
      thresholdPx: 60,
      startX: 0,
      startY: 0,
      moved: false,
      pointerId: null,
      startAt: 0,
    };
  }, []);

  const isInteractiveTarget = (target) => {
    try {
      if (!target || !(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          "button, a, input, textarea, select, option, label, summary, details, [role='button'], [role='link'], [data-no-tap-nav='1']"
        )
      );
    } catch {
      return false;
    }
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    swipe.pointerId = e.pointerId;
    swipe.startX = e.clientX;
    swipe.startY = e.clientY;
    swipe.moved = false;
    swipe.startAt = performance.now();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e) => {
    if (swipe.pointerId !== e.pointerId) return;
    const dx = e.clientX - swipe.startX;
    const dy = e.clientY - swipe.startY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) swipe.moved = true;

    // If it's clearly horizontal, prevent accidental browser nav/scroll.
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
      // prevent default passive handling if any
      try { e.preventDefault(); } catch {}
    }
  };

  const onPointerUp = (e) => {
    if (swipe.pointerId !== e.pointerId) return;
    swipe.pointerId = null;

    const dx = e.clientX - swipe.startX;
    const dy = e.clientY - swipe.startY;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const isHorizontal = absX > absY && absX >= swipe.thresholdPx;

    if (isHorizontal) {
      // swipe left => intraday, swipe right => daily (intuitive)
      if (dx < 0) setTab("intraday");
      else setTab("daily");
      return;
    }

    // Tap-to-toggle: only if it's a real tap (little move) and not on interactive elements.
    const tapLike = (!swipe.moved && absX < 8 && absY < 8);
    if (tapLike && !isInteractiveTarget(e.target)) {
      setTab(nextTab);
    }
  };

  const onPointerCancel = () => {
    swipe.pointerId = null;
  };

  return (
    <div
      ref={rootRef}
      className="h-full w-full overflow-hidden"
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {/* Body */}
      <div className="h-full w-full overflow-hidden">
        {tab === "daily" ? (
          <PageDaily state={api} t={t} topbarH={topbarH} />
        ) : (
          <PageIntraday state={api} t={t} topbarH={topbarH} />
        )}
      </div>
    </div>
  );
}
