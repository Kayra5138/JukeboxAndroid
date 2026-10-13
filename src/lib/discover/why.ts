import { strings, type Strings } from '../i18n/languages.ts';

/**
 * Why a song is on the list, as something that can be said.
 *
 * A recommendation that cannot explain itself is a stranger's guess. The
 * build knows a good deal about each song — which of somebody's artists led
 * to it and how near it is to them, what it is tagged, whether its artist is
 * new to the library — and used to keep one line of that and say "A new
 * artist · X". This is the rest of it, kept with the song as data and not as
 * a sentence, so that the sentence is made in whatever language the app is in
 * when it is read and not the one it was in when the list was built.
 */
export type Why = {
  /**
   * How the song was come by: `yours` is by an artist somebody plays —
   * `seeds` is then that artist and nobody else, whoever else they are near —
   * `near` is by a neighbour of one or two of them, and `tags` was found by
   * what it is tagged and by nothing else.
   */
  kind: 'yours' | 'near' | 'tags';
  /**
   * The artists somebody plays that led here, the one that counted most
   * first. A second is only named where it pulled at least six tenths as
   * hard as the first: "because you play X and Y" is a claim about both.
   */
  seeds: string[];
  /** The tags that were asked about, where it was found by tags. */
  searched: string[];
  /** The song's own genres, the nearest to the song first. */
  tags: string[];
  /** How near its artist is to the nearest of those seeds, from nought to one; null where unknown. */
  similarity: number | null;
  /** Its artist is not in the library and has never been played. */
  fresh: boolean;
  /**
   * Who said its artist is near the first of those seeds: the people who play
   * both (`listenbrainz`), the shop that files them together (`deezer`), or
   * `both`. Absent on a song gathered before this was kept, and on one that
   * is by an artist somebody plays, where nobody had to say anything.
   */
  witness?: 'listenbrainz' | 'deezer' | 'both';
  /**
   * For a song by an artist somebody has but was not started from: the
   * artists that were, and that led to it. `seeds` is then the artist
   * themself, because that is what there is to say — "More from Pomme" — and
   * this is how it came to be on the list at all.
   */
  via?: string[];
};

/**
 * The line under a song.
 *
 *  - by an artist somebody plays: "More from X", with a genre where there is one;
 *  - by a neighbour of two or more of them: "Because you play X and Y";
 *  - by a neighbour of one: "Like X · dream pop" — the genre is the song's
 *    own, and is what tells two neighbours of the same artist apart;
 *  - found by its tags: "From the dream pop + shoegaze you play".
 *
 * At most two names. A third makes a line that does not fit a row and says
 * no more than two did.
 */
export function explain(why: Why, t: Strings = strings()): string {
  const said = t.discover.why;
  const genre = why.tags[0];
  const tagged = (line: string) => (genre ? said.withGenre(line, genre) : line);

  if (why.kind === 'tags' || !why.seeds.length) {
    const about = why.searched.length ? why.searched : why.tags.slice(0, 2);
    return about.length ? said.fromTags(about.join(' + ')) : said.unexplained;
  }
  if (why.kind === 'yours') return tagged(said.moreFrom(why.seeds[0]!));
  if (why.seeds.length >= 2) return said.becauseYouPlay(said.both(why.seeds[0]!, why.seeds[1]!));
  return tagged(said.like(why.seeds[0]!));
}

/**
 * The same for a song as it is kept, including one kept before any of this.
 *
 * A list saved by an earlier version has songs with a `because` line and no
 * `why`, and they are said the way they always were.
 */
export function explainEntry(
  entry: { why?: Why; because: string; familiar: boolean },
  t: Strings = strings()
): string {
  if (entry.why) return explain(entry.why, t);
  return entry.familiar ? t.discover.panel.familiar(entry.because) : t.discover.panel.fresh(entry.because);
}

/** How near, as a word and not a number: nobody is helped by "0.62 similar". */
export function nearnessWord(similarity: number | null, t: Strings = strings()): string | null {
  if (similarity == null) return null;
  const said = t.discover.why;
  return similarity >= 0.6 ? said.veryNear : similarity >= 0.25 ? said.near : said.farther;
}
