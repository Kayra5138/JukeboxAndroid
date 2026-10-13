import { Modal, ScrollView, StyleSheet } from 'react-native';

import { Pressable } from '../Pressable';
import { makeStyles, outlined } from '../../lib/theme/index';
import { scrimOf, useWindowVeil } from '../../lib/theme/Veil';

/**
 * A sheet that comes up from the foot of the screen, in a window of its own:
 * the shape the track menu has, for the two that Discover opens.
 *
 * Bounded and scrolling, since either is taller than a phone on its side. A
 * touch anywhere off it closes it, and so does the back button, which is the
 * window's to answer.
 */
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  useWindowVeil(visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessible={false} onPress={onClose}>
        {visible ? (
          <ScrollView style={styles.sheet} contentContainerStyle={styles.body}>
            {/* Swallows a touch on the sheet's own words, which is not a touch on what is behind it. */}
            <Pressable accessible={false} onPress={swallow}>
              {children}
            </Pressable>
          </ScrollView>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const swallow = () => {};

const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: scrimOf(c), justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    flexGrow: 0,
    ...outlined(c),
  },
  body: { paddingBottom: 28 },
}));
