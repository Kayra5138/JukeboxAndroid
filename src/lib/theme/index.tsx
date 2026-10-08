import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  currentThemeChoice,
  isOffered,
  resolveTheme,
  SYSTEM_DARK,
  SYSTEM_LIGHT,
  THEME_GROUPS,
  themeChoiceFrom,
  themeOf,
  THEMES,
  themeSurroundings,
  type ThemeChoice,
  type ThemeId,
} from './registry.ts';
import { readSystemPalette } from './systemPalette.ts';
import type { Palette, Theme, ThemeGroup } from './tokens.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index';

export { withAlpha } from './colour.ts';
export { outlined, outlinedClip, outlineWidth } from './edges.ts';
export { THEMES, type ThemeChoice, type ThemeId } from './registry.ts';
export type { Palette, Theme, ThemeGroup } from './tokens.ts';

/**
 * The half of the theme that needs the app around it: the stored choice, what
 * the phone says, and the hooks a screen draws with.
 *
 * Like the language, the choice is one value held outside React and there is
 * no provider to forget: a component that asks is subscribed. The only context
 * is the one a `ThemeScope` sets, for the parts of the app that are a fixed
 * theme whatever was chosen.
 *
 * A theme that is worked out as the app runs is no exception. What it is
 * worked out from — the cover that is playing, the phone's palette — is one
 * more value held outside React, kept up to date by `ThemeSurroundings`, and
 * a component that asks for the theme is subscribed to that as well.
 */

/** Reads the stored choice. Called once, before anything is drawn; see `loadLanguage` for why. */
export function loadTheme(): void {
  try {
    currentThemeChoice.set(themeChoiceFrom(readSetting(SETTINGS.theme)));
  } catch {
    // Following the phone is the default, and a fine thing to fall back to.
  }
  // Here and not later, so that an app set to the wallpaper's colours opens in them.
  readSystemPalette();
}

/** Changes the theme, for good, and redraws everything. */
export function chooseTheme(choice: ThemeChoice): void {
  currentThemeChoice.set(choice);
  writeSetting(SETTINGS.theme, choice);
}

/** What is chosen, which is not always a theme: for the picker. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(currentThemeChoice.subscribe, currentThemeChoice.get);
}

const Scoped = createContext<Theme | null>(null);

/**
 * The theme this part of the screen is drawn in.
 *
 * Usually the one chosen, or the phone's. Inside a `ThemeScope` it is the
 * scope's, and nothing inside can tell the difference, which is the point.
 */
export function useTheme(): Theme {
  const scoped = useContext(Scoped);
  const choice = useThemeChoice();
  const system = useColorScheme();
  const around = useSyncExternalStore(themeSurroundings.subscribe, themeSurroundings.get);
  return scoped ?? resolveTheme(choice, system, around);
}

/** One line of the picker: something to choose, and the themes it would be drawn in, to show a sample of. */
export type ThemeOffer = {
  id: ThemeChoice;
  /** Its name, as a key of the `themes` section. */
  nameKey: Theme['nameKey'] | 'system';
  /** One theme, or for following the phone the two it goes between, light first. */
  samples: readonly Theme[];
};

/**
 * Everything the picker offers, in its groups and its order, and which of
 * them is in use.
 *
 * From the registry and nothing else: a theme added there is offered here,
 * in the group it names, with a sample drawn from its own tokens. Following
 * the phone is put first as the one choice that is not a theme. A theme that
 * cannot be had on this phone is left out; and should it be the one chosen
 * all the same, what is in use is said to be following the phone, because
 * that is how such a theme draws and something ought to be marked.
 *
 * The worked-out themes are sampled as they are at this moment, so the
 * wallpaper's is shown in the wallpaper's colours before it is chosen.
 */
export function useThemeOffers(): {
  chosen: ThemeChoice;
  groups: { group: ThemeGroup; offers: ThemeOffer[] }[];
} {
  const choice = useThemeChoice();
  const system = useColorScheme();
  const around = useSyncExternalStore(themeSurroundings.subscribe, themeSurroundings.get);
  const scheme = system === 'light' ? 'light' : 'dark';

  const offered = THEMES.filter((theme) => isOffered(theme, { ...around, scheme }));
  const groups = THEME_GROUPS.map((group) => {
    const offers: ThemeOffer[] = offered
      .filter((theme) => theme.group === group)
      .map((theme) => ({
        id: theme.id,
        nameKey: theme.nameKey,
        samples: [resolveTheme(theme.id, system, around)],
      }));
    if (group === 'basic') {
      offers.unshift({
        id: 'system',
        nameKey: 'system',
        samples: [themeOf(SYSTEM_LIGHT), themeOf(SYSTEM_DARK)],
      });
    }
    return { group, offers };
  }).filter((entry) => entry.offers.length > 0);

  return {
    chosen: choice === 'system' || offered.some((theme) => theme.id === choice) ? choice : 'system',
    groups,
  };
}

/** The colours alone, which is nearly always what is wanted: `const c = useColours()`. */
export function useColours(): Palette {
  return useTheme().colours;
}

/**
 * Holds everything inside it to one theme, whatever is chosen.
 *
 * For what has a look of its own: the tiles game, which is lit like an arcade
 * and would be a different game on white, and a surface coloured from an
 * album cover, where the words have to suit the cover and not the theme.
 *
 * [statusBar] is for a scope that fills the screen. The clock and the battery
 * are drawn over it, in whatever shade suits the theme outside, and have to be
 * told that what is under them now is something else. The last one drawn wins
 * and the one beneath comes back when this goes, so nothing has to undo it.
 */
export function ThemeScope({
  theme,
  statusBar = false,
  children,
}: {
  theme: ThemeId;
  statusBar?: boolean;
  children: ReactNode;
}) {
  const held = themeOf(theme);
  return (
    <Scoped.Provider value={held}>
      {statusBar ? <StatusBar style={held.base === 'dark' ? 'light' : 'dark'} /> : null}
      {children}
    </Scoped.Provider>
  );
}

/**
 * A key for a text field that has a hint in it, to be made again with.
 *
 * Android lays a field's hint out once. Given a new hint, or new colours,
 * while it is on screen, it keeps the old layout: the words sit on two lines
 * as if they were still the old ones, until the field is touched. Changing
 * the language did it, and so did changing the theme, since both reach every
 * field that is mounted — the library's search box on its hidden tab among
 * them. A field made afresh measures its own hint, so a field is keyed by
 * everything that would have gone stale: the words and the colours it wears.
 *
 * By the colours and not by the theme's name, because one theme can change
 * its colours as it runs.
 */
export function hintKey(c: Palette, hint: string): string {
  return `${hint}|${c.text}|${c.textDisabled}|${c.surface}|${c.bg}`;
}

/**
 * A file's styles, made from the colours of whatever theme is in use.
 *
 * A style sheet used to be built once, as the file loaded, with its colours
 * written in. It cannot be now — the colours are not known until something is
 * drawn — so the file says how to build it instead and each component asks
 * for the result:
 *
 *     const useStyles = makeStyles((c) => StyleSheet.create({
 *       screen: { flex: 1, backgroundColor: c.bg },
 *     }));
 *
 *     function Screen() {
 *       const styles = useStyles();
 *
 * Built once for each palette and kept, so asking costs a lookup, every
 * component drawing in one theme is handed the very same sheet, and a style
 * from it is as steady a thing to pass to a memoised row as it ever was.
 */
export function makeStyles<T>(build: (c: Palette) => T): () => T {
  const built = new WeakMap<Palette, T>();
  return function useStyles(): T {
    const colours = useColours();
    let styles = built.get(colours);
    if (!styles) {
      styles = build(colours);
      built.set(colours, styles);
    }
    return styles;
  };
}

/**
 * What a `Pressable` is given so that a finger on it shows:
 *
 *     const pressed = usePressed();
 *     ...
 *     <Pressable android_ripple={pressed} onPress={...}>
 *
 * The theme's `pressed` wash, spread from under the finger by Android itself
 * and kept inside the thing pressed, corners and all. Drawn under what the
 * button holds and over its fill, so nothing written on it is dimmed.
 *
 * The same object for as long as the colours are the same, like a style
 * sheet, so that handing it to a memoised row is no reason to draw it again.
 */
export const usePressed = makeStyles((c) => ({ color: c.pressed }));

/**
 * What a `Switch` is coloured with, to be spread onto it:
 * `<Switch value={on} {...switchColours(c, on)} />`.
 *
 * In one place because a switch takes its colours as two props of two shapes,
 * and a dozen switches each choosing four tokens is a dozen chances to choose
 * differently.
 */
export function switchColours(c: Palette, on: boolean) {
  return {
    trackColor: { false: c.switchTrack, true: c.accentMuted },
    thumbColor: on ? c.accent : c.switchThumb,
  };
}
