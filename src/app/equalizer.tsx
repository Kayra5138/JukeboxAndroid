import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import JukeboxAudio, {
  type EqualizerSettings,
  type EqualizerState,
} from '../../modules/jukebox-audio';
import { Fader, Slider } from '../components/Fader';
import { useLandscape } from '../lib/ui/layout';

const ACCENT = '#7ab8ff';

/** How tall a band fader is, upright and on its side. */
const FADER_HEIGHT = 190;
const FADER_HEIGHT_WIDE = 132;

/** Loudness is offered in whole decibels; the framework counts hundredths. */
const MB_PER_DB = 100;

export default function EqualizerScreen() {
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  const [state, setState] = useState<EqualizerState | null>(null);
  const [missing, setMissing] = useState(false);

  /*
    The settings as they stand, read by the drag handlers.
    A fader sends the whole document on every step of a drag, and building it
    from the render's props would send the values as they were when the drag
    began — so the band being moved would be right and the four beside it would
    snap back to wherever they were a moment ago.
  */
  const live = useRef<EqualizerSettings | null>(null);

  const remember = useCallback((next: EqualizerState) => {
    live.current = settingsOf(next);
    setState(next);
  }, []);

  useEffect(() => {
    void (async () => {
      // Optional on the module type because an older APK will not have it. The
      // screen has to say so rather than crash on a phone mid-update.
      if (!JukeboxAudio.getEqualizerAsync) {
        setMissing(true);
        return;
      }
      remember(await JukeboxAudio.getEqualizerAsync());
    })();
  }, [remember]);

  /** Sends to the audio framework and nothing else — for use during a drag. */
  const push = useCallback((changes: Partial<EqualizerSettings>) => {
    const current = live.current;
    if (!current || !JukeboxAudio.setEqualizerAsync) return;
    const next = { ...current, ...changes };
    live.current = next;
    void JukeboxAudio.setEqualizerAsync(next);
  }, []);

  /** The same, and then takes the answer as the new truth. */
  const commit = useCallback(
    async (changes: Partial<EqualizerSettings>) => {
      const current = live.current;
      if (!current || !JukeboxAudio.setEqualizerAsync) return;
      const next = { ...current, ...changes };
      live.current = next;
      remember(await JukeboxAudio.setEqualizerAsync(next));
    },
    [remember]
  );

  if (missing) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Text style={styles.note}>
          This build of the app does not have the equalizer in it yet.
        </Text>
      </View>
    );
  }

  if (!state) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <ActivityIndicator color="#ededed" />
      </View>
    );
  }

  const faderHeight = landscape ? FADER_HEIGHT_WIDE : FADER_HEIGHT;
  const off = !state.enabled;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingLeft: insets.left + 20,
          paddingRight: insets.right + 20,
          paddingBottom: insets.bottom + 40,
        },
      ]}>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.title}>Equalizer</Text>
          <Text style={styles.hint}>
            {state.attached
              ? 'Shaping what is playing now.'
              : 'Saved, and applied the moment something plays.'}
          </Text>
        </View>
        <Switch
          value={state.enabled}
          onValueChange={(enabled) => void commit({ enabled })}
          trackColor={{ false: '#2a2a2a', true: '#2f4a63' }}
          thumbColor={state.enabled ? ACCENT : '#6a6a6a'}
        />
      </View>

      {/* Dimmed rather than removed when off, so the shape of what was set up
          is still there to come back to. */}
      <View style={off ? styles.dimmed : undefined} pointerEvents={off ? 'none' : 'auto'}>
        {state.presets.length > 0 ? (
          <>
            <Text style={styles.section}>Presets</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}>
              <Chip
                label="Flat"
                // Not one of the device's own: every band at zero, which is the
                // way back from any of them.
                on={state.preset < 0 && state.bands.every((band) => band === 0)}
                onPress={() =>
                  void commit({ preset: -1, bands: state.bands.map(() => 0) })
                }
              />
              {state.presets.map((name, index) => (
                <Chip
                  key={name}
                  label={name}
                  on={state.preset === index}
                  onPress={() => void commit({ preset: index })}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.section}>Bands</Text>
        <View style={styles.bands}>
          {state.bands.map((level, index) => (
            <Fader
              key={index}
              value={level}
              min={state.minMb}
              max={state.maxMb}
              height={faderHeight}
              accent={ACCENT}
              label={frequency(state.centresHz[index] ?? 0)}
              format={decibels}
              onDrag={(value) =>
                push({ preset: -1, bands: replace(live.current?.bands ?? [], index, value) })
              }
              onSettle={(value) =>
                // The preset goes the moment a band moves. It named a curve,
                // and this is no longer that curve.
                void commit({
                  preset: -1,
                  bands: replace(live.current?.bands ?? [], index, Math.round(value)),
                })
              }
            />
          ))}
        </View>

        <Text style={styles.section}>Tone</Text>
        <View style={styles.tone}>
          {state.bassSupported ? (
            <Slider
              label="Bass boost"
              value={state.bass}
              min={0}
              max={1000}
              accent={ACCENT}
              format={percent}
              onDrag={(value) => push({ bass: Math.round(value) })}
              onSettle={(value) => void commit({ bass: Math.round(value) })}
            />
          ) : null}
          {state.virtualizerSupported ? (
            <Slider
              label="Surround"
              value={state.virtualizer}
              min={0}
              max={1000}
              accent={ACCENT}
              format={percent}
              onDrag={(value) => push({ virtualizer: Math.round(value) })}
              onSettle={(value) => void commit({ virtualizer: Math.round(value) })}
            />
          ) : null}
          <Slider
            label="Loudness"
            value={state.loudness}
            min={0}
            max={state.maxLoudnessMb}
            accent={ACCENT}
            format={decibels}
            onDrag={(value) => push({ loudness: Math.round(value) })}
            onSettle={(value) => void commit({ loudness: Math.round(value) })}
          />
          <Text style={styles.hint}>
            Loudness lifts a quiet recording without touching the tone. Pushed
            far it will clip, which is heard as the loud parts breaking up.
          </Text>
        </View>

        <Pressable
          style={styles.reset}
          onPress={() =>
            void commit({
              preset: -1,
              bands: state.bands.map(() => 0),
              bass: 0,
              virtualizer: 0,
              loudness: 0,
            })
          }>
          <Text style={styles.resetLabel}>Reset everything</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipLabel, on && styles.chipLabelOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function settingsOf(state: EqualizerState): EqualizerSettings {
  return {
    enabled: state.enabled,
    preset: state.preset,
    bands: state.bands,
    bass: state.bass,
    virtualizer: state.virtualizer,
    loudness: state.loudness,
  };
}

function replace(values: number[], index: number, value: number): number[] {
  const next = values.slice();
  next[index] = Math.round(value);
  return next;
}

/** `+6`, `−3`, `0` — millibels said in the decibels they are heard in. */
function decibels(millibels: number): string {
  const db = Math.round(millibels / MB_PER_DB);
  if (db === 0) return '0';
  return db > 0 ? `+${db}` : `−${Math.abs(db)}`;
}

function percent(strength: number): string {
  return `${Math.round(strength / 10)}%`;
}

/** `60`, `910`, `3.6k`, `14k` — a centre frequency short enough to sit under a fader. */
function frequency(hertz: number): string {
  if (hertz < 1000) return String(hertz);
  const thousands = hertz / 1000;
  return thousands >= 10
    ? `${Math.round(thousands)}k`
    : `${Number(thousands.toFixed(1))}k`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  centred: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  content: { paddingTop: 14 },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  switchText: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: '#ededed', fontSize: 17, fontWeight: '600' },
  hint: { color: '#5f5f5f', fontSize: 12, lineHeight: 18 },
  note: { color: '#7a7a7a', fontSize: 14, textAlign: 'center', lineHeight: 21 },

  dimmed: { opacity: 0.35 },

  section: {
    color: '#5f5f5f',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: 26,
    paddingBottom: 12,
  },

  chips: { gap: 8, paddingRight: 20 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3a',
  },
  chipOn: { backgroundColor: '#2f4a63', borderColor: '#2f4a63' },
  chipLabel: { color: '#9a9a9a', fontSize: 13 },
  chipLabelOn: { color: '#ededed', fontWeight: '600' },

  bands: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 4 },
  tone: { gap: 18 },

  reset: { alignItems: 'center', paddingTop: 32 },
  resetLabel: { color: ACCENT, fontSize: 14.5 },
});
