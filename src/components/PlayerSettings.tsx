import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Slider } from './Fader';
import {
  formatSemitones,
  formatSpeed,
  multiplierOf,
  PITCH,
  semitonesOf,
  snap,
  SPEED,
} from '../lib/player/playback';
import {
  BLANK,
  PRESETS,
  VOICES,
  isBlank,
  shapeOf,
  shapePresetFor,
  useAudioEffects,
} from '../lib/player/effects';

const ACCENT = '#7ab8ff';

/**
 * Settings that shape playback but are rarely touched, kept behind the gear so
 * the player itself stays down to the controls used every time.
 *
 * A layer rather than a modal, which used to be because the value pickers
 * inside were modals of their own and stacking one on another is unreliable on
 * Android. The pickers have gone and the reason has not: this sheet is opened
 * from the player, which is itself a layer over the navigator.
 */
export function PlayerSettings({
  visible,
  speed,
  pitch,
  onSpeed,
  onPitch,
  onClose,
}: {
  visible: boolean;
  speed: number;
  pitch: number;
  onSpeed: (value: number) => void;
  onPitch: (value: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings: effects, change: changeEffects } = useAudioEffects(visible);
  if (!visible) return null;

  /*
    Left standing, both this and the player behind it.

    They used to be closed on the way out, because the player is a layer over
    the navigator and the pushed route would otherwise open behind it. The host
    now hides the layer for exactly as long as one of these routes is up, which
    fixes the picture without throwing the state away -- so coming back arrives
    here, at the menu this was opened from, rather than at the library.
  */
  const leaveFor = (route: '/equalizer' | '/transitions' | '/effects') => {
    router.push(route);
  };

  const semitones = semitonesOf(pitch);
  const untouched = speed === SPEED.normal && semitones === PITCH.normal;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[
          styles.sheetBody,
          {
            // Sideways the cutout and the gesture bar are down the sides, and
            // a slider whose last few values sat under either would be a
            // slider that could not reach its own ends.
            paddingLeft: insets.left + 20,
            paddingRight: insets.right + 20,
            paddingBottom: insets.bottom + 28,
          },
        ]}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Playback</Text>
          {/*
            Dimmed rather than taken away when there is nothing to undo. It
            lives above two controls that are dragged, and a button appearing
            and disappearing would shift them under the finger doing it.

            Both at once, because they are one intention — ExoPlayer is handed
            speed and pitch as a pair, and nobody who has wandered off normal
            wants to be told they must come back in two goes. Either slider
            still returns to normal on its own, which is what the notch is for.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to normal speed and pitch"
            disabled={untouched}
            hitSlop={12}
            onPress={() => {
              onSpeed(SPEED.normal);
              onPitch(multiplierOf(PITCH.normal));
            }}>
            <Text style={[styles.reset, untouched && styles.resetOff]}>Normal</Text>
          </Pressable>
        </View>

        {/*
          Stacked, and stacked sideways too, where the rest of the app puts
          things side by side. Two columns would halve the travel, and half the
          travel is twice as hard to place a value on — which is the complaint
          this control was rebuilt to answer, not one to reintroduce.
        */}
        <View style={styles.controls}>
          <Slider
            label="Speed"
            value={speed}
            min={SPEED.min}
            max={SPEED.max}
            centre={SPEED.normal}
            accent={ACCENT}
            snap={(value) => snap(value, SPEED)}
            format={formatSpeed}
            /*
              The same call on the way past as on the way down, where the other
              sliders in the app keep a cheap one for dragging. They can send
              a hundred distinct values across a drag; this one is notched, so
              it speaks only when the step changes — thirty times over the
              whole track, and nothing at all while a finger crosses one step.
            */
            onDrag={onSpeed}
            onSettle={onSpeed}
          />

          <Slider
            label="Pitch"
            value={semitones}
            min={PITCH.min}
            max={PITCH.max}
            centre={PITCH.normal}
            accent={ACCENT}
            snap={(value) => snap(value, PITCH)}
            format={formatSemitones}
            onDrag={(value) => onPitch(multiplierOf(value))}
            onSettle={(value) => onPitch(multiplierOf(value))}
          />
          <Text style={styles.hint}>
            Semitones, up or down, with the recording still running at the speed
            above it.
          </Text>
        </View>

        {/*
          The choices worth making without leaving the song, in one row.

          Two headings was an accurate description of the code and a poor one of
          the thing: somebody reaching for this is picking how the record should
          sound, and whether the answer happens to be a stereo shape or a
          treatment of the voice is a distinction about how it is implemented.
          They do different halves of the settings and so can both be on at
          once, which is why `Off` is a chip of its own rather than the first of
          each list -- it is the only one that speaks for both halves.
        */}
        <Text style={styles.heading}>Effects</Text>
        <View style={styles.chips}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ checked: isBlank(effects) }}
            disabled={!effects}
            style={[
              styles.chip,
              isBlank(effects) && styles.chipOn,
              !effects && styles.chipOff,
            ]}
            onPress={() => changeEffects(BLANK)}>
            <Text style={isBlank(effects) ? styles.chipLabelOn : styles.chipLabel}>Off</Text>
          </Pressable>

          {PRESETS.filter((preset) => preset.name !== 'Off').map((preset) => {
            const on = shapePresetFor(effects) === preset.name;
            return (
              <Pressable
                key={preset.name}
                accessibilityRole="button"
                accessibilityState={{ checked: on }}
                disabled={!effects}
                style={[styles.chip, on && styles.chipOn, !effects && styles.chipOff]}
                onPress={() => changeEffects(shapeOf(preset.of))}>
                <Text style={on ? styles.chipLabelOn : styles.chipLabel}>{preset.name}</Text>
              </Pressable>
            );
          })}

          {VOICES.filter((choice) => choice.id !== 'off').map((choice) => {
            const on = effects?.voice === choice.id;
            return (
              <Pressable
                key={choice.id}
                accessibilityRole="button"
                accessibilityState={{ checked: on }}
                disabled={!effects}
                style={[styles.chip, on && styles.chipOn, !effects && styles.chipOff]}
                /*
                  Tapping the one already chosen turns it off, because there is
                  no longer an `Off` in this half of the row to go back to and
                  `Off` on its own would also undo whatever stereo shape was
                  set alongside it.
                */
                onPress={() =>
                  changeEffects(
                    on
                      ? { voice: 'off', voiceMix: 1 }
                      : { voice: choice.id, voiceMix: choice.mix }
                  )
                }>
                <Text style={on ? styles.chipLabelOn : styles.chipLabel}>{choice.name}</Text>
              </Pressable>
            );
          })}
        </View>
        {effects && effects.voice !== 'off' ? (
          <Text style={styles.hint}>
            {VOICES.find((choice) => choice.id === effects.voice)?.hint}
          </Text>
        ) : null}

        <Pressable style={styles.row} onPress={() => leaveFor('/equalizer')}>
          <Text style={styles.rowTitle}>Equalizer</Text>
          <Text style={styles.hint}>Bands, bass and loudness</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={() => leaveFor('/transitions')}>
          <Text style={styles.rowTitle}>Crossfade</Text>
          <Text style={styles.hint}>How one track gives way to the next</Text>
        </Pressable>

        {/* Last, because it is the way out of here rather than a setting. */}
        <Pressable style={styles.row} onPress={() => leaveFor('/effects')}>
          <Text style={styles.rowTitle}>All effects</Text>
          <Text style={styles.hint}>Width, crossfeed, rotation and level</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000cc',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  sheetBody: { paddingTop: 18, gap: 16 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: {
    color: '#8a8a8a',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reset: { color: ACCENT, fontSize: 13 },
  resetOff: { color: '#3f3f3f' },
  controls: { gap: 18 },
  hint: { color: '#5f5f5f', fontSize: 12, lineHeight: 18 },
  // Wrapping rather than a sideways scroller: a row that scrolls hides how
  // many there are, and six chips is few enough to simply show.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#242424', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  chipOn: { backgroundColor: '#ededed' },
  chipOff: { opacity: 0.4 },
  chipLabel: { color: '#bdbdbd', fontSize: 13 },
  chipLabelOn: { color: '#141414', fontSize: 13 },
  row: { backgroundColor: '#242424', borderRadius: 12, padding: 16, gap: 5, marginTop: 6 },
  rowTitle: { color: '#ededed', fontSize: 15 },
});
