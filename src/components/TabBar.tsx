import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, outlineWidth, useColours } from '../lib/theme/index';
import { useEffect, useState } from 'react';
import { SlidingMark, type MarkPlace } from './SlidingMark';
import { useLandscape } from '../lib/ui/layout';
import { useHiddenTabs } from '../lib/ui/tabs';
import { useTabLabelsShown } from '../lib/ui/tabLabels';
import { haptic } from '../lib/ui/haptics';
import { Frost, readyTab, useFrosted, useTabTarget } from './Frosted';
import { barGlass, barsLaidOver, noteTabBar } from './UnderBars';

/** Wide enough for an icon and a short word under it, and no wider. */
const RAIL_WIDTH = 92;

/** Worked out with the rest of what the bars cover; see there. */
export { tabBarHeight } from '../lib/ui/bars';

/**
 * What a tab bar is handed.
 *
 * Described here rather than imported: the navigator is bundled inside
 * expo-router rather than installed beside it, so its types are not on a path
 * anything can name. This is the whole of what is read.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        /** What a screen reader says for the tab where that is more than its name: Settings with an update waiting. */
        tabBarAccessibilityLabel?: string;
        tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
      };
    }
  >;
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
    preload?: (name: string) => void;
  };
};

/** How long the mark waits on a tab pressed to open before it goes back, should it not. */
const REACH_HELD_MS = 700;

/** How long after the app is up the tabs not yet opened begin to be made, and how far apart. */
const PRELOAD_AFTER_MS = 4000;
const PRELOAD_APART_MS = 1500;
/** The tabs made or opened already: each is made once for the life of the app. */
const made = new Set<string>();

/**
 * The navigation, along the bottom or down the left.
 *
 * Drawn here rather than configured, because the side bar the navigator
 * offers takes its width from its own reckoning and will not be told
 * otherwise — it came out a third of a landscape screen wide, which is the
 * opposite of what moving it there was for. Everything it does is state,
 * descriptors and a navigate call, all of which arrive in the props.
 *
 * Sideways the labels go. The width of a rail is what its widest item needs,
 * a word beside an icon is what makes that wide, and five destinations with
 * distinct icons do not need naming twice.
 */
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  const c = useColours();
  const styles = useStyles();
  /*
    Where each tab lies in the bar, by its key, and how tall the patch round
    an icon and its word is: what the one mark of the open tab is moved by.
  */
  const [cells, setCells] = useState<Record<string, MarkPlace>>({});
  /*
    The tab a finger came down on, which the mark goes to at once rather
    than when the tab has been opened: that is a little later, the app having
    the opening to do first, and on a slow phone a good deal later. Let go of
    once that tab is open, or a while after the finger left without opening it.
  */
  const [reaching, setReaching] = useState<string | null>(null);
  const openKey = state.routes[state.index]?.key ?? '';
  useEffect(() => {
    if (reaching == null) return;
    if (reaching === openKey) {
      setReaching(null);
      return;
    }
    const gone = setTimeout(() => setReaching(null), REACH_HELD_MS);
    return () => clearTimeout(gone);
  }, [openKey, reaching]);
  const [patchHeight, setPatchHeight] = useState(0);
  /*
    In a theme of glass, laid over the foot of the screens rather than under
    them, so that a list runs on beneath it and is seen through it; see
    `UnderBars`. Sideways it is a rail beside them as ever: a list passes
    under nothing down its side.
  */
  const over = barsLaidOver(c) && !landscape;
  /*
    The tabs somebody took off under Settings → Look. Left out of the bar
    and nothing more: the screens are still there for whatever opens one by
    name, Discover's link on the Lists tab among them.
  */
  const hidden = useHiddenTabs() as ReadonlySet<string>;
  // Each tab is the group its stack is in, `(lists)`; the choice of which are shown says `lists`.
  const nameOf = (route: string) => route.replace(/^\((.*)\)$/, '$1');
  // Names under the icons, unless switched off under Settings → Look.
  const named = useTabLabelsShown();
  const open = nameOf(state.routes[state.index]?.name ?? '');
  // The open tab, out of focus behind the bar: see `Frosted`.
  const target = useTabTarget(state.routes[state.index]?.key);
  const frosted = useFrosted(over ? target : null);
  /*
    The tabs not opened yet, made a while after the app is up, one at a time
    and while it is idle, and kept standing out of sight (`TabArea`). Made
    the first time each was opened, as they were, Settings took a sixth of a
    second to come on a fast phone, and a slow one some three times that.
  */
  const routeNames = state.routes.map((route) => route.name).join('|');
  const openName = state.routes[state.index]?.name ?? '';
  useEffect(() => {
    // Begun again from the start at every change of tab, so that it waits for the app to be left alone.
    made.add(openName);
    // Not those taken off the bar, which nobody can open from it.
    const names = routeNames.split('|').filter((name) => !made.has(name) && !hidden.has(name.replace(/^\((.*)\)$/, '$1')));
    const timers: ReturnType<typeof setTimeout>[] = [];
    let idle: number | null = null;
    names.forEach((name, at) => {
      timers.push(
        setTimeout(() => {
          idle = requestIdleCallback(() => {
            made.add(name);
            navigation.preload?.(name);
          });
        }, PRELOAD_AFTER_MS + at * PRELOAD_APART_MS)
      );
    });
    return () => {
      timers.forEach(clearTimeout);
      if (idle != null) cancelIdleCallback(idle);
    };
  }, [hidden, navigation, openName, routeNames]);

  // Taken off while it was open: the library, rather than a tab nobody can see is on.
  useEffect(() => {
    if (open && hidden.has(open)) navigation.navigate('(library)');
  }, [hidden, navigation, open]);

  return (
    <View
      style={[
        landscape ? styles.rail : over ? styles.glassBar : styles.bar,
        frosted && styles.clear,
        landscape
          ? { width: RAIL_WIDTH + insets.left, paddingLeft: insets.left, paddingTop: insets.top }
          : { paddingBottom: insets.bottom },
      ]}
      // Measured where it is laid over the screens, which keep clear of it by as much.
      onLayout={over ? noteTabBar : undefined}
      // Tabs to a screen reader, which then says which of five each one is.
      accessibilityRole="tablist">
      {frosted && target ? <Frost target={target} edge="top" /> : null}
      {/*
        The mark of the open tab, one for the bar and moved to whichever is
        opened: see `SlidingMark`. Upright it is the patch round the icon and
        its word, a fixed width centred in the cell; sideways, the whole
        rail item.
      */}
      <SlidingMark
        place={markOf(cells[reaching ?? openKey], landscape, patchHeight)}
        style={landscape ? styles.railMark : styles.slidingMark}
      />
      {state.routes.map((route, index) => {
        if (hidden.has(nameOf(route.name))) return null;
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        // On the mark of the open tab, which a theme may have made a fill to be
        // written on in something other than the colour of words.
        const colour = focused ? c.onSelected : c.textMuted;

        return (
          <Pressable
            // No wash under the finger: the mark moving to the tab says it was pressed.
            key={route.key}
            onLayout={(event) => {
              const { x, y, width, height } = event.nativeEvent.layout;
              setCells((before) => {
                const was = before[route.key];
                return was && was.x === x && was.y === y && was.width === width && was.height === height
                  ? before
                  : { ...before, [route.key]: { x, y, width, height } };
              });
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title ?? route.name}
            style={landscape ? styles.railItem : styles.item}
            // Made ready while the finger is down: see `TabArea`.
            onPressIn={
              focused
                ? undefined
                : () => {
                    readyTab(route.key);
                    setReaching(route.key);
                  }
            }
            onPressOut={focused ? undefined : () => readyTab(null)}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              // The navigator's own guard: a tab that is already open should
              // not be navigated to again, and a listener may say no.
              if (!focused && !event.defaultPrevented) {
                // The lightest of clicks, and only for a tab actually changed to.
                haptic('choices', 'tick');
                navigation.navigate(route.name, route.params);
              }
            }}>
            {/*
              Upright, the mark of the open tab is drawn around the icon and
              its word rather than around the whole cell. The cell is as wide
              as a fifth of the screen and filling it made a grey slab with a
              tab in the middle of it; what is wanted is the same rounded patch
              the rail already uses, which reads as a mark on the tab instead
              of as a panel behind it. The cell still takes the tap — the patch
              is not the target, only what is seen.
            */}
            {landscape ? (
              <View style={styles.icon}>
                {options.tabBarIcon?.({ focused, color: colour, size: 22 })}
              </View>
            ) : (
              <View
                style={[styles.patch, !named && styles.patchBare]}
                onLayout={(event) => {
                  const height = event.nativeEvent.layout.height;
                  setPatchHeight((before) => (before === height ? before : height));
                }}>
                {/*
                  The mark is its own layer, and only its opacity changes.

                  Toggling a background colour on the rounded view itself lost
                  the rounding: the corners were right on the first draw and
                  square from the next tab press on, because giving an Android
                  view a colour replaces the very drawable that was carrying
                  the radius. Something drawn rounded once and then only shown
                  or hidden cannot come back square.
                */}
                <View style={styles.icon}>
                  {options.tabBarIcon?.({ focused, color: colour, size: 22 })}
                </View>
                {/*
                  Made smaller to fit, where it has to be, rather than cut:
                  at a large size of writing a long name — İstatistikler —
                  came out as its first few letters and a dot.
                */}
                {named ? (
                  <Text
                    style={[styles.label, { color: colour }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}>
                    {options.title ?? route.name}
                  </Text>
                ) : null}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The patch's width upright: see `patch` below. */
const PATCH_WIDTH = 72;
/** The cell's own room above its patch upright: `item`'s paddingVertical. */
const CELL_PAD = 5;

/** Where the mark of a tab lying at [cell] goes. */
function markOf(cell: MarkPlace | undefined, landscape: boolean, patchHeight: number): MarkPlace | null {
  if (!cell) return null;
  if (landscape) return cell;
  if (!patchHeight) return null;
  return { x: cell.x + (cell.width - PATCH_WIDTH) / 2, y: cell.y + CELL_PAD, width: PATCH_WIDTH, height: patchHeight };
}

const useStyles = makeStyles((c) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: c.bar,
    // A hairline, or the width of an outline in a theme that draws those: the
    // bar is then the colour of the page, and this is all that parts them.
    borderTopWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderTopColor: c.border,
  },
  /*
    The same bar laid over the foot of the screens, in a theme of glass: a
    wash of the page dense enough to read the tabs over anything scrolled
    under it, and the same edge.
  */
  glassBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    ...barGlass(c),
    borderTopWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderTopColor: c.border,
  },
  /** Its fill left to `Frost`, which draws it over the blur. */
  clear: { backgroundColor: 'transparent' },
  rail: {
    backgroundColor: c.bar,
    borderRightWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderRightColor: c.border,
  },
  // The cell is what is pressed; the mark that moves to it is drawn apart (`SlidingMark`).
  item: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 5, borderRadius: 16 },
  /*
    One width for all five, declared rather than taken from the writing. Sized
    to the label it holds, the mark was a different shape under every tab —
    wide under Settings, narrow under Stats — which reads as five marks rather
    than one moving between them.
  */
  patch: { width: 72, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  // The icon alone, in a patch as round as the one with its name is wide: a little more room above and below it.
  patchBare: { paddingVertical: 8 },
  slidingMark: { borderRadius: 14, backgroundColor: c.selected },
  railMark: { borderRadius: 12, backgroundColor: c.selected },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  railItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 12,
  },
  label: { fontSize: 11, lineHeight: 16, includeFontPadding: false, textAlign: 'center' },
}));
