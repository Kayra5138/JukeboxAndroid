import { StyleSheet, View } from 'react-native';
import { LEADING, RADIUS, SPACE, TYPE } from '../../lib/theme/measures';
import { Note } from '../Note';
import { SectionLabel } from '../settings/rows';
import { Busy } from '../Busy';
import { Text } from '../settings/Find';
import { Switch } from '../Switch';
import { Pressable } from '../Pressable';

import { PageScroll } from '../Page';
import { Slider } from '../Fader';
import { useT } from '../../lib/i18n/index';
import { usePlayerState } from '../../lib/player/PlayerProvider';
import { isTape } from '../../lib/tapes/tape';
import {
  BLANK,
  PLAY_PRESETS,
  PRESETS,
  VOICES,
  isBlank,
  usePlayPreset,
  shapeOf,
  shapePresetFor,
  useAudioEffects,
} from '../../lib/player/effects';
import { makeStyles, outlined, scene, useColours, usePressed } from '../../lib/theme/index';

/** Where the amounts that start from nothing are felt: at nothing, as they turn off. */
const OFF = [0] as const;

export function EffectsPage() {
  const { settings, failure, change } = useAudioEffects();
  // Nightcore and slowed: the player's speed and pitch, and the room (`usePlayPreset`). Not for a tape, which keeps its own.
  const play = usePlayPreset(change);
  const playing = usePlayerState().current;
  const tape = playing != null && isTape(playing);
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
  const say = t.sound.effects;
  /** A share of the whole, as the sliders read it: `35%`, or `Off` at nothing. */
  const share = (value: number) => t.format.percent(Math.round(value * 100));
  const shareOrOff = (value: number) => (value === 0 ? t.common.off : share(value));

  if (!settings) {
    return (
      <View style={styles.waiting}>
        <Busy color={c.textFaint} />
      </View>
    );
  }

  const shape = shapePresetFor(settings);
  const nothing = isBlank(settings) && play.on == null;

  return (
    <PageScroll>
      {failure ? (
        <Note tone="bad" style={styles.bad}>
          {failure}
        </Note>
      ) : null}

      {/*
        One list, because the split between a stereo shape and a treatment of
        the voice is a fact about how these are implemented rather than about
        what anybody is choosing. The two halves are independent and can both
        be on, so `Off` stands apart as the only chip that clears both.
      */}
      <SectionLabel>{say.title}</SectionLabel>
      <View style={styles.presets}>
        <Pressable
          android_ripple={pressed}
          accessibilityRole="radio"
          accessibilityState={{ checked: nothing }}
          style={[styles.preset, nothing && styles.presetOn]}
          onPress={() => {
            change(BLANK);
            if (play.on) play.choose(null);
          }}>
          <Text style={nothing ? styles.presetLabelOn : styles.presetLabel}>{t.common.off}</Text>
        </Pressable>

        {PRESETS.filter((preset) => preset.id !== 'off').map((preset) => (
          <Pressable
            android_ripple={pressed}
            key={preset.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: shape === preset.id }}
            style={[styles.preset, shape === preset.id && styles.presetOn]}
            onPress={() => change(shapeOf(preset.of))}>
            <Text style={shape === preset.id ? styles.presetLabelOn : styles.presetLabel}>
              {say.presets[preset.id].name}
            </Text>
          </Pressable>
        ))}

        {tape
          ? null
          : PLAY_PRESETS.map((preset) => {
              const on = play.on === preset.id;
              return (
                <Pressable
                  android_ripple={pressed}
                  key={preset.id}
                  accessibilityRole="togglebutton"
                  accessibilityState={{ checked: on }}
                  style={[styles.preset, on && styles.presetOn]}
                  // Pressed again, the song is played as it is again.
                  onPress={() => play.choose(on ? null : preset.id)}>
                  <Text style={on ? styles.presetLabelOn : styles.presetLabel}>{say.presets[preset.id].name}</Text>
                </Pressable>
              );
            })}

        {VOICES.filter((choice) => choice.id !== 'off').map((choice) => {
          const on = settings.voice === choice.id;
          return (
            <Pressable
              android_ripple={pressed}
              key={choice.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.preset, on && styles.presetOn]}
              /* Tapping the chosen one again is the only way back to no voice,
                 now that `Off` would also undo the stereo shape beside it. */
              onPress={() =>
                change(on ? { voice: 'off', voiceMix: 1 } : { voice: choice.id, voiceMix: choice.mix })
              }>
              <Text style={on ? styles.presetLabelOn : styles.presetLabel}>
                {say.voices[choice.id].name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {settings.voice !== 'off'
          ? say.voices[settings.voice].hint
          : play.on
            ? say.presets[play.on].hint
            : shape
            ? say.presets[shape].hint
            : say.ownSettings}
      </Text>

      {settings.voice === 'off' ? null : (
        <View style={styles.card}>
          <Slider
            label={say.howMuch}
            value={settings.voiceMix}
            min={0}
            max={1}
            accent={c.accent}
            snap={(value) => Math.round(value * 20) / 20}
            notches={OFF}
            format={share}
            onDrag={(value) => change({ voiceMix: value })}
            onSettle={(value) => change({ voiceMix: value })}
          />
          <Text style={styles.note}>{say.voiceNote}</Text>
        </View>
      )}

      <SectionLabel>{say.stereo}</SectionLabel>
      <View style={styles.card}>
        <Slider
          label={say.width}
          value={settings.width}
          min={0}
          max={2}
          accent={c.accent}
          centre={1}
          snap={(value) => Math.round(value * 20) / 20}
          format={(value) =>
            value === 0 ? say.mono : value === 1 ? say.asRecorded : share(value)
          }
          onDrag={(value) => change({ width: value })}
          onSettle={(value) => change({ width: value })}
        />
        <Slider
          label={say.balance}
          value={settings.balance}
          min={-1}
          max={1}
          accent={c.accent}
          centre={0}
          snap={(value) => Math.round(value * 20) / 20}
          format={(value) => {
            const percent = Math.abs(Math.round(value * 100));
            return value === 0 ? say.centre : value < 0 ? say.left(percent) : say.right(percent);
          }}
          onDrag={(value) => change({ balance: value })}
          onSettle={(value) => change({ balance: value })}
        />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.title}>{say.swap.title}</Text>
            <Text style={styles.muted}>{say.swap.note}</Text>
          </View>
          <Switch
            // Named, for a screen reader, which otherwise says only "switch, off".
            accessibilityLabel={say.swap.title}
            value={settings.swap}
            onValueChange={(on) => change({ swap: on })}
          />
        </View>
      </View>

      {/* The room the music is played into: see `Reverb.kt`. */}
      <SectionLabel>{say.room}</SectionLabel>
      <View style={styles.card}>
        <Slider
          label={say.reverb}
          value={settings.reverb ?? 0}
          min={0}
          max={1}
          accent={c.accent}
          snap={(value) => Math.round(value * 20) / 20}
          notches={OFF}
          format={shareOrOff}
          onDrag={(value) => change({ reverb: value })}
          onSettle={(value) => change({ reverb: value })}
        />
        <Text style={styles.note}>{say.reverbNote}</Text>
      </View>

      <SectionLabel>{say.headphones}</SectionLabel>
      <View style={styles.card}>
        <Slider
          label={say.crossfeed}
          value={settings.crossfeed}
          min={0}
          max={1}
          accent={c.accent}
          snap={(value) => Math.round(value * 20) / 20}
          notches={OFF}
          format={shareOrOff}
          onDrag={(value) => change({ crossfeed: value })}
          onSettle={(value) => change({ crossfeed: value })}
        />
        <Text style={styles.note}>{say.crossfeedNote}</Text>
      </View>

      <SectionLabel>{say.rotation}</SectionLabel>
      <View style={styles.card}>
        <Slider
          label={say.depth}
          value={settings.rotate}
          min={0}
          max={1}
          accent={c.accent}
          snap={(value) => Math.round(value * 20) / 20}
          notches={OFF}
          format={shareOrOff}
          onDrag={(value) => change({ rotate: value })}
          onSettle={(value) => change({ rotate: value })}
        />
        <Slider
          label={say.turnTakes}
          value={settings.rotateSeconds}
          min={2}
          max={40}
          accent={c.accent}
          snap={(value) => Math.round(value)}
          format={(value) => say.seconds(Math.round(value))}
          onDrag={(value) => change({ rotateSeconds: value })}
          onSettle={(value) => change({ rotateSeconds: value })}
        />
        <Text style={styles.note}>{say.rotationNote}</Text>
      </View>

      <SectionLabel>{say.level}</SectionLabel>
      <View style={styles.card}>
        <Slider
          label={say.preamp}
          value={settings.preampDb}
          min={-12}
          max={6}
          accent={c.accent}
          centre={0}
          snap={(value) => Math.round(value * 2) / 2}
          format={say.decibels}
          onDrag={(value) => change({ preampDb: value })}
          onSettle={(value) => change({ preampDb: value })}
        />
        <Text style={styles.note}>{say.levelNote}</Text>
      </View>
    </PageScroll>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  waiting: { flex: 1, ...scene(c), alignItems: 'center', justifyContent: 'center' },

  card: { backgroundColor: c.surface, borderRadius: RADIUS.card, padding: SPACE.l, gap: SPACE.xs, ...outlined(c) },

  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  preset: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.s,
    backgroundColor: c.surface,
    ...outlined(c),
  },
  presetOn: { backgroundColor: c.selected, ...outlined(c, c.selected) },
  presetLabel: { color: c.textMuted, fontSize: TYPE.small, fontWeight: '500' },
  presetLabelOn: { color: c.onSelected, fontSize: TYPE.small, fontWeight: '600' },

  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingTop: SPACE.xs },
  rowText: { flex: 1, minWidth: 0 },
  title: { color: c.text, fontSize: TYPE.body },
  muted: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint, marginTop: SPACE.xxs },
  note: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.small, paddingTop: SPACE.xs },
  hint: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.hint, marginTop: SPACE.s, marginLeft: SPACE.xs },
  bad: { marginBottom: SPACE.s },
}));
