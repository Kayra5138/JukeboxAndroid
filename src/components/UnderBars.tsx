import { createContext, use, useCallback, useState, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { barWashOf } from '../lib/theme/effects';
import { outlineWidth, useColours } from '../lib/theme/index';
import type { Palette } from '../lib/theme/tokens';
import { glassOf } from '../lib/theme/Veil';
import { dockOf, overOf, tabBarOver, type Over } from '../lib/ui/bars';
import { useLandscape } from '../lib/ui/layout';
import { createStore } from '../lib/ui/store';

/**
 * Lists that run on under the bars, in a theme of glass.
 *
 * A bar of glass that a list stops short of is a bar over nothing: what it
 * was for, seeing what is scrolled pass under it, never happens. So in a
 * theme of glass the bars across the screen — the one over a pushed screen,
 * the tabs, the bar of what is playing — are laid over the screen rather
 * than beside it, and the screen's list runs the whole height. What it is
 * told by `useUnderBars` is how far in its first and last rows must start
 * for none of them to be under a bar at rest; it adds that to its own room
 * at the two ends of what it scrolls, and nowhere else, so that the bar it
 * scrolls with still reaches the edges and the last row can still be
 * brought up clear of the tabs.
 *
 * In any other theme every part of this is nothing: the bars keep their
 * room, the numbers are nought, and a screen looks as it always has.
 *
 * What is under a bar is not blurred, only washed over (see `barWashOf`).
 * The veil blurs a screen by telling it to draw itself out of focus, which
 * is a filter on a view that holds still; a bar would need the strip of a
 * moving list beneath it blurred afresh on every frame of a scroll, which
 * React Native cannot be asked for, and which a library could only do by
 * drawing the list a second time into the blur each frame. That is the one
 * thing a scroll cannot be made to pay for.
 */

/** What is around a screen that a bar of its own could be laid over. */
type Around = { top: number; tabs: boolean };

const Context = createContext<Around>({ top: 0, tabs: false });

/**
 * Says what bars are over the screens inside: [top], the bar over a pushed
 * screen where the screen lets its list run under it; [tabs], that the tab
 * bar is along their foot. What is not said is kept from further out.
 */
export function BarsOver({ top, tabs, children }: { top?: number; tabs?: boolean; children: ReactNode }) {
  const around = use(Context);
  const value = { top: top ?? around.top, tabs: tabs ?? around.tabs };
  return <Context value={value}>{children}</Context>;
}

/**
 * How tall the bars at the foot were last seen to be, as drawn.
 *
 * Measured rather than only worked out. Both grow with the size of writing,
 * the bar of what is playing becomes a preview's bar with no warning, and
 * either may be a hairline more or less than any sum; a list kept clear by
 * a guess shows its last row's edge under the bar, or a gap above it. One
 * for the whole app, since the bars are one shape on every screen they are
 * on: the bar of what is playing is drawn afresh by each, and is the same.
 */
const sizes = createStore<{ tabBar: number; player: number }>({ tabBar: 0, player: 0 });

function noteSize(key: 'tabBar' | 'player', height: number) {
  const now = sizes.get();
  const rounded = Math.round(height * 10) / 10;
  if (now[key] !== rounded) sizes.set({ ...now, [key]: rounded });
}

/** The tab bar's height, as laid out, for what keeps clear of it. */
export function noteTabBar(event: LayoutChangeEvent) {
  noteSize('tabBar', event.nativeEvent.layout.height);
}

function notePlayer(event: LayoutChangeEvent) {
  noteSize('player', event.nativeEvent.layout.height);
}

function useSizes() {
  return useSyncExternalStore(sizes.subscribe, sizes.get);
}

/** How tall the tab bar is reckoned to be, inset and all, where it is laid over the screens. */
function useTabBarOver(): number {
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return tabBarOver(useSizes().tabBar, fontScale, insets.bottom);
}

/**
 * How much of this screen is under a bar of glass at either end, to be added
 * to the room at the top and the foot of what it scrolls:
 *
 *     const under = useUnderBars();
 *     contentContainerStyle={[styles.content, { paddingBottom: 32 + under.bottom }]}
 *
 * Nought at both ends in any theme not of glass. [player] is for a screen
 * that has the bar of what is playing along its foot, which is laid over it
 * as well; it counts only while there is something in that bar.
 */
export function useUnderBars({ player = false }: { player?: boolean } = {}): Over {
  const c = useColours();
  const landscape = useLandscape();
  const around = use(Context);
  const measured = useSizes();
  const tabBar = useTabBarOver();
  return overOf({
    glass: glassOf(c) > 0,
    landscape,
    top: around.top,
    tabs: around.tabs,
    tabBar,
    player: player ? measured.player : 0,
  });
}

/**
 * Whether the bars across the screen are laid over it: a theme of glass, on
 * a phone that blurs. For the bars themselves, which take their place and
 * their wash from it.
 */
export function barsLaidOver(c: Palette): boolean {
  return glassOf(c) > 0;
}

/**
 * The bar of what is playing, along the foot of a screen: laid over the
 * screen on top of the tab bar, in a theme of glass, and measured, so that
 * what scrolls under it knows how far to keep clear. In any other theme it
 * is its children where they were, and nothing more.
 */
export function FootDock({ children }: { children: ReactNode }) {
  const c = useColours();
  const landscape = useLandscape();
  const around = use(Context);
  const tabBar = useTabBarOver();
  const bottom = dockOf({ glass: glassOf(c) > 0, landscape, tabs: around.tabs, tabBar });
  if (bottom == null) return children;
  return (
    <View style={[styles.dock, { bottom }]} onLayout={notePlayer}>
      {children}
    </View>
  );
}

/**
 * The fill of a bar of glass that something scrolls under; see `barWashOf`.
 * Null where bars are not glass, so that their own fill stands.
 */
export function barGlass(c: Palette): { backgroundColor: string } | null {
  return barsLaidOver(c) ? { backgroundColor: barWashOf(c) } : null;
}

/**
 * The top of a screen that its list scrolls under, in a theme of glass: the
 * search and the switches over the library, the counts and the buttons over
 * the tags. Laid over the list, and measured, since what is in it comes and
 * goes — a row of buttons while tracks are chosen, a note, a tip:
 *
 *     const top = useLaidOver();
 *     <View style={[styles.header, top.laid && styles.headerOver]} onLayout={top.onLayout}>…
 *     <FlatList contentContainerStyle={{ paddingTop: top.height }} …
 *
 * where `headerOver` is `topGlass(c)`. In any other theme it is not laid
 * over anything, takes its room as it always did, and is not measured.
 */
export function useLaidOver(): {
  laid: boolean;
  height: number;
  onLayout: ((event: LayoutChangeEvent) => void) | undefined;
} {
  const laid = barsLaidOver(useColours());
  const [height, setHeight] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setHeight(Math.round(event.nativeEvent.layout.height * 10) / 10);
  }, []);
  return { laid, height: laid ? height : 0, onLayout: laid ? onLayout : undefined };
}

/**
 * The style that lays a screen's top over its list, as glass: across the
 * top, drawn over the list though it comes before it in the page — so that a
 * screen reader still reads it first — washed, and edged along its foot as
 * the bar over a pushed screen is. Empty where bars are not glass.
 */
export function topGlass(c: Palette, top = 0) {
  if (!barsLaidOver(c)) return {};
  return {
    position: 'absolute' as const,
    top,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: barWashOf(c),
    borderBottomWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderBottomColor: c.border,
  };
}

/**
 * The same along the foot of a screen, for a bar of actions on what has been
 * chosen that a list scrolls under. Measured with `useLaidOver` as well, and
 * the list kept clear of it at its foot.
 */
export function footGlass(c: Palette) {
  if (!barsLaidOver(c)) return {};
  return {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: barWashOf(c),
    borderTopWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderTopColor: c.border,
  };
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0 },
});
