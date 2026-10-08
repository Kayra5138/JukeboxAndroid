import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildListen,
  BYTES_PER_REQUEST,
  bytesOf,
  chunk,
  joinsQueue,
  LISTENS_PER_REQUEST,
  SERVICE_LIMITS,
  tokenIn,
  type ShownNames,
} from '../listens.ts';

/** A moment the service accepts: some time in 2023, in milliseconds. */
const AT = 1_700_000_000_000;
const NOW = AT + 60_000;

const heard = (extra: Partial<{ startedAt: number; title: string; artist: string | null }> = {}) => ({
  startedAt: AT,
  title: 'akuma_no_ko',
  artist: 'ai higuchi' as string | null,
  ...extra,
});
const shown = (extra: Partial<ShownNames> = {}): ShownNames => ({
  title: 'Akuma no Ko',
  artist: 'Ai Higuchi',
  album: 'Saiaku Saiai',
  durationSec: 225.4,
  ...extra,
});

describe('a listen made from a row of history', () => {
  it('goes under the names on screen, signed by the app', () => {
    assert.deepEqual(buildListen(heard(), shown(), '0.30.6', NOW), {
      listened_at: 1_700_000_000,
      track_metadata: {
        artist_name: 'Ai Higuchi',
        track_name: 'Akuma no Ko',
        release_name: 'Saiaku Saiai',
        additional_info: {
          media_player: 'Jukebox',
          submission_client: 'Jukebox',
          submission_client_version: '0.30.6',
          duration_ms: 225_400,
        },
      },
    });
  });

  it('is dated by when the listen started, in whole seconds', () => {
    assert.equal(buildListen(heard({ startedAt: AT + 999 }), shown(), '1', NOW)?.listened_at, 1_700_000_000);
  });

  it('falls back to what the history wrote down for a track that has left the library', () => {
    const listen = buildListen(heard(), undefined, '1', NOW);
    assert.equal(listen?.track_metadata.track_name, 'akuma_no_ko');
    assert.equal(listen?.track_metadata.artist_name, 'ai higuchi');
    assert.equal('release_name' in listen!.track_metadata, false);
    assert.equal('duration_ms' in listen!.track_metadata.additional_info, false);
  });

  it('leaves out an album or a length it does not have, rather than sending nothing as one', () => {
    const listen = buildListen(heard(), shown({ album: '  ', durationSec: 0 }), '1', NOW)!;
    assert.equal('release_name' in listen.track_metadata, false);
    assert.equal('duration_ms' in listen.track_metadata.additional_info, false);
    // Nothing null anywhere in it, which is what the body is made from.
    assert.equal(JSON.stringify(listen).includes('null'), false);
  });

  it('is not made for a track with no artist anywhere', () => {
    assert.equal(buildListen(heard({ artist: null }), shown({ artist: null }), '1', NOW), null);
    assert.equal(buildListen(heard({ artist: '  ' }), undefined, '1', NOW), null);
    assert.equal(buildListen(heard({ title: '' }), shown({ title: null }), '1', NOW), null);
  });

  it('takes an artist from the history when the screen has none', () => {
    assert.equal(
      buildListen(heard(), shown({ artist: null }), '1', NOW)?.track_metadata.artist_name,
      'ai higuchi'
    );
  });

  it('is not made for a moment the service would refuse', () => {
    const tooEarly = (SERVICE_LIMITS.earliestListen - 1) * 1000;
    assert.equal(buildListen(heard({ startedAt: tooEarly }), shown(), '1', NOW), null);
    assert.equal(buildListen(heard({ startedAt: NOW + 5000 }), shown(), '1', NOW), null);
    assert.equal(buildListen(heard({ startedAt: Number.NaN }), shown(), '1', NOW), null);
  });

  it('is not made heavier than one listen is allowed to be', () => {
    assert.equal(buildListen(heard(), shown({ title: 'あ'.repeat(4000) }), '1', NOW), null);
    assert.notEqual(buildListen(heard(), shown({ title: 'あ'.repeat(400) }), '1', NOW), null);
  });

  it('leaves out a length longer than the service believes in', () => {
    const listen = buildListen(heard(), shown({ durationSec: 30 * 24 * 3600 }), '1', NOW)!;
    assert.equal('duration_ms' in listen.track_metadata.additional_info, false);
  });
});

describe('counting bytes', () => {
  it('agrees with the encoder about every kind of character', () => {
    for (const text of ['plain', 'İstanbul’da', '悪魔の子', 'a😀b', '']) {
      assert.equal(bytesOf(text), new TextEncoder().encode(text).length, text);
    }
  });
});

describe('cutting listens into requests', () => {
  const numbers = (count: number) => Array.from({ length: count }, (_, index) => index);

  it('stays well inside what the service allows', () => {
    assert.ok(LISTENS_PER_REQUEST <= SERVICE_LIMITS.listensPerRequest / 2);
    assert.ok(BYTES_PER_REQUEST <= SERVICE_LIMITS.bytesPerRequest / 2);
  });

  it('cuts by count, keeping every one in order', () => {
    const chunks = chunk(numbers(450), 200, 1_000_000);
    assert.deepEqual(chunks.map((each) => each.length), [200, 200, 50]);
    assert.deepEqual(chunks.flat(), numbers(450));
  });

  it('cuts by weight when that is reached first', () => {
    // A hundred bytes each and one for the comma, in a body that starts at 64.
    const chunks = chunk(numbers(10), 200, 64 + 101 * 3, () => 100);
    assert.deepEqual(chunks.map((each) => each.length), [3, 3, 3, 1]);
    assert.deepEqual(chunks.flat(), numbers(10));
  });

  it('weighs what is really sent, which is bytes and not letters', () => {
    const wide = { name: '悪'.repeat(100) };
    const narrow = { name: 'a'.repeat(100) };
    assert.equal(chunk([wide, wide], 200, 500).length, 2);
    assert.equal(chunk([narrow, narrow], 200, 500).length, 1);
  });

  it('gives something too heavy a request of its own rather than losing it', () => {
    assert.deepEqual(chunk([1, 2, 3], 200, 100, (item) => (item === 2 ? 5000 : 1)), [[1], [2], [3]]);
  });

  it('makes nothing of nothing', () => {
    assert.deepEqual(chunk([]), []);
  });
});

describe('whether a listen just recorded is queued', () => {
  const on = { connected: true, sending: true, since: 1000 };

  it('is, when it started after sending was switched on', () => {
    assert.equal(joinsQueue(on, 1000), true);
    assert.equal(joinsQueue(on, 5000), true);
  });

  it('is not, when it was already playing at that moment', () => {
    assert.equal(joinsQueue(on, 999), false);
  });

  it('is not without a token, or with the switch off, whatever the moment', () => {
    assert.equal(joinsQueue({ ...on, connected: false }, 5000), false);
    assert.equal(joinsQueue({ ...on, sending: false }, 5000), false);
    assert.equal(joinsQueue({ ...on, since: null }, 5000), false);
  });
});

describe('tokenIn', () => {
  const TOKEN = '3f2b8c1a-9d4e-4f6a-8b7c-0123456789ab';

  it('takes a token as it is', () => {
    assert.equal(tokenIn(TOKEN), TOKEN);
  });

  it('finds it among what a page and a clipboard wrap it in', () => {
    assert.equal(tokenIn(`  ${TOKEN}\n`), TOKEN);
    assert.equal(tokenIn(`Token ${TOKEN}`), TOKEN);
    assert.equal(tokenIn(`User token: "${TOKEN}".`), TOKEN);
  });

  it('is not put off by characters that cannot be seen', () => {
    // A zero-width space on the end is what a copy from some pages carries,
    // and in a header it stops the request from ever being sent.
    assert.equal(tokenIn(`${TOKEN}\u200b`), TOKEN);
    assert.equal(tokenIn(`\ufeff${TOKEN}`), TOKEN);
  });

  it('says there is none where there is none', () => {
    assert.equal(tokenIn(''), null);
    assert.equal(tokenIn('my-token'), null);
    assert.equal(tokenIn('3f2b8c1a-9d4e-4f6a-8b7c'), null);
  });
});
