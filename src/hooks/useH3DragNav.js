import { useEffect, useRef, useState } from "react";

/**
 * Horizontal 3-page navigator with swipe threshold + snap.
 *
 * Design rules (for this app):
 * - Swipe left/right switches A/B/C (index 0..2).
 * - Tap should NOT change pages unless tapToCycle=true.
 * - Interactive elements (buttons/links/inputs) must remain clickable.
 * - Vertical scroll inside pages must keep working (especially on Hub).
 */
export function useH3DragNav({ initialIndex = 0, thresholdPx = 110, tapToCycle = false } = {}) {
  const [index, setIndex] = useState(initialIndex);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startRef = useRef(null); // {x,y,t,pid}
  const lockedRef = useRef(null); // "h" | "v" | null

  const clampIndex = (i) => Math.max(0, Math.min(2, i));

  const isInteractiveTarget = (el) => {
    try {
      return Boolean(
        el?.closest?.(
          'button, a, input, textarea, select, [role="button"], [contenteditable="true"], [data-stop-toggle="1"], [data-no-tap-nav="1"]'
        )
      );
    } catch {
      return false;
    }
  };

  const goTo = (i) => setIndex(clampIndex(i));
  const goLeft = () => setIndex((v) => clampIndex(v - 1));
  const goRight = () => setIndex((v) => clampIndex(v + 1));

  const reset = () => {
    startRef.current = null;
    lockedRef.current = null;
    setIsDragging(false);
    setDragX(0);
  };

  const onPointerDown = (e) => {
    if (isInteractiveTarget(e.target)) return;
    if (e.button != null && e.button !== 0) return;

    startRef.current = { x: e.clientX, y: e.clientY, t: performance.now(), pid: e.pointerId };
    lockedRef.current = null;
    setIsDragging(false);
    setDragX(0);
  };

  const onPointerMove = (e) => {
    const s = startRef.current;
    if (!s || e.pointerId !== s.pid) return;

    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // Decide lock direction after small movement (Hub tends to have slight vertical jitter)
    if (!lockedRef.current) {
      if (adx < 6 && ady < 6) return;

      // Prefer horizontal if it's at least comparable to vertical
      if (adx >= 10 && adx > ady * 0.9) {
        lockedRef.current = "h";
        try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch {}
        setIsDragging(true);
      } else if (ady >= 12 && ady > adx * 1.4) {
        // Strong vertical intention -> let page scroll naturally
        lockedRef.current = "v";
        return;
      } else {
        // undecided, wait for more movement
        return;
      }
    }

    if (lockedRef.current !== "h") return;

    // Horizontal drag: prevent browser navigation gestures while actively dragging
    if (Math.abs(dx) > 10) e.preventDefault?.();
    setDragX(dx);
  };

  const onPointerUpOrCancel = (e) => {
    const s = startRef.current;
    const lock = lockedRef.current;
    reset();

    if (!s) return;

    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dt = performance.now() - s.t;

    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (lock !== "h") {
      if (tapToCycle && adx < 10 && ady < 10 && dt < 300) {
        setIndex((v) => clampIndex(v + 1));
      }
      return;
    }

    if (dx <= -thresholdPx) goRight();
    else if (dx >= thresholdPx) goLeft();
  };

  const bind = {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerUpOrCancel,
    onPointerCancel: onPointerUpOrCancel,
  };

  useEffect(() => {
    setIndex((v) => clampIndex(v));
  }, []);

  return { bind, index, dragX, isDragging, goTo, goLeft, goRight };
}
