import { isAbortError, isNetworkError, isSlow } from '../metadata/http.ts';
import type { ProblemCode } from './core.ts';

/**
 * Why the catalogue came back with nothing, as one of the reasons there is a
 * sentence for.
 *
 * The build says which, on the error, as `discover`: nothing here reads the
 * sentence an error was thrown with, in any language. What it cannot say for
 * certain is that the phone is offline. It knows only that a request never
 * left, which is also what a name that would not resolve looks like with
 * the Wi-Fi up; so `offline` from here is "ask the phone", and
 * {@link confirmed} is what is done with the phone's answer.
 */
export function problemOf(error: unknown, timedOut: boolean): ProblemCode {
  if (timedOut || isAbortError(error)) return 'timedOut';
  switch ((error as { discover?: unknown } | null)?.discover) {
    case 'taste':
      return 'noTaste';
    case 'nothing':
      return 'nothing';
    case 'throttled':
      return 'slowDown';
    case 'unreachable':
      return 'unreachable';
    case 'offline':
      return 'offline';
  }
  // Not the build's own error: something under it that got out as it was.
  if (isNetworkError(error)) return isSlow(error) ? 'unreachable' : 'offline';
  return 'failed';
}

/**
 * [code], with what the phone says of its connection taken into account.
 *
 * Only "offline" is in question, and only the phone can settle it: with a
 * connection that it has itself checked, requests that went nowhere are the
 * services' trouble and not the listener's. Where the phone cannot be asked,
 * the build is believed.
 */
export function confirmed(code: ProblemCode, connected: boolean | null): ProblemCode {
  return code === 'offline' && connected === true ? 'unreachable' : code;
}
