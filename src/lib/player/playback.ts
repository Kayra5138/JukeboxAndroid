/**
 * The arithmetic behind the speed and pitch controls.
 *
 * Kept out of the control that draws them because a slider is a bad place to
 * argue about numbers. Where a finger is allowed to stop, how near to normal
 * still counts as normal, and what a semitone is in the multiplier ExoPlayer
 * wants are all questions with a right answer, and they can be settled here
 * without a screen to look at.
 */

/** A control that sweeps, but has a value it rests at. */
export type Range = {
  min: number;
  max: number;
  /** Where the control is doing nothing at all. */
  normal: number;
  /** The gap between the values a drag is allowed to stop on. */
  step: number;
  /**
   * How far either side of `normal` still lands exactly on it.
   *
   * Wider than half a step, and that is the whole point. Normal is the value
   * people go back to, and half a step of the speed slider is about five
   * pixels of a phone's width — a target the width of a matchstick for the one
   * value that has to be easy. Widening it costs the two neighbouring steps
   * some of their own room, which they can afford; it must never cost them all
   * of it, so this stays below a full step.
   */
  detent: number;
  /**
   * Digits kept. Also what undoes the error in counting up by a fraction:
   * twenty hops of 0.05 from 0.5 arrive at 1.0000000000000002, and a value
   * that is not quite one is not quite normal.
   */
  decimals: number;
};

/**
 * Speed, from half to double.
 *
 * Both ends are where the recording stops being the recording. Under a half,
 * speech slurs into something you have to decode rather than hear; over
 * double, you are no longer following it, only checking that it is there. The
 * twentieth-of-a-step in between is finer than anyone can hear a change at,
 * which is what makes it feel continuous.
 */
export const SPEED: Range = {
  min: 0.5,
  max: 2,
  normal: 1,
  step: 0.05,
  detent: 0.035,
  decimals: 2,
};

/**
 * Pitch, counted in semitones, a fifth either way.
 *
 * Semitones because that is the unit it is heard in — a multiplier of 1.06
 * means nothing to anybody, one semitone means a great deal — and the
 * conversion to what ExoPlayer wants is below.
 *
 * A fifth rather than the octave this used to offer, for the reason the whole
 * control was rebuilt. Shifting a song to sit in your own range is a few
 * semitones at most; past a fifth you are not transposing a performance any
 * more, you are making a tape effect out of it. Two octaves of travel spent
 * almost entirely on values nobody picks is what made the ones people do pick
 * hard to place, and narrowing the range is what buys them room.
 */
export const PITCH: Range = {
  min: -7,
  max: 7,
  normal: 0,
  step: 1,
  detent: 0.7,
  decimals: 0,
};

/**
 * The nearest value a drag is allowed to stop on.
 *
 * Normal is asked about before the grid is, so that the detent can be wider
 * than the step without the grid quietly overruling it.
 */
export function snap(value: number, range: Range): number {
  if (!Number.isFinite(value)) return range.normal;
  const held = Math.min(range.max, Math.max(range.min, value));
  if (Math.abs(held - range.normal) <= range.detent) return range.normal;
  const stepped = range.min + Math.round((held - range.min) / range.step) * range.step;
  const factor = 10 ** range.decimals;
  return Math.min(range.max, Math.max(range.min, Math.round(stepped * factor) / factor));
}

/**
 * Speed as it is written on the control.
 *
 * Trailing zeros go because they are noise that changes width: a readout
 * flicking between `1.50×` and `1.55×` while `1×` sits at half the length is
 * harder to read at a glance than the shortest true form of each.
 */
export function formatSpeed(value: number): string {
  return `${value.toFixed(SPEED.decimals).replace(/\.?0+$/, '')}×`;
}

/**
 * Pitch as it is written on the control.
 *
 * Zero is named rather than numbered. `0` is a reading you have to interpret;
 * `Normal` is the answer to the question the reader is actually asking, which
 * is whether anything is being done to the sound.
 */
export function formatSemitones(value: number): string {
  if (value === 0) return 'Normal';
  return `${value > 0 ? '+' : ''}${value.toFixed(PITCH.decimals)}`;
}

/** Semitones as the frequency multiplier the player is set with. */
export function multiplierOf(semitones: number): number {
  return 2 ** (snap(semitones, PITCH) / 12);
}

/**
 * The multiplier the player is holding, read back as semitones.
 *
 * Clamped, so a value set further out by an older build of the app — the pitch
 * control used to reach a full octave — shows at the end of the slider instead
 * of off it. It is put right the moment anything is touched.
 */
export function semitonesOf(multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return PITCH.normal;
  return snap(12 * Math.log2(multiplier), PITCH);
}
