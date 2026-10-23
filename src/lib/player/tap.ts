/**
 * What a tap on a track plays.
 *
 * It used to be the list it was tapped in, from that track on, always. On an
 * album that is the record in its order, which is what somebody tapping a
 * song on it wants. On Tracks it is the whole library from that song on in
 * alphabetical order, which hardly anybody wants: after "Africa" comes
 * "Ain't No Sunshine" for no reason but the letter.
 *
 * So it is a choice (Settings → Player), and by default only on Tracks and in
 * the library's search results. The pages of albums, lists, artists and
 * folders keep their order unless somebody says otherwise. The Play and
 * Shuffle buttons above a list, Shuffle all and Discover are left alone: each
 * says exactly what it wants already.
 *
 * Nothing here reads a setting or knows the player. It is told the choice and
 * the list, and answers what queue to make of it, so that it can be held to
 * on a desk.
 */

export type TapMode = 'list' | 'shuffled' | 'similar' | 'only';

/**
 * In the order they are offered.
 *
 *  - `list`: the list as it is shown, playing from the track tapped;
 *  - `shuffled`: the track tapped, then the rest of the list shuffled;
 *  - `similar`: the track tapped, then a batch of songs like it, picked at
 *    once from where {@link SimilarSource} says — see `autoplay/`, which does
 *    the picking. After that batch the queue is any queue, and what keeps it
 *    going is "Keep playing similar songs";
 *  - `only`: the track alone. What happens after it is the end of a queue,
 *    which "Keep playing similar songs" decides.
 */
export const TAP_MODES: readonly TapMode[] = ['list', 'shuffled', 'similar', 'only'];

/**
 * Where the first batch comes from in a queue begun as similar songs: the
 * library, new songs from Discover, or both, as "Keep playing similar songs"
 * offers — but chosen apart from it, so that a tap can begin with the
 * library's songs and the queue go on with new ones, or the other way round.
 */
export type SimilarSource = 'library' | 'fresh' | 'mixed';

export const SIMILAR_SOURCES: readonly SimilarSource[] = ['library', 'fresh', 'mixed'];

/** Anything unreadable is the library, which works offline and downloads nothing. */
export function similarSourceFrom(stored: string | null | undefined): SimilarSource {
  return (SIMILAR_SOURCES as readonly (string | null | undefined)[]).includes(stored) ? (stored as SimilarSource) : 'library';
}

/** The setting as it was stored, made safe to go by. Anything unreadable is the list, which is how the app always was. */
export function tapModeFrom(stored: string | null | undefined): TapMode {
  return (TAP_MODES as readonly (string | null | undefined)[]).includes(stored) ? (stored as TapMode) : 'list';
}

/**
 * The queue to play: its tracks, where to start, and whether its first batch
 * of similar songs is to be picked at once, whatever "Keep playing similar
 * songs" says.
 */
export type TapQueue<T> = { tracks: T[]; start: number; similar: boolean };

/**
 * The queue a tap on [list]'s row [index] makes, by [mode].
 *
 * [shuffle] lays the rest of the list out: the app's own, which keeps an
 * artist from following themself. A row that is not there is the list as it
 * is, from its start, which is what the caller would have played anyway.
 */
export function tapQueue<T>(mode: TapMode, list: readonly T[], index: number, shuffle: (rest: T[]) => T[]): TapQueue<T> {
  const tapped = list[index];
  if (tapped === undefined) return { tracks: [...list], start: 0, similar: false };
  switch (mode) {
    case 'shuffled':
      return { tracks: [tapped, ...shuffle(list.filter((_, at) => at !== index))], start: 0, similar: false };
    case 'similar':
      return { tracks: [tapped], start: 0, similar: true };
    case 'only':
      return { tracks: [tapped], start: 0, similar: false };
    default:
      return { tracks: [...list], start: index, similar: false };
  }
}
