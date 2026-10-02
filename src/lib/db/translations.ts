import { db } from './index.ts';

export type StoredTranslation = {
  /** One entry per line of the original, blanks included. */
  lines: string[];
  /** The language it was translated out of, as far as the identifier could tell. */
  source: string | null;
};

/**
 * A translation already made, or null.
 *
 * `count` is the number of lines the caller is holding. A stored translation
 * that does not have exactly that many is thrown away rather than shown: it was
 * made against a different set of words — the lyrics were refetched, or a
 * timed version replaced a plain one — and laying it beside the current ones
 * would put every line against the wrong moment.
 */
export function readTranslation(
  trackId: string,
  target: string,
  count: number
): StoredTranslation | null {
  const row = db().getFirstSync<{ lines: string; source: string | null }>(
    `SELECT lines, source FROM lyric_translations WHERE track_id = ? AND target = ?`,
    trackId,
    target
  );
  if (!row) return null;

  try {
    const lines = JSON.parse(row.lines) as unknown;
    if (!Array.isArray(lines) || lines.length !== count) return null;
    if (!lines.every((line) => typeof line === 'string')) return null;
    return { lines: lines as string[], source: row.source };
  } catch {
    return null;
  }
}

export function writeTranslation(
  trackId: string,
  target: string,
  translation: StoredTranslation,
  at: number
): void {
  db().runSync(
    `INSERT OR REPLACE INTO lyric_translations (track_id, target, source, lines, translated_at)
     VALUES (?, ?, ?, ?, ?)`,
    trackId,
    target,
    translation.source,
    JSON.stringify(translation.lines),
    Math.round(at)
  );
}
