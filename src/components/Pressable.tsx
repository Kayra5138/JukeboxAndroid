import type { Ref } from 'react';
import {
  Pressable as Plain,
  StyleSheet,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type View,
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
const CUT_AFRESH: ViewStyle = { overflow: 'hidden', borderWidth: 0, borderColor: 'transparent' };

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
