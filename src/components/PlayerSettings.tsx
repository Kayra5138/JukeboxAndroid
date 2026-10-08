import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Slider } from './Fader';
import { TextPrompt } from './TextPrompt';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { useT } from '../lib/i18n/index';
import {
  MAX_SLEEP_MINUTES,
  SLEEP_PRESETS,
  describeTimer,
  isPreset,
  minutesFrom,
  preferencesFrom,
  preferencesToSetting,
  remainingMs,
  type SleepPreferences,
} from '../lib/player/sleep';
import { useSleepTimer } from '../lib/player/useSleepTimer';
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
import { makeStyles, outlined, switchColours, useColours, usePressed } from '../lib/theme/index';
import { scrimOf } from '../lib/theme/Veil';

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
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
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
          <Text style={styles.heading}>{t.format.upper(t.player.settings.playback)}</Text>
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
            accessibilityLabel={t.player.settings.backToNormal}
            disabled={untouched}
            hitSlop={12}
            onPress={() => {
              onSpeed(SPEED.normal);
              onPitch(multiplierOf(PITCH.normal));
            }}>
            <Text style={[styles.reset, untouched && styles.resetOff]}>{t.player.settings.normal}</Text>
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
            label={t.player.settings.speed}
            value={speed}
            min={SPEED.min}
            max={SPEED.max}
            centre={SPEED.normal}
            accent={c.accent}
            snap={(value) => snap(value, SPEED)}
            format={(value) => formatSpeed(value, t)}
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
            label={t.player.settings.pitch}
            value={semitones}
            min={PITCH.min}
            max={PITCH.max}
            centre={PITCH.normal}
            accent={c.accent}
            snap={(value) => snap(value, PITCH)}
            format={(value) => formatSemitones(value, t)}
            onDrag={(value) => onPitch(multiplierOf(value))}
            onSettle={(value) => onPitch(multiplierOf(value))}
          />
          <Text style={styles.hint}>{t.player.settings.pitchHint}</Text>
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
        <Text style={styles.heading}>{t.format.upper(t.player.settings.effects)}</Text>
        <View style={styles.chips}>
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            accessibilityState={{ checked: isBlank(effects) }}
            disabled={!effects}
            style={[
              styles.chip,
              isBlank(effects) && styles.chipOn,
              !effects && styles.chipOff,
            ]}
            onPress={() => changeEffects(BLANK)}>
            <Text style={isBlank(effects) ? styles.chipLabelOn : styles.chipLabel}>
              {t.common.off}
            </Text>
          </Pressable>

          {PRESETS.filter((preset) => preset.id !== 'off').map((preset) => {
            const on = shapePresetFor(effects) === preset.id;
            return (
              <Pressable
                android_ripple={pressed}
                key={preset.id}
                accessibilityRole="button"
                accessibilityState={{ checked: on }}
                disabled={!effects}
                style={[styles.chip, on && styles.chipOn, !effects && styles.chipOff]}
                onPress={() => changeEffects(shapeOf(preset.of))}>
                <Text style={on ? styles.chipLabelOn : styles.chipLabel}>
                  {t.sound.effects.presets[preset.id].name}
                </Text>
              </Pressable>
            );
          })}

          {VOICES.filter((choice) => choice.id !== 'off').map((choice) => {
            const on = effects?.voice === choice.id;
            return (
              <Pressable
                android_ripple={pressed}
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
                <Text style={on ? styles.chipLabelOn : styles.chipLabel}>
                  {t.sound.effects.voices[choice.id].name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {effects && effects.voice !== 'off' ? (
          <Text style={styles.hint}>{t.sound.effects.voices[effects.voice].hint}</Text>
        ) : null}

        <Pressable android_ripple={pressed} style={styles.row} onPress={() => leaveFor('/equalizer')}>
          <Text style={styles.rowTitle}>{t.nav.equalizer}</Text>
          <Text style={styles.hint}>{t.player.settings.equalizer.note}</Text>
        </Pressable>

        <Pressable android_ripple={pressed} style={styles.row} onPress={() => leaveFor('/transitions')}>
          <Text style={styles.rowTitle}>{t.nav.crossfade}</Text>
          <Text style={styles.hint}>{t.player.settings.crossfade.note}</Text>
        </Pressable>

        {/* Last of the rows, because it is the way out of here rather than a setting. */}
        <Pressable android_ripple={pressed} style={styles.row} onPress={() => leaveFor('/effects')}>
          <Text style={styles.rowTitle}>{t.player.settings.allEffects.title}</Text>
          <Text style={styles.hint}>{t.player.settings.allEffects.note}</Text>
        </Pressable>

        {/*
          Under everything else. The rest of this sheet is about how the music
          sounds, and this is about when it stops: reached for once, at the end
          of an evening, and in nobody's way down here the rest of the time.
        */}
        <SleepTimerSection />

      </ScrollView>
    </View>
  );
}

/**
 * The sleep timer: pause after a while, or when the track ends.
 *
 * Only the asking is here. The timer is kept by the playback service, since
 * it has to go off long after this sheet and the app around it have gone, and
 * what is drawn is what the service says it is keeping.
 *
 * A component of its own so that the clock it counts down by redraws these
 * few lines once a second and not the sliders above them, and so that it only
 * listens while the sheet is up: it is not mounted otherwise.
 */
function SleepTimerSection() {
  const { timer, now, supported, start, cancel } = useSleepTimer();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
  const [preferences, setPreferences] = useState(() =>
    preferencesFrom(readSetting(SETTINGS.sleepTimer))
  );
  const [asking, setAsking] = useState(false);
  const [refused, setRefused] = useState(false);

  const remember = (next: SleepPreferences) => {
    setPreferences(next);
    writeSetting(SETTINGS.sleepTimer, preferencesToSetting(next));
  };

  const pauseAfter = (minutes: number) => {
    remember({ ...preferences, minutes });
    void start({
      kind: 'duration',
      durationMs: minutes * 60_000,
      finishTrack: preferences.finishTrack,
    });
  };

  /*
    Applied to a timer that is already counting, and not only to the next one.
    The switch sits under a running countdown and reads as being about it, so
    one that waited for the next timer would look as if it had done nothing.
    Set again for what is left rather than for what was chosen, so the time on
    screen does not start over. A timer that has run out and is already waiting
    for its track is left as it is: the only other thing to do with it would be
    to stop the music under the finger, and there is a button for cancelling.
  */
  const letTrackFinish = (finishTrack: boolean) => {
    remember({ ...preferences, finishTrack });
    const left = remainingMs(timer, Date.now());
    // Under a second is less than the service will keep a timer for, and
    // asking would cancel the one that is about to fire.
    if (left !== null && left > 1_000) {
      void start({ kind: 'duration', durationMs: left, finishTrack });
    }
  };

  const running = timer.kind !== 'off';
  // The duration the countdown was started from, which is the last one
  // chosen. Not lit for a duration that has turned into waiting for a track.
  const counting = timer.kind === 'duration' && !timer.finishing ? preferences.minutes : null;
  // The last typed duration keeps a chip of its own, one press away the next
  // night, rather than having to be typed again.
  const typed = isPreset(preferences.minutes) ? null : preferences.minutes;

  return (
    <>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{t.format.upper(t.player.sleepTimer.title)}</Text>
        {/* Dimmed rather than taken away, for the reason `Normal` above is. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.player.sleepTimer.cancel}
          disabled={!running}
          hitSlop={12}
          onPress={() => void cancel()}>
          <Text style={[styles.reset, !running && styles.resetOff]}>{t.common.cancel}</Text>
        </Pressable>
      </View>

      <Text style={running ? styles.status : styles.hint}>
        {!supported
          ? t.player.sleepTimer.unsupported
          : (describeTimer(timer, now, t) ?? t.player.sleepTimer.about)}
      </Text>

      <View style={styles.chips}>
        {[...SLEEP_PRESETS, ...(typed === null ? [] : [typed])].map((minutes) => {
          const on = counting === minutes;
          return (
            <Pressable
              android_ripple={pressed}
              key={minutes}
              accessibilityRole="button"
              accessibilityLabel={t.player.sleepTimer.pauseAfter(minutes)}
              accessibilityState={{ selected: on, disabled: !supported }}
              disabled={!supported}
              style={[styles.chip, on && styles.chipOn, !supported && styles.chipOff]}
              onPress={() => pauseAfter(minutes)}>
              <Text style={on ? styles.chipLabelOn : styles.chipLabel}>
                {t.common.minutes(minutes)}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          accessibilityLabel={t.player.sleepTimer.pauseAfterTyped}
          accessibilityState={{ disabled: !supported }}
          disabled={!supported}
          style={[styles.chip, !supported && styles.chipOff]}
          onPress={() => {
            setRefused(false);
            setAsking(true);
          }}>
          <Text style={styles.chipLabel}>{t.player.sleepTimer.custom}</Text>
        </Pressable>

        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          accessibilityLabel={t.player.sleepTimer.pauseAtEnd}
          accessibilityState={{ selected: timer.kind === 'endOfTrack', disabled: !supported }}
          disabled={!supported}
          style={[
            styles.chip,
            timer.kind === 'endOfTrack' && styles.chipOn,
            !supported && styles.chipOff,
          ]}
          onPress={() => void start({ kind: 'endOfTrack' })}>
          <Text style={timer.kind === 'endOfTrack' ? styles.chipLabelOn : styles.chipLabel}>
            {t.player.sleepTimer.endOfTrack}
          </Text>
        </Pressable>
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchWords}>
          <Text style={styles.rowTitle}>{t.player.sleepTimer.finish.title}</Text>
          <Text style={styles.hint}>{t.player.sleepTimer.finish.note}</Text>
        </View>
        <Switch
          accessibilityLabel={t.player.sleepTimer.finish.label}
          value={preferences.finishTrack}
          disabled={!supported}
          onValueChange={letTrackFinish}
          {...switchColours(c, preferences.finishTrack)}
        />
      </View>

      <TextPrompt
        visible={asking}
        /*
          The heading is where a refusal is said, because the dialog has
          nowhere else to say it and a Start button that did nothing would be
          taken for a button that was missed.
        */
        heading={
          refused
            ? t.player.sleepTimer.refused(MAX_SLEEP_MINUTES)
            : t.player.sleepTimer.howMany
        }
        placeholder={t.player.sleepTimer.minutes}
        confirmLabel={t.player.sleepTimer.start}
        initial={String(preferences.minutes)}
        keyboardType="number-pad"
        onSubmit={(value) => {
          const minutes = minutesFrom(value);
          if (minutes === null) {
            setRefused(true);
            return;
          }
          setAsking(false);
          pauseAfter(minutes);
        }}
        onClose={() => setAsking(false)}
      />
    </>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: scrimOf(c),
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    ...outlined(c),
  },
  sheetBody: { paddingTop: 18, gap: 16 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: {
    color: c.textMuted,
    fontSize: 12,
    letterSpacing: 1,
  },
  reset: { color: c.accent, fontSize: 13 },
  resetOff: { color: c.textDisabled },
  controls: { gap: 18 },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 18 },
  // Figures of one width, so the line does not shuffle sideways as it counts.
  status: { color: c.text, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchWords: { flex: 1, gap: 3 },
  // Wrapping rather than a sideways scroller: a row that scrolls hides how
  // many there are, and six chips is few enough to simply show.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: c.surfaceRaised, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, ...outlined(c) },
  chipOn: { backgroundColor: c.primary, ...outlined(c, c.primary) },
  chipOff: { opacity: 0.4 },
  chipLabel: { color: c.textSecondary, fontSize: 13 },
  chipLabelOn: { color: c.onPrimary, fontSize: 13 },
  row: { backgroundColor: c.surfaceRaised, borderRadius: 12, padding: 16, gap: 5, marginTop: 6, ...outlined(c) },
  rowTitle: { color: c.text, fontSize: 15 },
}));
