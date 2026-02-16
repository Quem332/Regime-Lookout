import { useEffect, useRef } from "react";
import { logger } from "../core/logger";

// page index mapping (spec): 0:A, 1:B, 2:D, 3:C
export function useSwipeNav({ setPage }) {
  const startRef = useRef({ x: 0, y: 0, active: false, pointerId: null, edgeBlocked: false });
  const touchStart = useRef({ x: 0, y: 0, active: false, edgeBlocked: false });
  const cooldownRef = useRef(0); // timestamp ms until which navigation is locked

  const NAV_COOLDOWN_MS = 320;

  // Tuning knobs (desktop + mobile)
  const MIN_SWIPE_PX = 60; // reduce accidental swipes
  const DOMINANCE_RATIO = 1.25; // axis dominance (diagonals ignored)
  const EDGE_GUARD_PX = 16; // avoid iOS back-swipe / edge gestures

  const shouldIgnoreTarget = (target) => {
    if (!target) return false;
    // Any element can opt out with data-swipe-ignore
    if (target.closest?.("[data-swipe-ignore]")) return true;
    // Don't navigate when interacting with form controls / links
    if (target.closest?.("input, textarea, select, button, a")) return true;
    return false;
  };

  const isEdgeBlocked = (x, currentTarget) => {
    try {
      const rect = currentTarget?.getBoundingClientRect?.();
      if (!rect) return false;
      const relX = x - rect.left;
      return relX <= EDGE_GUARD_PX || relX >= rect.width - EDGE_GUARD_PX;
    } catch {
      return false;
    }
  };

  const MAIN_LOOP_NEXT = (p) => (p + 1) % 4;
  const MAIN_LOOP_PREV = (p) => (p - 1 + 4) % 4;

  const pairSwitch = (p) => {
    // Vertical Pair Switch per spec: A<->C (0<->3), B<->D (1<->2)
    if (p === 0) return 3;
    if (p === 3) return 0;
    if (p === 1) return 2;
    if (p === 2) return 1;
    return p;
  };

  // Pointer events (preferred) — works for mouse/trackpad/touch
  const onPointerDown = (e) => {
    if (shouldIgnoreTarget(e.target)) return;
    const edgeBlocked = isEdgeBlocked(e.clientX, e.currentTarget);
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      active: true,
      pointerId: e.pointerId,
      edgeBlocked,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onPointerUp = (e) => {
    if (!startRef.current.active) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    const edgeBlocked = startRef.current.edgeBlocked;
    startRef.current.active = false;

    // Ignore edge gestures (important on iOS + some Android browsers)
    if (edgeBlocked) return;

    // Navigation cooldown: prevent accidental double-advances on fast swipes.
    if (Date.now() < cooldownRef.current) return;

    if (Math.abs(dx) < MIN_SWIPE_PX && Math.abs(dy) < MIN_SWIPE_PX) return;

    const ax = Math.abs(dx);
    const ay = Math.abs(dy);

    // Ignore ambiguous diagonals
    if (ax / (ay || 1) < DOMINANCE_RATIO && ay / (ax || 1) < DOMINANCE_RATIO) return;

    if (ax > ay) {
      if (dx < 0) {
        logger.debug("nav.swipe", { kind: "horizontal", dir: "next" });
        cooldownRef.current = Date.now() + NAV_COOLDOWN_MS;
        setPage((p) => MAIN_LOOP_NEXT(p));
      } else {
        logger.debug("nav.swipe", { kind: "horizontal", dir: "prev" });
        cooldownRef.current = Date.now() + NAV_COOLDOWN_MS;
        setPage((p) => MAIN_LOOP_PREV(p));
      }
    } else {
      logger.debug("nav.swipe", { kind: "vertical", dir: "pair" });
      cooldownRef.current = Date.now() + NAV_COOLDOWN_MS;
      setPage((p) => pairSwitch(p));
    }
  };

  const onPointerCancel = () => {
    startRef.current.active = false;
  };

  // Touch fallback
  const onTouchStart = (e) => {
    if (shouldIgnoreTarget(e.target)) return;
    const t0 = e.touches[0];
    const edgeBlocked = isEdgeBlocked(t0.clientX, e.currentTarget);
    touchStart.current = { x: t0.clientX, y: t0.clientY, active: true, edgeBlocked };
  };

  const onTouchEnd = (e) => {
    if (!touchStart.current.active) return;
    const t0 = e.changedTouches[0];
    const dx = t0.clientX - touchStart.current.x;
    const dy = t0.clientY - touchStart.current.y;
    const edgeBlocked = touchStart.current.edgeBlocked;
    touchStart.current.active = false;

    if (edgeBlocked) return;

    if (Date.now() < cooldownRef.current) return;

    if (Math.abs(dx) < MIN_SWIPE_PX && Math.abs(dy) < MIN_SWIPE_PX) return;

    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax / (ay || 1) < DOMINANCE_RATIO && ay / (ax || 1) < DOMINANCE_RATIO) return;

    if (ax > ay) {
      if (dx < 0) {
        logger.debug("nav.swipe", { kind: "horizontal", dir: "next", via: "touch" });
        cooldownRef.current = Date.now() + NAV_COOLDOWN_MS;
        setPage((p) => MAIN_LOOP_NEXT(p));
      } else {
        logger.debug("nav.swipe", { kind: "horizontal", dir: "prev", via: "touch" });
        cooldownRef.current = Date.now() + NAV_COOLDOWN_MS;
        setPage((p) => MAIN_LOOP_PREV(p));
      }
    } else {
      logger.debug("nav.swipe", { kind: "vertical", dir: "pair", via: "touch" });
      cooldownRef.current = Date.now() + NAV_COOLDOWN_MS;
      setPage((p) => pairSwitch(p));
    }
  };

  // Keyboard nav (desktop testing)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") {
        logger.debug("nav.key", { key: "ArrowLeft" });
        setPage((p) => MAIN_LOOP_PREV(p));
      }
      if (e.key === "ArrowRight") {
        logger.debug("nav.key", { key: "ArrowRight" });
        setPage((p) => MAIN_LOOP_NEXT(p));
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        logger.debug("nav.key", { key: e.key });
        setPage((p) => pairSwitch(p));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPage]);

  return {
    // attach to a full-screen container
    bind: {
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onTouchStart,
      onTouchEnd,
    },
    pairSwitch,
    MAIN_LOOP_NEXT,
    MAIN_LOOP_PREV,
  };
}