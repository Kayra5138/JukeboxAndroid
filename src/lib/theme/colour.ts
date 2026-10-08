/**
 * The arithmetic of colours, for the themes that are worked out rather than
 * written down, and for the few places a screen wants a token at less than
 * full strength.
 *
 * Nothing here knows about React or the phone, so all of it can be tested.
 *
 * Lightness and hue are reckoned in OKLCH rather than in HSL. The two that
 * are computed — an accent from an album cover, a palette from the phone's
 * wallpaper — both come down to "this colour, but light enough to read", and
 * HSL's lightness is not what the eye calls light: its yellow at a half is a
 * lamp and its blue at a half is ink. In OKLCH a step of lightness is the same
 * step whatever the hue, and moving it leaves the hue where it was.
 */

export type Rgb = [number, number, number];

/** Lightness from nought to one, chroma from nought to about a third, hue in degrees. */
export type Lch = { l: number; c: number; h: number };

/**
 * The red, green and blue of `#rgb`, `#rrggbb` or `#rrggbbaa`, each out of
 * 255, and the alpha out of one. Null for anything else.
 */
export function parseColour(colour: string): { rgb: Rgb; alpha: number } | null {
  const hex = colour.trim().replace(/^#/, '');
  if (/[^0-9a-f]/i.test(hex)) return null;
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : hex;
  if (full.length !== 6 && full.length !== 8) return null;
  const at = (from: number) => parseInt(full.slice(from, from + 2), 16);
  return { rgb: [at(0), at(2), at(4)], alpha: full.length === 8 ? at(6) / 255 : 1 };
}

function two(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
}

export function toHex([r, g, b]: Rgb): string {
  return `#${two(r)}${two(g)}${two(b)}`;
}

/**
 * A colour at part strength: `withAlpha(c.accent, 0.18)`.
 *
 * What a screen calls when it wants a token seen through. Sticking two digits
 * on the end of the token did the same and only worked while every token was
 * written as six digits, which nothing promised; this reads the three forms a
 * token is ever written in, and a colour that already carries an alpha comes
 * out carrying the two multiplied. Anything it cannot read is handed back as
 * it came, which is a solid colour where a faint one was wanted and still a
 * colour.
 */
export function withAlpha(colour: string, alpha: number): string {
  const parsed = parseColour(colour);
  if (!parsed) return colour;
  const strength = Math.max(0, Math.min(1, alpha)) * parsed.alpha;
  return `${toHex(parsed.rgb)}${two(strength * 255)}`;
}

function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function encoded(value: number): number {
  const clipped = Math.max(0, Math.min(1, value));
  return 255 * (clipped <= 0.0031308 ? clipped * 12.92 : 1.055 * clipped ** (1 / 2.4) - 0.055);
}

/** How bright a colour is to the eye, from nought to one, as WCAG reckons it. An alpha is ignored. */
export function luminance(colour: string): number {
  const parsed = parseColour(colour);
  if (!parsed) return 0;
  const [r, g, b] = parsed.rgb;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG's contrast between two colours: one for the same colour twice, twenty-one for black on white. */
export function contrast(a: string, b: string): number {
  const one = luminance(a);
  const other = luminance(b);
  return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);
}

/** The colour `amount` of the way from `from` to `to`, as paint mixes: channel by channel. */
export function mix(from: string, to: string, amount: number): string {
  const a = parseColour(from);
  const b = parseColour(to);
  if (!a || !b) return from;
  const part = (index: 0 | 1 | 2) => a.rgb[index] + (b.rgb[index] - a.rgb[index]) * amount;
  return toHex([part(0), part(1), part(2)]);
}

export function toLch(colour: string): Lch {
  const parsed = parseColour(colour);
  if (!parsed) return { l: 0, c: 0, h: 0 };
  const [r, g, b] = parsed.rgb.map(linear) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bee = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = (Math.atan2(bee, a) * 180) / Math.PI;
  return { l: lightness, c: Math.hypot(a, bee), h: hue < 0 ? hue + 360 : hue };
}

/** The linear red, green and blue of an OKLCH colour, which may fall outside what a screen can show. */
function unclipped({ l, c, h }: Lch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];
}

/**
 * An OKLCH colour as a `#rrggbb` a screen can show.
 *
 * Not every lightness can carry every chroma — there is no such thing as a
 * very light, very strong blue — and a colour asked for outside what there is
 * gives up chroma until it fits. Clipping the channels instead would be
 * quicker and would bend the hue, which is the one thing a caller moving a
 * colour's lightness is trying to keep.
 */
export function fromLch(lch: Lch): string {
  const l = Math.max(0, Math.min(1, lch.l));
  const fits = (rgb: Rgb) => rgb.every((value) => value >= -0.0005 && value <= 1.0005);
  let c = Math.max(0, lch.c);
  let rgb = unclipped({ l, c, h: lch.h });
  if (!fits(rgb)) {
    let low = 0;
    let high = c;
    for (let step = 0; step < 18; step++) {
      c = (low + high) / 2;
      if (fits(unclipped({ l, c, h: lch.h }))) low = c;
      else high = c;
    }
    rgb = unclipped({ l, c: low, h: lch.h });
  }
  return toHex(rgb.map(encoded) as Rgb);
}

/**
 * Whichever of two inks is the easier to read on a fill: `inkOn(accent, dark, white)`.
 */
export function inkOn(fill: string, one: string, other: string): string {
  return contrast(one, fill) >= contrast(other, fill) ? one : other;
}

/**
 * A colour made readable on everything it will be written on, by moving its
 * lightness and nothing else.
 *
 * Away from the grounds: lighter on dark ones, darker on light ones. In steps
 * of a hundredth, stopping at the first that clears `ratio` on every ground,
 * so a colour that already does comes back untouched and one that does not is
 * moved no further than it has to be. A colour that cannot be made to — the
 * grounds are a mid grey, say, which nothing is readable on — ends as white or
 * black, whichever is the better of the two.
 */
export function readableOn(colour: string, grounds: readonly string[], ratio: number): string {
  const worst = (candidate: string) =>
    Math.min(...grounds.map((ground) => contrast(candidate, ground)));
  if (grounds.length === 0 || worst(colour) >= ratio) return colour;

  const mean = grounds.reduce((sum, ground) => sum + luminance(ground), 0) / grounds.length;
  // The luminance black and white are equally far from, by contrast.
  const lighter = mean < 0.179;
  const lch = toLch(colour);
  for (let l = lch.l; l >= 0 && l <= 1; l += lighter ? 0.01 : -0.01) {
    const candidate = fromLch({ ...lch, l });
    if (worst(candidate) >= ratio) return candidate;
  }
  return worst('#ffffff') >= worst('#000000') ? '#ffffff' : '#000000';
}
