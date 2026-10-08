import { Link } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import { makeStyles, switchColours, useColours, usePressed } from '../../lib/theme/index';
import { setDownloadsButtonWanted, useDownloadsButtonWanted } from '../../lib/ui/downloadsButton';
import { useDownloads } from '../../lib/youtube/DownloadsProvider';
import { tallyOf } from '../../lib/youtube/queueView';

/**
 * The two rows Settings has about downloads: the way into their screen,
 * which says beside its name how the queue stands, and the switch for the
 * button that floats over the app.
 *
 * Here and not written into Settings because of that first row. The queue
 * is read again every second while anything is being fetched, and whatever
 * listens to it is drawn again each time: this is two rows, and Settings is
 * the longest screen in the app.
 *
 * The styles are Settings' own rows over again, as the themes' screen has
 * them too, so that these two are not told from their neighbours.
 */
export function DownloadsSettings() {
  const { all, paused } = useDownloads();
  const floating = useDownloadsButtonWanted();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const tally = tallyOf(all);
  // Nothing at all when the queue is empty: "idle" is not news on a row.
  const state = t.downloads.short(tally.underWay, tally.waiting, paused);

  return (
    <>
      <Link href="/downloads" asChild>
        <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.nav.downloads}</Text>
            <View style={styles.choices}>
              {state ? (
                <Text style={styles.value} numberOfLines={1}>
                  {state}
                </Text>
              ) : null}
              <Text style={styles.chevron}>›</Text>
            </View>
          </View>
          <Text style={styles.muted}>{t.settings.downloads.note}</Text>
        </Pressable>
      </Link>
      <View style={styles.rule} />
      <View style={styles.row}>
        <View style={styles.line}>
          <Text style={styles.title}>{t.settings.downloads.button.title}</Text>
          <Switch
            value={floating}
            accessibilityLabel={t.settings.downloads.button.title}
            onValueChange={setDownloadsButtonWanted}
            {...switchColours(c, floating)}
          />
        </View>
        <Text style={styles.muted}>{t.settings.downloads.button.note}</Text>
      </View>
    </>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },
    choices: { flexDirection: 'row', gap: 6, flexShrink: 1 },
    title: { color: c.text, fontSize: 15.5, flexShrink: 1 },
    value: { color: c.textSecondary, fontSize: 14, flexShrink: 1 },
    muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
    chevron: { color: c.textDisabled, fontSize: 20, lineHeight: 22 },
  })
);
