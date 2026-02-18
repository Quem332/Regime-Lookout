import { useEffect, useRef, useState } from "react";

/**
 * Horizontal 3-page navigator with swipe threshold + snap.
 *
 * Goals:
 * - Swipe left/right switches A/B/C (index 0..2).
 * - Tap should NOT change pages unless tapToCycle=true.
 * - Interactive elements (buttons/links/inputs) must remain clickable.
 * - Vertical scroll inside pages must keep working.
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

  const onPointerDown = (e) => {
    if (isInteractiveTarget(e.target)) return;
    // Only left click / primary pointer
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

    // Decide lock direction after a small movement
    if (!lockedRef.current) {
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx < 6 && ady < 6) return;

      // Lock to horizontal only if clearly horizontal
      lockedRef.current = adx > ady * 1.2 ? "h" : "v";

      if (lockedRef.current === "h") {
        // Only now we start dragging and capture pointer
        try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch {}
        setIsDragging(true);
      } else {
        // Vertical: let the page scroll naturally
        startRef.current = null;
        return;
      }
    }

    if (lockedRef.current !== "h") return;

    // Horizontal drag: prevent browser back/forward gestures & selection while dragging
    e.preventDefault?.();
    setDragX(dx);
  };

  const onPointerUpOrCancel = (e) => {
    const s = startRef.current;
    const lock = lockedRef.current;
    startRef.current = null;
    lockedRef.current = null;

    if (!s) return;

    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dt = performance.now() - s.t;

    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // If not locked to horizontal, do nothing (allows clicks/scroll)
    if (lock !== "h") {
      // Optionally allow tap-to-cycle (only if it's a real tap)
      if (tapToCycle && adx < 10 && ady < 10 && dt < 300) {
        setIndex((v) => clampIndex(v + 1));
      }
      return;
    }

    // Snap by threshold
    if (dx <= -thresholdPx) goRight();
    else if (dx >= thresholdPx) goLeft();

    setIsDragging(false);
    setDragX(0);
  };

  const bind = {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerUpOrCancel,
    onPointerCancel: onPointerUpOrCancel,
  };

  // Keep index clamped
  useEffect(() => {
    setIndex((v) => clampIndex(v));
  }, []);

  return { bind, index, dragX, isDragging, goTo, goLeft, goRight };
}
