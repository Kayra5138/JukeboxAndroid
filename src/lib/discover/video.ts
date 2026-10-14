import { foldForMatch, matchScore, tokens, VARIANT_MARKERS } from '../metadata/text.ts';
import type { YouTubeVideo } from '../youtube/types.ts';

/** What is typed into YouTube for a song known only by its name. The one wording, whoever asks. */
export function findQuery(artist: string, title: string): string {
  return `${artist} ${title} official audio`.trim();
}

/** How close in seconds a video has to be to the recording to be taken for it on its length alone. */
const SAME_LENGTH_SEC = 2;

/**
 * The video that is this song, out of what a search for it came back with.
 *
 * Never a cover, a live take or a reaction where the studio recording was
 * asked for, never a whole concert, and never one whose length says it is
 * something else. Among what is left it is tried four ways, the surest first:
 *
 *   By its name: every word of the title in the video's, and the two near
 *   enough as a whole. This is the rule there always was, and alone it turned
 *   away any song whose video is titled in another writing than its
 *   catalogue entry — `Itterasshai` is `いってらっしゃい` on YouTube — and
 *   said no recording could be found of songs that were the first result.
 *
 *   By its length, on the artist's own channel or a video that names the
 *   artist: a recording is as long as it is to the second, wherever it is
 *   put, and a video that long from that artist is that recording whatever
 *   it is titled.
 *
 * The other two are for whoever said `loose`, which is Discover: a song it
 * offers is one it has just been told exists, by a catalogue that took it
 * from a record, so that none of twenty videos is it is much less likely
 * than that the rules above could not read them.
 *
 *   By its length alone, the first that fits to the second.
 *
 *   The first that is not ruled out. Where the length is known that still
 *   means within the wide margin every video is held to; where it is not,
 *   it has to name the artist.
 *
 * Results are taken in the order YouTube gave them, which is its own opinion
 * of which is meant, and worth having.
 */
export function chooseVideo(
  song: { title: string; artist: string; durationSec?: number | null; loose?: boolean },
  videos: YouTubeVideo[]
): YouTubeVideo | null {
  const query = `${song.artist} ${song.title}`;
  const wanted = new Set(foldForMatch(query).split(/\s+/));
  const variants = new Set([...VARIANT_MARKERS, 'cover', 'acoustic', 'reaction', 'tutorial']);
  const titleWords = tokens(song.title);
  const length = song.durationSec && song.durationSec > 0 ? song.durationSec : null;
  const artist = foldForMatch(song.artist);

  const possible = videos.filter((video) => {
    if (!video.duration || video.duration > 1200) return false;
    if (foldForMatch(video.title).split(/\s+/).some((word) => variants.has(word) && !wanted.has(word))) return false;
    return length == null || Math.abs(video.duration - length) <= Math.max(15, length * 0.15);
  });

  const named = possible
    .map((video) => {
      const words = tokens(video.title);
      const titleMatches = titleWords.length
        ? titleWords.every((word) => words.includes(word))
        : foldForMatch(video.title).includes(foldForMatch(song.title));
      if (!titleMatches) return { video, score: 0 };
      const score = matchScore(query, { title: video.title, artist: video.channel });
      return { video, score: score >= 0.8 ? score + (/topic|official/i.test(video.channel) ? 0.1 : 0) : 0 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.video;
  if (named) return named;

  const sameLength = (video: YouTubeVideo) => length != null && Math.abs((video.duration ?? 0) - length) <= SAME_LENGTH_SEC;
  const names = (video: YouTubeVideo) =>
    artist.length > 0 && (foldForMatch(video.channel).includes(artist) || foldForMatch(video.title).includes(artist));

  const byLength = possible.find((video) => sameLength(video) && names(video));
  if (byLength) return byLength;
  if (!song.loose) return null;

  return possible.find(sameLength) ?? possible.find((video) => length != null || names(video)) ?? null;
}
