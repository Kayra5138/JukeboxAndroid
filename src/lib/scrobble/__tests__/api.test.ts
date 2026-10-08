import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { isNetworkError, statusOf } from '../../metadata/http.ts';
import { allowanceOf, submitListens, validateToken } from '../api.ts';
import type { Listen } from '../listens.ts';

const TOKEN = 'a-token-nobody-should-see';

type Asked = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** A service that answers once, and remembers exactly what it was sent. */
function service(answer: { status?: number; body?: unknown; headers?: Record<string, string>; fail?: true }) {
  const asked: Asked[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    asked.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });
    if (answer.fail) throw new TypeError('Network request failed');
    return new Response(JSON.stringify(answer.body ?? {}), {
      status: answer.status ?? 200,
      headers: answer.headers,
    });
  }) as typeof fetch;
  return asked;
}

const real = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = real;
});

const listen: Listen = {
  listened_at: 1_700_000_000,
  track_metadata: {
    artist_name: 'Ai Higuchi',
    track_name: 'Akuma no Ko',
    additional_info: { media_player: 'Jukebox', submission_client: 'Jukebox', submission_client_version: '1' },
  },
};

describe('checking a token', () => {
  it('answers with whose it is, having sent it only in the header', async () => {
    const asked = service({ body: { code: 200, message: 'Token valid.', valid: true, user_name: 'kayra' } });
    assert.equal(await validateToken(TOKEN), 'kayra');
    assert.equal(asked[0]!.url, 'https://api.listenbrainz.org/1/validate-token');
    assert.equal(asked[0]!.headers.authorization, `Token ${TOKEN}`);
    assert.match(asked[0]!.headers['user-agent']!, /^Jukebox\//);
  });

  it('answers with nobody for a token the service does not know', async () => {
    service({ body: { code: 200, message: 'Token invalid.', valid: false } });
    assert.equal(await validateToken(TOKEN), null);
  });

  it('fails, rather than calling the token wrong, when nothing answered', async () => {
    service({ fail: true });
    await assert.rejects(validateToken(TOKEN), (error) => isNetworkError(error));
  });
});

describe('sending listens', () => {
  it('posts them as the service wants them and reads what it may send next', async () => {
    const asked = service({
      body: { status: 'ok' },
      headers: { 'X-RateLimit-Remaining': '29', 'X-RateLimit-Reset-In': '4' },
    });
    assert.deepEqual(await submitListens(TOKEN, 'import', [listen, listen]), { remaining: 29, resetInSec: 4 });
    assert.equal(asked[0]!.url, 'https://api.listenbrainz.org/1/submit-listens');
    assert.equal(asked[0]!.method, 'POST');
    assert.equal(asked[0]!.headers.authorization, `Token ${TOKEN}`);
    assert.equal(asked[0]!.headers['content-type'], 'application/json');
    assert.deepEqual(asked[0]!.body, { listen_type: 'import', payload: [listen, listen] });
  });

  it('knows nothing about the allowance when the answer does not say', async () => {
    service({ body: { status: 'ok' } });
    assert.deepEqual(await submitListens(TOKEN, 'single', [listen]), { remaining: null, resetInSec: null });
  });

  it('raises a refusal with its status and with when to come back', async () => {
    service({ status: 429, headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset-In': '12' } });
    await assert.rejects(submitListens(TOKEN, 'single', [listen]), (error) => {
      assert.equal(statusOf(error), 429);
      assert.deepEqual(allowanceOf(error), { remaining: 0, resetInSec: 12 });
      return true;
    });
  });

  it('never puts the token in an address or in the words of a failure', async () => {
    for (const answer of [{ status: 401 }, { status: 500 }, { fail: true as const }]) {
      const asked = service(answer);
      await assert.rejects(submitListens(TOKEN, 'single', [listen]), (error) => {
        assert.equal(String(error).includes(TOKEN), false);
        assert.equal(JSON.stringify(error, Object.getOwnPropertyNames(error)).includes(TOKEN), false);
        return true;
      });
      assert.equal(asked[0]!.url.includes(TOKEN), false);
    }
  });
});
