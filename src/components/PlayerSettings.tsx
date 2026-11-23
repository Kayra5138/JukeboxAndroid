import { useState, type RefObject } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { TextButton } from './Button';
import { CoverLookSettings } from './CoverLookSettings';
import { ResponseCurve, CURVE } from './equalizer/ResponseCurve';
import { Slider } from './Fader';
import { NumberStepper } from './NumberStepper';
import { Pressable } from './Pressable';
import { Chip, Segmented } from './Segmented';
import { Text } from './settings/Find';
import { LinkRow, Rule, SectionLabel, SwitchRow, useRows } from './settings/rows';
import { TabbedCard } from './TabbedCard';
import { PageInCard, useInCard } from './CardPages';
import { EffectsPage } from './sound/EffectsPage';
import { EqualizerPage } from './sound/EqualizerPage';
import { TransitionsPage } from './sound/TransitionsPage';
import { TextPrompt } from './TextPrompt';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { BUILT_IN, labelOf, matching } from '../lib/equalizer/presets';
import { useEqualizer } from '../lib/equalizer/useEqualizer';
import type { AudioEffects } from '../../modules/jukebox-audio';
import { useT } from '../lib/i18n/index';
import { usePitch, useSpeed } from '../lib/player/current';
import {
  BLANK,
  PRESETS,
  VOICES,
  isBlank,
  shapeOf,
  type EffectPresetId,
  type PlayPresetId,
  shapePresetFor,
  useAudioEffects,
  usePlayPreset,
} from '../lib/player/effects';
import type { Box, PanelPlace, PanelTab } from '../lib/player/panelPlace';
import { formatSemitones, formatSpeed, multiplierOf, PITCH, semitonesOf, snap, SPEED } from '../lib/player/playback';
import { usePlayerActions, usePlayerState } from '../lib/player/PlayerProvider';
import { setShakeToExtend, shakeSupported, shakeToExtend } from '../lib/player/shake';
import {
  MAX_SLEEP_MINUTES,
  SLEEP_PRESETS,
  describeTimer,
  formatRemaining,
  isPreset,
  minutesFrom,
  preferencesFrom,
  preferencesToSetting,
  remainingMs,
  type SleepPreferences,
} from '../lib/player/sleep';
import { roundTransition, transitionSeconds, useTransitions } from '../lib/player/useTransitions';
import { useSleepTimer } from '../lib/player/useSleepTimer';
import { setOwnTapeJump, TAPE_JUMP_RANGE, tapeJumpsFor } from '../lib/tapes/settings';
import { setTapeSpeed, tapeKeyOf } from '../lib/tapes/speed';
import { isTape } from '../lib/tapes/tape';
import { makeStyles, useColours } from '../lib/theme/index';
import { CARD_GAP, DISABLED, LEADING, ROW, SPACE, TYPE } from '../lib/theme/measures';
import { haptic } from '../lib/ui/haptics';

/*
  Settings that shape playback but are rarely touched, kept behind the gear so
  the player itself stays down to the controls used every time. Three parts,
  each one thing to come for: how it sounds ([SoundSettings]), how the player
  looks ([LookSettings]) and when it stops ([SleepSettings]). From the player,
  a card over it with a tab for each ([PlayerPanel]); in Settings, the pages
  Playback and Player look. The same parts in both, so that a setting is one
  setting wherever it is changed.
*/

/** The tape playing, if one is, and the key its book's or show's own speed and jumps are kept under. */
function usePlayingTape(): { tape: boolean; tapeKey: string | null } {
  const { current } = usePlayerState();
  const tape = current != null && isTape(current);
  return { tape, tapeKey: tape ? tapeKeyOf(current) : null };
}

/**
 * The player's settings over the player, from its gear or its sleep timer
 * ([tab]): a card with a tab for each part (`TabbedCard`), of glass over
 * the player ([behind]), where [place] puts it (`panelPlace`), the player
 * moved out of its way and nothing of it dimmed.
 *
 * A page one of them leads to — the equalizer, every effect, a list of
 * choices — opens in the card (`PageInCard`), with a way back to where it
 * was opened from.
 */
export function PlayerPanel({
  tab,
  onTab,
  onClose,
  place,
  behind,
}: {
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  onClose: () => void;
  place: PanelPlace;
  behind: RefObject<View | null> | null;
}) {
  const t = useT();
  const named = t.player.settings.tabs;
  // How long the timer has left, on its tab, to be seen from the other two.
  const { timer, now } = useSleepTimer();
  const left = remainingMs(timer, now);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Not stops for a screen reader, which closes the card with its own mark, or Back. */}
      {place.closers.map((box, at) => (
        <Pressable key={at} accessible={false} style={boxStyle(box)} onPress={onClose} />
      ))}
      <TabbedCard
        style={boxStyle(place.card)}
        behind={behind}
        tab={tab}
        onTab={onTab}
        onClose={onClose}
        tabs={[
          { value: 'sound', label: named.sound },
          // Read as the tab's name alone: said by the second, it was read out every second.
          { value: 'sleep', label: left != null ? `${named.sleep} ${formatRemaining(left)}` : named.sleep, accessibilityLabel: named.sleep },
          { value: 'look', label: named.look },
        ]}>
        {tab === 'sound' ? <SoundSettings /> : tab === 'look' ? <LookSettings /> : <SleepSettings />}
      </TabbedCard>
    </View>
  );
}

const boxStyle = (box: Box): ViewStyle => ({ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height });

/**
 * How the player looks: what stands where the cover is, what moves with the
 * music round it, a knock on the beat. Settings → Player look, and the
 * player's own tab of it.
 */
export function LookSettings() {
  const rows = useRows();
  return (
    <View style={rows.card}>
      <CoverLookSettings />
    </View>
  );
}

/**
 * How it sounds: speed and pitch, a tape's jumps, the effects worth choosing
 * without leaving the song, and the equalizer and the crossfade, each with
 * its switch and its few quick choices beside the way to the whole of it.
 * About what is playing: for a tape, its book's or show's own speed and
 * jumps, which the player reads again as this is closed.
 *
 * The whole of the equalizer, of the crossfade and of the effects is a page
 * of the tab from Settings, and a page in the card from the player's card
 * of settings (`PageInCard`), so that nothing opened from it goes anywhere
 * else.
 */
export function SoundSettings() {
  // Read here rather than handed down, so a slider moving draws this alone: see `playbackSpeed`.
  const speed = useSpeed();
  const pitch = usePitch();
  const { setSpeed, setPitch } = usePlayerActions();
  const { tape, tapeKey } = usePlayingTape();
  // Read again when the tape playing is of another book, and when changed here.
  const [jumps, setJumps] = useState(() => ({ key: tapeKey, ...tapeJumpsFor(tapeKey) }));
  if (jumps.key !== tapeKey) setJumps({ key: tapeKey, ...tapeJumpsFor(tapeKey) });
  const router = useRouter();
  const { settings: effects, change: changeEffects } = useAudioEffects(true);
  // Nightcore and slowed: speed and pitch together, and the room (`usePlayPreset`). Not offered for a tape.
  const play = usePlayPreset(changeEffects);
  const blank = isBlank(effects) && play.on == null;
  // The rest of the effects, shown: from the first when one of them is on, once it is known which is.
  const hiddenOn = effects != null && EFFECT_CHIPS.some((chip) => !chip.first && chipOn(chip, effects, play.on));
  const [more, setMore] = useState(false);
  const [opened, setOpened] = useState(false);
  if (effects != null && !opened) {
    setOpened(true);
    if (hiddenOn) setMore(true);
  }
  const t = useT();
  const styles = useStyles();
  const rows = useRows();
  const c = useColours();

  // A tape's speed is its own, kept for it as the player's speed button keeps it.
  const onSpeed = (value: number) => {
    if (tapeKey) setTapeSpeed(tapeKey, value);
    void setSpeed(value);
  };
  const onPitch = (value: number) => void setPitch(value);
  // Kept for the book or show, as its speed is, and handed to the player for presses from outside the app.
  const onJump = (which: 'back' | 'forward', seconds: number | null) => {
    if (!tapeKey) return;
    setOwnTapeJump(tapeKey, which, seconds);
    setJumps({ key: tapeKey, ...tapeJumpsFor(tapeKey) });
  };

  const inCard = useInCard();
  const [inside, setInside] = useState<Route | null>(null);
  const leaveFor = (route: Route) => {
    if (inCard) setInside(route);
    else router.push(route);
  };

  const semitones = semitonesOf(pitch);
  const untouched = speed === SPEED.normal && semitones === PITCH.normal;

  return (
    <View style={styles.groups}>
      <View>
        <View style={styles.headingRow}>
          <SectionLabel after={false}>{t.player.settings.playback}</SectionLabel>
          {/*
            Dimmed rather than taken away when there is nothing to undo. It
            lives above two controls that are dragged, and a button appearing
            and disappearing would shift them under the finger doing it.

            Both at once, because they are one intention — ExoPlayer is handed
            speed and pitch as a pair, and nobody who has wandered off normal
            wants to be told they must come back in two goes. Either slider
            still returns to normal on its own, which is what the notch is for.
          */}
          <TextButton
            label={t.player.settings.normal}
            accessibilityLabel={t.player.settings.backToNormal}
            disabled={untouched}
            onPress={() => {
              haptic('results', 'confirm');
              onSpeed(SPEED.normal);
              onPitch(multiplierOf(PITCH.normal));
            }}
          />
        </View>
        {/*
          Stacked, and stacked sideways too, where the rest of the app puts
          things side by side. Two columns would halve the travel, and half the
          travel is twice as hard to place a value on — which is the complaint
          this control was rebuilt to answer, not one to reintroduce.
        */}
        <View style={rows.card}>
          <View style={rows.row}>
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
          </View>
          {/* Not for a tape: a voice is listened to at its own pitch, sped up or not. */}
          {tape ? null : (
            <>
              <Rule />
              <View style={rows.row}>
                <Slider
                  label={t.player.settings.pitch}
                  value={semitones}
                  min={PITCH.min}
                  max={PITCH.max}
                  centre={PITCH.normal}
                  // Every semitone is felt, since every one is a different key.
                  notchEvery={1}
                  accent={c.accent}
                  snap={(value) => snap(value, PITCH)}
                  format={(value) => formatSemitones(value, t)}
                  onDrag={(value) => onPitch(multiplierOf(value))}
                  onSettle={(value) => onPitch(multiplierOf(value))}
                />
                <Text style={rows.muted}>{t.player.settings.pitchHint}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/*
        A tape's jumps, for its book or show, beside its speed, which is
        kept the same way: a lecture wants a longer step back than a novel.
        The general ones until changed here; `General` gives both back.
      */}
      {tapeKey ? (
        <View>
          <View style={styles.headingRow}>
            <SectionLabel after={false}>{t.player.settings.jumps.heading}</SectionLabel>
            <TextButton
              label={t.player.settings.jumps.general}
              accessibilityLabel={t.player.settings.jumps.backToGeneral}
              disabled={!jumps.ownBack && !jumps.ownForward}
              onPress={() => {
                haptic('results', 'confirm');
                onJump('back', null);
                onJump('forward', null);
              }}
            />
          </View>
          <View style={rows.card}>
            {(['back', 'forward'] as const).map((which, at) => (
              <View key={which}>
                {at > 0 ? <Rule /> : null}
                <View style={rows.row}>
                  <View style={rows.line}>
                    <Text style={rows.title}>{t.player.settings.jumps[which]}</Text>
                    <NumberStepper
                      name={t.player.settings.jumps[which]}
                      range={TAPE_JUMP_RANGE}
                      value={jumps[which]}
                      onChange={(seconds) => onJump(which, seconds)}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
          <Text style={rows.aside}>{t.player.settings.jumps.note}</Text>
        </View>
      ) : null}

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
      <View>
        <SectionLabel after={false}>{t.player.settings.effects}</SectionLabel>
        <View style={styles.chips}>
          {/*
            Off and the stereo shapes are one of a set, of which one is the
            answer; the voices beside them are each on or off by itself, and
            pressed again turn off. Said so to a screen reader, which would
            otherwise hear a row of buttons that are somehow checked.

            The few reached for most first, and the rest behind More, which
            shows them where they are: open already when one of them is on,
            so that what is playing is never under a button.
          */}
          {(more ? EFFECT_CHIPS : EFFECT_CHIPS.filter((chip) => chip.first)).map((chip) => {
            if (chip.kind === 'play' && tape) return null;
            if (chip.kind === 'shape') {
              const preset = PRESETS.find((one) => one.id === chip.id)!;
              return (
                <Chip
                  key={chip.id}
                  label={chip.id === 'off' ? t.common.off : t.sound.effects.presets[preset.id].name}
                  role="radio"
                  on={chip.id === 'off' ? blank : shapePresetFor(effects) === chip.id}
                  disabled={!effects}
                  onPress={() => {
                    haptic('choices', 'tick');
                    if (chip.id !== 'off') {
                      changeEffects(shapeOf(preset.of));
                      return;
                    }
                    changeEffects(BLANK);
                    if (play.on) play.choose(null);
                  }}
                />
              );
            }
            if (chip.kind === 'play') {
              const on = play.on === chip.id;
              return (
                <Chip
                  key={chip.id}
                  label={t.sound.effects.presets[chip.id].name}
                  on={on}
                  disabled={!effects}
                  // Pressed again, the song is played as it is again.
                  onPress={() => {
                    haptic('choices', on ? 'toggleOff' : 'toggleOn');
                    play.choose(on ? null : chip.id);
                  }}
                />
              );
            }
            const voice = VOICES.find((one) => one.id === chip.id)!;
            const on = effects?.voice === voice.id;
            return (
              <Chip
                key={chip.id}
                label={t.sound.effects.voices[voice.id].name}
                on={on}
                disabled={!effects}
                /*
                  Tapping the one already chosen turns it off, because there is
                  no longer an `Off` in this half of the row to go back to and
                  `Off` on its own would also undo whatever stereo shape was
                  set alongside it.
                */
                onPress={() => {
                  haptic('choices', on ? 'toggleOff' : 'toggleOn');
                  changeEffects(on ? { voice: 'off', voiceMix: 1 } : { voice: voice.id, voiceMix: voice.mix });
                }}
              />
            );
          })}
          <Chip
            label={more ? t.player.settings.fewerEffects : t.player.settings.moreEffects}
            role="button"
            on={false}
            expanded={more}
            onPress={() => {
              haptic('choices', 'tick');
              setMore(!more);
            }}
          />
        </View>
        {effects && effects.voice !== 'off' ? (
          <Text style={rows.aside}>{t.sound.effects.voices[effects.voice].hint}</Text>
        ) : null}
        <View style={[rows.card, styles.under]}>
          <LinkRow
            title={t.player.settings.allEffects.title}
            hint={t.player.settings.allEffects.note}
            onPress={() => leaveFor('/effects')}
          />
        </View>
      </View>

      <EqualizerCard open={() => leaveFor('/equalizer')} />
      {/* Nor this: a tape is never faded into the next thing. */}
      {tape ? null : <CrossfadeCard open={() => leaveFor('/transitions')} />}

      <PageInCard visible={inside === '/equalizer'} title={t.nav.equalizer} bare onClose={() => setInside(null)}>
        <EqualizerPage />
      </PageInCard>
      <PageInCard visible={inside === '/transitions'} title={t.nav.crossfade} bare onClose={() => setInside(null)}>
        <TransitionsPage />
      </PageInCard>
      <PageInCard visible={inside === '/effects'} title={t.nav.effects} bare onClose={() => setInside(null)}>
        <EffectsPage />
      </PageInCard>
    </View>
  );
}

/** The pages of the sound that the quick choices lead to the whole of. */
type Route = '/equalizer' | '/transitions' | '/effects';

/**
 * The effects offered beside the player, in the order they are shown: those
 * [first] always, the rest behind More. A stereo shape (`shape`), a way of
 * playing that is speed and pitch together (`play`, never for a tape), or a
 * treatment of the voice (`voice`).
 */
const EFFECT_CHIPS: readonly (
  | { kind: 'shape'; id: EffectPresetId; first: boolean }
  | { kind: 'play'; id: PlayPresetId; first: boolean }
  | { kind: 'voice'; id: AudioEffects['voice']; first: boolean }
)[] = [
  { kind: 'shape', id: 'off', first: true },
  { kind: 'shape', id: 'mono', first: true },
  { kind: 'play', id: 'nightcore', first: true },
  { kind: 'play', id: 'slowed', first: true },
  { kind: 'voice', id: 'vintage', first: true },
  { kind: 'shape', id: 'wide', first: false },
  { kind: 'shape', id: 'headphones', first: false },
  { kind: 'shape', id: '8d', first: false },
  { kind: 'shape', id: 'karaoke', first: false },
  { kind: 'voice', id: 'robot', first: false },
  { kind: 'voice', id: 'swirl', first: false },
  { kind: 'voice', id: 'chipmunk', first: false },
  { kind: 'voice', id: 'squeak', first: false },
];

/** Whether [chip] is the effect, or one of the effects, in force. */
function chipOn(chip: (typeof EFFECT_CHIPS)[number], effects: AudioEffects, playing: PlayPresetId | null | undefined): boolean {
  if (chip.kind === 'shape') return chip.id !== 'off' && shapePresetFor(effects) === chip.id;
  if (chip.kind === 'play') return playing === chip.id;
  return effects.voice === chip.id;
}

/**
 * The equalizer's switch, its curve and the curves to choose from, as the
 * page Equalizer has them; the curve, and the row under it, lead to that
 * page for the rest. Only the way there while the player has not said what
 * it has, or cannot (an older build).
 */
function EqualizerCard({ open }: { open: () => void }) {
  const t = useT();
  const rows = useRows();
  const styles = useStyles();
  const c = useColours();
  const { state, commit, shape } = useEqualizer();
  const parametric = state?.parametric;
  const kept = parametric?.presets ?? [];
  const all = [...BUILT_IN, ...kept];
  const off = !state?.enabled;
  return (
    <View style={rows.card}>
      {state ? (
        <>
          <SwitchRow
            title={t.sound.equalizer.title}
            hint={state.attached ? t.sound.equalizer.attached : t.sound.equalizer.saved}
            value={state.enabled}
            onChange={(enabled) => void commit({ enabled })}
          />
          {parametric ? (
            // Dimmed rather than taken away when off, as on its page: the shape set up is still there to come back to.
            <View
              collapsable={false}
              style={[styles.equalizer, off && styles.dimmed]}
              pointerEvents={off ? 'none' : 'auto'}
              importantForAccessibility={off ? 'no-hide-descendants' : 'auto'}>
              <Pressable style={styles.curve} accessibilityRole="button" accessibilityLabel={t.nav.equalizer} onPress={open}>
                <ResponseCurve bands={parametric.bands} height={CURVE.quick} accent={c.accent} />
              </Pressable>
              {/* Without a mark when the curve is none of them, having been shaped by hand. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presets}>
                <Segmented
                  variant="outline"
                  wrap={false}
                  options={all.map((preset) => ({ value: preset.name, label: labelOf(preset.name, t) }))}
                  value={matching(parametric.bands, parametric.preampDb, all)}
                  onChange={(name) => {
                    const preset = all.find((candidate) => candidate.name === name);
                    if (preset) shape({ bands: preset.bands, preampDb: preset.preampDb }, true);
                  }}
                />
              </ScrollView>
            </View>
          ) : null}
          <Rule />
        </>
      ) : null}
      <LinkRow title={t.player.settings.equalizer.note} onPress={open} />
    </View>
  );
}

/**
 * The crossfade's switch and how far one track runs over the next, as the
 * page Crossfade has them first; the row under them leads there for the
 * other transitions.
 */
function CrossfadeCard({ open }: { open: () => void }) {
  const t = useT();
  const say = t.sound.transitions;
  const rows = useRows();
  const styles = useStyles();
  const c = useColours();
  const { state, push, commit } = useTransitions();
  const off = !state?.enabled;
  return (
    <View style={rows.card}>
      {state ? (
        <>
          <SwitchRow title={say.title} hint={say.about} value={state.enabled} onChange={(enabled) => void commit({ enabled })} />
          <Rule />
          <View
            collapsable={false}
            style={[rows.row, off && styles.dimmed]}
            pointerEvents={off ? 'none' : 'auto'}
            importantForAccessibility={off ? 'no-hide-descendants' : 'auto'}>
            <Slider
              label={say.overlap}
              value={state.autoMs}
              min={0}
              max={state.maxAutoMs}
              notches={NOTHING}
              snap={(value) => roundTransition(value, state.maxAutoMs)}
              accent={c.accent}
              format={(milliseconds) => transitionSeconds(milliseconds, t)}
              onDrag={(value) => push({ autoMs: roundTransition(value, state.maxAutoMs) })}
              onSettle={(value) => void commit({ autoMs: roundTransition(value, state.maxAutoMs) })}
            />
          </View>
          <Rule />
        </>
      ) : null}
      <LinkRow title={say.more} onPress={open} />
    </View>
  );
}

/** Where the overlap is felt: at nothing, which is no crossfade. */
const NOTHING = [0] as const;

/**
 * When it stops: the sleep timer, for a song or for a tape's part. Settings
 * → Playback, and the player's own tab of it.
 */
export function SleepSettings() {
  const { tape } = usePlayingTape();
  return <SleepTimerSection tape={tape} />;
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
function SleepTimerSection({ tape }: { tape: boolean }) {
  const { timer, now, supported, start, cancel } = useSleepTimer();
  const t = useT();
  // A part's words for a tape, a song's for everything else; the rest is the same.
  const said = tape ? { ...t.player.sleepTimer, ...t.player.sleepTimer.tape } : t.player.sleepTimer;
  const styles = useStyles();
  const rows = useRows();
  const [preferences, setPreferences] = useState(() =>
    preferencesFrom(readSetting(SETTINGS.sleepTimer))
  );
  const [asking, setAsking] = useState(false);
  const [refused, setRefused] = useState(false);
  const [shake, setShake] = useState(shakeToExtend);

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
    // Only a timer counting the clock: one for the end of a chapter counts
    // the tape, and set again as a duration it would stop at the wrong place.
    const left = timer.kind === 'duration' ? remainingMs(timer, Date.now()) : null;
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
    <View style={styles.sleep}>
      <View style={styles.headingRow}>
        <SectionLabel after={false}>{t.player.sleepTimer.title}</SectionLabel>
        {/* Dimmed rather than taken away, for the reason `Normal` above is. */}
        <TextButton
          label={t.common.cancel}
          accessibilityLabel={t.player.sleepTimer.cancel}
          disabled={!running}
          onPress={() => {
            haptic('choices', 'tick');
            void cancel();
          }}
        />
      </View>

      <Text style={running ? styles.status : styles.hint}>
        {!supported
          ? t.player.sleepTimer.unsupported
          : (describeTimer(timer, now, t, tape) ?? said.about)}
      </Text>

      {/*
        Buttons, each of which starts the timer, and the one it was started
        from is marked: pressed again it starts afresh. Typing a time of one's
        own is a button among them that is never the one marked; the time
        typed then has a chip of its own, before it.
      */}
      <Segmented
        role="button"
        variant="chips"
        disabled={!supported}
        options={[
          ...[...SLEEP_PRESETS, ...(typed === null ? [] : [typed])].map((minutes) => ({
            value: `after ${minutes}`,
            label: t.common.minutes(minutes),
            accessibilityLabel: t.player.sleepTimer.pauseAfter(minutes),
          })),
          { value: 'typed', label: t.player.sleepTimer.custom, accessibilityLabel: t.player.sleepTimer.pauseAfterTyped },
          { value: 'end', label: said.endOfTrack, accessibilityLabel: said.pauseAtEnd },
        ]}
        value={counting !== null ? `after ${counting}` : timer.kind === 'endOfTrack' ? 'end' : null}
        onChange={(choice) => {
          if (choice === 'typed') {
            setRefused(false);
            setAsking(true);
          } else if (choice === 'end') {
            // Felt beyond the chips' own tick: something will now stop the music.
            haptic('results', 'confirm');
            void start({ kind: 'endOfTrack' });
          } else {
            haptic('results', 'confirm');
            pauseAfter(Number(choice.slice('after '.length)));
          }
        }}
      />

      <View style={rows.card}>
        <SwitchRow
          title={said.finish.title}
          hint={said.finish.note}
          accessibilityLabel={said.finish.label}
          value={preferences.finishTrack}
          disabled={!supported}
          onChange={letTrackFinish}
        />
        {/* Kept by the player, which listens for the shake, and in force at once on a timer already near its end. */}
        {shakeSupported() ? (
          <>
            <Rule />
            <SwitchRow
              title={t.player.sleepTimer.shake.title}
              hint={t.player.sleepTimer.shake.note}
              accessibilityLabel={t.player.sleepTimer.shake.label}
              value={shake}
              disabled={!supported}
              onChange={(on) => {
                setShakeToExtend(on);
                setShake(on);
              }}
            />
          </>
        ) : null}
      </View>

      <TextPrompt
        page
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
            haptic('results', 'reject');
            setRefused(true);
            return;
          }
          haptic('results', 'confirm');
          setAsking(false);
          pauseAfter(minutes);
        }}
        onClose={() => setAsking(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  // One part from the next a card's distance apart, as on any page of Settings.
  groups: { gap: CARD_GAP },
  sleep: { gap: SPACE.m },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.small },
  // Figures of one width, so the line does not shuffle sideways as it counts.
  status: { color: c.text, fontSize: TYPE.small, lineHeight: LEADING.small, fontVariant: ['tabular-nums'] },
  // Wrapping rather than a sideways scroller: a row that scrolls hides how
  // many there are, and six chips is few enough to simply show.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  under: { marginTop: SPACE.m },
  equalizer: { gap: SPACE.m, paddingBottom: ROW.vertical },
  curve: { marginHorizontal: ROW.horizontal },
  // In from the card's sides as its rows are, and scrolled out under them.
  presets: { paddingHorizontal: ROW.horizontal },
  dimmed: { opacity: DISABLED },
}));
