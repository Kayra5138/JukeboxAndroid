import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Opened } from '../lib/backup/index';
import { formatDateTime } from '../lib/format/date';

/**
 * What stands between choosing a backup and anything happening to the phone.
 *
 * A backup is opened first and only looked at. This is where what was found is
 * said back -- how much is in it, how many of its songs are actually here --
 * and where the one real choice is made: add it to what the phone has, or put
 * it in place of that. The second cannot be taken back, so it is never the
 * default, never the first button, and says so in as many words.
 *
 * A phone with nothing on it is not asked. There is nothing to merge with and
 * nothing to replace, and a choice between two ways of doing the same thing is
 * a question with no answer.
 *
 * It is a window of its own, over the tabs as well as the screen. Once an
 * import has gone in, what the rest of the app has in memory is about the data
 * that was there before, and a list edited from that would be written to
 * whatever now has its number. So nothing else can be reached from here until
 * the app has started again.
 */
export function BackupSheet({
  opened,
  working,
  finished,
  failure,
  onMerge,
  onReplace,
  onCancel,
  onRestart,
}: {
  opened: Opened | null;
  /** True while the import is being written, when nothing may be pressed. */
  working: boolean;
  /** True once it has been, and all that is left is to start again. */
  finished: boolean;
  failure: string | null;
  onMerge: () => void;
  onReplace: () => void;
  onCancel: () => void;
  onRestart: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!opened) return null;

  const { summary, backup, occupied } = opened;
  const missing = summary.songs - summary.found;
  const count = (value: number, one: string, many: string) =>
    `${value.toLocaleString('en-US')} ${value === 1 ? one : many}`;

  // Neither while it is being written nor once it has been can it be walked
  // away from, by the Back button or by touching outside.
  const leave = working || finished ? undefined : onCancel;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={leave}>
      <Pressable style={styles.backdrop} onPress={leave} />
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 },
        ]}>
        {finished ? (
          <>
            <Text style={styles.heading}>Imported</Text>
            <Text style={styles.text}>
              Everything is in. Jukebox has to start again to show it: what is on screen now was
              read before the import.
            </Text>
            <Pressable accessibilityRole="button" style={styles.primary} onPress={onRestart}>
              <Text style={styles.primaryLabel}>Restart Jukebox</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.heading}>Import this backup?</Text>
            <Text style={styles.text}>
              {backup.exportedAt > 0 ? `Made ${formatDateTime(new Date(backup.exportedAt))}` : 'A backup'}
              {backup.app ? ` by Jukebox ${backup.app}` : ''}.
            </Text>
            <View style={styles.facts}>
              <Text style={styles.fact}>{count(summary.listens, 'listen', 'listens')}</Text>
              <Text style={styles.fact}>{count(summary.lists, 'list', 'lists')}</Text>
              <Text style={styles.fact}>{count(summary.tagged, 'tagged song', 'tagged songs')}</Text>
              <Text style={styles.fact}>{count(summary.lyrics, 'song with lyrics', 'songs with lyrics')}</Text>
            </View>

            {/*
              Said before the choice, not after it. How many of the backup's
              songs are on this phone decides how much of it can be used, and
              somebody who has not copied their music across yet should find
              that out here rather than from an empty list afterwards.
            */}
            <Text style={missing > 0 ? styles.warning : styles.text}>
              {summary.songs === 0
                ? 'It does not mention any songs.'
                : `${summary.found.toLocaleString('en-US')} of ${count(summary.songs, 'song', 'songs')} in it ${
                    summary.found === 1 ? 'is' : 'are'
                  } in your library.`}
              {missing > 0
                ? ` The other ${missing.toLocaleString('en-US')} ${
                    missing === 1 ? 'is' : 'are'
                  } not on this phone. Their listens are kept, but their tags, lyrics and places in lists have no song to go with and are left out.`
                : ''}
            </Text>

            {failure ? (
              <Text accessibilityRole="alert" style={styles.failure}>
                {failure}
              </Text>
            ) : null}

            {working ? (
              <View style={styles.working}>
                <ActivityIndicator color="#bdbdbd" />
                <Text style={styles.text}>Importing…</Text>
              </View>
            ) : occupied ? (
              <>
                <Pressable accessibilityRole="button" style={styles.primary} onPress={onMerge}>
                  <Text style={styles.primaryLabel}>Merge</Text>
                  <Text style={styles.primaryHint}>
                    Add it to what is here. Nothing on this phone is removed.
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.danger} onPress={onReplace}>
                  <Text style={styles.dangerLabel}>Replace</Text>
                  <Text style={styles.dangerHint}>
                    Delete what is here and use the backup instead. This cannot be undone.
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.plain} onPress={onCancel}>
                  <Text style={styles.plainLabel}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable accessibilityRole="button" style={styles.primary} onPress={onReplace}>
                  <Text style={styles.primaryLabel}>Import</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.plain} onPress={onCancel}>
                  <Text style={styles.plainLabel}>Cancel</Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000cc' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
  },
  body: { paddingTop: 20, gap: 14 },
  heading: { color: '#ededed', fontSize: 19, fontWeight: '600' },
  text: { color: '#a8a8a8', fontSize: 14, lineHeight: 20 },
  warning: { color: '#e0c078', fontSize: 14, lineHeight: 20 },
  failure: { color: '#ff8a8a', fontSize: 14, lineHeight: 20 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: {
    color: '#dcdcdc',
    fontSize: 13,
    backgroundColor: '#262626',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  working: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  primary: { backgroundColor: '#ededed', borderRadius: 12, padding: 14, gap: 3, marginTop: 4 },
  primaryLabel: { color: '#141414', fontSize: 15.5, fontWeight: '600' },
  primaryHint: { color: '#4a4a4a', fontSize: 12.5, lineHeight: 17 },
  danger: { backgroundColor: '#2a1a1a', borderRadius: 12, padding: 14, gap: 3 },
  dangerLabel: { color: '#ff9a9a', fontSize: 15.5, fontWeight: '600' },
  dangerHint: { color: '#b08080', fontSize: 12.5, lineHeight: 17 },
  plain: { padding: 14, alignItems: 'center' },
  plainLabel: { color: '#a8a8a8', fontSize: 15 },
});
