/**
 * The equalizer's settings, in a shape the bridge will carry.
 *
 * The settings hold "nothing" in places: a preamp of null means the app works
 * it out, on the curve in force and on each one kept. The bridge turns the
 * object into a map on the other side, and a null anywhere inside it is more
 * than that conversion will take — it refuses the whole call with "Value is
 * null, expected an Object". From the screen that looked like a switch that
 * would not turn on and sliders that did nothing, and nothing said why.
 *
 * The player reads a key that is missing exactly as it reads one that is
 * null, so the nothings are left out rather than sent. Undefined goes the same
 * way, for the same reason.
 */
export function forBridge<T>(settings: T): T {
  return strip(settings) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value === null || typeof value !== 'object') return value;

  const kept: Record<string, unknown> = {};
  for (const [key, held] of Object.entries(value)) {
    if (held === null || held === undefined) continue;
    kept[key] = strip(held);
  }
  return kept;
}
