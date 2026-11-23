import type { ReactNode, Ref } from 'react';
import {
  Pressable as Plain,
  StyleSheet,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * The app's `Pressable`: React Native's, with the wash under a finger kept
 * to the shape of the thing pressed.
 *
 * Left to itself Android spreads that wash over the whole of a view's box.
 * A box is a rectangle whatever is drawn in it, so a round button answered a
 * touch with a square, and a pill with a slab: the outline of where the
 * finger may land, shown over something that is not that shape at all.
 *
 * There is one way the wash is made to follow a rounded shape, and it is
 * roundabout. Drawn over the view's contents instead of under them, it is
 * drawn after the view has cut its drawing to its own rounded edge for its
 * children's sake — which a view only does when told to hide what overflows
 * it. So here anything with rounded corners that is given a wash is also
 * told to cut, and `usePressed` asks for the wash on top. Something with
 * square corners is left exactly as it was; a rectangle is its shape.
 *
 * A view that cuts has one trap of its own on Android: it works out where to
 * cut from its border, and told of a border by one theme and of none by the
 * next it goes on cutting to the old one (see `outlinedClip`). So where the
 * style says nothing of a border, this says there is one of no width.
 */
export function Pressable({
  android_ripple,
  style,
  ...rest
}: PressableProps & { ref?: Ref<View> }) {
  if (!android_ripple) return <Plain style={style} {...rest} />;
  return (
    <Plain
      android_ripple={android_ripple}
      style={typeof style === 'function' ? (state: PressableStateCallbackType) => shaped(style(state)) : shaped(style)}
      {...rest}
    />
  );
}

const CUT: ViewStyle = { overflow: 'hidden' };
/*
  Every side as well as the whole. In a theme of glass each side's width is
  given (`edgesAt`), and React Native 0.86 keeps a side a style stops giving
  as "not a number": a view that cuts works out where from those, and cut to
  nowhere, so that a button's own words were gone the moment a flat theme
  was chosen after one of glass, and its fill was all that was left.
*/
const CUT_AFRESH: ViewStyle = {
  overflow: 'hidden',
  borderWidth: 0,
  borderTopWidth: 0,
  borderRightWidth: 0,
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  borderColor: 'transparent',
};

const CORNERS = [
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderTopStartRadius',
  'borderTopEndRadius',
  'borderBottomStartRadius',
  'borderBottomEndRadius',
] as const;

const BORDERS = [
  'borderWidth',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStartWidth',
  'borderEndWidth',
] as const;

/** A style with what it takes for a wash to keep to its corners, if it has any. */
function shaped(style: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  const flat = StyleSheet.flatten(style);
  if (!flat || !CORNERS.some((corner) => flat[corner])) return style;
  return [style, BORDERS.some((border) => flat[border] != null) ? CUT : CUT_AFRESH];
}

/**
 * A row pressed as a whole that has a control of its own in it as well: a
 * group's heading, which opens the group, with a box at its side that ticks
 * every row of it. The wash under a finger covers the whole row, the box's
 * corner included; the box still takes its own presses.
 *
 * The press is a view of its own laid under the row's contents rather than
 * round them: round them, the box would sit inside the thing pressed, and a
 * screen reader could not reach it as a thing of its own. [children] are
 * drawn over it and let touches through to it, all but [controls], which
 * keep theirs. What the row says to a screen reader is [accessibilityLabel],
 * so that what is written in it is not read twice.
 */
export function WholePress({
  style,
  inside,
  controls,
  children,
  ...press
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** How what is written in the row is laid out. */
  inside?: StyleProp<ViewStyle>;
  /** What in the row is pressed by itself, at its start. */
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={style}>
      <Pressable style={StyleSheet.absoluteFill} {...press} />
      <View style={whole.row} pointerEvents="box-none">
        {controls}
        <View style={[whole.words, inside]} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          {children}
        </View>
      </View>
    </View>
  );
}

const whole = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  words: { flex: 1, minWidth: 0 },
});
