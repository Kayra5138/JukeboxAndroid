import { strings, type Strings } from '../i18n/languages.ts';

/**
 * The equalizer's bands, as numbers: what one may be, what a set of them does
 * to each frequency, and how much room that needs.
 *
 * The filtering itself happens in the player, in Kotlin, and this file does
 * the same sums it does there (`Response.kt`) for two things the screen needs
 * without waiting on the player: the curve it draws, which has to follow a
 * finger, and the preamp it says the curve will get. Nothing here touches
 * React or the native module, so the tests can ask it for numbers.
 */

export type BandType = 'peak' | 'lowShelf' | 'highShelf';

export type Band = {
  type: BandType;
  frequencyHz: number;
  gainDb: number;
  q: number;
};

/**
 * A curve with a name. `preampDb` is the level trim that goes with it, or
 * null for the one worked out from the bands.
 */
export type Preset = {
  name: string;
  preampDb: number | null;
  bands: Band[];
};

/*
  The limits, which are the player's and are repeated here so a slider and the
  thing enforcing its range agree. The player holds whatever it is sent inside
  them regardless.
*/
export const MAX_BANDS = 12;
export const MIN_HZ = 20;
export const MAX_HZ = 20_000;
/** What AutoEQ allows its own filters, so that any file of its can be taken whole. */
export const MAX_GAIN_DB = 20;
export const MIN_Q = 0.1;
export const MAX_Q = 10;
export const MIN_PREAMP_DB = -30;
export const MAX_PREAMP_DB = 12;

/** The sample rate the curve is drawn at. The player uses the stream's own. */
export const REFERENCE_RATE = 48_000;

const BAND_TYPES: BandType[] = ['peak', 'lowShelf', 'highShelf'];

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** A band from anything, with every number somewhere a filter can be made from it. */
export function heldBand(band: Partial<Band> | null | undefined): Band {
  const type = BAND_TYPES.includes(band?.type as BandType) ? (band?.type as BandType) : 'peak';
  return {
    type,
    frequencyHz: clamp(finite(band?.frequencyHz, 1_000), MIN_HZ, MAX_HZ),
    gainDb: clamp(finite(band?.gainDb, 0), -MAX_GAIN_DB, MAX_GAIN_DB),
    q: clamp(finite(band?.q, 1), MIN_Q, MAX_Q),
  };
}

export function heldPreamp(preampDb: number | null | undefined): number | null {
  if (typeof preampDb !== 'number' || !Number.isFinite(preampDb)) return null;
  return clamp(preampDb, MIN_PREAMP_DB, MAX_PREAMP_DB);
}

/**
 * One band as a filter's five coefficients -- b0, b1, b2, a1, a2 over a0 --
 * or null where it does nothing. The Audio EQ Cookbook's designs, which are
 * the ones Equalizer APO uses and AutoEQ fits its corrections to.
 */
export function section(band: Band, rate: number = REFERENCE_RATE): number[] | null {
  const held = heldBand(band);
  if (held.gainDb === 0 || rate <= 0) return null;

  // Too near half the sample rate to be a filter; see `Response.kt`.
  if (held.frequencyHz >= rate * 0.49) {
    return held.type === 'lowShelf' ? [10 ** (held.gainDb / 20), 0, 0, 0, 0] : null;
  }

  const a = 10 ** (held.gainDb / 40);
  const w0 = (2 * Math.PI * held.frequencyHz) / rate;
  const cosine = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * held.q);
  const edge = 2 * Math.sqrt(a) * alpha;

  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (held.type === 'peak') {
    b0 = 1 + alpha * a;
    b1 = -2 * cosine;
    b2 = 1 - alpha * a;
    a0 = 1 + alpha / a;
    a1 = -2 * cosine;
    a2 = 1 - alpha / a;
  } else if (held.type === 'lowShelf') {
    b0 = a * (a + 1 - (a - 1) * cosine + edge);
    b1 = 2 * a * (a - 1 - (a + 1) * cosine);
    b2 = a * (a + 1 - (a - 1) * cosine - edge);
    a0 = a + 1 + (a - 1) * cosine + edge;
    a1 = -2 * (a - 1 + (a + 1) * cosine);
    a2 = a + 1 + (a - 1) * cosine - edge;
  } else {
    b0 = a * (a + 1 + (a - 1) * cosine + edge);
    b1 = -2 * a * (a - 1 + (a + 1) * cosine);
    b2 = a * (a + 1 + (a - 1) * cosine - edge);
    a0 = a + 1 - (a - 1) * cosine + edge;
    a1 = 2 * (a - 1 - (a + 1) * cosine);
    a2 = a + 1 - (a - 1) * cosine - edge;
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

function power([b0, b1, b2, a1, a2]: number[], hz: number, rate: number): number {
  const w = (2 * Math.PI * hz) / rate;
  const once = Math.cos(w);
  const twice = Math.cos(2 * w);
  const above = b0 * b0 + b1 * b1 + b2 * b2 + 2 * (b0 * b1 + b1 * b2) * once + 2 * b0 * b2 * twice;
  const below = 1 + a1 * a1 + a2 * a2 + 2 * (a1 + a1 * a2) * once + 2 * a2 * twice;
  return below > 0 ? above / below : 1;
}

/*
  The filters are designed once and then asked about many frequencies, rather
  than designed again for each: a curve is eighty questions and the search for
  its highest point two hundred and fifty, of up to twelve filters apiece, and
  all of it is done again on every step of a slider being dragged.
*/
function sectionsOf(bands: Band[], rate: number): number[][] {
  const made: number[][] = [];
  for (const band of bands) {
    const one = section(band, rate);
    if (one) made.push(one);
  }
  return made;
}

function gainOf(sections: number[][], hz: number, rate: number): number {
  let total = 0;
  for (const made of sections) total += 10 * Math.log10(Math.max(power(made, hz, rate), 1e-30));
  return total;
}

/**
 * How many decibels the bands together turn a tone at `hz` up or down.
 *
 * The bands only, without the preamp: this is the shape, and the preamp is
 * where the whole of it is then put.
 */
export function gainDb(bands: Band[], hz: number, rate: number = REFERENCE_RATE): number {
  return gainOf(sectionsOf(bands, rate), hz, rate);
}

/**
 * The most the bands turn anything up, between 20 Hz and 20 kHz.
 *
 * Walked a twenty-fourth of an octave at a time, and looked at on every
 * band's own frequency too: the top of a narrow peak is at its centre, and
 * even steps would straddle it.
 */
export function peakDb(bands: Band[], rate: number = REFERENCE_RATE): number {
  const sections = sectionsOf(bands, rate);
  const top = Math.min(MAX_HZ, rate * 0.49);
  const ratio = 2 ** (1 / 24);
  let highest = -Infinity;
  for (let hz = MIN_HZ; hz <= top; hz *= ratio) highest = Math.max(highest, gainOf(sections, hz, rate));
  for (const band of bands) {
    const at = heldBand(band).frequencyHz;
    if (at <= top) highest = Math.max(highest, gainOf(sections, at, rate));
  }
  return Number.isFinite(highest) ? highest : 0;
}

/**
 * The preamp a curve gets where nobody has chosen one: down by as much as
 * its highest point goes up, so that a boost becomes everything else being
 * cut and a recording already at full scale has nowhere to clip. Never
 * positive -- a curve that only cuts is left quieter.
 */
export function autoPreampDb(bands: Band[], rate: number = REFERENCE_RATE): number {
  const peak = peakDb(bands, rate);
  return peak > 0 ? -peak : 0;
}

/** How far along a log axis from 20 Hz to 20 kHz a frequency sits, 0 to 1. */
export function positionOfHz(hz: number): number {
  return clamp(Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ), 0, 1);
}

/** And the frequency that far along it. */
export function hzAtPosition(position: number): number {
  return MIN_HZ * (MAX_HZ / MIN_HZ) ** clamp(position, 0, 1);
}

/**
 * The curve as `count` points evenly spaced along that axis, in decibels.
 *
 * The first is 20 Hz and the last 20 kHz. This is everything the drawing
 * needs: where each point goes across is its place in the list.
 */
export function responseCurve(bands: Band[], count: number, rate: number = REFERENCE_RATE): number[] {
  const sections = sectionsOf(bands, rate);
  const points: number[] = [];
  for (let index = 0; index < count; index++) {
    points.push(gainOf(sections, hzAtPosition(count === 1 ? 0 : index / (count - 1)), rate));
  }
  return points;
}

/**
 * How many decibels either side of nought a drawing of this curve should
 * show: twelve, unless the curve goes further, and then the next six up.
 */
export function curveSpan(points: number[]): number {
  let furthest = 0;
  for (const point of points) furthest = Math.max(furthest, Math.abs(point));
  return Math.max(12, Math.ceil(furthest / 6 - 1e-9) * 6);
}

/**
 * Where a new band should start out: in the middle of the widest stretch of
 * the range that has no band in it yet.
 *
 * Every new one at 1 kHz would be a pile of them to pull apart by hand. The
 * ends of the range count as occupied, so the first band lands in the middle
 * and the next ones in the spaces either side.
 */
export function nextBandHz(bands: Band[]): number {
  const taken = [0, 1, ...bands.map((band) => positionOfHz(band.frequencyHz))].sort((a, b) => a - b);
  let at = 0.5;
  let widest = -1;
  for (let index = 1; index < taken.length; index++) {
    const gap = taken[index] - taken[index - 1];
    if (gap > widest + 1e-9) {
      widest = gap;
      at = (taken[index] + taken[index - 1]) / 2;
    }
  }
  return roundedHz(hzAtPosition(at));
}

/** A frequency to the precision a slider can honestly be placed at. */
export function roundedHz(hz: number): number {
  const step = hz < 100 ? 1 : hz < 1_000 ? 5 : hz < 10_000 ? 50 : 100;
  return clamp(Math.round(hz / step) * step, MIN_HZ, MAX_HZ);
}

/** A width to two figures: 0.71, 1.4, 10. */
export function roundedQ(q: number): number {
  const held = clamp(q, MIN_Q, MAX_Q);
  const step = held < 1 ? 0.01 : 0.1;
  return clamp(Number((Math.round(held / step) * step).toFixed(2)), MIN_Q, MAX_Q);
}

export function sameBands(one: Band[], other: Band[]): boolean {
  if (one.length !== other.length) return false;
  return one.every((band, index) => {
    const against = other[index];
    return (
      band.type === against.type &&
      band.frequencyHz === against.frequencyHz &&
      band.gainDb === against.gainDb &&
      band.q === against.q
    );
  });
}

/**
 * The number somebody typed, or null if it is not one.
 *
 * A comma is taken for a decimal point, since half the world types it, and a
 * trailing `k` for thousands, since nobody wants to type the noughts of
 * 12000. The proper minus sign is taken too; a keyboard may offer either.
 */
export function numberFrom(text: string): number | null {
  const cleaned = text.trim().replace(/−/g, '-').replace(',', '.').replace(/\s+/g, '');
  const match = /^([-+]?(?:\d+\.?\d*|\.\d+))(k)?(?:hz|db)?$/i.exec(cleaned);
  if (!match) return null;
  const value = Number(match[1]) * (match[2] ? 1_000 : 1);
  return Number.isFinite(value) ? value : null;
}

/**
 * A figure to at most [places] decimals and no more of them than it needs,
 * with the decimal mark of the language: `105`, `1.45`, `0,7`.
 *
 * None of these reach a thousand, so there is never a second mark to tell
 * from the first.
 */
function shortest(value: number, places: number, t: Strings): string {
  if (places === 0) return String(Math.round(value));
  return t.format
    .decimal(value, places)
    .replace(/([.,]\d*?)0+$/, '$1')
    .replace(/[.,]$/, '');
}

/**
 * `105 Hz`, `1.45 kHz`, `10 kHz`.
 *
 * [t] is the language to write it in, here and in the two below: only the
 * decimal mark differs, but a Turkish reader types `1,45` and should be shown
 * it. A screen passes the table `useT()` gave it; see `describeTimer`.
 */
export function formatHz(hz: number, t: Strings = strings()): string {
  if (hz < 1_000) return `${shortest(hz, hz < 100 ? 1 : 0, t)} Hz`;
  return `${shortest(hz / 1_000, 2, t)} kHz`;
}

/** `+5.5 dB`, `−3.4 dB`, `0 dB` -- with a real minus, which is as wide as the plus. */
export function formatDb(db: number, t: Strings = strings()): string {
  const rounded = Number(db.toFixed(1));
  if (rounded === 0) return '0 dB';
  return `${rounded > 0 ? '+' : '−'}${shortest(Math.abs(rounded), 1, t)} dB`;
}

export function formatQ(q: number, t: Strings = strings()): string {
  return shortest(q, 2, t);
}

/**
 * The curve in a sentence, for somebody who cannot see it drawn.
 *
 * Where it is highest and where it is lowest, which is what a glance at the
 * picture gives. `points` are as `responseCurve` returns them.
 */
export function describeCurve(points: number[], t: Strings = strings()): string {
  let highest = 0;
  let lowest = 0;
  points.forEach((point, index) => {
    if (point > points[highest]) highest = index;
    if (point < points[lowest]) lowest = index;
  });
  const at = (index: number) =>
    formatHz(roundedHz(hzAtPosition(points.length <= 1 ? 0 : index / (points.length - 1))), t);
  const up = points.length > 0 && points[highest] >= 0.05;
  const down = points.length > 0 && points[lowest] <= -0.05;
  if (!up && !down) return t.sound.curve.flat;
  const high = formatDb(points[highest], t);
  const low = formatDb(points[lowest], t);
  if (up && down) return t.sound.curve.highestAndLowest(high, at(highest), low, at(lowest));
  return up ? t.sound.curve.highest(high, at(highest)) : t.sound.curve.lowest(low, at(lowest));
}
