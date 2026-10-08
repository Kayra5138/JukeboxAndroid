import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Pressable } from '../components/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Slider } from '../components/Fader';
import { useT } from '../lib/i18n/index';
import {
  BLANK,
  PRESETS,
  VOICES,
  isBlank,
  shapeOf,
  shapePresetFor,
  useAudioEffects,
} from '../lib/player/effects';
import { makeStyles, outlined, scene, switchColours, useColours, usePressed } from '../lib/theme/index';

export default function EffectsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, failure, change } = useAudioEffects();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
  const say = t.sound.effects;
  /** A share of the whole, as the sliders read it: `35%`, or `Off` at nothing. */
  const share = (value: number) => t.sound.percent(Math.round(value * 100));
  const shareOrOff = (value: number) => (value === 0 ? t.common.off : share(value));

  if (!settings) {
    return (
      <View style={styles.waiting}>
        <ActivityIndicator color={c.textFaint} />
      </View>
    );
  }

  const shape = shapePresetFor(settings);
  const nothing = isBlank(settings);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      {failure ? (
        <Text accessibilityRole="alert" style={styles.bad}>
          {failure}
        </Text>
      ) : null}

      {/*
        One list, because the split between a stereo shape and a treatment of
        the voice is a fact about how these are implemented rather than about
        what anybody is choosing. The two halves are independent and can both
        be on, so `Off` stands apart as the only chip that clears both.
      */}
      <Text style={styles.section}>{t.format.upper(say.title)}</Text>
      <View style={styles.presets}>
        <Pressable
          android_ripple={pressed}
          accessibilityRole="radio"
          accessibilityState={{ checked: nothing }}
          style={[styles.preset, nothing && styles.presetOn]}
          onPress={() => change(BLANK)}>
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
            format={share}
            onDrag={(value) => change({ voiceMix: value })}
            onSettle={(value) => change({ voiceMix: value })}
          />
          <Text style={styles.note}>{say.voiceNote}</Text>
        </View>
      )}

      <Text style={styles.section}>{t.format.upper(say.stereo)}</Text>
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
            value={settings.swap}
            onValueChange={(on) => change({ swap: on })}
            {...switchColours(c, settings.swap)}
          />
        </View>
      </View>

      <Text style={styles.section}>{t.format.upper(say.headphones)}</Text>
      <View style={styles.card}>
        <Slider
          label={say.crossfeed}
          value={settings.crossfeed}
          min={0}
          max={1}
          accent={c.accent}
          snap={(value) => Math.round(value * 20) / 20}
          format={shareOrOff}
          onDrag={(value) => change({ crossfeed: value })}
          onSettle={(value) => change({ crossfeed: value })}
        />
        <Text style={styles.note}>{say.crossfeedNote}</Text>
      </View>

      <Text style={styles.section}>{t.format.upper(say.rotation)}</Text>
      <View style={styles.card}>
        <Slider
          label={say.depth}
          value={settings.rotate}
          min={0}
          max={1}
          accent={c.accent}
          snap={(value) => Math.round(value * 20) / 20}
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

      <Text style={styles.section}>{t.format.upper(say.level)}</Text>
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
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  waiting: { flex: 1, ...scene(c), alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20 },

  section: {
    color: c.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 26,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 16, gap: 6, ...outlined(c) },

  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
    backgroundColor: c.surface,
    ...outlined(c),
  },
  presetOn: { backgroundColor: c.selected, ...outlined(c, c.selected) },
  presetLabel: { color: c.textMuted, fontSize: 13.5, fontWeight: '500' },
  presetLabelOn: { color: c.onSelected, fontSize: 13.5, fontWeight: '600' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 6 },
  rowText: { flex: 1, minWidth: 0 },
  title: { color: c.text, fontSize: 15 },
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  note: { color: c.textFaint, fontSize: 12, lineHeight: 18, paddingTop: 6 },
  hint: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginTop: 10, marginLeft: 4 },
  bad: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginBottom: 8 },
}));
