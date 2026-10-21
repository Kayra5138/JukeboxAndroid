/**
 * How much of a screen the bars of glass are drawn over, and so how much
 * room a list has to keep at its two ends for nothing to be hidden at rest.
 *
 * In every theme but one of glass the bars take room of their own: the list
 * ends where the tab bar begins, and there is nothing to keep clear of. In a
 * theme of glass they are laid over the screen instead, so that what is
 * scrolled passes under them and is seen through them; the list then runs
 * the whole height and is told here how far in its first and last rows have
 * to start, so that they can still be scrolled clear of the bars.
 *
 * Only the bars across the screen are laid over it. Sideways the tabs are a
 * rail down the left and what is playing a panel down the right, and a list
 * that scrolls up and down passes under neither: they keep their room.
 *
 * Nothing here knows about React, so the arithmetic can be tested.
 */

/** What is drawn over the top and the foot of a screen, in pixels. */
export type Over = { readonly top: number; readonly bottom: number };

/** Nothing over either end, and always the same nothing. */
export const CLEAR: Over = Object.freeze({ top: 0, bottom: 0 });

/** The bar over a pushed screen, without what the system draws above it: the navigator's own measure on Android. */
export const HEADER_BAR = 64;

/**
 * How tall the tab bar is along the bottom, above the phone's own inset: the
 * cell's padding, the patch's, the icon, the gap and the label, whose line
 * grows with the size of writing the phone is set to. For what is drawn
 * over the app and has to keep clear of it; see `DownloadsButton`.
 */
export const tabBarHeight = (fontScale: number) => 46 + Math.ceil(16 * Math.max(1, fontScale));

/**
 * How tall the bar of what is playing is along the bottom: its padding and
 * the cover, or the two lines beside the cover once the phone's writing is
 * large enough for them to be the taller. For what is drawn over the app and
 * has to keep clear of it; see `DownloadsButton`.
 */
export const nowPlayingHeight = (fontScale: number) => 20 + Math.max(40, Math.ceil(2 + 36 * fontScale));

/**
 * How tall the tab bar is reckoned to be, edge and inset included: as it was
 * last measured, or, before it has been, as it is worked out to be. The
 * reckoning is right to within its hairline, so the first frame of a screen
 * is already where it will stay.
 */
export function tabBarOver(measured: number, fontScale: number, insetBottom: number): number {
  return measured > 0 ? measured : tabBarHeight(fontScale) + insetBottom;
}

/**
 * What the bars of glass cover of one screen.
 *
 * [top] is the bar over a pushed screen, where the screen lets its list run
 * under it; nought for one that does not. [tabs] is whether the screen is
 * one of the tabs, with the tab bar along its foot, [tabBar] how tall that
 * is, and [player] how tall the bar of what is playing is along the foot of
 * this screen — nought where nothing is playing or it has none.
 */
export function overOf({
  glass,
  landscape,
  top,
  tabs,
  tabBar,
  player,
}: {
  glass: boolean;
  landscape: boolean;
  top: number;
  tabs: boolean;
  tabBar: number;
  player: number;
}): Over {
  if (!glass) return CLEAR;
  const bottom = landscape ? 0 : (tabs ? tabBar : 0) + player;
  if (top <= 0 && bottom <= 0) return CLEAR;
  return { top: Math.max(0, top), bottom: Math.max(0, bottom) };
}

/**
 * Where the bar of what is playing stands along the foot of a screen, laid
 * over it: on the tab bar, where there is one, and otherwise at the foot.
 * Null where it is not laid over anything and keeps its place in the page:
 * any theme not of glass, and sideways, where it is a panel.
 */
export function dockOf({
  glass,
  landscape,
  tabs,
  tabBar,
}: {
  glass: boolean;
  landscape: boolean;
  tabs: boolean;
  tabBar: number;
}): number | null {
  if (!glass || landscape) return null;
  return tabs ? tabBar : 0;
}
