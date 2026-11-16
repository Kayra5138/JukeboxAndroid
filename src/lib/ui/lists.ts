/**
 * Whether a list takes the rows it has scrolled past out of the view tree.
 *
 * Never, in this app. React Native turns it on for every list on Android, as
 * a saving on long lists, and under the new renderer it brings the app down:
 * a row taken out is no longer where the renderer believes it is, and the next
 * view put in beside it — a row's mark changing as the player moves on, a line
 * appearing in a list's heading — is put at a place that does not exist. The
 * app closed twice like that on 19 October, both times on the next track
 * after the player had sat paused with the library under it
 * ("addViewAt: failed to insert view … at index 1", `IndexOutOfBoundsException`
 * in `ReactClippingViewManager`). The lists only ever draw the rows near the
 * screen anyway, so leaving the rest in place costs next to nothing.
 */
export const CLIP_SUBVIEWS = false;

/**
 * How many screens of rows a list keeps drawn, the one in sight among them:
 * three either side of it, as the library's lists do. Left to itself a list
 * goes on drawing rows while nothing is happening until it has ten screens
 * either side, a few hundred rows with covers for a long search, each of them
 * work for the phone and something held in memory.
 */
export const LIST_WINDOW = 7;

/**
 * Spread on a FlatList for its rows to be drawn again only when how a row
 * is drawn (`renderItem`) changes, and not at every drawing of the screen it
 * is on: FlatList's `strictMode`, which its types leave out. Without it the
 * list wraps `renderItem` anew each time it is drawn, and every row on
 * screen is drawn again with it -- the library's list of tracks, some
 * forty-five rows, three times at each change of view.
 */
export const ROWS_KEPT: object = { strictMode: true };
