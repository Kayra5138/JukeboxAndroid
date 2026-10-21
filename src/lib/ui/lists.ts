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
