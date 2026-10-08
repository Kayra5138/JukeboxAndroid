import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Opened } from '../lib/backup/index';
import { formatDateTime } from '../lib/format/date';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, outlinedClip, useColours, usePressed } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';

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
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  // Mounted always and a window only while there is a backup to ask about.
  useWindowVeil(opened !== null);
  if (!opened) return null;

  const said = t.backup;
  const { summary, backup, occupied } = opened;
  const missing = summary.songs - summary.found;

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
            <Text style={styles.heading}>{said.imported}</Text>
            <Text style={styles.text}>{said.importedBody}</Text>
            <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.primary} onPress={onRestart}>
              <Text style={styles.primaryLabel}>{said.restart}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.heading}>{said.question}</Text>
            <Text style={styles.text}>
              {said.made(
                backup.exportedAt > 0 ? formatDateTime(new Date(backup.exportedAt), t) : null,
                backup.app || null
              )}
            </Text>
            <View style={styles.facts}>
              <Text style={styles.fact}>{said.listens(summary.listens)}</Text>
              <Text style={styles.fact}>{t.common.lists(summary.lists)}</Text>
              <Text style={styles.fact}>{said.tagged(summary.tagged)}</Text>
              <Text style={styles.fact}>{said.withLyrics(summary.lyrics)}</Text>
            </View>

            {/*
              Said before the choice, not after it. How many of the backup's
              songs are on this phone decides how much of it can be used, and
              somebody who has not copied their music across yet should find
              that out here rather than from an empty list afterwards.
            */}
            <Text style={missing > 0 ? styles.warning : styles.text}>
              {said.songs(summary.found, summary.songs)}
            </Text>

            {failure ? (
              <Text accessibilityRole="alert" style={styles.failure}>
                {failure}
              </Text>
            ) : null}

            {working ? (
              <View style={styles.working}>
                <ActivityIndicator color={c.textSecondary} />
                <Text style={styles.text}>{said.importing}</Text>
              </View>
            ) : occupied ? (
              <>
                <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.primary} onPress={onMerge}>
                  <Text style={styles.primaryLabel}>{said.merge}</Text>
                  <Text style={styles.primaryHint}>{said.mergeHint}</Text>
                </Pressable>
                <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.danger} onPress={onReplace}>
                  <Text style={styles.dangerLabel}>{said.replace}</Text>
                  <Text style={styles.dangerHint}>{said.replaceHint}</Text>
                </Pressable>
                <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.plain} onPress={onCancel}>
                  <Text style={styles.plainLabel}>{t.common.cancel}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.primary} onPress={onReplace}>
                  <Text style={styles.primaryLabel}>{t.common.import}</Text>
                </Pressable>
                <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.plain} onPress={onCancel}>
                  <Text style={styles.plainLabel}>{t.common.cancel}</Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: scrimOf(c) },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    ...outlined(c),
  },
  body: { paddingTop: 20, gap: 14 },
  heading: { color: c.text, fontSize: 19, fontWeight: '600' },
  text: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
  warning: { color: c.warning, fontSize: 14, lineHeight: 20 },
  failure: { color: c.danger, fontSize: 14, lineHeight: 20 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: {
    color: c.text,
    fontSize: 13,
    backgroundColor: c.surfaceRaised,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    overflow: 'hidden',
    ...outlinedClip(c),
  },
  working: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  primary: { backgroundColor: c.primary, borderRadius: 12, padding: 14, gap: 3, marginTop: 4, ...outlined(c, c.primary) },
  primaryLabel: { color: c.onPrimary, fontSize: 15.5, fontWeight: '600' },
  // The label's own colour, held back: there is no token for a second voice on `primary`.
  primaryHint: { color: c.onPrimary, opacity: 0.7, fontSize: 12.5, lineHeight: 17 },
  danger: { backgroundColor: c.dangerSoft, borderRadius: 12, padding: 14, gap: 3, ...outlined(c, c.danger) },
  dangerLabel: { color: c.danger, fontSize: 15.5, fontWeight: '600' },
  dangerHint: { color: c.danger, opacity: 0.75, fontSize: 12.5, lineHeight: 17 },
  plain: { padding: 14, alignItems: 'center' },
  plainLabel: { color: c.textSecondary, fontSize: 15 },
}));
