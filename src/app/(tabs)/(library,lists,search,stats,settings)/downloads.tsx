import { useCallback, useState } from 'react';
import { LEADING, SPACE, TYPE } from '../../../lib/theme/measures';
import { Note } from '../../../components/Note';
import { ScreenState } from '../../../components/ScreenState';
import { Button, TextButton } from '../../../components/Button';
import { ConfirmSheet } from '../../../components/ConfirmSheet';
import { noteError } from '../../../lib/support/errorLogStore';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnderBars } from '../../../components/UnderBars';

import { DownloadsList } from '../../../components/downloads/DownloadsList';
import { ExtractorPanel } from '../../../components/downloads/ExtractorPanel';
import { downloadsLookedAt } from '../../../lib/ui/downloadsButton';
import { useT } from '../../../lib/i18n/index';
import { makeStyles, scene } from '../../../lib/theme/index';
import { Behind } from '../../../lib/theme/Veil';
import { useDownloads } from '../../../lib/youtube/DownloadsProvider';
import { youtubeError } from '../../../lib/youtube/errors';
import { checkExtractor, updateExtractor, useExtractorAdvice, useExtractorBusy } from '../../../lib/youtube/extractorState';
import { downloads } from '../../../lib/youtube/native';
import { tallyOf } from '../../../lib/youtube/queueView';
import { haptic } from '../../../lib/ui/haptics';

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
 *
 * Between the heading and the list, yt-dlp's own lines: which version does
 * the downloading, and whether there is a newer one (`ExtractorPanel`). It
 * is here because this is the screen a download fails on.
 */
export default function DownloadsScreen() {
  const { all: allNow, paused, error, refresh, cancel, retry, move, setPaused, clearHistory, cancelAll } = useDownloads();
  /*
    The downloads as they were when the page was last in front, while it is
    not, as the Search tab keeps them: told of them every second something
    downloads, the whole list was drawn again under whatever page was over
    it, or in a tab not open.
  */
  const focused = useIsFocused();
  const [allSeen, setAllSeen] = useState(allNow);
  if (focused && allSeen !== allNow) setAllSeen(allNow);
  const all = focused ? allNow : allSeen;
  const t = useT();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  // The bar of what is playing is along the foot of every page of a tab (see the tabs' layout), laid over it in a theme of glass: kept clear of.
  const under = useUnderBars();
  const said = t.downloads;
  /** Whether "cancel all" has been pressed and is waiting to be meant. */
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** What a failed row may offer in place of "Retry", where the failure looks like yt-dlp's age. */
  const advice = useExtractorAdvice();
  const adviceBusy = useExtractorBusy();

  // With the files looked for, so that a download deleted from the phone
  // since is shown as gone and not as in the library.
  useFocusEffect(
    useCallback(() => {
      void refresh(true);
    }, [refresh])
  );

  // The floating button need not say again what was read here: from the
  // moment this is opened to the moment it is left.
  useFocusEffect(
    useCallback(() => {
      downloadsLookedAt();
      return downloadsLookedAt;
    }, [])
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
  // What became of either is said beside the version, over the list.
  const advise = useCallback((what: 'update' | 'check') => {
    if (what === 'update') void updateExtractor();
    else void checkExtractor(true);
  }, []);
  // Removes nothing from the phone, so it is not asked about.
  const clear = useCallback(() => {
    clearHistory().catch(() => {});
  }, [clearHistory]);

  if (!downloads) {
    return (
      <View style={styles.centred}>
        <ScreenState kind="empty" title={t.search.unavailable.heading} text={said.unavailable} />
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
          <Button
            kind="secondary"
            label={paused ? said.resume : said.pause}
            onPress={() => {
              haptic('choices', paused ? 'toggleOn' : 'toggleOff');
              // Said where the phone would not: the button that did nothing looked broken.
              setPaused(!paused).catch((failure: unknown) => {
                haptic('results', 'reject');
                noteError('download', failure, 'The queue could not be paused or resumed');
              });
            }}
          />
          {/* The quieter of the two, and the one that is asked about before it is done. */}
          {busy ? <TextButton label={said.cancelAll} onPress={() => setAsking(true)} /> : null}
        </View>
      ) : null}
      {trouble ? (
        <Note tone="bad">
          {trouble}
        </Note>
      ) : null}
      <ExtractorPanel />
    </View>
  );

  return (
    <View style={[styles.screen, { paddingBottom: under.bottom }]}>
      {/* Everything the question below is laid over. */}
      <Behind veiled={false} style={styles.fill}>
        <DownloadsList
          all={all}
          header={header}
          empty={<ScreenState kind="empty" title={said.empty.heading} text={said.empty.body} />}
          edge={insets}
          onCancel={cancelOne}
          onRetry={retryOne}
          onMove={move}
          onClear={clear}
          advice={advice}
          adviceBusy={adviceBusy}
          onAdvice={advise}
        />
      </Behind>

      {/* A small question, on the app's own card over the page and short of the bars (`Floating`). */}
      <ConfirmSheet
        visible={asking}
        title={said.cancelAllQuestion}
        body={said.cancelAllHint}
        cancelLabel={said.keep}
        confirmLabel={said.cancelAll}
        danger
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          haptic('results', 'reject');
          setMessage(null);
          cancelAll().catch((failure: unknown) => setMessage(youtubeError(failure, t.search.failed.cancel, t)));
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, ...scene(c) },
    fill: { flex: 1 },
    centred: { flex: 1, ...scene(c), padding: SPACE.xl, justifyContent: 'center', gap: SPACE.s },

    header: { paddingHorizontal: SPACE.l, paddingTop: SPACE.l, paddingBottom: SPACE.xs, gap: SPACE.s },
    state: { color: c.text, fontSize: TYPE.head, fontWeight: '600', letterSpacing: -0.2 },
    note: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
    controls: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs },
  })
);
