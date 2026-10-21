/**
 * When the library offers, by itself, to find what its files do not say.
 *
 * A new install opens on grey squares and "Unknown artist", and the button
 * that fixes it is three screens away under a name — Tags — that nobody new
 * would look for. So the library asks, once, in a card above the list. It
 * asks politely, which here means rarely: a "not now" is believed, and asked
 * again only once and much later, when there is reason to think the answer
 * may have changed. After that the button on the Tags screen is the way, as
 * it always was.
 *
 * Nothing here reads the database or the clock. It is handed what was kept
 * and what the library looks like, and answers yes or no, so that every rule
 * in it has a test.
 */

const DAY = 86_400_000;

/** How long a "not now" is left alone before it is asked about the once more. */
export const ASK_AGAIN_AFTER_DAYS = 7;

/**
 * Or how many more tracks, whichever comes first: a library that has grown by
 * this much since has a good many new grey squares in it, and the person who
 * said "not now" to the old one has not said it to these.
 */
export const ASK_AGAIN_AFTER_TRACKS = 100;

/** How many times it is ever asked. */
export const MOST_ASKS = 2;

/** What is kept of the asking, as the setting's words. */
export type OfferKept = {
  /** How many times it has been answered. */
  asked: number;
  /** When it was last answered. */
  at: number;
  /** How many tracks the library had then. */
  tracks: number;
  /** Said yes to. Never asked again: the Tags screen has the rest. */
  accepted: boolean;
};

export type OfferInput = {
  kept: OfferKept | null;
  now: number;
  /** Tracks in the library, as it was last confirmed by the device. */
  tracks: number;
  /** Tracks of those that have never been looked up. */
  untried: number;
  /** Whether a lookup is already under way, from here or from the Tags screen. */
  running: boolean;
};

export function parseOffer(words: string | null): OfferKept | null {
  if (!words) return null;
  try {
    const value = JSON.parse(words) as Partial<OfferKept> | null;
    if (!value || typeof value !== 'object') return null;
    const number = (field: unknown) => (typeof field === 'number' && Number.isFinite(field) ? field : 0);
    return {
      asked: number(value.asked),
      at: number(value.at),
      tracks: number(value.tracks),
      accepted: value.accepted === true,
    };
  } catch {
    return null;
  }
}

/**
 * Whether there is enough left to find for the question to be worth asking.
 *
 * Something untried, and at least a quarter of the library. Somebody who
 * looked their whole collection up long ago and has added a record since has
 * a dozen untried tracks in a few thousand; that is the Tags screen's
 * business, and a card about it would be the app forgetting it had asked.
 */
export function worthAsking(tracks: number, untried: number): boolean {
  return tracks > 0 && untried > 0 && untried * 4 >= tracks;
}

/**
 * Whether to show the card now.
 *
 * Asked about the first time there is a library worth it; then, after a "not
 * now", once more when a week has passed or the library has grown by a
 * hundred tracks; then never. A yes is never followed by another question.
 */
export function shouldOffer({ kept, now, tracks, untried, running }: OfferInput): boolean {
  if (running || !worthAsking(tracks, untried)) return false;
  if (!kept || kept.asked <= 0) return true;
  if (kept.accepted || kept.asked >= MOST_ASKS) return false;
  // A clock put back is not a week gone by.
  const waited = now - kept.at >= ASK_AGAIN_AFTER_DAYS * DAY;
  const grown = tracks - kept.tracks >= ASK_AGAIN_AFTER_TRACKS;
  return waited || grown;
}

/** What is kept once the card has been answered. */
export function answered(kept: OfferKept | null, accepted: boolean, now: number, tracks: number): OfferKept {
  return { asked: (kept?.asked ?? 0) + 1, at: now, tracks, accepted };
}
