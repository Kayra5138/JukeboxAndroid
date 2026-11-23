import { Link } from 'expo-router';
import { LEADING, SPACE, TYPE, TOUCH } from '../../lib/theme/measures';
import { StyleSheet, View } from 'react-native';
import { Text } from '../settings/Find';

import { Pressable } from '../Pressable';
import { CategoryRow, SwitchRow, LinkRow, Chevron } from '../settings/rows';
import { useT } from '../../lib/i18n/index';
import { makeStyles, usePressed } from '../../lib/theme/index';
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
              <Chevron />
            </View>
          </View>
          <Text style={styles.muted}>{t.settings.downloads.note}</Text>
        </Pressable>
      </Link>
      <View style={styles.rule} />
      <SwitchRow
        title={t.settings.downloads.button.title}
        hint={t.settings.downloads.button.note}
        value={floating}
        onChange={setDownloadsButtonWanted}
      />
      <View style={styles.rule} />
      {/*
        A way in and not the settings themselves, which are a card as long as
        a page: laid out here they would put the switch below them out of
        sight. It is the screen the gear over Discover's list opens.
      */}
      <LinkRow
        title={t.discover.settings.heading}
        hint={t.settings.discover.note}
        href="/discover-settings"
      />
      {downloads?.extractorLatestAsync ? (
        <>
          <View style={styles.rule} />
          <SwitchRow
            title={t.settings.downloads.check.title}
            hint={t.settings.downloads.check.note}
            value={looking}
            onChange={setExtractorCheckWanted}
          />
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
    row: { paddingHorizontal: SPACE.l, paddingVertical: SPACE.m, gap: SPACE.xs },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: SPACE.l },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.m, minHeight: TOUCH.row },
    choices: { flexDirection: 'row', gap: SPACE.xs, flexShrink: 1 },
    title: { color: c.text, fontSize: TYPE.body, flexShrink: 1 },
    value: { color: c.textSecondary, fontSize: TYPE.small, flexShrink: 1 },
    muted: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
  })
);
