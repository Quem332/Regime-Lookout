import { useEffect, useRef, useState } from "react";

/**
 * Horizontal 3-page navigator with "drag to preview" + snap.
 *
 * Features:
 * - Swipe (pointer drag) left/right with threshold.
 * - Tap on empty space -> go to next page (cycle) for "one-handed" navigation.
 *   (Taps on interactive elements are ignored.)
 *
 * Returns:
 * - bind: spread onto the viewport element
 * - index, dragX, isDragging, goTo/goLeft/goRight
 */
export function useH3DragNav({ initialIndex = 0, thresholdPx = 80 } = {}) {
  const [index, setIndex] = useState(initialIndex);
  const [dragX, setDragX] = useState(0);
  const dragXRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const movedRef = useRef(false);
  const activePointerRef = useRef(null);

  const clampIndex = (i) => Math.max(0, Math.min(2, i));

  const goTo = (i) => {
    setIndex(clampIndex(i));
    dragXRef.current = 0;
    setDragX(0);
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
          "button, a, input, textarea, select, option, label, summary, details, [role='button'], [role='link'], [data-no-tap-nav='1']"
        )
      );
    } catch {
      return false;
    }
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    activePointerRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    movedRef.current = false;

    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    if (activePointerRef.current !== e.pointerId) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) movedRef.current = true;

    let applied = dx;
    if ((index === 0 && dx > 0) || (index === 2 && dx < 0)) {
      applied = dx * 0.35;
    }

    dragXRef.current = applied;
    setDragX(applied);

    // If it looks like a horizontal gesture, avoid browser history swipe / scroll interference.
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
      try { e.preventDefault(); } catch {}
    }
  };

  const endDrag = (eForTap) => {
    if (!isDragging) return;

    const dx = dragXRef.current;

    setIsDragging(false);
    dragXRef.current = 0;
    setDragX(0);

    if (dx <= -thresholdPx) {
      goRight();
      return;
    }
    if (dx >= thresholdPx) {
      goLeft();
      return;
    }

    // Tap-to-next: only if it wasn't a drag and target isn't interactive.
    if (eForTap && !movedRef.current && !isInteractiveTarget(eForTap.target)) {
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
