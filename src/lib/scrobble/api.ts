import { headerOf, request, USER_AGENT } from '../metadata/http.ts';
import type { Listen, ListenType } from './listens.ts';

/**
 * ListenBrainz, told what was listened to.
 *
 * The other half of `discover/listenbrainz.ts`, and the only place in the app
 * that sends anything about the user anywhere. That file asks questions
 * anybody may ask; this one writes to somebody's account, so every call here
 * carries their token and none is made unless they have supplied one.
 *
 * The token goes into the `Authorization` header and nowhere else. It is not
 * in a URL, where it would be written into logs along the way, and it is not
 * in the text of any error raised here: a failure says which service and what
 * status, which is all `http.ts` knows.
 */
const API = 'https://api.listenbrainz.org/1';

const headers = (token: string) => ({
  Authorization: `Token ${token}`,
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
});

/**
 * Whose token this is, or null if it is nobody's.
 *
 * The service answers 200 either way and says which in the body, so a token
 * that is wrong is an answer and not a failure. A failure -- no network, the
 * service down -- is thrown, and means nothing was learned about the token.
 */
export async function validateToken(token: string, signal?: AbortSignal): Promise<string | null> {
  const answer = await request<{ valid?: boolean; user_name?: string }>(
    'ListenBrainz',
    `${API}/validate-token`,
    { headers: headers(token) },
    signal
  );
  return answer?.valid === true && typeof answer.user_name === 'string' && answer.user_name
    ? answer.user_name
    : null;
}

/**
 * How much more the service is prepared to hear, as it said in its answer.
 *
 * Either may be null: the headers are a courtesy and a proxy in between is
 * free to drop them.
 */
export type Allowance = {
  /** Requests left in the current window. */
  remaining: number | null;
  /** Seconds until the window starts again. */
  resetInSec: number | null;
};

const count = (value: string | null): number | null => {
  if (value == null || value.trim() === '') return null;
  const read = Number(value);
  return Number.isFinite(read) && read >= 0 ? read : null;
};

const allowanceFrom = (get: (name: string) => string | null): Allowance => ({
  remaining: count(get('X-RateLimit-Remaining')),
  resetInSec: count(get('X-RateLimit-Reset-In')),
});

/** The allowance a refusal came with, which is how a 429 says when to return. */
export function allowanceOf(error: unknown): Allowance {
  return allowanceFrom((name) => headerOf(error, name));
}

/**
 * Sends listens, and answers with what the service said about sending more.
 *
 * A refusal is thrown as `http.ts` throws them, carrying its status: 401 for a
 * token that is no longer good, 429 for too many requests, 400 for a body the
 * service would not read.
 */
export async function submitListens(
  token: string,
  type: ListenType,
  payload: readonly Listen[],
  signal?: AbortSignal
): Promise<Allowance> {
  return request<Allowance>(
    'ListenBrainz',
    `${API}/submit-listens`,
    {
      method: 'POST',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ listen_type: type, payload }),
    },
    signal,
    // Nothing in the body is needed -- it says "ok" -- but it is read so that
    // the connection is finished with inside the deadline.
    async (response) => {
      await response.text();
      return allowanceFrom((name) => response.headers.get(name));
    }
  );
}
