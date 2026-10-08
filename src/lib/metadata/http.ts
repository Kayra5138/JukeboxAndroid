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

type Classified = { status?: number; network?: boolean; throttled?: boolean; said?: string | null; headers?: Headers };

/** The service answered, and the answer was a refusal. */
export function httpError(service: string, status: number): Error {
  return Object.assign(new Error(`${service} responded ${status}`), { status });
}

/**
 * The same refusal, marked as "slow down" by the one place that knows it is.
 *
 * A status says what the service answered, not what it meant: 403 is a wrong
 * question to most of them and the rate limit to Apple. Whoever asked knows
 * which service it was, so the meaning is attached there and travels with the
 * error, rather than being guessed again from the number further up.
 */
export function asThrottle(error: unknown): unknown {
  return error instanceof Error ? Object.assign(error, { throttled: true }) : error;
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

/** Whether a failure means "ask again later" rather than "no". */
export function isThrottle(error: unknown): boolean {
  return (error as Classified | null)?.throttled === true || statusOf(error) === 429;
}

/** The status a failure carried, or null when it never got an answer at all. */
export function statusOf(error: unknown): number | null {
  const status = (error as Classified | null)?.status;
  return typeof status === 'number' ? status : null;
}

/**
 * A header of the answer a refusal came with, or null.
 *
 * Only {@link request} attaches them, and only to a refusal: that is where a
 * service says how long to stay away, and the status alone does not carry it.
 */
export function headerOf(error: unknown, name: string): string | null {
  return (error as Classified | null)?.headers?.get(name) ?? null;
}

/**
 * What the service said about a refusal, in its own words, or null.
 *
 * A status says a request was refused and not why, and the why is sometimes
 * the only useful part: 401 from a service that has just accepted the same
 * token is not "your token is wrong", and only the body says what it is.
 * Never the request's own contents, which a service does not echo.
 */
export function saidOf(error: unknown): string | null {
  return (error as Classified | null)?.said ?? null;
}

/** The body of a refusal, cut short; a JSON `error` or `message` if that is what it is. */
async function saidBy(response: Response): Promise<string | null> {
  try {
    const text = (await response.text()).trim();
    if (!text) return null;
    try {
      const body = JSON.parse(text) as { error?: unknown; message?: unknown };
      const words = typeof body.error === 'string' ? body.error : body.message;
      if (typeof words === 'string' && words.trim()) return words.trim().slice(0, 300);
    } catch {
      // Not JSON, so it is said as it came.
    }
    return text.slice(0, 300);
  } catch {
    return null;
  }
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

/** What a pacer tells the time by. Passed in so a test need not wait. */
export type Clock = {
  now: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
};

// Read through the globals each time rather than held: the clock a phone
// tells the time by is the one that is there when it is asked.
const REAL_CLOCK: Clock = { now: () => Date.now(), sleep };

/**
 * Turns, handed out no closer together than a service allows.
 *
 * Callers stand in a line and are let go one at a time. Reading the clock and
 * then sleeping, which is what each client used to do for itself, is only a
 * limit while one thing is asking: two callers arriving together both read the
 * same wait, both slept it out, and both went at once.
 *
 * The gap is measured from the moment the one before was really let go, not
 * from the moment it was due. A timer on a phone is a promise to wake no
 * earlier than asked and says nothing about how much later: Android stops them
 * altogether while the app is in the background, and a run that had three
 * callers lined up at fixed moments came back to find all three moments
 * already past and let them go together.
 *
 * A caller who is stopped while waiting leaves the line and costs the one
 * behind nothing — no turn was taken, so there is no gap to keep after it.
 * It is told at once, too, rather than when its place comes round.
 *
 * Counted from when a request is let go, not from when its answer arrives, so
 * a slow answer does not stretch the interval further.
 */
export function pacer(intervalMs: number, clock: Clock = REAL_CLOCK) {
  let lastAt = -Infinity;
  let line: Promise<void> = Promise.resolve();

  return function turn(signal?: AbortSignal): Promise<void> {
    const mine = line.then(async () => {
      if (signal?.aborted) throw abortError();
      const wait = lastAt + intervalMs - clock.now();
      if (wait > 0) await clock.sleep(wait, signal);
      lastAt = clock.now();
    });
    // Whoever is next waits for this one to be over, however it ended.
    line = mine.catch(() => {});

    if (!signal) return mine;
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(abortError());
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
      mine.then(
        () => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        },
        (error: unknown) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        }
      );
    });
  };
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
    if (!response.ok) {
      throw Object.assign(httpError(service, response.status), {
        headers: response.headers,
        said: await saidBy(response),
      });
    }
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
