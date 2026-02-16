import { useCallback, useMemo, useRef, useState } from "react";

// Cube navigation:
// col: 0 (A/C), 1 (B/D)
// row: 0 (A/B), 1 (C/D)
// Horizontal swipe toggles col (A<->B, C<->D)
// Vertical swipe toggles row (A<->C, B<->D)
//
// Provides "drag to reveal next page" with spring-ish snap on release.

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function useCubeDragNav({
  thresholdRatio = 0.18, // percent of width/height to commit
  maxDragRatio = 0.42, // limit how far it can be pulled
  snapMs = 260,
} = {}) {
  const [col, setCol] = useState(0);
  const [row, setRow] = useState(0);
  const [drag, setDrag] = useState({ dx: 0, dy: 0, dragging: false });

  const startRef = useRef({ x: 0, y: 0, col: 0, row: 0, active: false });
  const lastAxisRef = useRef("none");

  const style = useMemo(() => {
    const dx = drag.dx;
    const dy = drag.dy;
    // translate the 2x2 grid to put current page into view, plus drag offset.
    return {
      transform: `translate3d(calc(${-col} * 100vw + ${dx}px), calc(${-row} * 100vh + ${dy}px), 0)`,
      transition: drag.dragging ? "none" : `transform ${snapMs}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
      willChange: "transform",
    };
  }, [col, row, drag, snapMs]);

  const go = useCallback(
    ({ dcol = 0, drow = 0 } = {}) => {
      setCol((c) => (c + (dcol ? 1 : 0)) % 2);
      setRow((r) => (r + (drow ? 1 : 0)) % 2);
    },
    [setCol, setRow]
  );

  const onPointerDown = useCallback((e) => {
    // Ignore right-click, etc.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);

    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      col,
      row,
      active: true,
    };
    lastAxisRef.current = "none";
    setDrag({ dx: 0, dy: 0, dragging: true });
  }, [col, row]);

  const onPointerMove = useCallback((e) => {
    if (!startRef.current.active) return;
    const dxRaw = e.clientX - startRef.current.x;
    const dyRaw = e.clientY - startRef.current.y;

    // Decide axis (once movement is meaningful)
    const ax = Math.abs(dxRaw);
    const ay = Math.abs(dyRaw);
    if (lastAxisRef.current === "none" && (ax + ay) > 8) {
      lastAxisRef.current = ax >= ay ? "x" : "y";
    }

    const maxDx = window.innerWidth * maxDragRatio;
    const maxDy = window.innerHeight * maxDragRatio;

    const dx = lastAxisRef.current === "x" ? clamp(dxRaw, -maxDx, maxDx) : 0;
    const dy = lastAxisRef.current === "y" ? clamp(dyRaw, -maxDy, maxDy) : 0;

    setDrag({ dx, dy, dragging: true });
  }, [maxDragRatio]);

  const onPointerUp = useCallback(() => {
    if (!startRef.current.active) return;
    startRef.current.active = false;

    const dx = drag.dx;
    const dy = drag.dy;
    const commitX = Math.abs(dx) >= window.innerWidth * thresholdRatio;
    const commitY = Math.abs(dy) >= window.innerHeight * thresholdRatio;

    // Apply dominant axis if both triggered (rare, but just in case)
    if (commitX && (!commitY || Math.abs(dx) >= Math.abs(dy))) {
      // swipe left -> next col (toggle), swipe right -> toggle too (still A<->B)
      setCol((c) => (c === 0 ? 1 : 0));
    } else if (commitY) {
      setRow((r) => (r === 0 ? 1 : 0));
    }

    setDrag({ dx: 0, dy: 0, dragging: false });
  }, [drag.dx, drag.dy, thresholdRatio]);

  const bind = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    }),
    [onPointerDown, onPointerMove, onPointerUp]
  );

  return {
    col,
    row,
    drag,
    style,
    // Convenience fields so the caller can do:
    // style={{ transform: nav.transform, transition: nav.transition }}
    transform: style.transform,
    transition: style.transition,
    bind,
    go,
  };
}
