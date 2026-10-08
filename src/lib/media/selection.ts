/**
 * Choosing tracks by what they are filed under.
 *
 * What is chosen in the library is always tracks, whichever way it is being
 * looked at: everything that can be done to a selection — queue it, list it,
 * tag it, erase it — is done to tracks. So a record, an artist or a folder is
 * never itself selected. Its row only says how many of its tracks are, and
 * tapping it chooses or lets go of all of them at once.
 *
 * Which is also what makes the views agree with each other without being told
 * to. A song by two artists is under both; choosing one of them leaves the
 * other with some of its tracks chosen, and its row says so, because both rows
 * are reading the same set.
 */

/** A heading's tick box: none of its tracks chosen, all of them, or some. */
export type Mark = boolean | 'mixed';

type Held = { readonly id: string };

/** What the row for [tracks] should show, given what is [selected]. */
export function markOf(tracks: readonly Held[], selected: ReadonlySet<string>): Mark {
  // Nothing chosen anywhere is the usual case, and the cheap one to answer.
  if (selected.size === 0 || tracks.length === 0) return false;
  let chosen = 0;
  for (const track of tracks) if (selected.has(track.id)) chosen += 1;
  return chosen === 0 ? false : chosen === tracks.length ? true : 'mixed';
}

/**
 * [selected] after the row for [tracks] has been tapped. A copy.
 *
 * All of them let go only when all of them were held. Some held becomes all
 * held, which is what a half-filled box is expected to do when pressed: the
 * tap is finishing something, not undoing it.
 */
export function withGroupToggled(
  selected: ReadonlySet<string>,
  tracks: readonly Held[]
): Set<string> {
  const next = new Set(selected);
  if (markOf(tracks, selected) === true) for (const track of tracks) next.delete(track.id);
  else for (const track of tracks) next.add(track.id);
  return next;
}

/**
 * Every track under [groups], once each.
 *
 * Once, because the groups overlap wherever a track is under two artists, and
 * a count of what "select all" would take must not count that track twice.
 */
export function tracksUnder(groups: readonly { readonly tracks: readonly Held[] }[]): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) for (const track of group.tracks) ids.add(track.id);
  return ids;
}

/** Whether everything in [shown] is selected; never true of nothing. */
export function holdsAll(selected: ReadonlySet<string>, shown: ReadonlySet<string>): boolean {
  if (shown.size === 0 || selected.size < shown.size) return false;
  for (const id of shown) if (!selected.has(id)) return false;
  return true;
}
