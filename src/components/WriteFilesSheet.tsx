import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';

import {
  forecast,
  lineFor,
  summarise,
  writeToFiles,
  type Outcome,
} from '../lib/filetags';
import { useT } from '../lib/i18n/index';
import type { EnrichedTrack } from '../lib/media/enriched';
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';

type Stage =
  | { at: 'asking'; note?: string }
  | { at: 'writing'; done: number; total: number }
  | { at: 'done'; outcomes: Outcome[] };

/**
 * Writes a run of tracks into their files, and says what became of each.
 *
 * Three states, in order. It asks, saying how many files will be changed,
 * because this is the one thing in the app that alters somebody's music and a
 * selection is easy to make larger than was meant. It counts while it works,
 * since a FLAC is copied whole before it is touched and a hundred of them is
 * minutes. And it ends on a list: every file, and whether it was written, was
 * left alone, or failed and why. A count of failures with no saying which
 * would leave nothing to do about them.
 *
 * The system asks its own question between the first state and the second.
 * Saying no there comes back to the first with nothing written.
 *
 * It cannot be dismissed while it is writing. Stop asks it to finish the file
 * it is on and go no further, which is the only safe place to stop.
 */
export function WriteFilesSheet({
  visible,
  tracks,
  playingId,
  onClose,
}: {
  visible: boolean;
  /** As the library shows them, which is what is written. */
  tracks: EnrichedTrack[];
  /** The track now playing, which is left alone. */
  playingId: string | null;
  /** Told whether any file was actually changed, so the list behind can read again. */
  onClose: (wroteAny: boolean) => void;
}) {
  const [stage, setStage] = useState<Stage>({ at: 'asking' });
  const stopping = useRef(false);
  const [stopAsked, setStopAsked] = useState(false);
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  useWindowVeil(visible);
  const said = t.details.write;

  // Reset as it opens rather than as it closes, so the first frame is the
  // question and not the last run's results.
  useEffect(() => {
    if (visible) {
      setStage({ at: 'asking' });
      setStopAsked(false);
      stopping.current = false;
    }
  }, [visible]);

  const plan = forecast(tracks, playingId);

  const start = useCallback(async () => {
    stopping.current = false;
    setStopAsked(false);
    setStage({ at: 'writing', done: 0, total: plan.willWrite });
    try {
      const outcomes = await writeToFiles(tracks, {
        playingId,
        onProgress: (done, total) => setStage({ at: 'writing', done, total }),
        stopped: () => stopping.current,
      });
      setStage(outcomes ? { at: 'done', outcomes } : { at: 'asking', note: said.nothingWritten });
    } catch (error) {
      setStage({
        at: 'asking',
        note: error instanceof Error ? error.message : said.couldNotStart,
      });
    }
  }, [tracks, playingId, plan.willWrite, said]);

  const close = useCallback(() => {
    if (stage.at === 'writing') return;
    onClose(stage.at === 'done' && stage.outcomes.some((entry) => entry.result.status === 'written'));
  }, [stage, onClose]);

  const left = plan.wrongFormat + plan.playing;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessible={false}>
        {/* Swallows taps so touching the sheet does not count as touching the
            backdrop behind it. */}
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          {stage.at === 'asking' ? (
            <>
              <Text style={styles.heading} accessibilityRole="header">
                {plan.willWrite > 0 ? said.heading(plan.willWrite) : said.noneHeading}
              </Text>
              <Text style={styles.body}>
                {plan.willWrite > 0 ? said.body(plan.willWrite) : said.noneBody}
              </Text>
              {plan.willWrite > 0 && left > 0 ? (
                <Text style={styles.aside}>{said.skipping(plan.wrongFormat, plan.playing > 0)}</Text>
              ) : null}
              {stage.note ? (
                <Text style={styles.aside} accessibilityLiveRegion="polite">
                  {stage.note}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable android_ripple={pressed} style={styles.button} accessibilityRole="button" onPress={close}>
                  <Text style={styles.buttonLabel}>{plan.willWrite > 0 ? t.common.cancel : t.common.close}</Text>
                </Pressable>
                {plan.willWrite > 0 ? (
                  <Pressable
                    android_ripple={pressed}
                    style={[styles.button, styles.confirm]}
                    accessibilityRole="button"
                    accessibilityLabel={said.confirmLabel(plan.willWrite)}
                    onPress={() => void start()}>
                    <Text style={styles.confirmLabel}>{said.confirm}</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : null}

          {stage.at === 'writing' ? (
            <>
              <Text style={styles.heading} accessibilityRole="header">
                {said.writing}
              </Text>
              <View
                style={styles.progress}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={said.progressLabel(stage.done, stage.total)}
                accessibilityValue={{ min: 0, max: stage.total, now: stage.done }}>
                <ActivityIndicator color={c.text} />
                <Text style={styles.body}>{said.progress(stage.done, stage.total)}</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${stage.total > 0 ? (stage.done / stage.total) * 100 : 0}%` },
                  ]}
                />
              </View>
              <Text style={styles.aside}>
                {stopAsked ? said.stopping : said.keepOpen}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  android_ripple={pressed}
                  style={[styles.button, stopAsked && styles.disabled]}
                  disabled={stopAsked}
                  accessibilityRole="button"
                  accessibilityLabel={said.stopLabel}
                  onPress={() => {
                    stopping.current = true;
                    setStopAsked(true);
                  }}>
                  <Text style={styles.buttonLabel}>{said.stop}</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {stage.at === 'done' ? (
            <>
              <Text style={styles.heading} accessibilityRole="header" accessibilityLiveRegion="polite">
                {summarise(stage.outcomes, t)}
              </Text>
              {stage.outcomes.length < tracks.length ? (
                <Text style={styles.aside}>
                  {said.stoppedShort(tracks.length - stage.outcomes.length)}
                </Text>
              ) : null}
              <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
                {stage.outcomes.map((entry) => (
                  <View key={entry.id} style={styles.result} accessible>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <Text
                      style={
                        entry.result.status === 'failed'
                          ? styles.resultBad
                          : entry.result.status === 'written'
                            ? styles.resultGood
                            : styles.resultPlain
                      }>
                      {lineFor(entry.result, t)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.actions}>
                <Pressable android_ripple={pressed} style={[styles.button, styles.confirm]} accessibilityRole="button" onPress={close}>
                  <Text style={styles.confirmLabel}>{t.common.done}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: scrimOf(c),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 18,
    gap: 14,
    alignSelf: 'stretch',
    maxHeight: '80%',
    ...outlined(c),
  },
  heading: { color: c.text, fontSize: 15, fontWeight: '600' },
  body: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  aside: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { height: 4, borderRadius: 2, backgroundColor: c.borderStrong, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: c.text },
  results: { flexGrow: 0 },
  resultsContent: { gap: 12 },
  result: { gap: 2 },
  resultTitle: { color: c.text, fontSize: 13.5 },
  resultGood: { color: c.success, fontSize: 12.5, lineHeight: 18 },
  resultPlain: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  resultBad: { color: c.warning, fontSize: 12.5, lineHeight: 18 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  buttonLabel: { color: c.textSecondary, fontSize: 14 },
  confirm: { backgroundColor: c.primary },
  confirmLabel: { color: c.onPrimary, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.35 },
}));
