import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lookupTrack as lookupItunes, REQUEST_INTERVAL_MS as APPLE_MS } from '../itunes.ts';
import { lookupTrack as lookupMusicBrainz } from '../musicbrainz.ts';
import { track, type Answer } from './support.ts';

/** What MusicBrainz asks for, with the headroom the client gives it. */
const MUSICBRAINZ_MS = 1_400;

/**
 * Runs `body` on a clock that jumps instead of waiting, and answers when each
 * request went out.
 *
 * The clients take their turns from pacers on the real clock, so the real
 * clock is what is stood in for: a timer fires at once and moves the time on
 * by what it was set for. Nothing is slept through, and the gap between two
 * requests is exactly the wait the client asked for.
 */
async function timed(route: (url: string) => Answer, body: () => Promise<unknown>): Promise<number[]> {
  const real = { setTimeout: globalThis.setTimeout, now: Date.now, fetch: globalThis.fetch };
  let now = real.now();
  const went: number[] = [];

  Date.now = () => now;
  globalThis.setTimeout = ((handler: () => void, ms = 0) => {
    const due = now + ms;
    return real.setTimeout(() => {
      now = Math.max(now, due);
      handler();
    }, 0);
  }) as typeof setTimeout;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    went.push(now);
    const answer = route(String(input));
    return new Response(JSON.stringify(answer.body ?? null), { status: answer.status ?? 200 });
  }) as typeof fetch;

  try {
    await body();
  } finally {
    Date.now = real.now;
    globalThis.setTimeout = real.setTimeout;
    globalThis.fetch = real.fetch;
  }
  return went;
}

const gaps = (times: number[]) => times.slice(1).map((time, index) => time - times[index]!);

describe('every request a client makes', () => {
  it('to MusicBrainz waits its turn: the artist, the recording, the release', async () => {
    const went = await timed(
      (url) => {
        if (url.includes('/artist?')) return { body: { artists: [{ id: 'a-paced', name: 'Paced', score: 100 }] } };
        if (url.includes('/recording?')) {
          return {
            body: {
              recordings: [
                { id: 'r', title: 'Song', score: 100, releases: [{ 'release-group': { id: 'rg-paced' } }] },
              ],
            },
          };
        }
        return { body: {} };
      },
      () => lookupMusicBrainz(track({ artist: 'Paced Artist', title: 'Song' }))
    );

    // Who they are, their genres, the recording, the release it is on.
    assert.equal(went.length, 4);
    assert.ok(gaps(went).every((gap) => gap >= MUSICBRAINZ_MS), String(gaps(went)));
  });

  it('to MusicBrainz waits its turn again when it is asked a second time after a 503', async () => {
    let refusals = 0;
    const went = await timed(
      (url) => {
        if (url.includes('/artist?')) {
          // Told to slow down twice before it answers.
          if ((refusals += 1) <= 2) return { status: 503 };
          return { body: { artists: [] } };
        }
        return { body: { recordings: [] } };
      },
      () => lookupMusicBrainz(track({ artist: 'Refused Twice', title: 'Song' }))
    );

    // Three goes at the artist, then the looser search for the recording.
    assert.equal(went.length, 4);
    assert.ok(gaps(went).every((gap) => gap >= MUSICBRAINZ_MS), String(gaps(went)));
  });

  it('to Apple waits its turn, storefront after storefront', async () => {
    const went = await timed(
      () => ({ body: { results: [] } }),
      () => lookupItunes(track({ artist: 'Nobody Sells', title: 'Song' }))
    );

    assert.equal(went.length, 3);
    assert.ok(gaps(went).every((gap) => gap >= APPLE_MS), String(gaps(went)));
  });

  it('keeps Apple’s interval between two lookups going on at once', async () => {
    const went = await timed(
      () => ({ body: { results: [] } }),
      () =>
        Promise.all([
          lookupItunes(track({ artist: 'One Of Two', title: 'Song' })),
          lookupItunes(track({ artist: 'Two Of Two', title: 'Song' })),
        ])
    );

    assert.equal(went.length, 6);
    assert.ok(gaps(went).every((gap) => gap >= APPLE_MS), String(gaps(went)));
  });
});
