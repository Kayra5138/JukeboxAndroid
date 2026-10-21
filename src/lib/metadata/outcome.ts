import type { Strings } from '../i18n/languages.ts';
import type { LyricsResult } from '../lyrics/bulk.ts';
import type { EnrichResult } from './pipeline.ts';

const SERVICE_NAMES = { musicbrainz: 'MusicBrainz', apple: 'Apple' } as const;

/** How a run ended, as `bulk.ts` keeps it; here without the store it lives in. */
export type Ended = { result: EnrichResult } | { lyrics: LyricsResult } | { error: string };

/**
 * The line that says how a run ended, when that is worth saying, or null.
 *
 * In one place because two screens say it: the Tags screen under its
 * buttons, and the library once a run begun from its selection is over.
 * [kind] is what the run was finding; a run for covers alone that found none
 * says so, where an ordinary lookup finding none has its count to say it.
 */
export function describeOutcome(
  kind: 'details' | 'covers' | 'lyrics',
  last: Ended,
  t: Strings
): string | null {
  const said = t.details.library;
  if ('error' in last) return last.error || said.stoppedUnexpectedly;
  if ('lyrics' in last) {
    const run = last.lyrics;
    if (run.stopped === 'offline') return t.details.selection.lyricsOffline;
    // Said even of a run that was stopped: what was found before the stop
    // is kept, and is worth knowing about.
    return t.details.selection.lyricsFound(run.found, run.wanted, run.had);
  }
  const result = last.result;
  if (result.stopped === 'offline') return said.stoppedOffline(result.matched);
  if (result.unreachable) return said.serviceUnreachable(SERVICE_NAMES[result.unreachable]);
  if (result.coversSaved) return said.coversSaved(result.coversSaved);
  return kind === 'covers' && !result.cancelled ? t.details.selection.coversNone : null;
}
