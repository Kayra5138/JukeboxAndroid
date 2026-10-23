import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, outlineWidth, useColours } from '../lib/theme/index';
import { useEffect, useState } from 'react';
import { SlidingMark, type MarkPlace } from './SlidingMark';
import { useLandscape } from '../lib/ui/layout';
import { useHiddenTabs } from '../lib/ui/tabs';
import { Frost, useFrosted, useTabTarget } from './Frosted';
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
  };
};

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
  const open = state.routes[state.index]?.name;
  // The open tab, out of focus behind the bar: see `Frosted`.
  const target = useTabTarget(state.routes[state.index]?.key);
  const frosted = useFrosted(over ? target : null);
  // Taken off while it was open: the library, rather than a tab nobody can see is on.
  useEffect(() => {
    if (open && hidden.has(open)) navigation.navigate('index');
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
        place={markOf(cells[state.routes[state.index]?.key ?? ''], landscape, patchHeight)}
        style={landscape ? styles.railMark : styles.slidingMark}
      />
      {state.routes.map((route, index) => {
        if (hidden.has(route.name)) return null;
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
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              // The navigator's own guard: a tab that is already open should
              // not be navigated to again, and a listener may say no.
              if (!focused && !event.defaultPrevented) {
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
                style={styles.patch}
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
                <Text
                  style={[styles.label, { color: colour }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}>
                  {options.title ?? route.name}
                </Text>
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
