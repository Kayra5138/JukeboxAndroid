import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Pressable } from '../components/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import JukeboxAudio, {
  type TransitionSettings,
  type Transitions,
} from '../../modules/jukebox-audio';
import { Slider } from '../components/Fader';
import { useT, type Strings } from '../lib/i18n/index';
import { makeStyles, outlined, scene, switchColours, useColours, usePressed } from '../lib/theme/index';

/**
 * A change the player would not take, said in the log.
 *
 * Without this a refusal leaves the screen exactly as it was and says
 * nothing, which is how the equalizer came to look like a switch that was
 * stuck for as long as it did.
 */
const refused = (failure: unknown) => console.warn('The crossfade could not be set', failure);

/**
 * Which of the four durations a row sets. What to call it, and the line
 * under it, are in the string tables under the same key.
 */
const OTHERS: {
  key: 'manualMs' | 'pauseMs' | 'seekMs';
  ceiling: 'maxManualMs' | 'maxPauseMs' | 'maxSeekMs';
}[] = [
  { key: 'manualMs', ceiling: 'maxManualMs' },
  { key: 'pauseMs', ceiling: 'maxPauseMs' },
  { key: 'seekMs', ceiling: 'maxSeekMs' },
];

export default function TransitionsScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
  const say = t.sound.transitions;
  const written = (milliseconds: number) => seconds(milliseconds, t);
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
    void JukeboxAudio.setTransitionsAsync(next).catch(refused);
  }, []);

  /** The same, and then takes the answer as the new truth. */
  const commit = useCallback(
    async (changes: Partial<TransitionSettings>) => {
      const current = live.current;
      if (!current || !JukeboxAudio.setTransitionsAsync) return;
      const next = { ...current, ...changes };
      live.current = next;
      try {
        remember(await JukeboxAudio.setTransitionsAsync(next));
      } catch (failure) {
        refused(failure);
      }
    },
    [remember]
  );

  if (missing) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Text style={styles.note}>{say.missing}</Text>
      </View>
    );
  }

  if (!state) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <ActivityIndicator color={c.text} />
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
          <Text style={styles.title}>{say.title}</Text>
          <Text style={styles.hint}>{say.about}</Text>
        </View>
        <Switch
          value={state.enabled}
          onValueChange={(enabled) => void commit({ enabled })}
          {...switchColours(c, state.enabled)}
        />
      </View>

      {/* Dimmed rather than removed when off, so what was set up is still
          there to come back to. */}
      <View style={off ? styles.dimmed : undefined} pointerEvents={off ? 'none' : 'auto'}>
        <Text style={styles.section}>{t.format.upper(say.betweenTracks)}</Text>
        <Slider
          label={say.overlap}
          value={state.autoMs}
          min={0}
          max={state.maxAutoMs}
          accent={c.accent}
          format={written}
          onDrag={(value) => push({ autoMs: round(value, state.maxAutoMs) })}
          onSettle={(value) => void commit({ autoMs: round(value, state.maxAutoMs) })}
        />
        <Text style={styles.hint}>{say.overlapNote}</Text>

        <Pressable
          android_ripple={pressed}
          style={styles.toggle}
          onPress={() => void commit({ skipSameAlbum: !state.skipSameAlbum })}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>{say.albums.title}</Text>
            <Text style={styles.hint}>{say.albums.note}</Text>
          </View>
          <Check on={state.skipSameAlbum} />
        </Pressable>

        {expanded ? (
          <View style={styles.others}>
            {OTHERS.map((entry) => (
              <View key={entry.key} style={styles.other}>
                <Slider
                  label={say.others[entry.key].label}
                  value={state[entry.key]}
                  min={0}
                  max={state[entry.ceiling]}
                  accent={c.accent}
                  format={written}
                  onDrag={(value) => push({ [entry.key]: round(value, state[entry.ceiling]) })}
                  onSettle={(value) =>
                    void commit({ [entry.key]: round(value, state[entry.ceiling]) })
                  }
                />
                <Text style={styles.hint}>{say.others[entry.key].hint}</Text>
              </View>
            ))}

            <Pressable
              android_ripple={pressed}
              style={styles.toggle}
              onPress={() => void commit({ equalPower: !state.equalPower })}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>{say.equalPower.title}</Text>
                <Text style={styles.hint}>{say.equalPower.note}</Text>
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
      <Pressable android_ripple={pressed} style={styles.more} onPress={() => setExpanded((was) => !was)}>
        <Text style={styles.moreLabel}>{expanded ? say.fewer : say.more}</Text>
      </Pressable>

      <Pressable
        android_ripple={pressed}
        style={styles.reset}
        // The switch is left where it is. It is the feature; this belongs to
        // the settings under it, and somebody tidying up their durations did
        // not ask for the music to stop crossfading.
        onPress={() => void commit(state.defaults)}>
        <Text style={styles.resetLabel}>{say.reset}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Check({ on }: { on: boolean }) {
  const styles = useStyles();
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

function seconds(milliseconds: number, t: Strings): string {
  if (milliseconds < 50) return t.common.off;
  const value = milliseconds / 1000;
  return t.sound.transitions.seconds(
    value % 1 === 0 ? String(value) : t.format.decimal(value, 2).replace(/0$/, '')
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  centred: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  content: { paddingTop: 14 },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  switchText: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 18 },
  note: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21 },

  dimmed: { opacity: 0.35 },

  section: {
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
    paddingTop: 30,
    paddingBottom: 12,
  },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    ...outlined(c),
  },
  toggleText: { flex: 1, minWidth: 0, gap: 4 },
  toggleLabel: { color: c.text, fontSize: 14.5 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: c.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: c.accent, borderColor: c.accent },
  tick: { width: 9, height: 9, borderRadius: 2, backgroundColor: c.onAccent },

  reset: { alignItems: 'center', paddingTop: 34 },
  resetLabel: { color: c.accent, fontSize: 14.5 },
  more: { alignItems: 'center', paddingTop: 28 },
  moreLabel: { color: c.accent, fontSize: 14 },
  others: { paddingTop: 18, gap: 22 },
  other: { gap: 8 },
}));
