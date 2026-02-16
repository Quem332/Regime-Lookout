import { useCallback, useMemo, useState } from "react";

// Cube navigation (spec v2.3)
// Pair A: Daily <-> Hub(Settings)
// Pair B: Score <-> Intraday
// Vertical: pair switch A<->C, B<->D (within pair)
// Horizontal: swap pairs while keeping vertical position (A<->B, C<->D)

const HMAP = { 0: 1, 1: 0, 2: 3, 3: 2 }; // left/right swap
const VMAP = { 0: 3, 3: 0, 1: 2, 2: 1 }; // up/down toggle

export function useDragNav({ initialPage = 0 } = {}) {
  const [page, setPage] = useState(initialPage);

  const goto = useCallback(
    ({ dx = 0, dy = 0 } = {}) => {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax === 0 && ay === 0) return page;
      return ax >= ay ? HMAP[page] : VMAP[page];
    },
    [page]
  );

  const commit = useCallback(
    ({ dx = 0, dy = 0 } = {}) => {
      const next = goto({ dx, dy });
      setPage(next);
      return next;
    },
    [goto]
  );

  const api = useMemo(
    () => ({
      page,
      setPage,
      goto,
      commit,
      // explicit helpers
      swapPair: () => setPage((p) => HMAP[p]),
      toggleWithinPair: () => setPage((p) => VMAP[p]),
      hmap: HMAP,
      vmap: VMAP,
    }),
    [page, goto, commit]
  );

  return api;
}
