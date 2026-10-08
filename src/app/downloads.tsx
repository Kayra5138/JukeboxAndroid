import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DownloadsList } from '../components/downloads/DownloadsList';
import { Pressable } from '../components/Pressable';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, scene, usePressed } from '../lib/theme/index';
import { Behind, scrimOf } from '../lib/theme/Veil';
import { useDownloads } from '../lib/youtube/DownloadsProvider';
import { youtubeError } from '../lib/youtube/errors';
import { downloads } from '../lib/youtube/native';
import { tallyOf } from '../lib/youtube/queueView';

/**
 * The downloads: what is being fetched, what is waiting to be, and what has
 * been.
 *
 * A screen of its own, opened from Settings, from the search tab and from
 * the button that floats over the app. The search tab used to show the last
 * few under its results, which was enough while a download was a thing done
 * one at a time from that tab. It is now a queue that an album, a playlist
 * and Discover all add to, and a queue wants seeing whole: what is next,
 * what went wrong an hour ago, and somewhere to say "not that one" or "this
 * one first".
 *
 * Top to bottom in the order of how soon each thing matters: the state of
 * the queue in a sentence with the two controls over all of it, the download
 * under way, the ones waiting in the order they will go, and the history.
 */
export default function DownloadsScreen() {
  const { all, paused, error, refresh, cancel, retry, move, setPaused, clearHistory, cancelAll } = useDownloads();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const insets = useSafeAreaInsets();
  const said = t.downloads;
  /** Whether "cancel all" has been pressed and is waiting to be meant. */
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // With the files looked for, so that a download deleted from the phone
  // since is shown as gone and not as in the library.
  useFocusEffect(
    useCallback(() => {
      void refresh(true);
    }, [refresh])
  );

  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!asking) return false;
        setAsking(false);
        return true;
      });
      return () => listener.remove();
    }, [asking])
  );

  /*
    Each of these is handed to every row, so each is the same function from
    one draw to the next: a row is drawn again when its download changes and
    not because the phone was read.
  */
  const cancelOne = useCallback(
    (id: string) => {
      setMessage(null);
      cancel(id).catch((failure: unknown) => setMessage(youtubeError(failure, t.search.failed.cancel, t)));
    },
    [cancel, t]
  );
  const retryOne = useCallback(
    (id: string) => {
      setMessage(null);
      retry(id).catch((failure: unknown) => setMessage(youtubeError(failure, t.search.failed.queue, t)));
    },
    [retry, t]
  );
  // Removes nothing from the phone, so it is not asked about.
  const clear = useCallback(() => {
    clearHistory().catch(() => {});
  }, [clearHistory]);

  if (!downloads) {
    return (
      <View style={styles.centred}>
        <Text style={styles.emptyHeading}>{t.search.unavailable.heading}</Text>
        <Text style={styles.emptyBody}>{said.unavailable}</Text>
      </View>
    );
  }

  const tally = tallyOf(all);
  const busy = tally.underWay + tally.waiting > 0;
  const trouble = message ?? (error ? youtubeError(error, said.readFailed, t) : null);

  const header = (
    <View style={styles.header}>
      <Text style={styles.state} accessibilityRole="header">
        {said.state(tally.underWay, tally.waiting, paused)}
      </Text>
      {paused ? <Text style={styles.note}>{said.pausedNote}</Text> : null}
      {tally.automatic > 0 ? <Text style={styles.note}>{said.automaticNote(tally.automatic)}</Text> : null}
      {/*
        Only while there is a queue to pause or to cancel — and while it is
        paused whatever is in it, or there would be no way to say resume.
      */}
      {busy || paused ? (
        <View style={styles.controls}>
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            style={styles.button}
            onPress={() => {
              setPaused(!paused).catch(() => {});
            }}>
            <Text style={styles.buttonLabel}>{paused ? said.resume : said.pause}</Text>
          </Pressable>
          {busy ? (
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              style={styles.quiet}
              onPress={() => setAsking(true)}>
              <Text style={styles.quietLabel}>{said.cancelAll}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {trouble ? (
        <Text accessibilityRole="alert" style={styles.bad}>
          {trouble}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Everything the question below is laid over. */}
      <Behind veiled={asking} style={styles.fill}>
        <DownloadsList
          all={all}
          header={header}
          empty={
            <View style={styles.empty}>
              <Text style={styles.emptyHeading}>{said.empty.heading}</Text>
              <Text style={styles.emptyBody}>{said.empty.body}</Text>
            </View>
          }
          edge={insets}
          onCancel={cancelOne}
          onRetry={retryOne}
          onMove={move}
          onClear={clear}
        />
      </Behind>

      {asking ? (
        <View style={styles.layer}>
          <Pressable style={styles.backdrop} accessible={false} onPress={() => setAsking(false)} />
          <View style={styles.confirm}>
            <Text style={styles.confirmHeading}>{said.cancelAllQuestion}</Text>
            <Text style={styles.note}>{said.cancelAllHint}</Text>
            <View style={styles.confirmActions}>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                style={styles.confirmButton}
                onPress={() => setAsking(false)}>
                <Text style={styles.confirmLabel}>{said.keep}</Text>
              </Pressable>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                style={styles.confirmButton}
                onPress={() => {
                  setAsking(false);
                  setMessage(null);
                  cancelAll().catch((failure: unknown) =>
                    setMessage(youtubeError(failure, t.search.failed.cancel, t))
                  );
                }}>
                <Text style={styles.destructive}>{said.cancelAll}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, ...scene(c) },
    fill: { flex: 1 },
    centred: { flex: 1, ...scene(c), padding: 24, justifyContent: 'center', gap: 10 },

    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6, gap: 8 },
    state: { color: c.text, fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
    note: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
    bad: { color: c.danger, fontSize: 12.5, lineHeight: 18 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    button: {
      minHeight: 44,
      minWidth: 108,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: c.surface,
      ...outlined(c),
    },
    buttonLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    // The quieter of the two, and the one that is asked about before it is done.
    quiet: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12 },
    quietLabel: { color: c.textMuted, fontSize: 13.5 },

    empty: { paddingHorizontal: 32, paddingTop: 48, alignItems: 'center', gap: 8 },
    emptyHeading: { color: c.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
    emptyBody: { color: c.textFaint, fontSize: 13, lineHeight: 19, textAlign: 'center' },

    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: scrimOf(c) },
    layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
    confirm: {
      // As wide as an upright phone and no wider, so that sideways it is a
      // dialog in the middle and not a band across the screen.
      width: '100%',
      maxWidth: 420,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 20,
      gap: 10,
      ...outlined(c),
    },
    confirmHeading: { color: c.text, fontSize: 15.5, fontWeight: '600' },
    confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 6 },
    confirmButton: { paddingHorizontal: 14, paddingVertical: 9, minHeight: 40, justifyContent: 'center', borderRadius: 8 },
    confirmLabel: { color: c.textSecondary, fontSize: 14 },
    destructive: { color: c.danger, fontSize: 14, fontWeight: '600' },
  })
);
