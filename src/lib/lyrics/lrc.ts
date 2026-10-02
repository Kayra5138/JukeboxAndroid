/**
 * The LRC format: lyrics with a timestamp in front of each line.
 *
 *   [ar:LiSA]
 *   [00:12.34]Tsuyoku nareru riyuu wo shitta
 *   [00:15.67][01:20.10]Boku wo tsurete susume
 *
 * Square brackets carry two different things. `[00:12.34]` is a time, and a
 * line may have several when the same words recur. Anything else — `[ar:…]`,
 * `[length:…]` — is a header about the file, not part of the song.
 *
 * A time is minutes and seconds, and the format gives no way to say otherwise.
 * Files for tracks over an hour sometimes write `[01:02:50]` meaning an hour
 * and change; read as minutes and seconds with a fraction, that is 62.5s, and
 * this reads it that way. The ambiguity is in the format and cannot be resolved
 * from the text alone — `[01:02:50]` is a legitimate 62.5s stamp in a
 * three-minute song, which is what almost every file is. Long recordings are
 * the rarer thing to get wrong.
 */

const TIMESTAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

export type LyricLine = {
  /** Seconds from the start of the track. */
  at: number;
  text: string;
};

/**
 * Turn an LRC file into lines in playing order.
 *
 * Blank lines are kept: a pause between verses is part of how the lyrics read
 * as they scroll, and dropping them would run the verses together.
 */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const raw of lrc.split(/\r?\n/)) {
    TIMESTAMP.lastIndex = 0;
    const stamps: number[] = [];
    let match: RegExpExecArray | null;
    let consumedTo = 0;

    while ((match = TIMESTAMP.exec(raw)) !== null) {
      // Only a run of timestamps at the very start of the line counts. A
      // bracketed time later on belongs to the words, not to the timing.
      if (match.index !== consumedTo) break;
      consumedTo = match.index + match[0].length;

      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      // Two digits are hundredths, three are thousandths.
      const fraction = match[3] ? Number(match[3]) / 10 ** match[3].length : 0;
      stamps.push(minutes * 60 + seconds + fraction);
    }

    if (stamps.length === 0) continue;
    const text = raw.slice(consumedTo).trim();
    for (const at of stamps) lines.push({ at, text });
  }

  return lines.sort((a, b) => a.at - b.at);
}

/**
 * Which line is being sung at `positionSec`, or -1 before the first one.
 *
 * A line stands until the next one starts, so this is the last line whose time
 * has passed. Found by halving the range rather than scanning, because it runs
 * on every position update for lyrics that can be hundreds of lines long.
 */
export function lineAt(lines: LyricLine[], positionSec: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lines[middle]!.at <= positionSec) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return found;
}

/** True when the file has timings worth following rather than a plain text. */
export function isSynced(lrc: string | null): boolean {
  return lrc !== null && parseLrc(lrc).length > 0;
}
