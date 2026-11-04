import { useCallback, useRef } from 'react';

import { startingOffset, type StartingOffset } from './startingOffset.ts';

/**
 * The `contentOffset` for a list that comes back to where it was left, and the
 * `ref` that tells this whether the list stands: see `startingOffset.ts`.
 * [where] is where the list was last; [builtFor] is what remounts it.
 */
export function useStartingOffset(builtFor: unknown, where: () => number) {
  const standing = useRef(false);
  const held = useRef<StartingOffset | null>(null);
  const start = startingOffset(held.current, builtFor, standing.current, where);
  held.current = start;
  const ref = useCallback((list: unknown) => {
    standing.current = list != null;
  }, []);
  return { contentOffset: start.offset, ref };
}
