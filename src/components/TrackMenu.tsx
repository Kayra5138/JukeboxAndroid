import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { EnrichedTrack } from '../lib/media/merge';

export type TrackAction =
  | 'playNext'
  | 'addToQueue'
  | 'lookup'
  | 'edit'
  | 'lyrics'
  | 'addToPlaylist'
  | 'album'
  | 'tiles'
  | 'view'
  | 'delete';

const ACTIONS: { key: TrackAction; label: string; hint: string }[] = [
  { key: 'playNext', label: 'Play next', hint: 'Straight after the current track' },
  { key: 'addToQueue', label: 'Add to queue', hint: 'At the end' },
  { key: 'album', label: 'Go to album', hint: 'The rest of the record, in order' },
  { key: 'addToPlaylist', label: 'Add to a list', hint: 'One of your lists, or a new one' },
  { key: 'tiles', label: 'Play piano tiles', hint: 'Keys falling in time with this record' },
  { key: 'lookup', label: 'Look up details', hint: 'Search again for tags and a cover' },
  { key: 'edit', label: 'Edit tags', hint: 'Artist, title, tags and their order' },
  { key: 'lyrics', label: 'Lyrics', hint: 'Fix the timing, search or paste them' },
  { key: 'view', label: 'View details', hint: 'File, tags and listening history' },
  { key: 'delete', label: 'Delete', hint: 'Erases the file from the phone' },
];

/** Everything that can be done to one track, from a long press on its row. */
export function TrackMenu({
  track,
  onSelect,
  onClose,
}: {
  track: EnrichedTrack | null;
  onSelect: (action: TrackAction, track: EnrichedTrack) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={track !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {track ? (
          // Six actions and a heading are taller than a landscape screen, so the
          // sheet is bounded and scrolls rather than running off the bottom.
          <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetBody}>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={2}>
                {track.title}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {track.artist ?? 'Unknown artist'}
              </Text>
            </View>

            {ACTIONS.filter(
              // Only where there is a record to go to. A track whose album
              // nobody knows would lead to an empty screen.
              (action) => action.key !== 'album' || Boolean(track.album?.trim())
            ).map((action) => (
              <Pressable
                key={action.key}
                style={styles.action}
                onPress={() => onSelect(action.key, track)}>
                <Text style={action.key === 'delete' ? styles.destructive : styles.actionLabel}>
                  {action.label}
                </Text>
                <Text style={styles.actionHint}>{action.hint}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000cc',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    flexGrow: 0,
  },
  sheetBody: { paddingBottom: 28 },
  header: {
    gap: 3,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  title: { color: '#ededed', fontSize: 16, fontWeight: '600' },
  artist: { color: '#7a7a7a', fontSize: 13 },
  action: { paddingHorizontal: 20, paddingVertical: 13, gap: 2 },
  actionLabel: { color: '#ededed', fontSize: 15 },
  destructive: { color: '#e08585', fontSize: 15 },
  actionHint: { color: '#5f5f5f', fontSize: 12 },
});
