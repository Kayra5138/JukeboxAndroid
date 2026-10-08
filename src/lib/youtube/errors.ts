import { strings, type Strings } from '../i18n/languages.ts';

type Said = keyof Strings['search']['errors'];

/**
 * Which sentence of ours each of the native side's failures is answered with.
 *
 * The codes are `Failure.kt`'s, and are the same whatever the app is speaking
 * and whichever build made them. One that is not listed has no sentence of
 * its own here and is answered with whatever the caller would have said.
 */
const BY_CODE: Readonly<Record<string, Said>> = {
  ERR_YOUTUBE_OUTDATED: 'update',
  ERR_YOUTUBE_REFUSED: 'refused',
  ERR_YOUTUBE_VERIFICATION: 'refused',
  ERR_YOUTUBE_UNAVAILABLE: 'unavailable',
  ERR_YOUTUBE_NETWORK: 'unreachable',
  ERR_YOUTUBE_TIMED_OUT: 'unreachable',
  ERR_YOUTUBE_PLAYLIST_LINK: 'playlistLink',
  ERR_YOUTUBE_NO_PLAYLIST: 'playlistLink',
  ERR_YOUTUBE_PLAYLIST_QUERY: 'playlistLink',
  ERR_YOUTUBE_VIDEO_LINK: 'videoLink',
  ERR_YOUTUBE_NOT_A_VIDEO: 'videoLink',
  ERR_YOUTUBE_QUERY: 'videoLink',
  ERR_DOWNLOAD_QUEUE_FULL: 'queueFull',
  ERR_DOWNLOAD_BATCH: 'queueFull',
};

/**
 * The one failure that is nothing in particular. It comes with the last line
 * of what the extractor said, which is English because the extractor is, and
 * reading that line is still the only way to tell a dropped connection from
 * anything else.
 */
const UNSORTED = 'ERR_DOWNLOAD_FAILED';

/** The native side's name for what went wrong, where it gave one. */
export function failureCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && /^ERR_(YOUTUBE|DOWNLOAD)_/.test(code) ? code : null;
}

/**
 * Native bridge exception envelopes and extractor traces belong in logs, not the UI.
 *
 * A failure is recognised by its code. The wording is only read for a build
 * of the app from before there were codes, and for the one failure whose
 * words are the extractor's own: it is the native side's English either way,
 * which is how the message arrives whatever the app is speaking. Only what is
 * handed back is in [t]'s language.
 */
export function youtubeError(error: unknown, fallback: string, t: Strings = strings()): string {
  const said = t.search.errors;
  const code = failureCode(error);
  if (code && code !== UNSORTED) {
    const known = BY_CODE[code];
    return known ? said[known] : fallback;
  }

  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/does not contain a playlist|paste a YouTube playlist link|Illegal character in/i.test(message)) return said.playlistLink;
  if (/single video link|Use a video link|YouTube video link/i.test(message)) return said.videoLink;
  if (/queue is full|up to 500/i.test(message)) return said.queueFull;
  if (/update Jukebox/i.test(message)) return said.update;
  if (/private|unavailable|does not exist/i.test(message)) return said.unavailable;
  if (/network|resolve|connection|timed out|too long/i.test(message)) return said.unreachable;
  if (/Sign in|verification|\bbot\b|403/i.test(message)) return said.refused;
  return fallback;
}
