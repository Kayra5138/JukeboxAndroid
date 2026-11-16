import { requireNativeViewManager } from 'expo-modules-core';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * What is in it kept standing and laid out, and, [shut], not drawn at all:
 * see `CurtainView.kt`. For what waits out of sight to be brought back at
 * once -- a view of the library not in front, a wall of covers behind a list
 * -- and costs nothing meanwhile.
 *
 * Not see-through (opacity nought), which is drawn all the same, with every
 * frame of whatever moves in front; nor display none, which is not laid out
 * either, and is laid out whole again when it comes back.
 *
 * Shut, what is in it is still there for touch and the screen reader as far
 * as the phone knows, and this view round it keeps both off.
 */
export function Curtain({
  shut,
  warm = false,
  style,
  children,
}: {
  shut: boolean;
  /** Shut and about to be opened: what is in it made ready to be shown, out of sight (see `CurtainView.kt`). */
  warm?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  /*
    Shut, held at the size it last had open: what is in it is not laid out
    again for a window that changes size meanwhile -- the phone turned --
    and is laid out once, for the size there is then, when it is opened.
    Laid out again with everything else, every list standing shut in every
    tab told its rows they had moved, put up others for its new height and
    drew them, a few thousand views for nothing anybody could see.
  */
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const held = shut && size ? [styles.held, size] : null;
  return (
    <View
      collapsable={false}
      style={[style, held]}
      onLayout={(event) => {
        if (shut && size) return;
        const { width, height } = event.nativeEvent.layout;
        if (!size || size.width !== width || size.height !== height) setSize({ width, height });
      }}
      pointerEvents={shut ? 'none' : 'auto'}
      importantForAccessibility={shut ? 'no-hide-descendants' : 'auto'}>
      <NativeCurtain shut={shut} warm={warm} style={styles.fill} collapsable={false}>
        {children}
      </NativeCurtain>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Its own size and no other, whatever it is in: not grown, shrunk or stretched by what is round it.
  held: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', alignSelf: 'flex-start' },
});

const NativeCurtain = requireNativeViewManager<{ shut: boolean; warm: boolean; style?: StyleProp<ViewStyle>; collapsable?: boolean; children?: ReactNode }>(
  'JukeboxAudio',
  'CurtainView'
);
