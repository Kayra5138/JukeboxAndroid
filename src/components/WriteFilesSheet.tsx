import { useCallback, useEffect, useRef, useState } from 'react';
import { LEADING, SPACE, TYPE } from '../lib/theme/measures';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Busy } from './Busy';
import { Dialog } from './Dialog';
import { CardAnswers } from './CardAnswers';

import {
  forecast,
  lineFor,
  summarise,
  writeToFiles,
  type Outcome,
} from '../lib/filetags';
import { useT } from '../lib/i18n/index';
import { useCurrentId } from '../lib/player/current';
import type { EnrichedTrack } from '../lib/media/enriched';
import { makeStyles, useColours } from '../lib/theme/index';
import { haptic } from '../lib/ui/haptics';

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
  onClose,
}: {
  visible: boolean;
  /** As the library shows them, which is what is written. */
  tracks: EnrichedTrack[];
  /** Told whether any file was actually changed, so the list behind can read again. */
  onClose: (wroteAny: boolean) => void;
}) {
  const [stage, setStage] = useState<Stage>({ at: 'asking' });
  const stopping = useRef(false);
  const [stopAsked, setStopAsked] = useState(false);
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const said = t.details.write;
  // The track now playing, which is left alone.
  const playingId = useCurrentId();

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
      // Nothing felt for a no to the system's question, which is not a result.
      if (outcomes) haptic('results', outcomes.some((entry) => entry.result.status === 'written') ? 'confirm' : 'reject');
      setStage(outcomes ? { at: 'done', outcomes } : { at: 'asking', note: said.nothingWritten });
    } catch (error) {
      haptic('results', 'reject');
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
    // A card over the page, short of the bars: see `Dialog`.
    <Dialog visible={visible} onClose={close}>
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
              <CardAnswers
                answers={[
                  { label: plan.willWrite > 0 ? t.common.cancel : t.common.close, kind: 'quiet', onPress: close },
                  ...(plan.willWrite > 0
                    ? [{ label: said.confirm, accessibilityLabel: said.confirmLabel(plan.willWrite), onPress: () => void start() }]
                    : []),
                ]}
              />
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
                <Busy color={c.text} />
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
              <CardAnswers
                answers={[
                  {
                    label: said.stop,
                    kind: 'quiet',
                    disabled: stopAsked,
                    accessibilityLabel: said.stopLabel,
                    onPress: () => {
                      stopping.current = true;
                      setStopAsked(true);
                    },
                  },
                ]}
              />
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
              <CardAnswers answers={[{ label: t.common.done, onPress: close }]} />
            </>
          ) : null}
    </Dialog>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  heading: { color: c.text, fontSize: TYPE.body, fontWeight: '600' },
  body: { color: c.textSecondary, fontSize: TYPE.small, lineHeight: LEADING.small },
  aside: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
  progress: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m },
  track: { height: 4, borderRadius: 2, backgroundColor: c.borderStrong, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: c.text },
  results: { flexGrow: 0 },
  resultsContent: { gap: SPACE.m },
  result: { gap: SPACE.xxs },
  resultTitle: { color: c.text, fontSize: TYPE.small },
  resultGood: { color: c.success, fontSize: TYPE.hint, lineHeight: LEADING.hint },
  resultPlain: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
  resultBad: { color: c.warning, fontSize: TYPE.hint, lineHeight: LEADING.hint },
}));
