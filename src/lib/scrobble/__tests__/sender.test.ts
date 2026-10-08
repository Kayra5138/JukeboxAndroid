import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { httpError, networkError } from '../../metadata/http.ts';
import type { Allowance } from '../api.ts';
import type { Listen, ListenType, ShownNames } from '../listens.ts';
import { BETWEEN_REQUESTS_MS, drain, retryAfterMs, type SenderDeps } from '../sender.ts';
import type { Waiting } from '../store.ts';

/** Some time in 2023, which the service accepts as a moment to have listened. */
const AT = 1_700_000_000_000;
const NOW = AT + 10_000_000;

type Row = Waiting & { now: 'queued' | 'past' | 'sent' | 'skipped' | 'gone' };

/** A queue held in a list, in place of SQLite. */
function queue(rows: Partial<Row>[]) {
  const all: Row[] = rows.map((row, index) => ({
    id: index + 1,
    trackId: `t${index + 1}`,
    title: `song ${index + 1}`,
    artist: 'Somebody',
    startedAt: AT + index * 1000,
    state: 'past',
    ...row,
    now: row.state ?? 'past',
  }));
  return {
    all,
    waiting: (limit: number): Waiting[] =>
      all
        .filter((row) => row.now === 'queued' || row.now === 'past')
        .sort((a, b) => Number(a.now === 'past') - Number(b.now === 'past') || a.id - b.id)
        .slice(0, limit)
        .map(({ now, ...row }) => ({ ...row, state: now as 'queued' | 'past' })),
    mark: (ids: readonly number[], state: 'sent' | 'skipped') => {
      for (const id of ids) all.find((row) => row.id === id)!.now = state;
    },
    /** What stopping an upload of the history does. */
    dropPast: () => {
      for (const row of all) if (row.now === 'past') row.now = 'gone';
    },
    states: () => all.map((row) => row.now),
  };
}

type Sent = { type: ListenType; payload: Listen[] };
type Reply = Partial<Allowance> | Error | ((sent: Sent) => Partial<Allowance> | Error);

const refusal = (status: number, headers: Record<string, string> = {}) =>
  Object.assign(httpError('ListenBrainz', status), { headers: new Headers(headers) });

/**
 * A run against a service that answers from a script, one reply a request,
 * and then accepts everything. No wait is waited; each is written down.
 */
function setup(rows: Partial<Row>[], replies: Reply[] = [], extra: Partial<SenderDeps> = {}) {
  const store = queue(rows);
  const requests: Sent[] = [];
  const waits: number[] = [];
  let progressed = 0;
  const deps: SenderDeps = {
    store,
    shown: async () => new Map<string, ShownNames>(),
    submit: async (type, payload) => {
      const sent = { type, payload };
      requests.push(sent);
      let reply = replies.shift() ?? {};
      if (typeof reply === 'function') reply = reply(sent);
      if (reply instanceof Error) throw reply;
      return { remaining: 10, resetInSec: 5, ...reply };
    },
    version: '0.30.6',
    now: () => NOW,
    wait: async (ms) => void waits.push(ms),
    onProgress: () => void (progressed += 1),
    ...extra,
  };
  return { store, requests, waits, deps, progress: () => progressed };
}

describe('sending what is waiting', () => {
  it('has nothing to do and asks nothing when nothing is waiting', async () => {
    const { deps, requests } = setup([]);
    assert.deepEqual(await drain(deps), { kind: 'done', sent: 0, skipped: 0 });
    assert.equal(requests.length, 0);
  });

  it('sends the one listen just heard as a single', async () => {
    const { deps, requests, store } = setup([{ state: 'queued' }]);
    assert.deepEqual(await drain(deps), { kind: 'done', sent: 1, skipped: 0 });
    assert.equal(requests.length, 1);
    assert.equal(requests[0]!.type, 'single');
    assert.equal(requests[0]!.payload.length, 1);
    assert.equal(requests[0]!.payload[0]!.listened_at, AT / 1000);
    assert.deepEqual(store.states(), ['sent']);
  });

  it('sends several that piled up, and one old one, as an import', async () => {
    const several = setup([{ state: 'queued' }, { state: 'queued' }]);
    await drain(several.deps);
    assert.deepEqual(several.requests.map((each) => [each.type, each.payload.length]), [['import', 2]]);

    const old = setup([{ state: 'past' }]);
    await drain(old.deps);
    assert.deepEqual(old.requests.map((each) => each.type), ['import']);
  });

  it('goes under the names on screen where the track is still in the library', async () => {
    const { deps, requests } = setup([{ trackId: 'a' }, { trackId: 'b', title: 'as it was heard' }], [], {
      shown: async (ids) => {
        assert.deepEqual(ids, ['a', 'b']);
        return new Map([['a', { title: 'Corrected', artist: 'Right Name', album: 'Record', durationSec: 200 }]]);
      },
    });
    await drain(deps);
    const [first, second] = requests[0]!.payload;
    assert.equal(first!.track_metadata.track_name, 'Corrected');
    assert.equal(first!.track_metadata.artist_name, 'Right Name');
    assert.equal(first!.track_metadata.release_name, 'Record');
    assert.equal(second!.track_metadata.track_name, 'as it was heard');
  });

  it('sends a long history in requests of two hundred, a second apart, each row once', async () => {
    const { deps, requests, waits, store, progress } = setup(Array.from({ length: 450 }, () => ({})));
    assert.deepEqual(await drain(deps), { kind: 'done', sent: 450, skipped: 0 });
    assert.deepEqual(requests.map((each) => each.payload.length), [200, 200, 50]);
    assert.ok(requests.every((each) => each.type === 'import'));
    const moments = requests.flatMap((each) => each.payload.map((listen) => listen.listened_at));
    assert.equal(new Set(moments).size, 450);
    assert.ok(store.states().every((state) => state === 'sent'));
    // A gap before the second and the third, and none spent after the last.
    assert.deepEqual(waits, [BETWEEN_REQUESTS_MS, BETWEEN_REQUESTS_MS]);
    assert.equal(progress(), 3);
  });

  it('sets aside a track with no artist and sends the rest', async () => {
    const { deps, requests, store } = setup([{ artist: null }, {}, { artist: '' }]);
    assert.deepEqual(await drain(deps), { kind: 'done', sent: 1, skipped: 2 });
    assert.equal(requests[0]!.payload.length, 1);
    assert.deepEqual(store.states(), ['skipped', 'sent', 'skipped']);
  });

  it('asks nothing of the service when nothing waiting can be sent', async () => {
    const { deps, requests } = setup([{ artist: null }]);
    assert.deepEqual(await drain(deps), { kind: 'done', sent: 0, skipped: 1 });
    assert.equal(requests.length, 0);
  });
});

describe('being told no', () => {
  it('stops at a 401 and leaves the listens waiting', async () => {
    const { deps, requests, store } = setup([{}, {}], [refusal(401)]);
    assert.deepEqual(await drain(deps), { kind: 'revoked', sent: 0, skipped: 0, said: null });
    assert.equal(requests.length, 1);
    assert.deepEqual(store.states(), ['past', 'past']);
  });

  it('hands on what the service gave as its reason for a 401', async () => {
    // The status is the same for a dead token and for an account the service
    // will not take listens from, and only its words tell them apart.
    const refused = Object.assign(refusal(401), { said: 'The account is not allowed to submit.' });
    const { deps } = setup([{}], [refused]);
    const outcome = await drain(deps);
    assert.equal(outcome.kind, 'revoked');
    assert.equal(outcome.said, 'The account is not allowed to submit.');
  });

  it('waits as long as a 429 says and then sends the same listens', async () => {
    const { deps, requests, waits, store } = setup(
      [{}, {}],
      [refusal(429, { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset-In': '7' })]
    );
    assert.deepEqual(await drain(deps), { kind: 'done', sent: 2, skipped: 0 });
    assert.deepEqual(waits, [7000]);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1]!.payload, requests[0]!.payload);
    assert.deepEqual(store.states(), ['sent', 'sent']);
  });

  it('waits a while after a 429 that does not say how long', async () => {
    const { deps, waits } = setup([{}], [refusal(429)]);
    await drain(deps);
    assert.deepEqual(waits, [10_000]);
  });

  it('gives up for now when it keeps being told to slow down', async () => {
    const hurry = () => refusal(429, { 'X-RateLimit-Reset-In': '1' });
    const { deps, requests, store } = setup([{}], [hurry(), hurry(), hurry()]);
    assert.deepEqual(await drain(deps), { kind: 'later', trouble: 'busy', sent: 0, skipped: 0 });
    assert.equal(requests.length, 3);
    assert.deepEqual(store.states(), ['past']);
  });

  it('goes away rather than hold a timer open for a very long wait', async () => {
    const { deps, waits } = setup([{}], [refusal(429, { 'X-RateLimit-Reset-In': '3600' })]);
    assert.deepEqual(await drain(deps), { kind: 'later', trouble: 'busy', sent: 0, skipped: 0 });
    assert.deepEqual(waits, []);
  });

  it('pauses before the allowance is spent rather than after being refused', async () => {
    const { deps, requests, waits } = setup(
      Array.from({ length: 250 }, () => ({})),
      [{ remaining: 0, resetInSec: 9 }]
    );
    assert.deepEqual(await drain(deps), { kind: 'done', sent: 250, skipped: 0 });
    assert.equal(requests.length, 2);
    assert.deepEqual(waits, [9000]);
  });

  it('does not wait for an allowance it has no further use for', async () => {
    const { deps, waits } = setup([{}], [{ remaining: 0, resetInSec: 9 }]);
    assert.deepEqual(await drain(deps), { kind: 'done', sent: 1, skipped: 0 });
    assert.deepEqual(waits, []);
  });

  it('keeps everything queued when the service is down', async () => {
    const { deps, requests, store } = setup([{ state: 'queued' }, {}], [refusal(503)]);
    assert.deepEqual(await drain(deps), { kind: 'later', trouble: 'server', sent: 0, skipped: 0 });
    assert.equal(requests.length, 1);
    assert.deepEqual(store.states(), ['queued', 'past']);
  });

  it('keeps everything queued when there is no network', async () => {
    const { deps, store } = setup([{ state: 'queued' }], [networkError('ListenBrainz could not be reached')]);
    assert.deepEqual(await drain(deps), { kind: 'later', trouble: 'offline', sent: 0, skipped: 0 });
    assert.deepEqual(store.states(), ['queued']);
  });

  it('keeps what went before the network was lost, and no more', async () => {
    const { deps, store } = setup(
      Array.from({ length: 300 }, () => ({})),
      [{}, networkError('ListenBrainz did not answer in time')]
    );
    assert.deepEqual(await drain(deps), { kind: 'later', trouble: 'offline', sent: 200, skipped: 0 });
    assert.equal(store.states().filter((state) => state === 'sent').length, 200);
    assert.equal(store.states().filter((state) => state === 'past').length, 100);
  });

  it('sends nothing when the library cannot be read', async () => {
    const { deps, requests, store } = setup([{}], [], {
      shown: async () => {
        throw new Error('no permission');
      },
    });
    assert.deepEqual(await drain(deps), { kind: 'later', trouble: 'failed', sent: 0, skipped: 0 });
    assert.equal(requests.length, 0);
    assert.deepEqual(store.states(), ['past']);
  });

  it('finds the one listen a 400 was about, sets it aside and sends the others', async () => {
    const bad = (sent: Sent) =>
      sent.payload.some((listen) => listen.track_metadata.track_name === 'song 3') ? refusal(400) : {};
    const { deps, store } = setup(
      Array.from({ length: 5 }, () => ({})),
      Array.from({ length: 12 }, () => bad)
    );
    assert.deepEqual(await drain(deps), { kind: 'done', sent: 4, skipped: 1 });
    assert.deepEqual(store.states(), ['sent', 'sent', 'skipped', 'sent', 'sent']);
  });
});

describe('being stopped and starting again', () => {
  it('ends an upload of the history at the request it was in, which still counts', async () => {
    const run = setup(Array.from({ length: 450 }, () => ({})), [
      () => {
        // Stop is pressed while the first request is in the air.
        run.store.dropPast();
        return {};
      },
    ]);
    assert.deepEqual(await drain(run.deps), { kind: 'done', sent: 200, skipped: 0 });
    assert.equal(run.requests.length, 1);
    assert.equal(run.store.states().filter((state) => state === 'sent').length, 200);
    assert.equal(run.store.states().filter((state) => state === 'gone').length, 250);
  });

  it('still sends what was just heard once the history has been taken back', async () => {
    const run = setup([{ state: 'queued' }, {}, {}]);
    run.store.dropPast();
    await drain(run.deps);
    assert.deepEqual(run.store.states(), ['sent', 'gone', 'gone']);
    assert.deepEqual(run.requests.map((each) => each.type), ['single']);
  });

  it('picks up where it left off, sending nothing a second time', async () => {
    const first = setup(Array.from({ length: 450 }, () => ({})), [{}, refusal(500)]);
    assert.equal((await drain(first.deps)).kind, 'later');

    // The same queue, a later run: the service is back.
    const again = setup([]);
    const outcome = await drain({ ...again.deps, store: first.store });
    assert.deepEqual(outcome, { kind: 'done', sent: 250, skipped: 0 });

    const everything = [...first.requests.slice(0, 1), ...again.requests].flatMap((each) =>
      each.payload.map((listen) => listen.listened_at)
    );
    assert.equal(everything.length, 450);
    assert.equal(new Set(everything).size, 450);
  });

  it('writes nothing down once the run has been abandoned', async () => {
    const abandon = new AbortController();
    const { deps, store, requests } = setup(
      [{}, {}],
      [
        () => {
          abandon.abort();
          return {};
        },
      ],
      { signal: abandon.signal }
    );
    assert.deepEqual(await drain(deps), { kind: 'stopped', sent: 0, skipped: 0 });
    assert.equal(requests.length, 1);
    assert.deepEqual(store.states(), ['past', 'past']);
  });

  it('does not start at all when it was abandoned beforehand', async () => {
    const abandon = new AbortController();
    abandon.abort();
    const { deps, requests } = setup([{}], [], { signal: abandon.signal });
    assert.equal((await drain(deps)).kind, 'stopped');
    assert.equal(requests.length, 0);
  });
});

describe('how long to leave it', () => {
  it('doubles from a minute and stops at half an hour', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(retryAfterMs), [
      60_000,
      120_000,
      240_000,
      480_000,
      960_000,
      1_800_000,
      1_800_000,
    ]);
  });
});
