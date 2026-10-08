import { joinsQueue, type Sending } from './listens.ts';

/**
 * What is kept about sending: the connection, and the state of each listen.
 *
 * Written against the three things it needs from a database rather than
 * against the one the app uses, the way the backup's store is, so that the
 * queries can be run on a real SQLite in the tests. What matters about them --
 * that a listen is offered once, that stopping takes back only what was asked
 * for after the fact -- is a question about rows, and only a database can
 * answer it.
 */
export type ScrobbleDb = {
  all<T>(sql: string, ...params: (string | number | null)[]): T[];
  run(sql: string, ...params: (string | number | null)[]): void;
  /** Everything in [work] or none of it. */
  transaction(work: () => void): void;
};

/**
 * The settings this keeps, all under one prefix.
 *
 * The prefix is what the backup goes by: nothing beginning `listenbrainz:` is
 * written into one or read out of one (`backup/format.ts`). A key added here
 * is covered by that without anybody having to remember, and the test beside
 * this file holds every one of them to it.
 */
export const KEYS = {
  /**
   * The user token. A secret: it is what lets anything at all be written to
   * the account. Read only on the way into a request header -- never shown,
   * never logged, never put in the text of an error.
   */
  token: 'listenbrainz:token',
  /** The account the token turned out to belong to, which is what is shown. */
  user: 'listenbrainz:user',
  /** `'true'` while new listens are to be sent. */
  sending: 'listenbrainz:sending',
  /** When that was last turned on, in milliseconds. */
  since: 'listenbrainz:since',
  /** When a request last went through, in milliseconds. */
  lastSentAt: 'listenbrainz:lastSentAt',
  /** Why the last attempt did not, as one of {@link Trouble}; absent when it did. */
  trouble: 'listenbrainz:trouble',
  /** What the service said, for the one trouble that has its own words: `refused`. */
  said: 'listenbrainz:said',
} as const;

/**
 * Why sending is not happening, in the few ways there are.
 *
 * `revoked` is the one that does not mend itself: the service said the token
 * is no longer good, the token has been thrown away, and only the user can
 * supply another.
 */
export type Trouble = 'offline' | 'busy' | 'server' | 'failed' | 'revoked' | 'refused';

const TROUBLES: readonly string[] = ['offline', 'busy', 'server', 'failed', 'revoked', 'refused'];

export type ListenState = 'queued' | 'past' | 'sent' | 'skipped';

/** A listen that is waiting, with what the history wrote down about it. */
export type Waiting = {
  id: number;
  trackId: string;
  title: string;
  artist: string | null;
  startedAt: number;
  state: 'queued' | 'past';
};

export type Counts = {
  /** Heard with sending on, and not yet sent. */
  queued: number;
  /** Asked to be sent after the fact, and not yet sent. */
  past: number;
  sent: number;
  /** Could not be sent as they stand. */
  skipped: number;
  /** In the history and never offered at all. */
  untouched: number;
};

export type Connection = Sending & {
  user: string | null;
  lastSentAt: number | null;
  trouble: Trouble | null;
  /** The service's reason, when the trouble is `refused` and it gave one. */
  said: string | null;
};

export type ScrobbleStore = ReturnType<typeof scrobbleStore>;

export function scrobbleStore(database: ScrobbleDb) {
  const read = (key: string): string | null =>
    database.all<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)[0]?.value ?? null;
  const write = (key: string, value: string) =>
    database.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value
    );
  const erase = (key: string) => database.run('DELETE FROM settings WHERE key = ?', key);
  const moment = (key: string): number | null => {
    const value = Number(read(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  const connection = (): Connection => {
    const trouble = read(KEYS.trouble);
    return {
      connected: !!read(KEYS.token),
      user: read(KEYS.user),
      sending: read(KEYS.sending) === 'true',
      since: moment(KEYS.since),
      lastSentAt: moment(KEYS.lastSentAt),
      trouble: trouble && TROUBLES.includes(trouble) ? (trouble as Trouble) : null,
      said: read(KEYS.said),
    };
  };

  return {
    /** For the request header and nowhere else. */
    token: (): string | null => read(KEYS.token),
    connection,

    /**
     * Holds a token that has been checked, under the name it belongs to.
     *
     * Sending starts off, every time. Having an account is not the same as
     * having asked for anything to be sent to it, and that includes somebody
     * who had it on, was signed out, and has come back.
     *
     * What was sent is forgotten if this is a different account from the last
     * one, since none of it was sent there. The same account coming back --
     * after its token was revoked and replaced -- keeps its record, and what
     * was waiting is still waiting.
     */
    connect(token: string, user: string): void {
      database.transaction(() => {
        const before = read(KEYS.user);
        if (before != null && before !== user) database.run('DELETE FROM listenbrainz_listens');
        write(KEYS.token, token);
        write(KEYS.user, user);
        write(KEYS.sending, 'false');
        erase(KEYS.trouble);
        erase(KEYS.said);
      });
    },

    /** Forgets the account and everything that was known about what it was sent. */
    disconnect(): void {
      database.transaction(() => {
        database.run('DELETE FROM listenbrainz_listens');
        database.run(`DELETE FROM settings WHERE key LIKE 'listenbrainz:%'`);
      });
    },

    /**
     * The service has said the token is no good.
     *
     * The token goes, because it is useless and still a secret. The name and
     * the record of what was sent stay: the usual reason is a token reset on
     * the website, and the same person pasting the new one should find the
     * queue where it was.
     */
    revoke(): void {
      database.transaction(() => {
        erase(KEYS.token);
        write(KEYS.trouble, 'revoked' satisfies Trouble);
        erase(KEYS.said);
      });
    },

    /**
     * Turns sending on or off.
     *
     * On writes down the moment, which is the line between what is sent as it
     * happens and what is history. Off leaves the moment and the queue alone:
     * what was heard while it was on was heard under a promise to send it.
     */
    setSending(on: boolean, now: number): void {
      database.transaction(() => {
        write(KEYS.sending, on ? 'true' : 'false');
        if (on) write(KEYS.since, String(Math.round(now)));
      });
    },

    sent(now: number): void {
      database.transaction(() => {
        write(KEYS.lastSentAt, String(Math.round(now)));
        erase(KEYS.trouble);
        erase(KEYS.said);
      });
    },

    /** Nothing is waiting any more, so whatever stood in the way no longer does. */
    settled(): void {
      database.transaction(() => {
        erase(KEYS.trouble);
        erase(KEYS.said);
      });
    },

    troubled(trouble: Trouble): void {
      database.transaction(() => {
        write(KEYS.trouble, trouble);
        erase(KEYS.said);
      });
    },

    /**
     * The service would not take listens, and the token is not why.
     *
     * A 401 used to mean one thing here — the token is no good — and the token
     * was thrown away on it. But the service gives the same status to an
     * account it will not accept listens from while still recognising its
     * token, and throwing a good token away for that told somebody who had
     * just connected that they had been signed out. So the token is kept, the
     * service's own reason is kept beside it to be shown, and nothing is sent
     * until the user asks again.
     */
    refused(said: string | null): void {
      database.transaction(() => {
        write(KEYS.trouble, 'refused' satisfies Trouble);
        if (said) write(KEYS.said, said);
        else erase(KEYS.said);
      });
    },

    /** Queues a listen that has just been recorded, if it is one that should be. */
    heard(playId: number, startedAt: number, now: number): boolean {
      if (!joinsQueue(connection(), startedAt)) return false;
      database.run(
        `INSERT OR IGNORE INTO listenbrainz_listens (play_id, state, at) VALUES (?, 'queued', ?)`,
        playId,
        Math.round(now)
      );
      return true;
    },

    /**
     * Puts the whole of the history that has never been offered in line.
     *
     * What was left out before is offered again as well. The usual reason for
     * leaving a listen out is a track with no artist, and the usual reason for
     * asking a second time is having just given it one.
     */
    queuePast(now: number): void {
      database.transaction(() => {
        database.run(`UPDATE listenbrainz_listens SET state = 'past' WHERE state = 'skipped'`);
        database.run(
          `INSERT INTO listenbrainz_listens (play_id, state, at)
           SELECT plays.id, 'past', ? FROM plays
           LEFT JOIN listenbrainz_listens known ON known.play_id = plays.id
           WHERE known.play_id IS NULL`,
          Math.round(now)
        );
      });
    },

    /**
     * Takes back what {@link queuePast} put in line and has not gone yet.
     *
     * Only that. A listen heard with sending on is not something stopping an
     * upload of the history was ever about.
     */
    dropPast(): void {
      database.run(`DELETE FROM listenbrainz_listens WHERE state = 'past'`);
    },

    /**
     * The next listens to send.
     *
     * What was just heard goes ahead of the history, so that a long upload does
     * not hold today's listens back for as long as it runs; within each, oldest
     * first, which is the order the history was made in.
     */
    waiting(limit: number): Waiting[] {
      return database.all<Waiting>(
        `SELECT plays.id         AS id,
                plays.track_id   AS trackId,
                plays.title      AS title,
                plays.artist     AS artist,
                plays.started_at AS startedAt,
                known.state      AS state
         FROM listenbrainz_listens known
         JOIN plays ON plays.id = known.play_id
         WHERE known.state IN ('queued', 'past')
         ORDER BY known.state = 'past', plays.started_at, plays.id
         LIMIT ?`,
        limit
      );
    },

    /**
     * Writes down what became of some listens.
     *
     * Replacing rather than updating, so that a listen whose row was taken
     * back while its request was in the air is still recorded as sent: it was.
     */
    mark(ids: readonly number[], state: 'sent' | 'skipped', now: number): void {
      if (ids.length === 0) return;
      database.transaction(() => {
        for (const id of ids) {
          database.run(
            'INSERT OR REPLACE INTO listenbrainz_listens (play_id, state, at) VALUES (?, ?, ?)',
            id,
            state,
            Math.round(now)
          );
        }
      });
    },

    counts(): Counts {
      const counts: Counts = { queued: 0, past: 0, sent: 0, skipped: 0, untouched: 0 };
      // Joined to the history, so that a row left behind by a listen that is no
      // longer there is not counted as something waiting.
      const rows = database.all<{ state: ListenState; found: number }>(
        `SELECT known.state AS state, COUNT(*) AS found
         FROM listenbrainz_listens known JOIN plays ON plays.id = known.play_id
         GROUP BY known.state`
      );
      for (const row of rows) if (row.state in counts) counts[row.state] = row.found;
      counts.untouched =
        database.all<{ found: number }>(
          `SELECT COUNT(*) AS found FROM plays
           LEFT JOIN listenbrainz_listens known ON known.play_id = plays.id
           WHERE known.play_id IS NULL`
        )[0]?.found ?? 0;
      return counts;
    },
  };
}
