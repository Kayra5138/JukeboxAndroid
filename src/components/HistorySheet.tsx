import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from './Pressable';
import type { ImportPlan } from '../lib/history/index';
import { formatDate } from '../lib/format/date';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, outlinedClip, useColours, usePressed } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';

/**
 * What stands between choosing another app's history and its listens going
 * into this one's.
 *
 * Said back before anything is written: how many listens there are to bring,
 * over what stretch of time, and how many are of songs in the library, which
 * is the thing most worth knowing beforehand. Somebody whose library holds
 * few of the songs they streamed should learn that here, and decide.
 *
 * Unlike a backup, nothing already here is touched, so there is no choice to
 * make between merging and replacing and no restart afterwards: the listens
 * are added, and the charts read them the next time they are drawn.
 */
export function HistorySheet({
  plan,
  working,
  failure,
  onImport,
  onCancel,
}: {
  plan: ImportPlan | null;
  /** True while the listens are being written, when nothing may be pressed. */
  working: boolean;
  failure: string | null;
  onImport: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  useWindowVeil(plan !== null);
  if (!plan) return null;

  const said = t.backup.history;
  const leave = working ? undefined : onCancel;
  const day = (at: number | null) => (at == null ? '' : formatDate(new Date(at), t));

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={leave}>
      {/* Not a stop for a screen reader: Cancel and the back gesture are the ways out. */}
      <Pressable style={styles.backdrop} onPress={leave} accessible={false} />
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 },
        ]}>
        <Text accessibilityRole="header" style={styles.heading}>{said.question}</Text>
        <View style={styles.facts}>
          <Text style={styles.fact}>{t.backup.listens(plan.rows.length)}</Text>
        </View>
        <Text style={styles.text}>{said.range(day(plan.from), day(plan.until))}</Text>
        <Text style={styles.text}>{said.matched(plan.matched, plan.rows.length)}</Text>
        {plan.short > 0 ? <Text style={styles.muted}>{said.short(plan.short)}</Text> : null}
        {plan.already > 0 ? <Text style={styles.muted}>{said.already(plan.already)}</Text> : null}

        {failure ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.failure}>
            {failure}
          </Text>
        ) : null}

        {working ? (
          <View style={styles.working}>
            <ActivityIndicator color={c.textSecondary} />
            <Text style={styles.text}>{t.backup.importing}</Text>
          </View>
        ) : (
          <>
            <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.primary} onPress={onImport}>
              <Text style={styles.primaryLabel}>{t.common.import}</Text>
            </Pressable>
            <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.plain} onPress={onCancel}>
              <Text style={styles.plainLabel}>{t.common.cancel}</Text>
            </Pressable>
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
  muted: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
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
  plain: { padding: 14, alignItems: 'center' },
  plainLabel: { color: c.textSecondary, fontSize: 15 },
}));
