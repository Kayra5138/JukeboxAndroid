import { isNetworkError, isThrottle, pause, saidOf, statusOf } from '../metadata/http.ts';
import { allowanceOf, type Allowance } from './api.ts';
import {
  buildListen,
  BYTES_PER_REQUEST,
  bytesOf,
  chunk,
  LISTENS_PER_REQUEST,
  type Listen,
  type ListenType,
  type ShownNames,
} from './listens.ts';
import type { ScrobbleStore, Trouble, Waiting } from './store.ts';

/**
 * Sending what is waiting, one request at a time, until there is nothing left
 * or a reason to stop.
 *
 * Everything it touches is handed to it -- where the queue is kept, what the
 * tracks are called, the request itself, even the waiting -- so that the whole
 * of it runs on a desk against a made-up service. This is the part of the
 * feature that cannot be tried by hand without filling somebody's account with
 * listens, and the part where the difference between "try again" and "stop" is
 * decided.
 *
 * Nothing is held in memory between requests. Each turn asks the queue what is
 * waiting, sends the front of it, and writes down that it went; the next turn
 * asks again. So a listen recorded during a long upload is picked up by it,
 * taking the history back out of the queue ends the upload at the next turn,
 * and an app killed part way has lost nothing but the request it was in.
 */

/**
 * The gap between requests.
 *
 * The service asks that a client make no more than one call a second, whatever
 * its allowance says.
 */
export const BETWEEN_REQUESTS_MS = 1_100;

/** How long to stay away after a 429 that did not say. */
const UNSAID_RESET_MS = 10_000;

/**
 * The longest this will sit waiting for the allowance to come back.
 *
 * Past it the run is given up as "later" instead. The window is normally a few
 * seconds, and a service asking for longer than this is in some kind of
 * trouble that is better met by going away than by holding a timer open.
 */
const LONGEST_WAIT_MS = 120_000;

/** How many refusals for hurrying, one after another, before giving up for now. */
const THROTTLES_BEFORE_LATER = 3;

export type SenderDeps = {
  store: Pick<ScrobbleStore, 'waiting' | 'mark'>;
  /**
   * What the app calls these tracks now. A track missing from the answer is
   * one that is no longer in the library. Throwing means the library could not
   * be read at all, which is not the same thing and sends nothing.
   */
  shown: (trackIds: string[]) => Promise<Map<string, ShownNames>>;
  submit: (type: ListenType, payload: Listen[], signal?: AbortSignal) => Promise<Allowance>;
  /** The app's version, which every listen is signed with. */
  version: string;
  /** Aborted to abandon the run: nothing after that moment is written down. */
  signal?: AbortSignal;
  now?: () => number;
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** After anything is written down, so that whoever is watching can count again. */
  onProgress?: () => void;
};

export type Outcome = {
  /**
   * `done`: nothing is waiting. `stopped`: abandoned through the signal.
   * `revoked`: the service answered 401, and nothing further should be tried
   * until whoever called has found out why — a token that is no longer good,
   * or an account the service will not take listens from; `said` is what it
   * gave as its reason. `later`: it did not work this time and may the next.
   */
  kind: 'done' | 'stopped' | 'revoked' | 'later';
  /** The service's own words for a refusal, where it gave any. */
  said?: string | null;
  /** Why, when it is `later`. */
  trouble?: Exclude<Trouble, 'revoked'>;
  sent: number;
  skipped: number;
};

export async function drain(deps: SenderDeps): Promise<Outcome> {
  const { store, signal } = deps;
  const now = deps.now ?? Date.now;
  const wait = deps.wait ?? pause;

  let sent = 0;
  let skipped = 0;
  const ended = (kind: Outcome['kind'], trouble?: Outcome['trouble']): Outcome => ({
    kind,
    ...(trouble ? { trouble } : {}),
    sent,
    skipped,
  });

  /** How many listens to put in the next request; halved when one is refused. */
  let limit = LISTENS_PER_REQUEST;
  /** How long to stay quiet before the next request, set by the last one. */
  let owed = 0;
  let throttles = 0;

  for (;;) {
    if (signal?.aborted) return ended('stopped');

    const rows = store.waiting(limit);
    if (rows.length === 0) return ended('done');

    if (owed > 0) {
      await wait(owed, signal);
      owed = 0;
      // Whatever was waiting may have been taken back in the meantime.
      continue;
    }

    let names: Map<string, ShownNames>;
    try {
      names = await deps.shown([...new Set(rows.map((row) => row.trackId))]);
    } catch {
      return ended('later', 'failed');
    }
    if (signal?.aborted) return ended('stopped');

    const ready: { row: Waiting; listen: Listen }[] = [];
    const unsendable: number[] = [];
    for (const row of rows) {
      const listen = buildListen(row, names.get(row.trackId), deps.version, now());
      if (listen) ready.push({ row, listen });
      else unsendable.push(row.id);
    }
    if (unsendable.length > 0) {
      store.mark(unsendable, 'skipped', now());
      skipped += unsendable.length;
      deps.onProgress?.();
    }
    if (ready.length === 0) continue;

    // Only the front of what is ready. The rest is asked for again next turn,
    // by which time it may have changed.
    const batch = chunk(ready, limit, BYTES_PER_REQUEST, (each) => bytesOf(JSON.stringify(each.listen)))[0]!;
    const ids = batch.map((each) => each.row.id);
    // `single` is for the one listen just heard. Anything older, or more than
    // one, is an import, whose whole meaning is "these already happened".
    const type: ListenType = batch.length === 1 && batch[0]!.row.state === 'queued' ? 'single' : 'import';

    let allowance: Allowance;
    try {
      allowance = await deps.submit(type, batch.map((each) => each.listen), signal);
    } catch (error) {
      if (signal?.aborted) return ended('stopped');
      const status = statusOf(error);

      if (status === 401) return { ...ended('revoked'), said: saidOf(error) };

      if (isThrottle(error)) {
        throttles += 1;
        const asked = allowanceOf(error).resetInSec;
        const away = asked == null ? UNSAID_RESET_MS : asked * 1000;
        if (throttles >= THROTTLES_BEFORE_LATER || away > LONGEST_WAIT_MS) return ended('later', 'busy');
        owed = Math.max(away, BETWEEN_REQUESTS_MS);
        continue;
      }

      /*
        The service read the request and would not have it. That is about what
        was sent, so sending it again is no use -- but one bad listen refuses
        the whole request, and the others in it are fine. Halving finds the
        one, which is then set aside so that the queue does not stay jammed
        behind it for good.
      */
      if (status === 400 || status === 413) {
        if (batch.length > 1) {
          limit = Math.ceil(batch.length / 2);
        } else {
          store.mark(ids, 'skipped', now());
          skipped += 1;
          deps.onProgress?.();
        }
        owed = BETWEEN_REQUESTS_MS;
        continue;
      }

      if (isNetworkError(error)) return ended('later', 'offline');
      if (status != null && status >= 500) return ended('later', 'server');
      return ended('later', 'failed');
    }

    // Abandoned while the request was in the air. It may well have arrived;
    // whoever abandoned the run has also thrown the record away, and writing
    // into it now would bring part of it back.
    if (signal?.aborted) return ended('stopped');

    store.mark(ids, 'sent', now());
    sent += ids.length;
    throttles = 0;
    limit = Math.min(LISTENS_PER_REQUEST, limit * 2);
    deps.onProgress?.();

    /*
      The allowance is read from every answer and obeyed before it runs out,
      rather than found out by being refused: with none left, the next request
      waits for the window to turn over.
    */
    owed = BETWEEN_REQUESTS_MS;
    if (allowance.remaining === 0) {
      const away = allowance.resetInSec == null ? UNSAID_RESET_MS : allowance.resetInSec * 1000;
      if (away > LONGEST_WAIT_MS) {
        // Not a failure -- everything asked for went -- so only if more is waiting.
        if (store.waiting(1).length > 0) return ended('later', 'busy');
        return ended('done');
      }
      owed = Math.max(away, BETWEEN_REQUESTS_MS);
    }
  }
}

/**
 * How long to leave it after a run that ended in `later`.
 *
 * Doubling from a minute to half an hour. A phone that is offline is usually
 * offline for a while, and there is no hurry: the listens are dated, and
 * arrive filed under when they were heard whenever they are sent.
 */
export function retryAfterMs(failures: number): number {
  return Math.min(30 * 60_000, 60_000 * 2 ** Math.max(0, failures - 1));
}
