import { createContext, use, useEffect, useState } from 'react';

import { useListColumns } from './layout';

/**
 * Whether the tab a screen is in is the one open: told by the tab itself
 * (`TabArea`), round everything in it, its pages included. Every tab once
 * opened is kept standing behind the open one (see there), and what costs a
 * lot to lay out anew can wait for its tab to be opened to do it.
 */
export const TabOpen = createContext(true);

export function useTabOpen(): boolean {
  return use(TabOpen);
}

/**
 * {@link useListColumns}, for a list that is made afresh when the count
 * changes: as many as the window has room for while its tab is open, and
 * while it is not, as many as it had when it last was. Turned with the
 * phone, every list in every tab behind the open one was made afresh, rows
 * and all, for a width nobody was looking at.
 */
export function useColumnsInSight(): number {
  const live = useListColumns();
  const open = useTabOpen();
  const [kept, setKept] = useState(live);
  useEffect(() => {
    if (open && kept !== live) setKept(live);
  }, [kept, live, open]);
  return open ? live : kept;
}
