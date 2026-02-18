import { useEffect, useRef, useState } from "react";

/**
 * Horizontal 3-page navigator with swipe threshold + snap.
 *
 * Goals (important):
 * - Swipe left/right switches A/B/C (index 0..2).
 * - Tap should NOT change pages unless tapToCycle=true.
 * - Interactive elements (buttons/links/inputs) must remain clickable.
 *
 * Returns: { bind, index, dragX, isDragging, goTo, goLeft, goRight }
 */
export function useH3DragNav({ initialIndex = 0, thresholdPx = 90, tapToCycle = false } = {}) {
  const [index, setIndex] = useState(initialIndex);
  const [dragX, setDragX] = useState(0);
  const dragXRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTRef = useRef(0);

  const movedRef = useRef(false);
  const activePointerRef = useRef(null);
  const capturedRef = useRef(false);

  const clampIndex = (i) => Math.max(0, Math.min(2, i));

  const goTo = (i) => {
    setIndex(clampIndex(i));
    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false);
    capturedRef.current = false;
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

    // If user pressed on a button/link/etc, never start drag logic.
    // This preserves clickability on mobile (pointer-capture can cancel click).
    if (isInteractiveTarget(e.target)) return;

    activePointerRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTRef.current = performance.now();

    movedRef.current = false;
    capturedRef.current = false;

    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false); // start as false; becomes true only after real horizontal move
  };

  const onPointerMove = (e) => {
    if (activePointerRef.current !== e.pointerId) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) movedRef.current = true;

    // Only start dragging when the intent is clearly horizontal.
    const horizontalIntent = Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.15;
    if (!isDragging && !horizontalIntent) return;

    if (!isDragging) setIsDragging(true);

    // Capture pointer only after drag intent is confirmed.
    if (!capturedRef.current) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
        capturedRef.current = true;
      } catch {}
    }

    let applied = dx;
    if ((index === 0 && dx > 0) || (index === 2 && dx < 0)) {
      applied = dx * 0.35;
    }

    dragXRef.current = applied;
    setDragX(applied);

    // Avoid browser history swipe / scroll interference ONLY while dragging.
    try {
      e.preventDefault();
    } catch {}
  };

  const endDrag = (eForTap) => {
    const dx = dragXRef.current;

    // reset visual state
    setIsDragging(false);
    dragXRef.current = 0;
    setDragX(0);
    capturedRef.current = false;

    // If we were dragging, apply threshold
    if (Math.abs(dx) >= thresholdPx) {
      if (dx <= -thresholdPx) goRight();
      if (dx >= thresholdPx) goLeft();
      return;
    }

    // Tap-to-cycle: only when enabled, and only when it truly wasn't a drag.
    if (tapToCycle && eForTap && !movedRef.current && !isInteractiveTarget(eForTap.target)) {
      goNext();
    }
  };

  const onPointerUp = (e) => {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    endDrag(e);
  };

  const onPointerCancel = () => {
    activePointerRef.current = null;
    endDrag(null);
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
