import { ScrollView, StyleSheet } from 'react-native';

import { Dialog } from '../Dialog';
import { TimedRow } from '../TimedRow';
import { useT } from '../../lib/i18n/index';
import { usePlayerPosition } from '../../lib/player/PlayerProvider';
import { chapterAt, type Chapter } from '../../lib/tapes/extras';
import { haptic } from '../../lib/ui/haptics';
import { durationLabel } from '../../lib/youtube/types';

/**
 * The chapters of the tape playing, from the player: each where it begins
 * and what it is called, the one it is in picked out. A chapter pressed is
 * gone to; and the sleep timer can be set to the end of the one it is in.
 * The app's small card (`Dialog`), in a window of its own over the player.
 */
export function ChaptersSheet({
  visible,
  chapters,
  durationSec,
  onSeek,
  onSleepAt,
  onClose,
}: {
  visible: boolean;
  chapters: readonly Chapter[];
  durationSec: number;
  onSeek: (seconds: number) => void;
  /** The sleep timer set to stop at [positionSec] in the tape: the end of this chapter, however long it takes to get there. */
  onSleepAt: (positionSec: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const said = t.player.chapters;
  const { positionSec } = usePlayerPosition(visible);
  const at = chapterAt(chapters, positionSec);
  const end = chapters[at + 1]?.startSec ?? durationSec;

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={said.heading(chapters.length)}
      edge
      answers={[
        { label: t.common.close, kind: 'quiet', onPress: onClose },
        ...(at >= 0 && end > positionSec
          ? [
              {
                label: said.sleepAtEnd,
                onPress: () => {
                  haptic('choices', 'toggleOn');
                  onSleepAt(end);
                  onClose();
                },
              },
            ]
          : []),
      ]}>
      <ScrollView style={styles.list}>
        {chapters.map((chapter, index) => (
          <TimedRow
            key={`${index}-${chapter.startSec}`}
            at={durationLabel(chapter.startSec) || '0:00'}
            text={chapter.title || said.untitled(index + 1)}
            on={index === at}
            onPress={() => {
              haptic('player', 'tick');
              onSeek(chapter.startSec);
              onClose();
            }}
          />
        ))}
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  // As tall as its chapters, up to what the card allows, and scrolled past that.
  list: { flexGrow: 0 },
});
