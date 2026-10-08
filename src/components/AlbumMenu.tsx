import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';

import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, usePressed } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';

export type AlbumAction = 'select' | 'rest';

/** In the order the sheet shows them; `library.albumActions` says what each is. */
const ACTIONS: readonly AlbumAction[] = ['select', 'rest'];

/** For the rack, which has no boxes to tick and so nothing for "Select" to start. */
export const WITHOUT_SELECT: readonly AlbumAction[] = ['select'];

/**
 * What can be done to one album, from a long press on it.
 *
 * `TrackMenu` for a record, and drawn as that is on purpose: the same sheet,
 * the same rows of a name over a line saying what it does, so holding a row
 * down means one thing whichever kind of row it is.
 *
 * Holding an album used to start choosing tracks with it, straight away.
 * That is the first entry here now, one tap further on, because a long press
 * can only do one thing and there is more than one thing to do to an album.
 */
export function AlbumMenu({
  album,
  hidden,
  onSelect,
  onClose,
}: {
  /** What the sheet is headed with; null when it is not up. */
  album: { name: string; detail: string } | null;
  hidden?: readonly AlbumAction[];
  onSelect: (action: AlbumAction) => void;
  onClose: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  useWindowVeil(album !== null);
  return (
    <Modal visible={album !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {album ? (
          // Bounded and scrolling, as the track's is, for a screen on its side.
          <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetBody}>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={2}>
                {album.name}
              </Text>
              <Text style={styles.detail} numberOfLines={1}>
                {album.detail}
              </Text>
            </View>

            {ACTIONS.filter((action) => !hidden?.includes(action)).map((action) => (
              <Pressable
                android_ripple={pressed}
                key={action}
                style={styles.action}
                onPress={() => onSelect(action)}>
                <Text style={styles.actionLabel}>{t.library.albumActions[action].label}</Text>
                <Text style={styles.actionHint}>{t.library.albumActions[action].hint}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </Pressable>
    </Modal>
  );
}

// `TrackMenu`'s, line for line.
const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: scrimOf(c),
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    flexGrow: 0,
    ...outlined(c),
  },
  sheetBody: { paddingBottom: 28 },
  header: {
    gap: 3,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  title: { color: c.text, fontSize: 16, fontWeight: '600' },
  detail: { color: c.textMuted, fontSize: 13 },
  action: { paddingHorizontal: 20, paddingVertical: 13, gap: 2 },
  actionLabel: { color: c.text, fontSize: 15 },
  actionHint: { color: c.textFaint, fontSize: 12 },
}));
