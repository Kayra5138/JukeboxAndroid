import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useBatch } from './useBatch';
import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlinedClip, usePressed } from '../../lib/theme/index';
import { useDownloads } from '../../lib/youtube/DownloadsProvider';
import { tallyOf } from '../../lib/youtube/queueView';

/**
 * One row under the search results that says how the downloads stand and
 * opens their screen.
 *
 * In place of the list that used to be here: the downloads under way and the
 * last five to finish, each with its own cancel. That was the whole of the
 * queue while a download was something done from this tab, one at a time.
 * The queue has a screen now, and two places to cancel a download from is
 * one place to forget to look.
 *
 * There while there is a queue, and for a few minutes after it has emptied —
 * for as long as somebody who has just asked for a song might look down to
 * see what became of it. Otherwise nothing.
 */
export function QueueLink() {
  const { all, paused } = useDownloads();
  const batch = useBatch();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const tally = tallyOf(all);
  if (tally.underWay + tally.waiting === 0 && batch.total === 0) return null;
  // The queue as it stands, or with nothing left in it, how the last of it went.
  const state =
    t.downloads.short(tally.underWay, tally.waiting, paused) ||
    (batch.failed > 0 ? t.downloads.button.failed(batch.failed) : t.downloads.button.done(batch.done));

  return (
    <Link href="/downloads" asChild>
      <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row}>
        <Text style={styles.title}>{t.nav.downloads}</Text>
        <View style={styles.value}>
          <Text style={styles.state} numberOfLines={1}>
            {state}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 52,
      paddingHorizontal: 16,
      marginTop: 26,
      marginBottom: 24,
      backgroundColor: c.surface,
      borderRadius: 14,
      overflow: 'hidden',
      ...outlinedClip(c),
    },
    title: { color: c.text, fontSize: 14.5, fontWeight: '500' },
    value: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    state: { color: c.textSecondary, fontSize: 13.5, flexShrink: 1 },
    chevron: { color: c.textDisabled, fontSize: 20, lineHeight: 22 },
  })
);
