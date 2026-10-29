/**
 * A tape's captions as the words the player shows for a song: timed lines,
 * in the form the lyrics view reads. Nothing here reads anything, so it can
 * be tested.
 */

/** [seconds] as an LRC stamp, `[mm:ss.xx]`, minutes running past sixty for a long talk. */
export function stampOf(seconds: number): string {
  const hundredths = Math.max(0, Math.round(seconds * 100));
  const minutes = Math.floor(hundredths / 6000);
  const rest = hundredths % 6000;
  return `[${String(minutes).padStart(2, '0')}:${String(Math.floor(rest / 100)).padStart(2, '0')}.${String(rest % 100).padStart(2, '0')}]`;
}

/** [lines] as timed text and as plain text; null for none. */
export function asLyrics(lines: readonly { startSec: number; text: string }[]): { synced: string; plain: string } | null {
  const kept = lines.filter((line) => line.text.trim());
  if (kept.length === 0) return null;
  return {
    synced: kept.map((line) => `${stampOf(line.startSec)}${line.text.trim()}`).join('\n'),
    plain: kept.map((line) => line.text.trim()).join('\n'),
  };
}
