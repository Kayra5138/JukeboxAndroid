import { usePathname } from 'expo-router';

/**
 * Routes that are reached from inside the player and belong on top of it.
 *
 * The player is a layer over the navigator, so anything pushed while it is up
 * arrives underneath it and cannot be seen. That used to be dealt with by
 * closing the player on the way out, which solved the picture and broke the
 * back button: coming back from the equalizer landed on the library, because
 * the player it had been opened from no longer existed.
 *
 * Hidden rather than closed. The player and whatever was open inside it keep
 * their state for as long as the route is up, so going back from one of these
 * puts the player back exactly as it was left — which is what back means.
 *
 * In a file of its own because both sides of that arrangement need the list:
 * the host, to hide the layer, and the player, to stop answering the back
 * button while it is hidden. Importing one from the other made a cycle.
 */
const OVER_THE_PLAYER = new Set(['/equalizer', '/transitions', '/effects']);

/**
 * Whether one of those routes is currently on top of the player.
 *
 * The player registers a back handler that answers every press. While it is
 * hidden that means swallowing presses meant for the route above it, so this
 * is the signal to stand down as well as the signal to disappear — one list,
 * so the two cannot disagree about when.
 */
export function useCoveredByRoute(): boolean {
  return OVER_THE_PLAYER.has(usePathname());
}
