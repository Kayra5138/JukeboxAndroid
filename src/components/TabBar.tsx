import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, outlineWidth, useColours, usePressed } from '../lib/theme/index';
import { useLandscape } from '../lib/ui/layout';

/** Wide enough for an icon and a short word under it, and no wider. */
const RAIL_WIDTH = 92;

/**
 * How tall the bar is along the bottom, above the phone's own inset: the
 * cell's padding, the patch's, the icon, the gap and the label, whose line
 * grows with the size of writing the phone is set to. For what is drawn
 * over the app and has to keep clear of it; see `DownloadsButton`.
 */
export const tabBarHeight = (fontScale: number) => 46 + Math.ceil(16 * Math.max(1, fontScale));

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
  const pressed = usePressed();

  return (
    <View
      style={[
        landscape ? styles.rail : styles.bar,
        landscape
          ? { width: RAIL_WIDTH + insets.left, paddingLeft: insets.left, paddingTop: insets.top }
          : { paddingBottom: insets.bottom },
      ]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        // On the mark of the open tab, which a theme may have made a fill to be
        // written on in something other than the colour of words.
        const colour = focused ? c.onSelected : c.textMuted;

        return (
          <Pressable
            android_ripple={pressed}
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.title ?? route.name}
            style={landscape ? [styles.railItem, focused && styles.focused] : styles.item}
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
              <View style={styles.patch}>
                {/*
                  The mark is its own layer, and only its opacity changes.

                  Toggling a background colour on the rounded view itself lost
                  the rounding: the corners were right on the first draw and
                  square from the next tab press on, because giving an Android
                  view a colour replaces the very drawable that was carrying
                  the radius. Something drawn rounded once and then only shown
                  or hidden cannot come back square.
                */}
                <View style={[styles.mark, focused && styles.marked]} pointerEvents="none" />
                <View style={styles.icon}>
                  {options.tabBarIcon?.({ focused, color: colour, size: 22 })}
                </View>
                <Text style={[styles.label, { color: colour }]} numberOfLines={1}>
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

const useStyles = makeStyles((c) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: c.bar,
    // A hairline, or the width of an outline in a theme that draws those: the
    // bar is then the colour of the page, and this is all that parts them.
    borderTopWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderTopColor: c.border,
  },
  rail: {
    backgroundColor: c.bar,
    borderRightWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderRightColor: c.border,
  },
  // Rounded as the mark inside it is, for the sake of the wash under a finger:
  // the cell is what is pressed, and the wash keeps to the shape it is given.
  item: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 5, borderRadius: 16 },
  /*
    One width for all five, declared rather than taken from the writing. Sized
    to the label it holds, the mark was a different shape under every tab —
    wide under Settings, narrow under Stats — which reads as five marks rather
    than one moving between them.
  */
  patch: { width: 72, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  mark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    backgroundColor: 'transparent',
    opacity: 0,
  },
  marked: { backgroundColor: c.selected, opacity: 1 },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  railItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 12,
  },
  focused: { backgroundColor: c.selected },
  label: { fontSize: 11, lineHeight: 16, includeFontPadding: false, textAlign: 'center' },
}));
