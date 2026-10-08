import type { LyricLine } from './lrc.ts';

/**
 * The same song's words in another writing, laid against the lines on screen.
 *
 * Romanised Japanese cannot be translated, and the same catalogue very often
 * holds the song as it was written as well. Those words can be translated —
 * but the translation has to sit under the romanised lines that are being
 * shown, one for one, and the two entries were typed by different people. So
 * each line on screen is given the line of the other entry that is the same
 * moment of the song, and what cannot be paired is left with nothing rather
 * than with a neighbour's meaning.
 */

/** How far apart two people's timings of one line are allowed to be, in seconds. */
const SAME_MOMENT_SEC = 1.5;

/**
 * How much of the song has to pair up before any of it is believed.
 *
 * Two entries for the same recording agree nearly everywhere. Two that agree
 * on a third of their lines are a different edit, or a different song of the
 * same name and length, and the third that did pair is coincidence.
 */
const ENOUGH = 0.6;

/** Whether enough of the lines with words in them found a partner. */
function believable(lines: string[], partners: string[]): boolean {
  let worded = 0;
  let paired = 0;
  lines.forEach((line, index) => {
    if (line.trim().length === 0) return;
    worded += 1;
    if (partners[index]!.trim().length > 0) paired += 1;
  });
  return worded > 0 && paired / worded >= ENOUGH;
}

/**
 * Pairs by time: for each line on screen, the other entry's line nearest to
 * it, if one is near enough. Null when too little of the song pairs up.
 */
export function partnersByTime(
  lines: string[],
  times: number[],
  other: LyricLine[]
): string[] | null {
  if (lines.length !== times.length) return null;
  const worded = other.filter((line) => line.text.trim().length > 0);

  const partners = lines.map((line, index) => {
    if (line.trim().length === 0) return '';
    let best = '';
    let nearest = SAME_MOMENT_SEC;
    for (const candidate of worded) {
      const apart = Math.abs(candidate.at - times[index]!);
      if (apart <= nearest) {
        nearest = apart;
        best = candidate.text;
      }
    }
    return best;
  });

  return believable(lines, partners) ? partners : null;
}

/**
 * Pairs by order, for words with no timings: first line with words to first
 * line with words. Only when both have the same number of them — one line
 * more or fewer and every pair after it is off by one, which reads as a
 * translation and is not one.
 */
export function partnersByOrder(lines: string[], other: string[]): string[] | null {
  const theirs = other.filter((line) => line.trim().length > 0);
  const ours = lines.filter((line) => line.trim().length > 0);
  if (ours.length === 0 || ours.length !== theirs.length) return null;

  let next = 0;
  return lines.map((line) => (line.trim().length === 0 ? '' : theirs[next++]!));
}
