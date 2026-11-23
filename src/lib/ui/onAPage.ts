import type { ReactNode } from 'react';

/**
 * What Settings used to lay over a page as a sheet, and now opens as a page
 * of its own in the tab (`OnAPage`, and the `shown` page that draws it), by a
 * token handed to the page in its address.
 *
 * A page is opened by an address, and a sheet's insides -- what it shows and
 * what its buttons do -- are not something an address can carry: so they
 * are kept here while the page is open, handed on afresh each time whoever
 * opened it is drawn, and the page draws them from here.
 */
export type Shown = {
  title: string;
  body: ReactNode;
  /** Gone back from: whoever opened it is told, as a sheet told them on Cancel. */
  onClose: () => void;
  /** Drawn as it is, filling the page, with no page of Settings round it to scroll: for what scrolls in itself. */
  bare?: boolean;
  /** Not to be left for now, by Back or the arrow: something on it is under way that cannot be walked away from. */
  locked?: boolean;
};

type Held = {
  shown: Shown;
  open: boolean;
  /** Whether the page is the one in front, or has had another opened over it, by a choice made on it. */
  onTop?: boolean;
  /** Takes the page out from under whatever was opened over it, told by the page itself. */
  remove?: () => void;
};

const held = new Map<string, Held>();
const listeners = new Set<() => void>();
let made = 0;
/** Changes whenever anything kept here does, for the page to be drawn again by. */
let version = 0;

function told(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/** Keeps [shown] for a page to draw, and answers the token to open it by. */
export function offerPage(shown: Shown): string {
  made += 1;
  const token = `shown-${made}`;
  held.set(token, { shown, open: true });
  told();
  return token;
}

/** As it stands now, from whoever opened it; for the page to draw. */
export function updatePage(token: string, shown: Shown): void {
  const entry = held.get(token);
  if (!entry) return;
  entry.shown = shown;
  told();
}

/** What a token stands for, or nothing where it was let go (or the app was opened afresh on the page). */
export function pageOf(token: string | undefined): Shown | null {
  return token ? (held.get(token)?.shown ?? null) : null;
}

/** Whether the page for [token] is still open: closing it twice would go back twice. */
export function pageOpen(token: string): boolean {
  return held.get(token)?.open === true;
}

/** The page is closing, or closed: nobody is to close it again. */
export function pageClosed(token: string): void {
  const entry = held.get(token);
  if (entry) entry.open = false;
}

/** Let go of once nobody is showing it any more. */
export function dropPage(token: string): void {
  held.delete(token);
  told();
}

export function subscribePages(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pagesVersion(): number {
  return version;
}

/** Said by the page as it comes to the front and goes from it, and how to take it out from under another. */
export function notePage(token: string, onTop: boolean, remove: () => void): void {
  const entry = held.get(token);
  if (!entry) return;
  entry.onTop = onTop;
  entry.remove = remove;
}

/**
 * How the page for [token] is to be closed: gone back from, where it is in
 * front, or taken out from under the page a choice on it opened, which a
 * going back would have closed in its place.
 */
export function closingOf(token: string): 'back' | (() => void) {
  const entry = held.get(token);
  if (!entry || entry.onTop !== false || !entry.remove) return 'back';
  return entry.remove;
}
