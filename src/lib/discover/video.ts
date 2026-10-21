import { withoutBrackets } from '../metadata/credit.ts';
import { foldForMatch, matchScore, tokens, VARIANT_MARKERS } from '../metadata/text.ts';
import type { YouTubeVideo } from '../youtube/types.ts';

/** What is typed into YouTube for a song known only by its name. The one wording, whoever asks. */
export function findQuery(artist: string, title: string): string {
  return `${artist} ${title} official audio`.trim();
}

/** How close in seconds a video has to be to the recording to be taken for it on its length alone. */
const SAME_LENGTH_SEC = 2;

/**
 * Whether a video's title is in another writing than the song's, so that
 * not finding the song's words in it says nothing: `いってらっしゃい` for
 * `Itterasshai`. The artist's name and what is said about the upload are left
 * out first, and the letters that remain are counted, Latin against the rest.
 *
 * This is the only ground on which a video whose name does not say it is the
 * song may be taken for it. A title in the same writing that does not have
 * the song's words in it is the name of another song: taken on its length, or
 * as the first result, it was `bôa – Twilight` downloaded and filed as
 * `Frozen`, from the same artist and near enough the same length, and nothing
 * on the screen said so.
 */
export function inOtherWriting(songTitle: string, videoTitle: string, artist: string): boolean {
  const latin = (text: string) => (text.match(/\p{Script=Latin}/gu) ?? []).length;
  const letters = (text: string) => (text.match(/\p{L}/gu) ?? []).length;
  let rest = videoTitle;
  if (artist.trim()) rest = rest.split(artist).join(' ');
  rest = rest.replace(/official|audio|video|music|lyrics?|topic|mv|pv|hd|4k/gi, ' ');
  const songLatin = latin(songTitle) * 2 > letters(songTitle);
  const restLetters = letters(rest);
  if (restLetters === 0) return false;
  const restLatin = latin(rest) * 2 > restLetters;
  return songLatin !== restLatin;
}

/**
 * The video that is this song, out of what a search for it came back with.
 *
 * Never a cover, a live take or a reaction where the studio recording was
 * asked for, never a whole concert, never one whose length says it is
 * something else, and never one whose title, readable, names another song
 * (see {@link inOtherWriting}). Among what is left it is tried four ways, the surest first:
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
  // The words of the song's own name, not of what a catalogue added in brackets after it.
  const titleWords = tokens(withoutBrackets(song.title));
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
      const score = matchScore(`${song.artist} ${withoutBrackets(song.title)}`, { title: video.title, artist: video.channel });
      return { video, score: score >= 0.8 ? score + (/topic|official/i.test(video.channel) ? 0.1 : 0) : 0 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.video;
  if (named) return named;

  const sameLength = (video: YouTubeVideo) => length != null && Math.abs((video.duration ?? 0) - length) <= SAME_LENGTH_SEC;
  const names = (video: YouTubeVideo) =>
    artist.length > 0 && (foldForMatch(video.channel).includes(artist) || foldForMatch(video.title).includes(artist));

  // Past here the name has not said it is the song, which it is only allowed to fail to say in another writing.
  const unreadable = (video: YouTubeVideo) => inOtherWriting(song.title, video.title, song.artist);
  const byLength = possible.find((video) => sameLength(video) && names(video) && unreadable(video));
  if (byLength) return byLength;
  if (!song.loose) return null;

  const readable = possible.filter(unreadable);
  return readable.find(sameLength) ?? readable.find((video) => length != null || names(video)) ?? null;
}
