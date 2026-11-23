import { useCallback } from 'react';
import { LEADING, SPACE, TYPE, RADIUS } from '../../lib/theme/measures';
import { Note } from '../Note';
import { ProgressBar } from '../ProgressBar';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../lib/i18n/index';
import { makeStyles, outlined } from '../../lib/theme/index';
import { isNewer } from '../../lib/youtube/extractor';
import {
  checkExtractor,
  extractorWanted,
  restoreExtractor,
  updateExtractor,
  useExtractor,
} from '../../lib/youtube/extractorState';
import { TextButton, Button } from '../Button';

/**
 * yt-dlp's few lines on the downloads screen: which version is on the phone,
 * whether there is a newer one, and the button that looks for it or fetches
 * it.
 *
 * Under the queue's own heading and not in Settings, because this is where
 * somebody is standing when it matters: looking at a row that says YouTube
 * has changed. The switch for the look the app makes by itself is in
 * Settings, with the other things that are decided once.
 *
 * A component of its own for the reason the Settings rows are: it is drawn
 * again for every percent of an update, and the screen around it is a list.
 *
 * Coming to the screen is one of the two moments the app looks by itself,
 * where a look is due: see `extractor.ts`. Nothing is drawn on a build of
 * the phone's side that cannot say what version it has.
 */
export function ExtractorPanel() {
  const state = useExtractor();
  const t = useT();
  const styles = useStyles();
  const said = t.downloads.extractor;

  useFocusEffect(
    useCallback(() => {
      extractorWanted();
    }, [])
  );

  const { installed, bundled, known, doing, trouble } = state;
  if (!installed) return null;

  const newer = isNewer(known.latest, installed) ? known.latest : null;
  const changing = doing === 'waiting' || doing === 'downloading' || doing === 'checkingFile' || doing === 'restoring';
  const status =
    doing === 'waiting'
      ? said.waiting
      : doing === 'downloading'
        ? said.downloading(known.latest ?? '', state.percent)
        : doing === 'checkingFile'
          ? said.trying
          : doing === 'restoring'
            ? said.restoring
            : state.changedTo
              ? said.updated(state.changedTo)
              : newer
                ? said.available(newer)
                : state.checkedDays == null
                  ? said.unchecked
                  : `${said.current} · ${said.checked(state.checkedDays)}`;
  const reason = trouble
    ? trouble.during === 'check' && trouble.why === 'failed'
      ? said.checkFailed
      : said.trouble[trouble.why]
    : null;
  // Only an update can be gone back on: the build's own copy is as far back as there is.
  const goesBack = !doing && bundled && isNewer(installed, bundled) ? bundled : null;

  return (
    <View style={styles.card}>
      <View style={styles.line}>
        <View style={styles.text}>
          <Text style={styles.title}>{said.heading}</Text>
          {/* The version on a line with what is known of it, which may wrap; never cut short for the button's sake. */}
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {changing ? status : `${said.version(installed)} · ${status}`}
          </Text>
        </View>
        {changing ? null : (
          <Button
            label={doing === 'checking' ? said.checking : newer ? said.update : said.check}
            kind="secondary"
            size="small"
            disabled={doing === 'checking'}
            onPress={() => {
              if (newer) void updateExtractor();
              else void checkExtractor(true);
            }}
          />
        )}
      </View>
      {doing === 'downloading' ? (
        <ProgressBar value={state.percent / 100} style={styles.track} />
      ) : null}
      {reason ? (
        <Note tone="bad" style={styles.bad}>
          {reason}
        </Note>
      ) : null}
      {goesBack ? (
        <TextButton
          label={said.restore(goesBack)}
          tone="plain"
          style={styles.back}
          onPress={() => {
            void restoreExtractor();
          }}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      marginTop: SPACE.xs,
      paddingLeft: SPACE.m,
      paddingRight: SPACE.s,
      paddingVertical: SPACE.s,
      gap: SPACE.s,
      borderRadius: RADIUS.control,
      backgroundColor: c.surface,
      ...outlined(c),
    },
    line: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
    text: { flex: 1, minWidth: 0, gap: SPACE.xxs },
    title: { color: c.text, fontSize: TYPE.small, fontWeight: '600' },
    status: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
    bad: { paddingRight: SPACE.xs },
    track: { marginRight: SPACE.xs },
    // As quiet as "cancel all" above it: there, and not asked for often.
    back: { alignSelf: 'flex-start' },
  })
);
