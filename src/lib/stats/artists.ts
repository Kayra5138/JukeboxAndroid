import { foldForMatch } from '../metadata/text.ts';

/**
 * Counting listens by artist, when a listen can have more than one.
 *
 * The history records the credit as it was written, so a song by two people is
 * filed under both their names at once: `Eminem, Rihanna` as an artist of its
 * own, sitting in the list beside Eminem and taking an hour off him. Counted
 * here instead, each name in a credit is given the listen. Nobody's time is
 * divided: somebody who listened to that song for four minutes listened to
 * Eminem for four minutes and to Rihanna for four minutes, and both are true.
 *
 * Which means the artists' minutes no longer add up to the minutes listened,
 * and are not meant to. The total is counted from the listens, not from this.
 *
 * Who a listen names is asked of the whole row and not only of its credit,
 * because half the catalogues in the world put the guest in the title:
 * `Love the Way You Lie (feat. Rihanna)` by Eminem is as much Rihanna's as
 * `Eminem, Rihanna` is.
 */

/** One credit's listens to one track, which is as fine as the history needs slicing. */
export type CreditListens = {
  artist: string;
  /** What the track was called when it was played, for the guests it names. */
  title?: string | null;
  trackId: string;
  plays: number;
  seconds: number;
};

export type ArtistTally = {
  /** Unique in the list, and the name as it was first met. */
  key: string;
  label: string;
  playCount: number;
  totalSeconds: number;
  /** Whichever of theirs was played most, to borrow a cover from. */
  sample: string | null;
};

type Running = {
  label: string;
  plays: number;
  seconds: number;
  tracks: Map<string, { plays: number; seconds: number }>;
};

/**
 * The most listened-to artists, each credited with every listen they are on.
 *
 * Names are matched folded, so `AURORA` on one file and `Aurora` on another
 * are one artist; the spelling shown is the one with the most listens behind
 * it, which is the one the library mostly uses.
 */
export function tallyArtists(
  rows: CreditListens[],
  namesOn: (listen: { artist: string; title?: string | null }) => string[],
  limit: number
): ArtistTally[] {
  const artists = new Map<string, Running>();
  // Heaviest first, so the spelling that is kept is the commonest one.
  const ordered = [...rows].sort((a, b) => b.plays - a.plays || b.seconds - a.seconds);

  for (const row of ordered) {
    const counted = new Set<string>();
    for (const name of namesOn(row)) {
      const key = foldForMatch(name);
      // Once per listen even if they are named twice, or in both places.
      if (!key || counted.has(key)) continue;
      counted.add(key);

      let artist = artists.get(key);
      if (!artist) {
        artist = { label: name, plays: 0, seconds: 0, tracks: new Map() };
        artists.set(key, artist);
      }
      artist.plays += row.plays;
      artist.seconds += row.seconds;
      const track = artist.tracks.get(row.trackId) ?? { plays: 0, seconds: 0 };
      track.plays += row.plays;
      track.seconds += row.seconds;
      artist.tracks.set(row.trackId, track);
    }
  }

  return [...artists.values()]
    .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, limit))
    .map((artist) => {
      let sample: string | null = null;
      let best = { plays: -1, seconds: -1 };
      for (const [trackId, heard] of artist.tracks) {
        if (heard.plays > best.plays || (heard.plays === best.plays && heard.seconds > best.seconds)) {
          sample = trackId;
          best = heard;
        }
      }
      return {
        key: artist.label,
        label: artist.label,
        playCount: artist.plays,
        totalSeconds: artist.seconds,
        sample,
      };
    });
}

/** How many different artists a set of listens names between them. */
export function countArtists(
  listens: { artist: string; title?: string | null }[],
  namesOn: (listen: { artist: string; title?: string | null }) => string[]
): number {
  const names = new Set<string>();
  for (const listen of listens) {
    for (const name of namesOn(listen)) {
      const key = foldForMatch(name);
      if (key) names.add(key);
    }
  }
  return names.size;
}
