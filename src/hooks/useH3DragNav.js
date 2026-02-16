import { useEffect, useRef, useState } from 'react';

/**
 * Horizontal 3-page navigator with "drag to preview" + snap.
 * - index: 0..2
 * - dragX: live pixel offset during drag (used to translate track)
 * - goTo: programmatic navigation
 */
export function useH3DragNav({ initialIndex = 0, thresholdPx = 80 } = {}) {
  const [index, setIndex] = useState(initialIndex);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const lastXRef = useRef(0);
  const activePointerRef = useRef(null);

  const clampIndex = (i) => Math.max(0, Math.min(2, i));

  const goTo = (i) => {
    setIndex(clampIndex(i));
    setDragX(0);
    setIsDragging(false);
  };

  const goLeft = () => goTo(index - 1);
  const goRight = () => goTo(index + 1);

  const onPointerDown = (e) => {
    // Only left button / touch.
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    activePointerRef.current = e.pointerId;
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    setIsDragging(true);

    // Capture so we keep receiving move/up even if pointer leaves.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    if (activePointerRef.current !== e.pointerId) return;

    const dx = e.clientX - startXRef.current;
    lastXRef.current = e.clientX;

    // Prevent dragging beyond edges too far.
    if ((index === 0 && dx > 0) || (index === 2 && dx < 0)) {
      setDragX(dx * 0.35);
      return;
    }
    setDragX(dx);
  };

  const endDrag = () => {
    if (!isDragging) return;

    const dx = dragX;
    setIsDragging(false);
    setDragX(0);

    if (dx <= -thresholdPx) {
      goRight();
      return;
    }
    if (dx >= thresholdPx) {
      goLeft();
      return;
    }
    // else snap back (index unchanged)
  };

  const onPointerUp = (e) => {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    endDrag();
  };

  const onPointerCancel = () => {
    activePointerRef.current = null;
    endDrag();
  };

  // Keyboard support (desktop)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft') goLeft();
      if (e.key === 'ArrowRight') goRight();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return {
    index,
    dragX,
    isDragging,
    goTo,
    goLeft,
    goRight,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
