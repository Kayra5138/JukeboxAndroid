import { featuredIn, splitCredit, withoutPackaging } from './credit.ts';
import { bareTitle, foldForMatch } from './text.ts';
import type { Track } from '../types.ts';

/**
 * Works out who performs a track and what it is called.
 *
 * The media store leaves the artist empty for untagged files and puts the whole
 * filename in the title, so `Yousei Teikoku - Gothic Lolita Agitator` is usually
 * the only place an artist name exists at all.
 *
 * When there is no artist to compare against, the first ` - ` is taken as the
 * separator and there is no way to do better: an artist whose own name contains
 * a dash will be cut in the wrong place, and nothing in the filename says so.
 *
 * `artist` is the credit as it is written, and is what gets saved. `artists`
 * is the same credit taken apart, with anybody the title names as a guest on
 * the end, and is what gets searched for: no catalogue has an artist called
 * `Eminem, Rihanna`, and every one of them has Eminem. `title` has had the
 * guests and the upload's own labels taken out of it for the same reason.
 */
export type Identity = {
  artist: string | null;
  artists: string[];
  title: string;
  query: string;
};

/** A genre or a channel in brackets at the front: `[DnB] - Feint - Snake Eyes`. */
const LABEL_IN_FRONT = /^\s*\[[^\]]*\]\s+-\s+/;

/** The title as a catalogue would have it, and whoever it names as a guest. */
function cleaned(title: string): { title: string; featured: string[] } {
  return featuredIn(withoutPackaging(title));
}

/** One list from a credit and a title's guests, each artist once. */
function together(credit: string | null, featured: string[]): string[] {
  const seen = new Set<string>();
  return [...splitCredit(credit), ...featured].filter((name) => {
    const key = foldForMatch(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function identify(track: Track): Identity {
  if (track.artist) {
    // The same tagger that filled the artist in usually left `Artist - Title`
    // sitting in the title as well, and a catalogue reads that literally: a
    // search for `Ai Higuchi - Akuma no Ko` by Ai Higuchi finds nothing at all.
    const { title, featured } = cleaned(bareTitle(track.title, track.artist));
    const artists = together(track.artist, featured);
    return {
      artist: track.artist,
      artists,
      title,
      // Under the first name only. A search for every name on the record at
      // once asks for a song all of them are credited on in so many words, and
      // a guest is as often in the title as in the credit.
      query: `${artists[0] ?? track.artist} ${title}`.trim(),
    };
  }

  const named = track.title.replace(LABEL_IN_FRONT, '');
  const separator = named.indexOf(' - ');
  if (separator < 0) {
    const { title, featured } = cleaned(named);
    return { artist: null, artists: featured, title, query: title };
  }

  const artist = named.slice(0, separator).trim();
  const { title, featured } = cleaned(named.slice(separator + 3).trim());
  const artists = together(artist, featured);
  return {
    artist,
    artists,
    title,
    query: `${artists[0] ?? artist} ${title}`.trim(),
  };
}
