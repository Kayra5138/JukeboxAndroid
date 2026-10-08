import {
  heldBand,
  MAX_BANDS,
  MAX_GAIN_DB,
  MAX_HZ,
  MAX_Q,
  MIN_HZ,
  MIN_Q,
  type Band,
  type BandType,
} from './bands.ts';
import { strings, type Strings } from '../i18n/languages.ts';

/**
 * Reading a headphone correction out of AutoEQ's text.
 *
 * AutoEQ publishes, for a few thousand headphones, the filters that bring
 * each one to a neutral target, as a `ParametricEQ.txt` in the format
 * Equalizer APO reads:
 *
 *     Preamp: -6.2 dB
 *     Filter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70
 *     Filter 2: ON LSC Fc 105 Hz Gain 5.5 dB Q 0.70
 *
 * The text arrives pasted from a web page or read from a file somebody
 * downloaded, so it is read forgivingly: any line endings, any spacing,
 * either case, a decimal comma where a locale put one. What cannot be read
 * is counted rather than guessed at, so the screen can say that part of the
 * file was left behind.
 */
export type AutoEqResult = {
  /** The file's own preamp, or null where it gives none. */
  preampDb: number | null;
  bands: Band[];
  /** Filters switched on that are of a kind this equalizer has not got. */
  unsupported: number;
  /** Filters past the twelfth, which there is no band left for. */
  dropped: number;
  /** Filters whose numbers were outside the limits and were brought in. */
  adjusted: number;
  /**
   * Whether the text is AutoEQ's other file, `GraphicEQ.txt` -- one line of
   * a hundred-odd fixed points, for equalizers of that kind. The commonest
   * way to end up with nothing to import, and worth naming.
   */
  graphic: boolean;
};

/*
  A number as either convention writes it. Only one separator is allowed for,
  and it is the decimal one: these files never group thousands, and a reading
  of "1,000" as a thousand would make "3,4" thirty-four.
*/
const NUMBER = '([-+\\u2212]?\\d+(?:[.,]\\d+)?|[-+\\u2212]?[.,]\\d+)';

const number = (text: string) => Number(text.replace('−', '-').replace(',', '.'));

const TYPES: Record<string, BandType> = {
  PK: 'peak',
  PEQ: 'peak',
  MODAL: 'peak',
  LS: 'lowShelf',
  LSC: 'lowShelf',
  LSQ: 'lowShelf',
  HS: 'highShelf',
  HSC: 'highShelf',
  HSQ: 'highShelf',
};

/**
 * The width a shelf gets when the file does not give one, which Equalizer
 * APO allows. A Butterworth shelf: as steep as it can be with no bump at the
 * corner.
 */
const DEFAULT_SHELF_Q = Math.SQRT1_2;

/** And a peak, where a file leaves it out: about an octave and a third. */
const DEFAULT_PEAK_Q = 1;

/** A bandwidth in octaves as the Q that means the same, by the cookbook's formula. */
function qFromOctaves(octaves: number): number {
  const ratio = 2 ** octaves;
  return Math.sqrt(ratio) / (ratio - 1);
}

export function parseAutoEq(text: string): AutoEqResult {
  const result: AutoEqResult = {
    preampDb: null,
    bands: [],
    unsupported: 0,
    dropped: 0,
    adjusted: 0,
    graphic: false,
  };

  // A file saved by Windows starts with a mark that is not part of any line.
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;

    if (/^GraphicEQ\s*:/i.test(line)) {
      result.graphic = true;
      continue;
    }

    const preamp = new RegExp(`^Preamp\\s*:\\s*${NUMBER}\\s*(?:dB)?`, 'i').exec(line);
    if (preamp) {
      const value = number(preamp[1]);
      if (Number.isFinite(value)) result.preampDb = value;
      continue;
    }

    const filter = /^Filter\s*\d*\s*:\s*(ON|OFF)\s+([A-Za-z]+)(.*)$/i.exec(line);
    if (!filter) continue;
    // Switched off in the file is left out of the curve, not carried as a
    // band at nought: it is the file saying this filter is not part of it.
    if (filter[1].toUpperCase() === 'OFF') continue;

    const type = TYPES[filter[2].toUpperCase()];
    const rest = filter[3];
    const fc = new RegExp(`\\bFc\\s+${NUMBER}\\s*(k?)Hz`, 'i').exec(rest);
    const gain = new RegExp(`\\bGain\\s+${NUMBER}\\s*dB`, 'i').exec(rest);
    if (!type || !fc || !gain) {
      // `NONE` is a placeholder some editors write for an empty slot; every
      // other kind -- a low-pass, a notch -- is a filter that is being lost.
      if (filter[2].toUpperCase() !== 'NONE') result.unsupported++;
      continue;
    }

    const q = new RegExp(`\\bQ\\s+${NUMBER}`, 'i').exec(rest);
    const octaves = new RegExp(`\\bBW\\s+Oct\\s+${NUMBER}`, 'i').exec(rest);
    const wanted: Band = {
      type,
      frequencyHz: number(fc[1]) * (fc[2] ? 1_000 : 1),
      gainDb: number(gain[1]),
      q: q
        ? number(q[1])
        : octaves && number(octaves[1]) > 0
          ? qFromOctaves(number(octaves[1]))
          : type === 'peak'
            ? DEFAULT_PEAK_Q
            : DEFAULT_SHELF_Q,
    };

    if (result.bands.length >= MAX_BANDS) {
      result.dropped++;
      continue;
    }

    const held = heldBand(wanted);
    if (
      wanted.frequencyHz < MIN_HZ ||
      wanted.frequencyHz > MAX_HZ ||
      Math.abs(wanted.gainDb) > MAX_GAIN_DB ||
      wanted.q < MIN_Q ||
      wanted.q > MAX_Q
    ) {
      result.adjusted++;
    }
    result.bands.push(held);
  }

  return result;
}

/**
 * A name for a correction, from the name of the file it came in.
 *
 * AutoEQ names its files after the headphone -- `Sennheiser HD 650
 * ParametricEQ.txt` -- so what is left once the last two words are taken
 * off is the right thing to offer. Offered and not imposed: it fills in the
 * box the user is then asked to confirm.
 */
export function nameFromFile(fileName: string | null | undefined): string {
  if (!fileName) return '';
  return fileName
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .replace(/[\s_-]*Parametric\s*EQ$/i, '')
    .replace(/_/g, ' ')
    .trim();
}

/**
 * What to tell somebody about an import, in a sentence or two.
 *
 * `ok` is false when there was nothing in the text to import, and the message
 * then says why. [t] is the language to say it in; see `describeTimer`.
 */
export function describeImport(
  result: AutoEqResult,
  t: Strings = strings()
): { ok: boolean; message: string } {
  const say = t.sound.autoEq;
  if (result.bands.length === 0) {
    if (result.graphic) return { ok: false, message: say.graphic };
    return { ok: false, message: result.unsupported > 0 ? say.noneSupported : say.noneFound };
  }
  // Each a whole sentence of its own, so they are only ever set side by side.
  const parts = [say.imported(result.bands.length)];
  if (result.dropped > 0) parts.push(say.leftOut(result.dropped, MAX_BANDS));
  if (result.unsupported > 0) parts.push(say.unsupported(result.unsupported));
  if (result.adjusted > 0) parts.push(say.adjusted(result.adjusted));
  return { ok: true, message: parts.join(' ') };
}
