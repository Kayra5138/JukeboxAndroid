import { StyleSheet, Text, View } from 'react-native';
import { LEADING, RADIUS, SPACE, TYPE } from '../lib/theme/measures';
import { Busy } from './Busy';
import { OnAPage } from './OnAPage';

import type { Opened } from '../lib/backup/index';
import { formatDateTime } from '../lib/format/date';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlinedClip, useColours } from '../lib/theme/index';
import { Button, TextButton } from './Button';
import { Note } from './Note';

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
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const said = t.backup;

  /*
    A page of its own in the tab, the bars where they are (`OnAPage`). Neither
    while it is being written nor once it has been can it be walked away from.
  */
  const asked = ({ summary, backup, occupied }: NonNullable<typeof opened>) => {
  const missing = summary.songs - summary.found;
  return (
      <View style={styles.body}>
        {finished ? (
          <>
            <Text style={styles.text}>{said.importedBody}</Text>
            <Button kind="primary" wide label={said.restart} onPress={onRestart} />
          </>
        ) : (
          <>
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
              {summary.followed > 0 ? <Text style={styles.fact}>{said.followed(summary.followed)}</Text> : null}
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
              <Note tone="bad">{failure}</Note>
            ) : null}

            {working ? (
              <View style={styles.working}>
                <Busy color={c.textSecondary} />
                <Text style={styles.text}>{said.importing}</Text>
              </View>
            ) : occupied ? (
              <>
                <Button kind="primary" wide label={said.merge} hint={said.mergeHint} onPress={onMerge} />
                <Button kind="danger" wide label={said.replace} hint={said.replaceHint} onPress={onReplace} />
                <TextButton label={t.common.cancel} tone="plain" size="body" onPress={onCancel} style={styles.cancel} />
              </>
            ) : (
              <>
                <Button kind="primary" wide label={t.common.import} onPress={onReplace} />
                <TextButton label={t.common.cancel} tone="plain" size="body" onPress={onCancel} style={styles.cancel} />
              </>
            )}
          </>
        )}
      </View>
  );
  };

  return (
    <OnAPage visible={opened !== null} title={finished ? said.imported : said.question} onClose={onCancel} locked={working || finished}>
      {opened ? asked(opened) : null}
    </OnAPage>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  body: { gap: SPACE.m },
  heading: { color: c.text, fontSize: TYPE.heading, fontWeight: '600' },
  text: { color: c.textSecondary, fontSize: TYPE.small, lineHeight: LEADING.small },
  warning: { color: c.warning, fontSize: TYPE.small, lineHeight: LEADING.small },
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
  // The way out, quietly, under the ways on.
  cancel: { alignSelf: 'center' },
  // The label's own colour, held back: there is no token for a second voice on `primary`.
}));
