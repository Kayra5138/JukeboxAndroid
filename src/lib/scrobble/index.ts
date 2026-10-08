import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { version } from '../../../package.json';
import { submitListens, validateToken } from './api.ts';
import { tokenIn, type ShownNames } from './listens.ts';
import { drain, retryAfterMs } from './sender.ts';
import { scrobbleStore, type Connection, type Counts, type ScrobbleDb, type ScrobbleStore } from './store.ts';
import { db } from '../db/index.ts';
import { readMetadata } from '../db/metadata.ts';
import { mergeMetadata } from '../media/enriched.ts';
import { findTrack, scanLibrary } from '../media/library.ts';
import { withMetadata } from '../media/merge.ts';
import type { Track } from '../types.ts';
import { createStore } from '../ui/store.ts';

/**
 * Sending listens to ListenBrainz, for somebody who has asked for that.
 *
 * This file is only the errands, as `backup/index.ts` is: when to try, what to
 * do with how it went, and what to tell the screen. What a listen looks like,
 * which ones are waiting and what each answer from the service means are in
 * the files beside it, where they can be tested without a phone.
 *
 * It is the one part of the app that tells anybody anything about the user,
 * and it is inert until they have done two separate things: pasted a token,
 * and turned sending on. Without a token every entry point here reads one
 * setting and returns.
 *
 * There is no background service. A listen is sent from JavaScript, so it is
 * sent while the app is alive: just after it is recorded, when the app starts,
 * and when it comes back to the front. One recorded with no network waits in
 * the database for the next of those. Nothing watches the connection itself --
 * that would be a dependency to learn something the next attempt finds out
 * anyway -- so a run that fails is tried again on a timer, further apart each
 * time.
 */

function store(): ScrobbleStore {
  const database = db();
  const adapter: ScrobbleDb = {
    all: <T,>(sql: string, ...params: (string | number | null)[]) => database.getAllSync<T>(sql, params),
    run: (sql, ...params) => {
      database.runSync(sql, params);
    },
    transaction: (work) => database.withTransactionSync(work),
  };
  return scrobbleStore(adapter);
}

/** What the settings screen draws. The token is not in it, and never is. */
export type Scrobbling = {
  connection: Connection;
  counts: Counts;
  /** A run is at work at this moment. */
  running: boolean;
};

/** Null until something has asked; nothing reads the database to fill it in on its own. */
const view = createStore<Scrobbling | null>(null);

/** The run in progress, if there is one: what abandons it. */
let current: AbortController | null = null;
/** Something asked for a run while one was already going. */
let wanted = false;
let failures = 0;
let retry: ReturnType<typeof setTimeout> | null = null;

/**
 * Reads everything the screen shows, afresh.
 *
 * Called by whoever has just changed something and by the screen as it comes
 * into view -- from handlers and effects, never while drawing. It counts over
 * the history, which is a query nobody wants in a render.
 */
export function refreshScrobbling(): void {
  try {
    const kept = store();
    view.set({ connection: kept.connection(), counts: kept.counts(), running: current != null });
  } catch (failure) {
    console.warn('Could not read the ListenBrainz state', failure);
  }
}

export function useScrobbling(): Scrobbling | null {
  return useSyncExternalStore(view.subscribe, view.get);
}

const names = (track: Track): ShownNames => ({
  title: track.title,
  artist: track.artist,
  album: track.album,
  durationSec: track.durationSec,
});

/** Up to this many tracks are asked for one by one; more, and the library is read once. */
const FEW = 4;

/**
 * What the app calls a set of tracks, for the length of one run.
 *
 * The usual run is one listen, and reading the whole library to name one track
 * would be a scan of every file at the end of every song. So a few are looked
 * up singly, through the same merge the screens use, and only an upload of the
 * history reads the library -- once, and then answers from that.
 *
 * A track that is not in the library is simply absent from the answer, and is
 * sent under what the history wrote down.
 */
function shownNames(): (trackIds: string[]) => Promise<Map<string, ShownNames>> {
  let whole: Map<string, ShownNames> | null = null;

  return async (trackIds) => {
    if (whole) return whole;

    if (trackIds.length <= FEW) {
      const found = new Map<string, ShownNames>();
      for (const id of trackIds) {
        const track = await findTrack(id);
        if (!track) continue;
        const known = readMetadata(id);
        const [merged] = mergeMetadata([track], {
          readAllMetadata: () => new Map(known ? [[id, known]] : []),
          allTags: () => new Map(),
        });
        if (merged) found.set(id, names(merged));
      }
      return found;
    }

    whole = new Map(withMetadata(await scanLibrary()).map((track) => [track.id, names(track)]));
    return whole;
  };
}

async function run(): Promise<void> {
  const kept = store();
  const token = kept.token();
  if (!token) return;
  if (kept.waiting(1).length === 0) {
    // Nothing to send, so nothing is in the way of sending it either -- which
    // matters after an upload that was failing has been stopped.
    const trouble = kept.connection().trouble;
    if (trouble && trouble !== 'revoked') {
      kept.settled();
      refreshScrobbling();
    }
    return;
  }

  const controller = new AbortController();
  current = controller;
  refreshScrobbling();

  try {
    const outcome = await drain({
      store: kept,
      shown: shownNames(),
      submit: (type, payload, signal) => submitListens(token, type, payload, signal),
      version,
      signal: controller.signal,
      onProgress: refreshScrobbling,
    });

    // Abandoned by a disconnect, which has already thrown everything away.
    if (controller.signal.aborted || outcome.kind === 'stopped') return;

    if (outcome.sent > 0) kept.sent(Date.now());
    if (outcome.kind === 'done') {
      failures = 0;
      kept.settled();
    } else if (outcome.kind === 'revoked') {
      failures = 0;
      /*
        A 401, which has two meanings and only one of them is about the token.
        The service is asked whose token this is: if it no longer knows, the
        token is gone and is thrown away. If it still does, the refusal was
        about the account — one the service will not take listens from — and
        throwing a good token away would be signing somebody out for it. If
        the question cannot be asked, nothing is concluded either way.
      */
      const whose = await validateToken(token).catch(() => undefined);
      if (whose === null) kept.revoke();
      else if (whose === undefined) kept.troubled('failed');
      else kept.refused(outcome.said ?? null);
    } else {
      // Something got through before it failed, so the service is there and
      // the count starts over.
      failures = outcome.sent > 0 ? 1 : failures + 1;
      kept.troubled(outcome.trouble ?? 'failed');
      retry = setTimeout(sendWaiting, retryAfterMs(failures));
    }
  } catch (failure) {
    // The database, since everything from the network is turned into an
    // outcome before it gets here. The token is in neither.
    console.warn('Sending to ListenBrainz stopped unexpectedly', failure);
  } finally {
    if (current === controller) current = null;
    refreshScrobbling();
  }
}

/**
 * Tries to send whatever is waiting. Safe to call at any time and as often as
 * anything likes: there is only ever one run, and asking during one means
 * another look at the queue when it ends.
 */
export function sendWaiting(): void {
  if (retry) {
    clearTimeout(retry);
    retry = null;
  }
  if (current) {
    wanted = true;
    return;
  }
  void (async () => {
    try {
      do {
        wanted = false;
        await run();
      } while (wanted && !retry);
    } catch (failure) {
      console.warn('Sending to ListenBrainz could not start', failure);
    }
  })();
}

/**
 * A listen has just been written to the history.
 *
 * Called from inside the player's track-change handler, so it must neither
 * throw nor take time: it writes one row if the listen is to be sent, and the
 * sending itself happens after this has returned.
 */
export function listenRecorded(playId: number, startedAt: number): void {
  try {
    if (store().heard(playId, startedAt, Date.now())) sendWaiting();
  } catch (failure) {
    console.warn('Could not queue a listen for ListenBrainz', failure);
  }
}

/**
 * Tries at the start, and each time the app comes back to the front. Answers
 * with how to stop.
 */
export function keepScrobbling(): () => void {
  sendWaiting();
  const returning = AppState.addEventListener('change', (state) => {
    if (state === 'active') sendWaiting();
  });
  return () => returning.remove();
}

/**
 * Checks a pasted token and, if it is somebody's, holds on to it.
 *
 * Answers with whose, or null for a token the service does not know -- which
 * is not kept. Throws when the service could not be asked, which says nothing
 * about the token either way.
 */
export async function connectListenBrainz(pasted: string): Promise<string | null> {
  const token = tokenIn(pasted);
  if (!token) return null;
  const user = await validateToken(token);
  if (!user) return null;
  store().connect(token, user);
  failures = 0;
  refreshScrobbling();
  // What was waiting when a token was revoked is still waiting.
  sendWaiting();
  return user;
}

/** Forgets the account, the token and all that was known about what it was sent. */
export function disconnectListenBrainz(): void {
  current?.abort();
  current = null;
  wanted = false;
  failures = 0;
  if (retry) clearTimeout(retry);
  retry = null;
  store().disconnect();
  refreshScrobbling();
}

/** Turns "send what I listen to" on or off. */
export function setSendingListens(on: boolean): void {
  store().setSending(on, Date.now());
  refreshScrobbling();
}

/** Puts the history that was never sent in line, and starts on it. */
export function sendPastListens(): void {
  store().queuePast(Date.now());
  failures = 0;
  refreshScrobbling();
  sendWaiting();
}

/**
 * Stops an upload of the history.
 *
 * By taking what is left of it back out of the queue, not by cutting off the
 * request in the air: that one is allowed to finish and be written down, so
 * that nothing is left in the state of having perhaps been sent. Asking again
 * later carries on from there.
 */
export function stopPastListens(): void {
  store().dropPast();
  refreshScrobbling();
  // So that a retry that was only waiting on the history is not left ticking.
  sendWaiting();
}
