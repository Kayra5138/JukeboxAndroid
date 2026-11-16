/**
 * The shapes of what can stand where the cover is in the player
 * (`coverLook.ts`), worked out apart from the database so that they can be
 * tried on their own.
 */
export type SongLook = 'cover' | 'record';
export type TapeLook = 'cover' | 'cassette';
/** What moves with the music, over the cover, the record or the cassette alike. */
export type CoverMotion =
  | 'none'
  | 'spectrum'
  | 'ripple'
  | 'breathe'
  | 'punch'
  | 'scope'
  | 'spectrogram'
  | 'sparks'
  | 'aurora';

/**
 * How long a record takes to go round. Slower than a turntable's thirty-three
 * and a third a minute, which on a screen held a foot away was a whirl.
 */
export const RECORD_TURN_MS = 5000;

/** How long a cassette's reel takes to go round, at the speed the tape is pulled past the head. */
export const REEL_TURN_MS = 2400;

/**
 * How far round a cassette's reel is wound, between its hub at nought and as
 * far as the window lets it be seen at one, with [share] of the tape on it:
 * the tape on a reel is a ring, so its edge goes out as the root of how much
 * there is.
 */
export function woundTo(share: number, hub: number): number {
  const kept = Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0));
  return Math.sqrt(hub * hub + (1 - hub * hub) * kept);
}

/** Where the arm turns, as shares of the record across from its top left corner, and how long it is. */
export const PIVOT_X = 0.9;
export const PIVOT_Y = 0.08;
export const ARM = 0.66;
/** Where the needle is at the start of a side and at its end, as shares of the record across from its middle. */
export const FIRST_GROOVE = 0.46;
export const LAST_GROOVE = 0.24;

/**
 * How far the arm is turned from hanging straight down, in degrees, for the
 * needle to stand [from] the middle of a record [size] across: worked out by
 * halving, as the needle's distance from the middle only falls as the arm turns
 * in over the record.
 */
export function armTurn(from: number, size: number): number {
  const pivotX = size * PIVOT_X;
  const pivotY = size * PIVOT_Y;
  const arm = size * ARM;
  let low = 0;
  let high = 80;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    const turn = (middle * Math.PI) / 180;
    const x = pivotX - Math.sin(turn) * arm - size / 2;
    const y = pivotY + Math.cos(turn) * arm - size / 2;
    if (Math.hypot(x, y) > from) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}
