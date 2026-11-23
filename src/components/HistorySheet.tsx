import { StyleSheet, Text, View } from 'react-native';
import { LEADING, RADIUS, SPACE, TYPE } from '../lib/theme/measures';
import { Busy } from './Busy';
import { OnAPage } from './OnAPage';

import type { ImportPlan } from '../lib/history/index';
import { formatDate } from '../lib/format/date';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlinedClip, useColours } from '../lib/theme/index';
import { Button, TextButton } from './Button';
import { Note } from './Note';

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
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const said = t.backup.history;
  const day = (at: number | null) => (at == null ? '' : formatDate(new Date(at), t));

  // A page of its own in the tab, the bars where they are; not to be left while the listens are being written (`OnAPage`).
  return (
    <OnAPage visible={plan !== null} title={said.question} onClose={onCancel} locked={working}>
      {plan ? (
      <View style={styles.body}>
        <View style={styles.facts}>
          <Text style={styles.fact}>{t.backup.listens(plan.rows.length)}</Text>
        </View>
        <Text style={styles.text}>{said.range(day(plan.from), day(plan.until))}</Text>
        <Text style={styles.text}>{said.matched(plan.matched, plan.rows.length)}</Text>
        {plan.short > 0 ? <Text style={styles.muted}>{said.short(plan.short)}</Text> : null}
        {plan.already > 0 ? <Text style={styles.muted}>{said.already(plan.already)}</Text> : null}

        {failure ? (
          <Note tone="bad">{failure}</Note>
        ) : null}

        {working ? (
          <View style={styles.working}>
            <Busy color={c.textSecondary} />
            <Text style={styles.text}>{t.backup.importing}</Text>
          </View>
        ) : (
          <>
            <Button kind="primary" wide label={t.common.import} onPress={onImport} />
            <TextButton label={t.common.cancel} tone="plain" size="body" onPress={onCancel} style={styles.cancel} />
          </>
        )}
      </View>
      ) : null}
    </OnAPage>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  body: { gap: SPACE.m },
  heading: { color: c.text, fontSize: TYPE.heading, fontWeight: '600' },
  text: { color: c.textSecondary, fontSize: TYPE.small, lineHeight: LEADING.small },
  muted: { color: c.textMuted, fontSize: TYPE.small, lineHeight: LEADING.small },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  fact: {
    color: c.text,
    fontSize: TYPE.small,
    backgroundColor: c.surfaceRaised,
    borderRadius: RADIUS.pill,
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.m,
    overflow: 'hidden',
    ...outlinedClip(c),
  },
  working: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: SPACE.s },
  // The way out, quietly, under the way on.
  cancel: { alignSelf: 'center' },
}));
