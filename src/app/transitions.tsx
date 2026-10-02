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
  type TransitionSettings,
  type Transitions,
} from '../../modules/jukebox-audio';
import { Slider } from '../components/Fader';

const ACCENT = '#7ab8ff';

/** Which of the four durations a row sets, and what to call it. */
const OTHERS: {
  key: 'manualMs' | 'pauseMs' | 'seekMs';
  ceiling: 'maxManualMs' | 'maxPauseMs' | 'maxSeekMs';
  label: string;
  hint: string;
}[] = [
  {
    key: 'manualMs',
    ceiling: 'maxManualMs',
    label: 'Skipping',
    hint: 'Next or previous, pressed. Keep it short — a button that answers late stops feeling connected.',
  },
  {
    key: 'pauseMs',
    ceiling: 'maxPauseMs',
    label: 'Pause and resume',
    hint: 'Takes the edge off stopping, and off starting again.',
  },
  {
    key: 'seekMs',
    ceiling: 'maxSeekMs',
    label: 'Seeking',
    hint: 'After dragging the progress bar, which otherwise lands mid-waveform and clicks.',
  },
];

export default function TransitionsScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<Transitions | null>(null);
  const [missing, setMissing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  /*
    The settings as they stand, read by the drag handlers. A slider sends the
    whole document on every step of a drag, and building it from the render's
    props would send the other three durations as they were when the drag
    began.
  */
  const live = useRef<TransitionSettings | null>(null);

  const remember = useCallback((next: Transitions) => {
    const {
      maxAutoMs: _auto,
      maxManualMs: _manual,
      maxPauseMs: _pause,
      maxSeekMs: _seek,
      defaults: _defaults,
      ...settings
    } = next;
    live.current = settings;
    setState(next);
  }, []);

  useEffect(() => {
    void (async () => {
      // Optional on the module type because an older APK will not have it.
      if (!JukeboxAudio.getTransitionsAsync) {
        setMissing(true);
        return;
      }
      remember(await JukeboxAudio.getTransitionsAsync());
    })();
  }, [remember]);

  /** Reaches the player and nothing else — for use during a drag. */
  const push = useCallback((changes: Partial<TransitionSettings>) => {
    const current = live.current;
    if (!current || !JukeboxAudio.setTransitionsAsync) return;
    const next = { ...current, ...changes };
    live.current = next;
    void JukeboxAudio.setTransitionsAsync(next);
  }, []);

  /** The same, and then takes the answer as the new truth. */
  const commit = useCallback(
    async (changes: Partial<TransitionSettings>) => {
      const current = live.current;
      if (!current || !JukeboxAudio.setTransitionsAsync) return;
      const next = { ...current, ...changes };
      live.current = next;
      remember(await JukeboxAudio.setTransitionsAsync(next));
    },
    [remember]
  );

  if (missing) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Text style={styles.note}>
          This build of the app does not have transitions in it yet.
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
          <Text style={styles.title}>Crossfade</Text>
          <Text style={styles.hint}>
            One track keeps playing while the next one starts, so there is no
            join to hear.
          </Text>
        </View>
        <Switch
          value={state.enabled}
          onValueChange={(enabled) => void commit({ enabled })}
          trackColor={{ false: '#2a2a2a', true: '#2f4a63' }}
          thumbColor={state.enabled ? ACCENT : '#6a6a6a'}
        />
      </View>

      {/* Dimmed rather than removed when off, so what was set up is still
          there to come back to. */}
      <View style={off ? styles.dimmed : undefined} pointerEvents={off ? 'none' : 'auto'}>
        <Text style={styles.section}>Between tracks</Text>
        <Slider
          label="Overlap"
          value={state.autoMs}
          min={0}
          max={state.maxAutoMs}
          accent={ACCENT}
          format={seconds}
          onDrag={(value) => push({ autoMs: round(value, state.maxAutoMs) })}
          onSettle={(value) => void commit({ autoMs: round(value, state.maxAutoMs) })}
        />
        <Text style={styles.hint}>
          How much of the outgoing track the next one plays over. Zero leaves
          tracks to end the ordinary way.
        </Text>

        <Pressable
          style={styles.toggle}
          onPress={() => void commit({ skipSameAlbum: !state.skipSameAlbum })}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Keep albums together</Text>
            <Text style={styles.hint}>
              No crossfade between consecutive tracks of one album. A live
              record or anything mixed to run on is meant to have that join.
            </Text>
          </View>
          <Check on={state.skipSameAlbum} />
        </Pressable>

        {expanded ? (
          <View style={styles.others}>
            {OTHERS.map((entry) => (
              <View key={entry.key} style={styles.other}>
                <Slider
                  label={entry.label}
                  value={state[entry.key]}
                  min={0}
                  max={state[entry.ceiling]}
                  accent={ACCENT}
                  format={seconds}
                  onDrag={(value) => push({ [entry.key]: round(value, state[entry.ceiling]) })}
                  onSettle={(value) =>
                    void commit({ [entry.key]: round(value, state[entry.ceiling]) })
                  }
                />
                <Text style={styles.hint}>{entry.hint}</Text>
              </View>
            ))}

            <Pressable
              style={styles.toggle}
              onPress={() => void commit({ equalPower: !state.equalPower })}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Equal power curve</Text>
                <Text style={styles.hint}>
                  Two tracks at half volume are not half as loud together. This
                  curve holds the level across an overlap; the straight one sags
                  in the middle.
                </Text>
              </View>
              <Check on={state.equalPower} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {/*
        Outside the dimmed block, and deliberately. These are not settings —
        one opens the rest of them and the other puts them all back — and
        sealing them behind the switch meant the only way to reset a crossfade
        you had turned off was to turn it on again first.
      */}
      <Pressable style={styles.more} onPress={() => setExpanded((was) => !was)}>
        <Text style={styles.moreLabel}>
          {expanded ? 'Fewer settings' : 'Other transitions'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.reset}
        // The switch is left where it is. It is the feature; this belongs to
        // the settings under it, and somebody tidying up their durations did
        // not ask for the music to stop crossfading.
        onPress={() => void commit(state.defaults)}>
        <Text style={styles.resetLabel}>Reset to defaults</Text>
      </Pressable>
    </ScrollView>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <View style={[styles.check, on && styles.checkOn]}>
      {on ? <View style={styles.tick} /> : null}
    </View>
  );
}

/**
 * Snapped, by an amount that suits the range.
 *
 * A tenth of a second across five seconds is fifty positions, which is about
 * as fine as a finger can place anyway. The same tenth across the one-second
 * seek slider would leave it ten positions wide, so the short ones step by
 * fifty milliseconds instead.
 */
function round(milliseconds: number, ceiling: number): number {
  const step = ceiling <= 2_000 ? 50 : 100;
  return Math.round(milliseconds / step) * step;
}

function seconds(milliseconds: number): string {
  if (milliseconds < 50) return 'Off';
  const value = milliseconds / 1000;
  return `${value % 1 === 0 ? value : value.toFixed(2).replace(/0$/, '')}s`;
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
    paddingTop: 30,
    paddingBottom: 12,
  },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
  },
  toggleText: { flex: 1, minWidth: 0, gap: 4 },
  toggleLabel: { color: '#ededed', fontSize: 14.5 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#4a4a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  tick: { width: 9, height: 9, borderRadius: 2, backgroundColor: '#121212' },

  reset: { alignItems: 'center', paddingTop: 34 },
  resetLabel: { color: ACCENT, fontSize: 14.5 },
  more: { alignItems: 'center', paddingTop: 28 },
  moreLabel: { color: ACCENT, fontSize: 14 },
  others: { paddingTop: 18, gap: 22 },
  other: { gap: 8 },
});
