import type { Track } from '../../types.ts';

/**
 * Shared scaffolding for the tests that exercise the network clients.
 *
 * The clients are worth testing precisely because they are the part nobody can
 * reproduce by hand — a 400 from a malformed query, a compilation shadowing an
 * album, a minute-long backoff — and all of that is reachable with a stubbed
 * `fetch` and a clock that does not actually wait.
 */

/** A library track with only the fields a lookup reads filled in. */
export function track(fields: Partial<Track> & { title: string }): Track {
  return {
    id: 'track-1',
    uri: 'content://media/external/audio/media/1',
    artist: null,
    album: null,
    artworkUri: null,
    durationSec: 0,
    trackNumber: null,
    filename: null,
    folder: null,
    addedAt: null,
    ...fields,
  };
}

export type Answer = { status?: number; body?: unknown; fail?: 'network' };

/**
 * Replace `fetch` with something that answers from `route` and remembers what
 * it was asked. Returns the list of urls, which is the assertion for most of
 * these tests: what was requested matters more than what came back.
 */
export function stubFetch(route: (url: string) => Answer): string[] {
  const asked: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String(input);
    asked.push(url);
    const answer = route(url);
    // The only way "offline" ever presents itself: fetch rejects outright
    // rather than answering with a status.
    if (answer.fail === 'network') throw new TypeError('Network request failed');
    return new Response(JSON.stringify(answer.body ?? null), {
      status: answer.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  return asked;
}

/**
 * Run `body` with every wait shortened to nothing.
 *
 * The clients pace themselves seconds apart and back off for a minute, which is
 * correct in a player and unbearable in a test. Replacing the global keeps the
 * awaits and their ordering and removes only the waiting.
 */
export async function withoutWaiting<T>(body: () => Promise<T>): Promise<T> {
  const real = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: () => void) => real(handler, 0)) as typeof setTimeout;
  try {
    return await body();
  } finally {
    globalThis.setTimeout = real;
  }
}

/** The query string of a MusicBrainz or LRCLIB url, readable again. */
export function queryOf(url: string): string {
  return decodeURIComponent(url.slice(url.indexOf('?') + 1));
}
