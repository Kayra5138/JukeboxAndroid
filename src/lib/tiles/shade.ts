/**
 * The handful of colours a key is painted with, from whatever the sleeve gave.
 *
 * The cover is asked for a few colours and may answer with one, with several,
 * or with several that are nearly the same. A gradient wants three that are
 * recognisably a light, a middle and a dark, so this makes up whatever the
 * record did not supply rather than letting the key come out flat on some
 * sleeves and striped on others.
 */

/** `#rgb` and `#rrggbb`, which is everything the colour reader produces. */
function parse(colour: string): [number, number, number] | null {
  const hex = colour.trim().replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function hex([r, g, b]: [number, number, number]): string {
  const two = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${two(r)}${two(g)}${two(b)}`;
}

/**
 * The same colour moved towards white or black.
 *
 * Towards white rather than simply multiplied up, because multiplying a
 * saturated colour past its own ceiling only shifts its hue — a red scaled by
 * one and a half is the same red with the green and blue still at nothing,
 * which is not a highlight. Mixing with white keeps the hue and raises it.
 */
export function lift(colour: string, towards: number): string {
  const rgb = parse(colour);
  if (!rgb) return colour;
  const end = towards > 0 ? 255 : 0;
  const amount = Math.abs(towards);
  return hex([
    rgb[0] + (end - rgb[0]) * amount,
    rgb[1] + (end - rgb[1]) * amount,
    rgb[2] + (end - rgb[2]) * amount,
  ]);
}

/** Roughly how bright a colour is, which is all that is needed to order them. */
function brightness(colour: string): number {
  const rgb = parse(colour);
  return rgb ? rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 : 0;
}

/**
 * Three colours to paint a key down, lightest first.
 *
 * Both ends are made from the face rather than taken from the sleeve, and that
 * is the point. Taking them from the sleeve was tried: a key would then be
 * painted from one of the record's colours to another, which sounds better and
 * is wrong, because nothing guarantees the two are in the right order. A dark
 * navy over a warm orange is a key whose top is darker than its middle, and a
 * surface lit from below is not a surface anybody recognises. Derived, the ramp
 * is always a light, a face and a shadow.
 *
 * The middle goes through `lift` as well, moved by nothing: the sleeve may
 * answer in the short form, and handing back a three-digit colour between two
 * six-digit ones leaves the caller holding three colours written two ways.
 *
 * Deliberately modest. A key is read at a glance while it falls, and a gradient
 * steep enough to admire is one that makes the top and bottom of the same key
 * look like two different things.
 */
export function keyShades(stops: readonly string[]): [string, string, string] {
  const good = stops.filter((stop) => parse(stop) != null);
  const face = good[good.length - 1] ?? '#6f7cff';
  return [lift(face, 0.26), lift(face, 0), lift(face, -0.32)];
}

/**
 * A different set of three for each column, from the same sleeve.
 *
 * One palette for the whole board made four identical keys falling side by
 * side, which reads as wallpaper rather than as a game: nothing on screen
 * tells you apart from anything else, and a column is only distinguishable by
 * where it is. Giving each column its own colour costs nothing and says
 * something true — the columns *are* different, they are the bands the song
 * was sorted into, low on the left and high on the right.
 *
 * Where the sleeve offered several colours they are dealt out one to a column.
 * Where it offered one, the four are made by walking from a shade darker than
 * it to a shade lighter, which keeps them unmistakably one family and still
 * tells them apart.
 */
export function laneShades(
  stops: readonly string[],
  lane: number,
  lanes: number
): [string, string, string] {
  const good = stops.filter((stop) => parse(stop) != null);
  const place = lanes > 1 ? lane / (lanes - 1) : 0;

  /*
    Low columns darker, high columns lighter, which is the way round a listener
    already expects -- a bass note is not a bright thing. A third either side of
    the sleeve's own is enough to separate four of them without any of them
    stopping being the colour of the record.
  */
  const toward = -0.22 + place * 0.44;

  /*
    Dealt out darkest first where the sleeve gave enough colours, so the columns
    run the same way round whether they were taken from the record or made from
    one of its colours. Four keys that disagree about which end is the bass is
    worse than four that are all the same.
  */
  if (good.length >= lanes) {
    const ordered = [...good].sort((a, b) => brightness(a) - brightness(b));
    return keyShades([ordered[lane % ordered.length]!]);
  }
  const base = good.length > 0 ? good[good.length - 1]! : '#6f7cff';
  return keyShades([lift(base, toward)]);
}
