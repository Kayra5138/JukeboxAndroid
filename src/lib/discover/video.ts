import { foldForMatch, matchScore, tokens, VARIANT_MARKERS } from '../metadata/text.ts';
import type { YouTubeVideo } from '../youtube/types.ts';
/** What is typed into YouTube for a song known only by its name. The one wording, whoever asks. */
export function findQuery(artist: string, title: string): string {
  return `${artist} ${title} official audio`.trim();
}
/** Never silently download the first result, a cover, or a live take of a studio recording. */
export function chooseVideo(song: { title: string; artist: string; durationSec?: number | null }, videos: YouTubeVideo[]): YouTubeVideo | null {
  const query = `${song.artist} ${song.title}`;
  const wanted = new Set(foldForMatch(query).split(/\s+/));
  const variants = new Set([...VARIANT_MARKERS, 'cover', 'acoustic', 'reaction', 'tutorial']);
  const titleWords = tokens(song.title);
  return videos.map(video => {
    const words = tokens(video.title);
    if (foldForMatch(video.title).split(/\s+/).some(w => variants.has(w) && !wanted.has(w)) || !video.duration || video.duration > 1200) return { video, score: 0 };
    if (song.durationSec && Math.abs(video.duration - song.durationSec) > Math.max(15, song.durationSec * .15)) return { video, score: 0 };
    const titleMatches = titleWords.length ? titleWords.every(w => words.includes(w)) : foldForMatch(video.title).includes(foldForMatch(song.title));
    if (!titleMatches) return { video, score: 0 };
    const score = matchScore(query, { title: video.title, artist: video.channel });
    return { video, score: score >= .8 ? score + (/topic|official/i.test(video.channel) ? .1 : 0) : 0 };
  }).filter(v => v.score > 0).sort((a,b) => b.score-a.score)[0]?.video ?? null;
}
