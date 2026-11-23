import { StyleSheet, View } from 'react-native';
import { SPACE, RADIUS } from '../../lib/theme/measures';

import { Pressable } from '../Pressable';
import { Text } from './Find';
import { useT } from '../../lib/i18n/index';
import { haptic } from '../../lib/ui/haptics';
import { makeStyles } from '../../lib/theme/index';

/**
 * A place earlier and a place later, beside a row of something whose order
 * is chosen: the tabs, the library's views. Two buttons rather than a drag,
 * as nothing here is long enough to want one and a button can be pressed
 * from a screen reader as a drag cannot. The one with nowhere to go is
 * there and dimmed, so that the other does not move under the finger.
 */
export function OrderButtons({ name, first, last, onMove }: { name: string; first: boolean; last: boolean; onMove: (by: -1 | 1) => void }) {
  const t = useT();
  const styles = useStyles();
  const press = (by: -1 | 1) => {
    haptic('choices', 'tick');
    onMove(by);
  };
  return (
    <View style={styles.pair}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.common.moveUp}: ${name}`}
        accessibilityState={{ disabled: first }}
        disabled={first}
        hitSlop={6}
        style={styles.button}
        onPress={() => press(-1)}>
        <Text style={[styles.arrow, first && styles.off]} importantForAccessibility="no">
          ↑
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.common.moveDown}: ${name}`}
        accessibilityState={{ disabled: last }}
        disabled={last}
        hitSlop={6}
        style={styles.button}
        onPress={() => press(1)}>
        <Text style={[styles.arrow, last && styles.off]} importantForAccessibility="no">
          ↓
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    pair: { flexDirection: 'row', gap: SPACE.xxs },
    button: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.cover },
    arrow: { color: c.textSecondary, fontSize: 18, fontWeight: '600' },
    off: { color: c.textDisabled },
  })
);
