/**
 * The ways the library can be looked at, and which of them are on offer.
 *
 * One collection drawn four ways rather than four collections, which is why
 * they share a switch on one screen. Which of the four are worth a place on
 * that switch is a matter of how the collection was put together — somebody
 * whose files were never filed has no use for folders, and somebody whose tags
 * are a mess has no use for much else — so each can be turned off in Settings.
 *
 * Nothing here reads a setting. The stored words come in and go out as
 * arguments, so the rules can be exercised without a database behind them.
 */
export type LibraryView = 'tracks' | 'albums' | 'artists' | 'folders';

/** In the order the switch shows them. */
export const LIBRARY_VIEWS = ['tracks', 'albums', 'artists', 'folders'] as const;

/*
  What each is called is not here: it is `library.views` in the string tables,
  under these same words, so that the switch and Settings say it in whatever
  language the app is speaking.
*/

/**
 * What is on offer before anybody has chosen.
 *
 * Folders are left off. The other three are read out of the music itself;
 * folders are read out of how the files happen to be kept, which for most
 * collections is one folder with everything in it — a view with a single row.
 */
const UNLESS_TOLD: readonly LibraryView[] = ['tracks', 'albums', 'artists'];

/**
 * The views that are switched on, from what was written down.
 *
 * Written as the names of the ones that are on, with commas between. Anything
 * unrecognised is passed over, and a setting that names nothing usable is
 * treated as one never made: there is no reading of it under which the library
 * should be left with no way of being looked at.
 */
export function viewsFrom(stored: string | null): LibraryView[] {
  const named = new Set((stored ?? '').split(','));
  const on = LIBRARY_VIEWS.filter((view) => named.has(view));
  return on.length > 0 ? on : [...UNLESS_TOLD];
}

/** The other direction: what to write down for [views]. */
export function storedViews(views: readonly LibraryView[]): string {
  return LIBRARY_VIEWS.filter((view) => views.includes(view)).join(',');
}

/**
 * [views] with one of them turned on or off.
 *
 * Turning off the last one is refused, and what comes back is what went in. A
 * library that cannot be looked at is not a preference anybody has, only a
 * switch pressed once too often.
 */
export function withView(
  views: readonly LibraryView[],
  view: LibraryView,
  on: boolean
): LibraryView[] {
  const next = LIBRARY_VIEWS.filter((candidate) =>
    candidate === view ? on : views.includes(candidate)
  );
  return next.length > 0 ? next : [...views];
}

/**
 * The view to draw, given the one last chosen and the ones on offer.
 *
 * The first on offer when the chosen one has been turned off, or was never a
 * view at all. The choice itself is left as it was written: turning a view off
 * and on again in Settings should come back to it, not to wherever the library
 * was sent in the meantime.
 */
export function viewShown(remembered: string | null, enabled: readonly LibraryView[]): LibraryView {
  return enabled.find((view) => view === remembered) ?? enabled[0] ?? 'tracks';
}
