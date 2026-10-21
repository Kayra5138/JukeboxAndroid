import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { withAlpha } from './colour.ts';
import { effectsOf, veilOf } from './effects.ts';
import { useColours } from './index';
import type { Palette } from './tokens.ts';
import { createStore } from '../ui/store.ts';

/**
 * The veil: what a theme of glass draws over the app while a sheet or a
 * dialog is open on it.
 *
 * A card on the page needs no blur, because the page behind it is already
 * smooth. A sheet is the one piece of glass with something sharp behind it —
 * a list, a row of covers, lines of text — and glass that shows those as
 * they are is a window, not frosted. So while a sheet is up, what it was
 * opened on goes out of focus.
 *
 * It is done from the other side to the way it sounds. Nothing here blurs
 * what is behind a view, which this phone can only be asked for through a
 * library; what is behind is told to draw itself blurred, which React Native
 * can do unaided. That works because of where a sheet is: either in a window
 * of its own, when everything in this one is behind it, or laid over one
 * screen by that screen, which knows what it was laid over.
 *
 * Hence the two halves. A sheet in a window of its own says it is open with
 * `useWindowVeil`, and the `WindowBehind` round the whole app answers. A
 * sheet a screen lays over itself is a sibling of a `Behind` holding the
 * rest of that screen, told by the screen when to veil.
 *
 * In a theme without glass every part of this is a plain view and a hook
 * that counts and is not listened to.
 */

/** Android drew nothing out of focus before 12; there, a veil is not drawn and the scrim does more. */
const CAN_BLUR = Platform.OS !== 'android' || Number(Platform.Version) >= 31;

/**
 * How far, in pixels, what a page of glass is opened over goes out of focus,
 * or nought where the theme is not glass or the phone cannot do it.
 *
 * For a screen pushed over another, which until now hid the one below
 * entirely: see the root layout, where one screen is tried this way.
 */
export function glassOf(c: Palette): number {
  return CAN_BLUR ? veilOf(c) : 0;
}

/**
 * How much of the page's own colour is washed over what shows through a
 * whole screen of glass, so that what is written on it can be read; and how
 * far out of focus what is below it is put.
 *
 * The first try used a sheet's blur under a wash of six tenths, and over a
 * screen that is dark cards on a dark page that left one even colour: it was
 * glass over nothing that could be seen. What is below has to keep its
 * shapes to be there at all. These two numbers are the whole of how a
 * screen of glass looks, wherever one is: a pushed screen, the player, a
 * record opened from the rack.
 */
const WASH = 0.3;
const OUT_OF_FOCUS = 7;

const WASHES = new WeakMap<Palette, ViewStyle>();

/** What a whole screen of glass has for a page: the wash, and nothing else of its own. */
export function glassPage(c: Palette): ViewStyle {
  let made = WASHES.get(c);
  if (!made) {
    made = { backgroundColor: withAlpha(c.bg, WASH) };
    WASHES.set(c, made);
  }
  return made;
}

/** The style that puts what a screen of glass is over out of focus, or null where the theme is not glass. */
export function underGlass(c: Palette): ViewStyle | null {
  return glassOf(c) > 0 ? veils(Math.min(glassOf(c), OUT_OF_FOCUS)) : null;
}

/** How much of its light what is under a screen of glass keeps, where it is also set back. */
const SET_BACK = 0.72;

const BACKS = new Map<number, ViewStyle>();

/**
 * The same, and set back as well: out of focus and with some of its light
 * taken, which is how a thing further off looks. For a screen that is to
 * read as standing in front of the one below and not merely over it.
 */
export function setBack(c: Palette): ViewStyle | null {
  if (glassOf(c) <= 0) return null;
  const radius = Math.min(glassOf(c), OUT_OF_FOCUS);
  let made = BACKS.get(radius);
  if (!made) {
    made = { filter: [{ blur: radius }, { brightness: SET_BACK }] };
    BACKS.set(radius, made);
  }
  return made;
}

/** How many sheets in windows of their own are open. */
const open = createStore(0);

/** How many `Behind`s are veiled: sheets laid over a screen by the screen, and the window's own. */
const laidOver = createStore(0);

/**
 * Whether a sheet of either kind is open anywhere.
 *
 * For what is drawn over the navigator and so over every screen's own
 * sheets, which it should not be: the button that floats over the app steps
 * aside while this is true. It leans on the rule the veil already needs —
 * that whatever lays a sheet over a screen says so through a `Behind`.
 */
export function useSheetOpen(): boolean {
  return useSyncExternalStore(laidOver.subscribe, laidOver.get) > 0;
}

/**
 * Says that a sheet in a window of its own — anything in a `Modal` — is on
 * screen for as long as [visible] is true.
 */
export function useWindowVeil(visible: boolean): void {
  useEffect(() => {
    if (!visible) return;
    open.set(open.get() + 1);
    return () => open.set(Math.max(0, open.get() - 1));
  }, [visible]);
}

/**
 * Everything a sheet laid over a screen was laid over, to go out of focus
 * while [veiled]:
 *
 *     <View style={styles.screen}>
 *       <Behind veiled={picking} style={styles.fill}>…the screen…</Behind>
 *       {picking ? <Sheet /> : null}
 *     </View>
 *
 * Takes the style the view it replaces had, and is that view in every theme
 * but a glass one.
 */
export function Behind({
  veiled,
  style,
  children,
}: {
  veiled: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const c = useColours();
  const radius = veiled && CAN_BLUR ? veilOf(c) : 0;
  useEffect(() => {
    if (!veiled) return;
    laidOver.set(laidOver.get() + 1);
    return () => laidOver.set(Math.max(0, laidOver.get() - 1));
  }, [veiled]);
  /*
    Never folded away. A view that only lays its children out is left out of
    what is really drawn, until it is given something to draw with — and a
    filter is that. It would then be put in, by taking every child out of its
    parent and handing it to the new view: every screen detached from the
    window and attached again each time a sheet opened, and a dialog that is
    detached is dismissed. Kept, it is given its filter where it stands.

    Out of a screen reader's reach as well while it is covered, in every theme
    and not only the blurred ones. Android has no other way to keep a reader
    inside a sheet that is drawn in the same window as the screen it covers:
    left as it was, a swipe past the last row of the sheet walked on into the
    screen underneath, reading out things nobody could see or touch. A sheet in
    a window of its own is a window of its own and is not affected.
  */
  return (
    <View
      collapsable={false}
      style={radius > 0 ? [style, veils(radius)] : style}
      importantForAccessibility={veiled ? 'no-hide-descendants' : 'auto'}>
      {children}
    </View>
  );
}

/** The whole app, to go out of focus while any sheet in a window of its own is open. */
export function WindowBehind({ children }: { children: ReactNode }) {
  const sheets = useSyncExternalStore(open.subscribe, open.get);
  return (
    <Behind veiled={sheets > 0} style={styles.fill}>
      {children}
    </Behind>
  );
}

const VEILS = new Map<number, ViewStyle>();

/** One style a radius, so that a veil that stays up is not a new style each time anything is drawn. */
function veils(radius: number): ViewStyle {
  let made = VEILS.get(radius);
  if (!made) {
    made = { filter: [{ blur: radius }] };
    VEILS.set(radius, made);
  }
  return made;
}

const SCRIMS = new WeakMap<Palette, string>();

/**
 * The colour drawn over the screen behind a sheet: `c.scrim`, nearly always.
 *
 *     backdrop: { flex: 1, backgroundColor: scrimOf(c) },
 *
 * A glass theme's scrim is thin, because the blur under it is what sets the
 * sheet apart and a thick one would hide the very thing that makes it glass.
 * On a phone that cannot blur there is nothing under it but the screen as it
 * was, sharp, showing through a sheet that is itself half clear; so there
 * the scrim is thickened until what is behind is a shape and no longer
 * something to read.
 */
export function scrimOf(c: Palette): string {
  if (CAN_BLUR || !effectsOf(c)?.veil) return c.scrim;
  let made = SCRIMS.get(c);
  if (!made) {
    // Its own colour at most of its strength, whatever strength it was written at.
    made = `${withAlpha(c.scrim, 1).slice(0, 7)}e0`;
    SCRIMS.set(c, made);
  }
  return made;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
