import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Slider } from '../components/Fader';
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

export default function EffectsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, failure, change } = useAudioEffects();

  if (!settings) {
    return (
      <View style={styles.waiting}>
        <ActivityIndicator color="#5f5f5f" />
      </View>
    );
  }

  const shape = shapePresetFor(settings);
  const voice = VOICES.find((choice) => choice.id === settings.voice);
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
      <Text style={styles.section}>Effects</Text>
      <View style={styles.presets}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: nothing }}
          style={[styles.preset, nothing && styles.presetOn]}
          onPress={() => change(BLANK)}>
          <Text style={nothing ? styles.presetLabelOn : styles.presetLabel}>Off</Text>
        </Pressable>

        {PRESETS.filter((preset) => preset.name !== 'Off').map((preset) => (
          <Pressable
            key={preset.name}
            accessibilityRole="radio"
            accessibilityState={{ checked: shape === preset.name }}
            style={[styles.preset, shape === preset.name && styles.presetOn]}
            onPress={() => change(shapeOf(preset.of))}>
            <Text style={shape === preset.name ? styles.presetLabelOn : styles.presetLabel}>
              {preset.name}
            </Text>
          </Pressable>
        ))}

        {VOICES.filter((choice) => choice.id !== 'off').map((choice) => {
          const on = settings.voice === choice.id;
          return (
            <Pressable
              key={choice.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.preset, on && styles.presetOn]}
              /* Tapping the chosen one again is the only way back to no voice,
                 now that `Off` would also undo the stereo shape beside it. */
              onPress={() =>
                change(on ? { voice: 'off', voiceMix: 1 } : { voice: choice.id, voiceMix: choice.mix })
              }>
              <Text style={on ? styles.presetLabelOn : styles.presetLabel}>{choice.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {voice && settings.voice !== 'off'
          ? voice.hint
          : PRESETS.find((preset) => preset.name === shape)?.hint ?? 'Your own settings'}
      </Text>

      {settings.voice === 'off' ? null : (
        <View style={styles.card}>
          <Slider
            label="How much"
            value={settings.voiceMix}
            min={0}
            max={1}
            accent={ACCENT}
            snap={(value) => Math.round(value * 20) / 20}
            format={(value) => `${Math.round(value * 100)}%`}
            onDrag={(value) => change({ voiceMix: value })}
            onSettle={(value) => change({ voiceMix: value })}
          />
          <Text style={styles.note}>
            Each of the voices keeps the record’s own harmonics and alters them, so the song stays
            the song underneath. Turn the amount down to hear more of it as recorded.
          </Text>
        </View>
      )}

      <Text style={styles.section}>Stereo</Text>
      <View style={styles.card}>
        <Slider
          label="Width"
          value={settings.width}
          min={0}
          max={2}
          accent={ACCENT}
          centre={1}
          snap={(value) => Math.round(value * 20) / 20}
          format={(value) =>
            value === 0 ? 'Mono' : value === 1 ? 'As recorded' : `${Math.round(value * 100)}%`
          }
          onDrag={(value) => change({ width: value })}
          onSettle={(value) => change({ width: value })}
        />
        <Slider
          label="Balance"
          value={settings.balance}
          min={-1}
          max={1}
          accent={ACCENT}
          centre={0}
          snap={(value) => Math.round(value * 20) / 20}
          format={(value) =>
            value === 0 ? 'Centre' : `${Math.abs(Math.round(value * 100))}% ${value < 0 ? 'left' : 'right'}`
          }
          onDrag={(value) => change({ balance: value })}
          onSettle={(value) => change({ balance: value })}
        />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.title}>Swap channels</Text>
            <Text style={styles.muted}>Left becomes right. For a miswired cable.</Text>
          </View>
          <Switch
            value={settings.swap}
            onValueChange={(on) => change({ swap: on })}
            trackColor={{ false: '#2a2a2a', true: '#2f4a63' }}
            thumbColor={settings.swap ? '#7ab8ff' : '#6a6a6a'}
          />
        </View>
      </View>

      <Text style={styles.section}>Headphones</Text>
      <View style={styles.card}>
        <Slider
          label="Crossfeed"
          value={settings.crossfeed}
          min={0}
          max={1}
          accent={ACCENT}
          snap={(value) => Math.round(value * 20) / 20}
          format={(value) => (value === 0 ? 'Off' : `${Math.round(value * 100)}%`)}
          onDrag={(value) => change({ crossfeed: value })}
          onSettle={(value) => change({ crossfeed: value })}
        />
        <Text style={styles.note}>
          A little of each channel reaches the far ear, late and dull, the way it would from
          speakers. It takes the strain out of old hard-panned mixes. On speakers it does nothing
          worth having.
        </Text>
      </View>

      <Text style={styles.section}>Rotation</Text>
      <View style={styles.card}>
        <Slider
          label="Depth"
          value={settings.rotate}
          min={0}
          max={1}
          accent={ACCENT}
          snap={(value) => Math.round(value * 20) / 20}
          format={(value) => (value === 0 ? 'Off' : `${Math.round(value * 100)}%`)}
          onDrag={(value) => change({ rotate: value })}
          onSettle={(value) => change({ rotate: value })}
        />
        <Slider
          label="A turn takes"
          value={settings.rotateSeconds}
          min={2}
          max={40}
          accent={ACCENT}
          snap={(value) => Math.round(value)}
          format={(value) => `${Math.round(value)}s`}
          onDrag={(value) => change({ rotateSeconds: value })}
          onSettle={(value) => change({ rotateSeconds: value })}
        />
        <Text style={styles.note}>
          What people call 8D: the sound turns slowly around you. Meant for headphones — on a
          speaker it is just the volume wandering.
        </Text>
      </View>

      <Text style={styles.section}>Level</Text>
      <View style={styles.card}>
        <Slider
          label="Preamp"
          value={settings.preampDb}
          min={-12}
          max={6}
          accent={ACCENT}
          centre={0}
          snap={(value) => Math.round(value * 2) / 2}
          format={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`}
          onDrag={(value) => change({ preampDb: value })}
          onSettle={(value) => change({ preampDb: value })}
        />
        <Text style={styles.note}>
          Turn this down if widening or the equalizer makes anything crackle: that is the sound of
          the loudest peaks running out of room.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  waiting: { flex: 1, backgroundColor: '#121212', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20 },

  section: {
    color: '#6a6a6a',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 26,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, gap: 6 },

  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
    backgroundColor: '#1a1a1a',
  },
  presetOn: { backgroundColor: '#2c2c2c' },
  presetLabel: { color: '#8a8a8a', fontSize: 13.5, fontWeight: '500' },
  presetLabelOn: { color: '#ededed', fontSize: 13.5, fontWeight: '600' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 6 },
  rowText: { flex: 1, minWidth: 0 },
  title: { color: '#ededed', fontSize: 15 },
  muted: { color: '#7a7a7a', fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  note: { color: '#6a6a6a', fontSize: 12, lineHeight: 18, paddingTop: 6 },
  hint: { color: '#6a6a6a', fontSize: 12.5, lineHeight: 18, marginTop: 10, marginLeft: 4 },
  bad: { color: '#ff9b9b', fontSize: 12.5, lineHeight: 18, marginBottom: 8 },
});
