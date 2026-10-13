import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlined, usePressed } from '../../lib/theme/index';
import { isNewer } from '../../lib/youtube/extractor';
import {
  checkExtractor,
  extractorWanted,
  restoreExtractor,
  updateExtractor,
  useExtractor,
} from '../../lib/youtube/extractorState';

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
  const pressed = usePressed();
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
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            disabled={doing === 'checking'}
            style={styles.button}
            onPress={() => {
              if (newer) void updateExtractor();
              else void checkExtractor(true);
            }}>
            <Text style={styles.buttonLabel}>
              {doing === 'checking' ? said.checking : newer ? said.update : said.check}
            </Text>
          </Pressable>
        )}
      </View>
      {doing === 'downloading' ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(Math.max(state.percent, 0), 100)}%` }]} />
        </View>
      ) : null}
      {reason ? (
        <Text accessibilityRole="alert" style={styles.bad}>
          {reason}
        </Text>
      ) : null}
      {goesBack ? (
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          style={styles.back}
          onPress={() => {
            void restoreExtractor();
          }}>
          <Text style={styles.backLabel}>{said.restore(goesBack)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      marginTop: 6,
      paddingLeft: 14,
      paddingRight: 8,
      paddingVertical: 10,
      gap: 8,
      borderRadius: 12,
      backgroundColor: c.surface,
      ...outlined(c),
    },
    line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    text: { flex: 1, minWidth: 0, gap: 2 },
    title: { color: c.text, fontSize: 13.5, fontWeight: '600' },
    status: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
    bad: { color: c.danger, fontSize: 12.5, lineHeight: 18, paddingRight: 6 },
    button: { minHeight: 40, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    buttonLabel: { color: c.text, fontSize: 13, fontWeight: '600' },
    track: { height: 3, backgroundColor: c.borderStrong, borderRadius: 2, marginRight: 6, overflow: 'hidden' },
    fill: { height: 3, backgroundColor: c.accent },
    // As quiet as "cancel all" above it: there, and not asked for often.
    back: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', paddingRight: 8, borderRadius: 8 },
    backLabel: { color: c.textMuted, fontSize: 12.5 },
  })
);
