import { THEMES, type ThemeChoice, type ThemeId } from './registry.ts';

/**
 * A different theme each time the app is opened, out of the ones somebody
 * has said they like.
 *
 * Two settings: whether it is on, and which themes it draws from. They are
 * kept apart so that turning it off does not forget the list, and a list can
 * be made before it is turned on.
 *
 * The draw is made once, as the app starts, and what it draws becomes the
 * chosen theme like any other — written down, shown as chosen in the picker,
 * there to be changed by hand for the rest of the day. So nothing else in
 * the app knows about this at all.
 */

/** The themes a stored list names, in the registry's order. One that is no longer a theme is no choice. */
export function poolFrom(stored: string | null): ThemeId[] {
  const named = new Set((stored ?? '').split(','));
  return THEMES.filter((theme) => named.has(theme.id)).map((theme) => theme.id);
}

/** The other direction: what to write down for a list. */
export function poolToSetting(pool: readonly ThemeId[]): string {
  return THEMES.filter((theme) => pool.includes(theme.id))
    .map((theme) => theme.id)
    .join(',');
}

/** A list with one theme put in or taken out. */
export function withTheme(pool: readonly ThemeId[], theme: ThemeId, on: boolean): ThemeId[] {
  return THEMES.filter((entry) => (entry.id === theme ? on : pool.includes(entry.id))).map((entry) => entry.id);
}

/**
 * The theme to open in, or null to leave the choice as it stands.
 *
 * Null with nothing to draw from. With one theme in the list it is that
 * theme, every time, which is what was asked for. With more, never the one
 * the app was last in: the point is a change, and a draw that came up the
 * same twice running would look as if it had not been made.
 *
 * [random] is `Math.random` to the app and whatever a test likes to a test.
 */
export function drawn(pool: readonly ThemeId[], last: ThemeChoice, random: () => number): ThemeId | null {
  if (pool.length === 0) return null;
  const others = pool.length > 1 ? pool.filter((theme) => theme !== last) : pool;
  return others[Math.min(others.length - 1, Math.floor(random() * others.length))] ?? null;
}
