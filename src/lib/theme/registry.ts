import { aero } from './themes/aero.ts';
import { aurora } from './themes/aurora.ts';
import { black } from './themes/black.ts';
import { contrast } from './themes/contrast.ts';
import { cover } from './themes/cover.ts';
import { custom } from './themes/custom.ts';
import { dark } from './themes/dark.ts';
import { dusk } from './themes/dusk.ts';
import { forest } from './themes/forest.ts';
import { frost } from './themes/frost.ts';
import { glass } from './themes/glass.ts';
import { ice } from './themes/ice.ts';
import { lavender } from './themes/lavender.ts';
import { light } from './themes/light.ts';
import { material } from './themes/material.ts';
import { midnight } from './themes/midnight.ts';
import { mint } from './themes/mint.ts';
import { pastel } from './themes/pastel.ts';
import { peach } from './themes/peach.ts';
import { plum } from './themes/plum.ts';
import { sepia } from './themes/sepia.ts';
import { sunset } from './themes/sunset.ts';
import type { Need, Surroundings, Theme, ThemeGroup } from './tokens.ts';
import { createStore } from '../ui/store.ts';

/**
 * The themes there are, in the order the picker shows them.
 *
 * Adding one is a file beside `dark.ts` answering the same tokens, a line
 * here, and its name in each language's `themes`. Nothing else knows how many
 * there are: the picker is drawn from this list, and screens only ever read
 * tokens.
 *
 * A theme that is worked out as the app runs — from the cover of what is
 * playing, from the phone's wallpaper, from colours somebody chose — is the
 * same line here. What makes it different is in its own file, as a `dynamic`
 * that says what it needs and what to make of it; `resolveTheme` below is the
 * only thing that looks.
 */
export const THEMES = [
  light,
  dark,
  pastel,
  sepia,
  ice,
  mint,
  lavender,
  peach,
  black,
  midnight,
  forest,
  sunset,
  dusk,
  plum,
  contrast,
  cover,
  material,
  custom,
  glass,
  frost,
  aero,
  aurora,
] as const satisfies readonly Theme[];

export type ThemeId = (typeof THEMES)[number]['id'];

/** Follow the phone, or one theme by name. */
export type ThemeChoice = 'system' | ThemeId;

/** What `'system'` means when the phone is in its light mode, and in its dark one. */
export const SYSTEM_LIGHT: ThemeId = 'light';
export const SYSTEM_DARK: ThemeId = 'dark';

export const DEFAULT_THEME_CHOICE: ThemeChoice = 'system';

/** The groups the picker lays the themes out in, in its order. */
export const THEME_GROUPS = ['basic', 'light', 'dark', 'effects', 'special'] as const satisfies readonly ThemeGroup[];

export function themeOf(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? dark;
}

/** The choice a stored setting means. A theme that has since been removed is no choice at all. */
export function themeChoiceFrom(stored: string | null): ThemeChoice {
  return THEMES.find((theme) => theme.id === stored)?.id ?? DEFAULT_THEME_CHOICE;
}

/** What is known when nothing has been found out: a dark phone, silent, from before Android 12, with no colours chosen. */
export const NOTHING_AROUND: Surroundings = { scheme: 'dark', cover: null, system: null, custom: null };

/**
 * The last thing each worked-out theme was worked out to, and from what.
 *
 * Screens are redrawn when the theme they are handed is a different object,
 * and their styles are kept by palette; a theme made afresh on every ask
 * would look like a change of theme every time anything was drawn. So the
 * same surroundings get the same object back. One answer a theme is plenty:
 * the surroundings move forwards, and nobody asks about the track before.
 */
const worked = new Map<string, { around: Surroundings; theme: Theme }>();

/** A theme as it is in these surroundings: itself, if it is written down. */
function inSurroundings(theme: Theme, around: Surroundings): Theme {
  if (!theme.dynamic) return theme;
  const last = worked.get(theme.id);
  if (
    last &&
    last.around.scheme === around.scheme &&
    last.around.cover === around.cover &&
    last.around.system === around.system &&
    last.around.custom === around.custom
  ) {
    return last.theme;
  }
  const { base, colours } = theme.dynamic.resolve(around);
  const made: Theme = { ...theme, base, colours };
  worked.set(theme.id, { around, theme: made });
  return made;
}

/**
 * The theme to draw with, from what was chosen and what the phone says.
 *
 * A phone that does not say is taken to be dark. That is what the app was
 * before it could be anything else, and it is the kinder guess to be wrong
 * with: a dark screen in a bright room is dim, a white one in a dark room is
 * a torch.
 *
 * [around] is for the themes that are worked out, and can be left off by
 * anything that only wants to know which theme a choice means.
 */
export function resolveTheme(
  choice: ThemeChoice,
  system: string | null | undefined,
  around: Omit<Surroundings, 'scheme'> = NOTHING_AROUND
): Theme {
  const scheme = system === 'light' ? 'light' : 'dark';
  const theme = choice === 'system' ? themeOf(scheme === 'light' ? SYSTEM_LIGHT : SYSTEM_DARK) : themeOf(choice);
  if (!theme.dynamic) return theme;
  /*
    Only what the theme said it needs is passed on, so that it is not made
    again for a change in something it never looks at: the cover changing
    under the wallpaper's theme is no change to it.
  */
  return inSurroundings(theme, {
    scheme,
    cover: theme.dynamic.needs.includes('cover') ? around.cover : null,
    system: theme.dynamic.needs.includes('system') ? around.system : null,
    custom: theme.dynamic.needs.includes('custom') ? around.custom : null,
  });
}

/** Whether a theme can be offered on this phone. Every written-down theme can. */
export function isOffered(theme: Theme, around: Surroundings): boolean {
  return theme.dynamic?.available?.(around) ?? true;
}

/** What has to be fetched for a choice to be drawn: nothing, for most. */
export function needsOf(choice: ThemeChoice): readonly Need[] {
  return choice === 'system' ? [] : (themeOf(choice).dynamic?.needs ?? []);
}

/** What has been chosen. Set through `chooseTheme`; read by `useTheme`. */
export const currentThemeChoice = createStore<ThemeChoice>(DEFAULT_THEME_CHOICE);

/**
 * The cover's colours, the phone's palette and the colours of the theme
 * somebody made, as last found out.
 *
 * Held like the choice, outside React, and for the same reason: the theme is
 * read by everything, including the layout that sits above the player, and
 * what the cover is can only be known below it. Whoever knows writes here;
 * whoever draws reads, and neither has to be inside the other.
 */
export const themeSurroundings = createStore<Omit<Surroundings, 'scheme'>>(NOTHING_AROUND);
