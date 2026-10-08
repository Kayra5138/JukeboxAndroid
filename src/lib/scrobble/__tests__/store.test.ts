import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import { carried, staysThroughReplace } from '../../backup/format.ts';
import { migrate, type MigrationTarget } from '../../db/migrations.ts';
import { KEYS, scrobbleStore, type ScrobbleDb } from '../store.ts';

/** A real database with the app's schema, since the queue is its queries. */
function open() {
  const raw = new DatabaseSync(':memory:');
  const target: MigrationTarget = Object.assign(raw, {
    execSync: (sql: string) => raw.exec(sql),
    getFirstSync: <T,>(sql: string) => (raw.prepare(sql).get() as T) ?? null,
  });
  migrate(target);
  const database: ScrobbleDb = {
    all: <T,>(sql: string, ...params: (string | number | null)[]) =>
      raw.prepare(sql).all(...params).map((row) => ({ ...row })) as T[],
    run: (sql, ...params) => {
      raw.prepare(sql).run(...params);
    },
    transaction: (work) => {
      raw.exec('BEGIN');
      try {
        work();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };

  /** Records a listen the way the history does, and answers with its row number. */
  const play = (track: string, startedAt: number, artist: string | null = 'Somebody'): number => {
    const made = raw
      .prepare(
        `INSERT INTO plays (track_id, title, artist, filename, started_at, seconds_played, completed)
         VALUES (?, ?, ?, NULL, ?, 120, 1)`
      )
      .run(track, `song ${track}`, artist, startedAt);
    return Number(made.lastInsertRowid);
  };
  const settings = () =>
    Object.fromEntries(
      database.all<{ key: string; value: string }>('SELECT key, value FROM settings').map((row) => [row.key, row.value])
    );
  return { raw, database, store: scrobbleStore(database), play, settings };
}

describe('the connection', () => {
  it('is nothing at all until a token is held', () => {
    const { store } = open();
    assert.deepEqual(store.connection(), {
      connected: false,
      user: null,
      sending: false,
      since: null,
      lastSentAt: null,
      trouble: null,
      said: null,
    });
    assert.equal(store.token(), null);
  });

  it('starts with sending off, even with a token', () => {
    const { store, play } = open();
    store.connect('secret', 'kayra');
    assert.equal(store.connection().connected, true);
    assert.equal(store.connection().user, 'kayra');
    assert.equal(store.connection().sending, false);
    assert.equal(store.heard(play('1', 5000), 5000, 6000), false);
    assert.deepEqual(store.waiting(10), []);
  });

  it('keeps every key it writes out of a backup, in both directions', () => {
    const { store, settings } = open();
    store.connect('secret', 'kayra');
    store.setSending(true, 1000);
    store.sent(2000);
    store.refused('Not allowed.');
    const written = Object.keys(settings());
    assert.deepEqual(written.sort(), Object.values(KEYS).sort());
    for (const key of written) {
      assert.equal(carried(key), false, key);
      assert.equal(staysThroughReplace(key), true, key);
    }
  });

  it('forgets everything on disconnecting, and nothing else', () => {
    const { raw, store, play, settings } = open();
    raw.exec(`INSERT INTO settings (key, value) VALUES ('player:repeat', 'all')`);
    store.connect('secret', 'kayra');
    store.setSending(true, 1000);
    store.heard(play('1', 5000), 5000, 6000);
    store.mark([play('2', 10)], 'sent', 7000);

    store.disconnect();

    assert.deepEqual(settings(), { 'player:repeat': 'all' });
    assert.deepEqual(store.counts(), { queued: 0, past: 0, sent: 0, skipped: 0, untouched: 2 });
    assert.equal(raw.prepare('SELECT COUNT(*) AS found FROM plays').get()!.found, 2);
  });

  it('keeps the token when it is the account that was refused, with the reason', () => {
    // A 401 for an account the service still knows the token of. Throwing the
    // token away for it signed somebody out a moment after they connected.
    const { store, play, settings } = open();
    store.connect('secret', 'kayra');
    store.setSending(true, 1000);
    store.heard(play('1', 5000), 5000, 6000);

    store.refused('The account is not allowed to submit.');

    assert.equal(settings()[KEYS.token], 'secret');
    assert.equal(store.connection().connected, true);
    assert.equal(store.connection().trouble, 'refused');
    assert.equal(store.connection().said, 'The account is not allowed to submit.');

    // Once something goes through, there is nothing left to say about it.
    store.sent(7000);
    assert.equal(store.connection().trouble, null);
    assert.equal(store.connection().said, null);
  });

  it('throws a revoked token away and keeps the queue for whoever pastes the next', () => {
    const { store, play, settings } = open();
    store.connect('secret', 'kayra');
    store.setSending(true, 1000);
    const waiting = play('1', 5000);
    store.heard(waiting, 5000, 6000);

    store.revoke();

    assert.equal(KEYS.token in settings(), false);
    assert.equal(store.connection().connected, false);
    assert.equal(store.connection().trouble, 'revoked');
    assert.equal(store.connection().user, 'kayra');
    // Nothing joins the queue while there is no token.
    assert.equal(store.heard(play('2', 8000), 8000, 9000), false);

    store.connect('another', 'kayra');
    assert.equal(store.connection().trouble, null);
    assert.equal(store.connection().sending, false);
    assert.deepEqual(store.waiting(10).map((row) => row.id), [waiting]);
  });

  it('forgets what was sent when the account is a different one', () => {
    const { store, play } = open();
    store.connect('secret', 'kayra');
    store.mark([play('1', 10)], 'sent', 20);
    store.revoke();
    store.connect('other', 'somebody-else');
    assert.equal(store.counts().sent, 0);
    assert.equal(store.counts().untouched, 1);
  });

  it('clears the trouble when something goes through', () => {
    const { store } = open();
    store.connect('secret', 'kayra');
    store.troubled('server');
    assert.equal(store.connection().trouble, 'server');
    store.sent(4000);
    assert.equal(store.connection().trouble, null);
    assert.equal(store.connection().lastSentAt, 4000);
  });
});

describe('the queue', () => {
  function connected() {
    const opened = open();
    opened.store.connect('secret', 'kayra');
    return opened;
  }

  it('takes what starts after the switch went on, and not what was already playing', () => {
    const { store, play } = connected();
    const before = play('1', 900);
    store.setSending(true, 1000);
    assert.equal(store.heard(before, 900, 1200), false);
    const after = play('2', 1500);
    assert.equal(store.heard(after, 1500, 1700), true);
    assert.deepEqual(store.waiting(10), [
      { id: after, trackId: '2', title: 'song 2', artist: 'Somebody', startedAt: 1500, state: 'queued' },
    ]);
    assert.deepEqual(store.counts(), { queued: 1, past: 0, sent: 0, skipped: 0, untouched: 1 });
  });

  it('stops taking listens when the switch goes off, and keeps what it had', () => {
    const { store, play } = connected();
    store.setSending(true, 1000);
    const kept = play('1', 2000);
    store.heard(kept, 2000, 2100);
    store.setSending(false, 3000);
    assert.equal(store.heard(play('2', 4000), 4000, 4100), false);
    assert.deepEqual(store.waiting(10).map((row) => row.id), [kept]);
  });

  it('moves the line when the switch is turned on again', () => {
    const { store, play } = connected();
    store.setSending(true, 1000);
    store.setSending(false, 2000);
    const between = play('1', 2500);
    store.setSending(true, 3000);
    assert.equal(store.heard(between, 2500, 3100), false);
    assert.equal(store.heard(play('2', 3500), 3500, 3600), true);
  });

  it('does not queue one listen twice', () => {
    const { store, play } = connected();
    store.setSending(true, 1000);
    const id = play('1', 2000);
    store.heard(id, 2000, 2100);
    store.heard(id, 2000, 2200);
    assert.equal(store.waiting(10).length, 1);
  });

  it('puts the whole of the history in line when asked, once', () => {
    const { store, play } = connected();
    const ids = [play('1', 300), play('2', 100), play('3', 200)];
    store.mark([ids[0]!], 'sent', 400);
    store.queuePast(500);
    store.queuePast(600);
    // Oldest first, and not the one that has already gone.
    assert.deepEqual(store.waiting(10).map((row) => row.id), [ids[1], ids[2]]);
    assert.deepEqual(store.counts(), { queued: 0, past: 2, sent: 1, skipped: 0, untouched: 0 });
  });

  it('sends what was just heard ahead of the history', () => {
    const { store, play } = connected();
    play('1', 100);
    play('2', 200);
    store.queuePast(300);
    store.setSending(true, 1000);
    const fresh = play('3', 2000);
    store.heard(fresh, 2000, 2100);
    assert.deepEqual(store.waiting(10).map((row) => row.state), ['queued', 'past', 'past']);
    assert.equal(store.waiting(1)[0]!.id, fresh);
  });

  it('takes back only the history when that is stopped', () => {
    const { store, play } = connected();
    const old = play('1', 100);
    const gone = play('2', 200);
    store.queuePast(300);
    store.mark([gone], 'sent', 350);
    store.setSending(true, 1000);
    const fresh = play('3', 2000);
    store.heard(fresh, 2000, 2100);

    store.dropPast();

    assert.deepEqual(store.waiting(10).map((row) => row.id), [fresh]);
    assert.deepEqual(store.counts(), { queued: 1, past: 0, sent: 1, skipped: 0, untouched: 1 });
    // And picks up where it left off: only what never went is put back in line.
    store.queuePast(3000);
    assert.deepEqual(store.waiting(10).map((row) => row.id), [fresh, old]);
  });

  it('records as sent a listen whose row was taken back while it was in the air', () => {
    const { store, play } = connected();
    const id = play('1', 100);
    store.queuePast(200);
    store.dropPast();
    store.mark([id], 'sent', 300);
    assert.equal(store.counts().sent, 1);
    store.queuePast(400);
    assert.deepEqual(store.waiting(10), []);
  });

  it('offers what was left out again the next time the history is asked for', () => {
    const { store, play } = connected();
    const id = play('1', 100, null);
    store.queuePast(200);
    store.mark([id], 'skipped', 300);
    assert.deepEqual(store.waiting(10), []);
    assert.equal(store.counts().skipped, 1);
    store.queuePast(400);
    assert.deepEqual(store.waiting(10).map((row) => row.id), [id]);
  });

  it('does not count a row whose listen is no longer there', () => {
    const { raw, store, play } = connected();
    store.mark([play('1', 100)], 'sent', 200);
    raw.exec('DELETE FROM plays');
    assert.deepEqual(store.counts(), { queued: 0, past: 0, sent: 0, skipped: 0, untouched: 0 });
  });

  it('leaves the history table exactly as it was', () => {
    const { raw, store, play } = connected();
    const id = play('1', 100);
    const before = raw.prepare('SELECT * FROM plays').all().map((row) => ({ ...row }));
    store.queuePast(200);
    store.mark([id], 'sent', 300);
    assert.deepEqual(raw.prepare('SELECT * FROM plays').all().map((row) => ({ ...row })), before);
  });
});
