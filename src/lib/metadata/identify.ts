import { bareTitle } from './text.ts';
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
 */
export type Identity = { artist: string | null; title: string; query: string };

export function identify(track: Track): Identity {
  if (track.artist) {
    // The same tagger that filled the artist in usually left `Artist - Title`
    // sitting in the title as well, and a catalogue reads that literally: a
    // search for `Ai Higuchi - Akuma no Ko` by Ai Higuchi finds nothing at all.
    const title = bareTitle(track.title, track.artist);
    return {
      artist: track.artist,
      title,
      query: `${track.artist} ${title}`.trim(),
    };
  }

  const separator = track.title.indexOf(' - ');
  if (separator < 0) {
    return { artist: null, title: track.title, query: track.title };
  }

  return {
    artist: track.title.slice(0, separator).trim(),
    title: track.title.slice(separator + 3).trim(),
    query: track.title,
  };
}
