import { wholeIn, type Range } from '../ui/range.ts';

/**
 * The jumps a book or a show was given of its own, apart from the general
 * ones in the tape settings: a lecture wants a long step back to hear a
 * point again, a chatty show a long step on past its asides. Kept by the
 * same key as its speed (`tapeKeyOf`), `{ key: { back, forward } }` in
 * seconds, either left out where it is the general one.
 *
 * Only the reading and the changing of that map here, with nothing of the
 * app's around it, so that it is checked without one: `settings.ts` keeps it
 * and hands it to the player, whose presses from a headset, the notification
 * or the car read it the same way (`Tapes.jumpsFor`).
 */
export type OwnJumps = Record<string, { back?: number; forward?: number }>;

export type Jumps = { back: number; forward: number };

/** [stored] as the map it should be, nothing where it is not one. */
export function ownJumpsFrom(stored: string | null | undefined): OwnJumps {
  if (!stored) return {};
  try {
    const kept: unknown = JSON.parse(stored);
    return kept && typeof kept === 'object' && !Array.isArray(kept) ? (kept as OwnJumps) : {};
  } catch {
    return {};
  }
}

/**
 * The jumps for [key]: its own where it has them, each falling back to
 * [general] where it has none or one out of [range]; and which of the two
 * are its own, to say so beside them.
 */
export function jumpsFor(
  own: OwnJumps,
  key: string,
  general: Jumps,
  range: Range
): Jumps & { ownBack: boolean; ownForward: boolean } {
  const mine = own[key];
  const back = mine ? wholeIn(mine.back, range) : null;
  const forward = mine ? wholeIn(mine.forward, range) : null;
  return {
    back: back ?? general.back,
    forward: forward ?? general.forward,
    ownBack: back != null,
    ownForward: forward != null,
  };
}

/**
 * [own] with [key]'s jump [which] set to [seconds], or given back to the
 * general one for null; a key left with neither is taken out altogether.
 */
export function withOwnJump(own: OwnJumps, key: string, which: 'back' | 'forward', seconds: number | null): OwnJumps {
  const mine = { ...own[key] };
  if (seconds == null) delete mine[which];
  else mine[which] = seconds;
  const next = { ...own };
  if (mine.back == null && mine.forward == null) delete next[key];
  else next[key] = mine;
  return next;
}
