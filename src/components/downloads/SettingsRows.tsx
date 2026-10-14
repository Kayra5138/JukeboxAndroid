import { Link } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Pressable } from '../Pressable';
import { CategoryRow } from '../settings/rows';
import { useT } from '../../lib/i18n/index';
import { makeStyles, switchColours, useColours, usePressed } from '../../lib/theme/index';
import { setDownloadsButtonWanted, useDownloadsButtonWanted } from '../../lib/ui/downloadsButton';
import { useDownloads } from '../../lib/youtube/DownloadsProvider';
import { setExtractorCheckWanted, useExtractor } from '../../lib/youtube/extractorState';
import { downloads } from '../../lib/youtube/native';
import { tallyOf } from '../../lib/youtube/queueView';

/**
 * The rows Settings has about downloads and about Discover, whose songs are
 * downloads too: the way into the downloads' screen, which says beside its
 * name how the queue stands, the switch for the button that floats over the
 * app, the way into Discover's settings, and the switch for the look the app
 * makes by itself for a newer yt-dlp — which says under it what that look
 * sends, and is not there on a build of the phone's side that cannot make it.
 *
 * Here and not written into the page because of that first row. The queue
 * is read again every second while anything is being fetched, and whatever
 * listens to it is drawn again each time: this is four rows, and the page
 * they are on need not be drawn with them.
 *
 * The styles are Settings' own rows over again, as the themes' screen has
 * them too, so that these are not told from their neighbours.
 */
export function DownloadsSettings() {
  const { all, paused } = useDownloads();
  const floating = useDownloadsButtonWanted();
  const looking = useExtractor().wanted;
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
      <View style={styles.rule} />
      {/*
        A way in and not the settings themselves, which are a card as long as
        a page: laid out here they would put the switch below them out of
        sight. It is the screen the gear over Discover's list opens.
      */}
      <Link href="/discover-settings" asChild>
        <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.discover.settings.heading}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
          <Text style={styles.muted}>{t.settings.discover.note}</Text>
        </Pressable>
      </Link>
      {downloads?.extractorLatestAsync ? (
        <>
          <View style={styles.rule} />
          <View style={styles.row}>
            <View style={styles.line}>
              <Text style={styles.title}>{t.settings.downloads.check.title}</Text>
              <Switch
                value={looking}
                accessibilityLabel={t.settings.downloads.check.title}
                onValueChange={setExtractorCheckWanted}
                {...switchColours(c, looking)}
              />
            </View>
            <Text style={styles.muted}>{t.settings.downloads.check.note}</Text>
          </View>
        </>
      ) : null}
    </>
  );
}

/**
 * The row on the Settings tab that opens the page those rows are on.
 *
 * It says how the queue stands when there is anything in it, as the row for
 * the downloads does, and what the page holds when there is not. By itself
 * for the reason above: the tab is not to be drawn again each second for it.
 */
export function DownloadsCategory() {
  const { all, paused } = useDownloads();
  const t = useT();
  const tally = tallyOf(all);
  const state = t.downloads.short(tally.underWay, tally.waiting, paused);
  return (
    <CategoryRow
      href="/settings-downloads"
      title={t.settings.sections.downloads}
      note={t.settings.categories.downloads}
      value={state || undefined}
    />
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
