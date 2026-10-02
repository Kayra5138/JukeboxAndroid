/**
 * Talking to catalogues that fail in three different ways.
 *
 * The enrichment loop has to tell those ways apart, because each one deserves a
 * different answer: "slow down" is worth waiting for, "no such record" is not,
 * and "there is no network" is worth abandoning the pass over. A bare `Error`
 * makes all three look identical, so failures are raised carrying enough to
 * classify them.
 */

/**
 * Long enough for a slow mobile connection to answer, short enough that a
 * connection which has silently died does not hold up the rest of the library.
 * Without it a stalled socket blocks the loop for as long as the OS allows.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Who is asking.
 *
 * Shared rather than declared per client because the catalogues that want it
 * want the same thing: MusicBrainz and Wikimedia both ask to be told which
 * application is calling and where to complain about it, and both answer a
 * bare or absent agent with a refusal. One string means the two cannot drift
 * apart and leave only one of them identifying itself.
 */
export const USER_AGENT = 'Jukebox/0.1 ( https://github.com/Kayra5138/JukeboxAndroid )';

type Classified = { status?: number; network?: boolean };

/** The service answered, and the answer was a refusal. */
export function httpError(service: string, status: number): Error {
  return Object.assign(new Error(`${service} responded ${status}`), { status });
}

/** Nothing answered: no route, no name resolution, or no reply in time. */
export function networkError(message: string): Error {
  return Object.assign(new Error(message), { network: true });
}

/**
 * `DOMException` is a browser type that Hermes does not guarantee, so an abort
 * is signalled with a plain error wearing the name everything checks for.
 */
export function abortError(): Error {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function isNetworkError(error: unknown): boolean {
  return (error as Classified | null)?.network === true;
}

/** The status a failure carried, or null when it never got an answer at all. */
export function statusOf(error: unknown): number | null {
  const status = (error as Classified | null)?.status;
  return typeof status === 'number' ? status : null;
}

/** Wait, unless the caller stops first — in which case fail. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Wait, and treat a stop as the wait being over.
 *
 * The minute-long backoff is exactly when someone presses Stop, and a rejection
 * from there escapes whatever `catch` block the wait happens to sit in. Ending
 * the wait quietly lets the caller notice the stop where it already looks.
 */
export function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * A request that cannot outlive its usefulness.
 *
 * `AbortSignal.any(...)` composed with `AbortSignal.timeout(...)` would say this
 * in one line, but the AbortController React Native installs on Hermes is a
 * polyfill with neither static, so the caller's signal and the deadline are
 * joined by hand.
 *
 * Answers with the body rather than the response, because a deadline that ends
 * at the headers is not a deadline on the request.
 */
export async function request<T>(
  service: string,
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
  /** Reads the body. Runs inside the deadline, which is the whole point. */
  read: (response: Response) => Promise<T> = (response) => response.json() as Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const forward = () => controller.abort();

  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', forward, { once: true });

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw httpError(service, response.status);
    /*
      The body is read here rather than by the caller, so that it is covered by
      the deadline and by the caller's signal.

      Returning the response instead ended the protection at the headers: the
      `finally` below cleared the timer and unhooked the signal, and the
      `await response.json()` that followed had neither. A server that answers
      200 and then stalls mid-body — a dying mobile socket, a captive portal —
      hung that read for good, and with it the enrichment pass, which sits on
      the await and never reaches the point where it would notice Stop.
    */
    return await read(response);
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (timedOut) throw networkError(`${service} did not answer in time`);
    if (statusOf(error) != null) throw error;
    // fetch rejects with a TypeError when it never reached the host, which is
    // the only way "offline" ever presents itself.
    throw networkError(`${service} could not be reached`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
}
