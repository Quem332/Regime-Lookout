import { useEffect, useRef, useState } from "react";

/**
 * Horizontal 3-page navigator.
 *
 * Design goals (mobile-first):
 * - NEVER break clicks on buttons/inputs.
 * - Allow vertical scroll inside pages.
 * - Swipe should require a clear horizontal intent (or an edge-swipe), and exceed a threshold.
 * - Optional tap-to-cycle (disabled by default).
 */
export function useH3DragNav({
  initialIndex = 0,
  thresholdPx = 110,
  tapToCycle = false,
  edgeSwipePx = 22,
} = {}) {
  const [index, setIndex] = useState(initialIndex);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const activePointerRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0, t: 0 });
  const movedRef = useRef(false);

  const engagedRef = useRef(false); // becomes true only when we decide it's a horizontal swipe
  const edgeStartRef = useRef(false);
  const dragXRef = useRef(0);

  const clampIndex = (i) => Math.max(0, Math.min(2, i));

  const goTo = (i) => {
    setIndex(clampIndex(i));
    dragXRef.current = 0;
    setDragX(0);
    engagedRef.current = false;
    setIsDragging(false);
  };

  const goLeft = () => goTo(index - 1);
  const goRight = () => goTo(index + 1);
  const goNext = () => goTo((index + 1) % 3);

  const isInteractiveTarget = (target) => {
    try {
      if (!target || !(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          "button, a, input, textarea, select, option, label, summary, details, [role='button'], [role='link'], [data-no-tap-nav='1'], [data-stop-toggle='1']"
        )
      );
    } catch {
      return false;
    }
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // Do not start nav gestures from interactive elements.
    if (isInteractiveTarget(e.target)) return;

    activePointerRef.current = e.pointerId;
    startRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    movedRef.current = false;
    engagedRef.current = false;

    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false);

    // Edge-swipe detection: helps on scroll-heavy Hub page.
    try {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      edgeStartRef.current = x <= edgeSwipePx || x >= rect.width - edgeSwipePx;
    } catch {
      edgeStartRef.current = false;
    }
  };

  const engage = (e) => {
    if (engagedRef.current) return;
    engagedRef.current = true;
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e) => {
    if (activePointerRef.current !== e.pointerId) return;

    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) movedRef.current = true;

    // Decide whether to engage horizontal swipe.
    if (!engagedRef.current) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // If started from the edge, be more permissive.
      const edgeOk = edgeStartRef.current && absX > 10;

      // Otherwise require strong horizontal intent.
      const horizontalOk = absX > 14 && absX > absY * 1.25;

      if (!(edgeOk || horizontalOk)) {
        return; // do nothing; allow vertical scroll normally
      }

      engage(e);
    }

    // Apply drag (with a little resistance at ends)
    let applied = dx;
    if ((index === 0 && dx > 0) || (index === 2 && dx < 0)) {
      applied = dx * 0.35;
    }

    dragXRef.current = applied;
    setDragX(applied);

    // When engaged, prevent native scrolling/history navigation.
    try {
      e.preventDefault();
    } catch {}
  };

  const endGesture = (eForTap) => {
    const engaged = engagedRef.current;
    const dx = dragXRef.current;

    // Reset
    engagedRef.current = false;
    edgeStartRef.current = false;
    activePointerRef.current = null;

    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false);

    if (engaged) {
      if (dx <= -thresholdPx) {
        goRight();
        return;
      }
      if (dx >= thresholdPx) {
        goLeft();
        return;
      }
      return;
    }

    // Tap-to-next (optional)
    if (
      tapToCycle &&
      eForTap &&
      !movedRef.current &&
      !isInteractiveTarget(eForTap.target)
    ) {
      goNext();
    }
  };

  const onPointerUp = (e) => {
    if (activePointerRef.current !== e.pointerId) return;
    endGesture(e);
  };

  const onPointerCancel = () => {
    if (activePointerRef.current == null) return;
    endGesture(null);
  };

  // Keyboard support (desktop)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "ArrowLeft") goLeft();
      if (e.key === "ArrowRight") goRight();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const bind = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
  return { index, dragX, isDragging, goTo, goLeft, goRight, bind };
}
