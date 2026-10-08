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
  type EqualizerSettings,
  type EqualizerState,
  type ParametricEqualizer,
} from '../../modules/jukebox-audio';
import { BandEditor, type BandField } from '../components/equalizer/BandEditor';
import { ImportSheet } from '../components/equalizer/ImportSheet';
import { ResponseCurve } from '../components/equalizer/ResponseCurve';
import { Slider } from '../components/Fader';
import { TextPrompt } from '../components/TextPrompt';
import {
  MAX_BANDS,
  MAX_GAIN_DB,
  MAX_HZ,
  MAX_PREAMP_DB,
  MAX_Q,
  MIN_HZ,
  MIN_PREAMP_DB,
  MIN_Q,
  autoPreampDb,
  formatDb,
  formatQ,
  heldBand,
  heldPreamp,
  nextBandHz,
  numberFrom,
  type Band,
} from '../lib/equalizer/bands';
import { forBridge } from '../lib/equalizer/bridge';
import { BUILT_IN, labelOf, matching, removed, renamed, saved } from '../lib/equalizer/presets';
import { useT, type Strings } from '../lib/i18n/index';
import { makeStyles, outlined, outlineWidth, scene, switchColours, useColours, usePressed } from '../lib/theme/index';
import { useLandscape } from '../lib/ui/layout';

/** A change the player would not take, said in the log; see `settle`. */
const refused = (failure: unknown) => console.warn('The equalizer could not be set', failure);

/** How tall the curve is drawn, upright and on its side. */
const CURVE_HEIGHT = 156;
const CURVE_HEIGHT_WIDE = 116;

/** Loudness is offered in whole decibels; the framework counts hundredths. */
const MB_PER_DB = 100;

/**
 * How far the preamp slider goes down. The setting itself goes further, for
 * the file that asks for it, and that far it is typed: a slider reaching to
 * minus thirty would spend half its length on values nobody wants.
 */
const PREAMP_SLIDER_MIN = -20;

/** The part of the equalizer's settings that is the curve and the curves kept. */
type Shape = Omit<ParametricEqualizer, 'notice'>;

/** What a prompt is open to ask for, when one is. */
type Asking =
  | { kind: 'band'; index: number; field: BandField }
  | { kind: 'preamp' }
  // What is being kept decides the heading: a curve made here, or a correction brought in.
  | { kind: 'save'; initial: string; what: 'curve' | 'correction' }
  | { kind: 'rename'; from: string };

export default function EqualizerScreen() {
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
  const [state, setState] = useState<EqualizerState | null>(null);
  const [missing, setMissing] = useState(false);

  /** The band whose sliders are showing, if any. One at a time. */
  const [open, setOpen] = useState<number | null>(null);
  /*
    What the prompt is asking for, and separately whether it is showing. Kept
    apart so that closing it does not also empty it: the dialog fades out
    over a moment, and one that forgot its question at the start of that
    moment would be seen fading out blank.
  */
  const [asking, setAsking] = useState<Asking | null>(null);
  const [prompting, setPrompting] = useState(false);
  const [importing, setImporting] = useState(false);
  /** A line about the last thing that was done, where it needs saying. */
  const [note, setNote] = useState<string | null>(null);
  /** The preset "Delete" has been pressed on once, waiting to be pressed again. */
  const [armed, setArmed] = useState<string | null>(null);

  /*
    The settings as they stand, read by the drag handlers.
    A slider sends the whole document on every step of a drag, and building it
    from the render's props would send the values as they were when the drag
    began — so the band being moved would be right and the ones beside it
    would snap back to wherever they were a moment ago.
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

  /**
   * Sends what `live` now holds and takes the answer as the new truth —
   * unless something else has been changed while the answer was on its way,
   * in which case the answer is about a moment that has passed and the one
   * that follows it will say better.
   */
  const settle = useCallback(async () => {
    const sent = live.current;
    if (!sent || !JukeboxAudio.setEqualizerAsync) return;
    try {
      const answer = await JukeboxAudio.setEqualizerAsync(forBridge(sent));
      if (live.current === sent) remember(answer);
    } catch (failure) {
      // Said in the log at least: a refusal here used to leave the screen
      // exactly as it was, which looks like a switch that is stuck.
      refused(failure);
    }
  }, [remember]);

  /** Sends to the player and nothing else — for the tone sliders during a drag. */
  const push = useCallback((changes: Partial<EqualizerSettings>) => {
    const current = live.current;
    if (!current || !JukeboxAudio.setEqualizerAsync) return;
    const next = { ...current, ...changes };
    live.current = next;
    void JukeboxAudio.setEqualizerAsync(forBridge(next)).catch(refused);
  }, []);

  /** The same, and then takes the answer as the new truth. */
  const commit = useCallback(
    async (changes: Partial<EqualizerSettings>) => {
      const current = live.current;
      if (!current) return;
      live.current = { ...current, ...changes };
      await settle();
    },
    [settle]
  );

  /**
   * Changes the curve, or the curves kept.
   *
   * Unlike the tone sliders, this is drawn at once and on every step of a
   * drag, not only when the finger lifts: the curve at the top of the screen
   * is the point of it, and a curve that stood still until the slider was
   * let go would be a picture of the last setting. The cost is a render per
   * step, which the slider already holds to twenty-five a second — the same
   * throttle that keeps a drag from flooding the player.
   */
  const shape = useCallback(
    (changes: Partial<Shape>, done: boolean) => {
      const current = live.current;
      if (!current?.parametric || !JukeboxAudio.setEqualizerAsync) return;
      const parametric = { ...current.parametric, ...changes };
      const next = { ...current, parametric };
      live.current = next;
      setState((before) =>
        before?.parametric ? { ...before, parametric: { ...before.parametric, ...changes } } : before
      );
      if (done) void settle();
      else void JukeboxAudio.setEqualizerAsync(forBridge(next)).catch(refused);
    },
    [settle]
  );

  if (missing) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Text style={styles.note}>{t.sound.equalizer.missing}</Text>
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
  const parametric = state.parametric;
  const bands = parametric?.bands ?? [];
  const preampDb = parametric?.preampDb ?? null;
  const kept = parametric?.presets ?? [];

  /** Which preset the curve is, if it is exactly one of them. */
  const current = matching(bands, preampDb, [...BUILT_IN, ...kept]);
  const currentIsMine = current !== null && kept.some((preset) => preset.name === current);
  const automatic = autoPreampDb(bands);

  /** The bands as the handlers must read them: the latest, not this render's. */
  const latestBands = () => live.current?.parametric?.bands ?? [];

  const changeBand = (index: number, change: Partial<Band>, done: boolean) => {
    const next = latestBands().slice();
    if (!next[index]) return;
    next[index] = heldBand({ ...next[index], ...change });
    shape({ bands: next }, done);
  };

  const choose = (preset: { bands: Band[]; preampDb: number | null }) => {
    // The band that was open belonged to the curve that has just gone.
    setOpen(null);
    setArmed(null);
    setNote(null);
    shape({ bands: preset.bands, preampDb: preset.preampDb }, true);
  };

  const ask = (what: Asking) => {
    setArmed(null);
    setAsking(what);
    setPrompting(true);
  };

  const typed = (text: string) => {
    if (!asking) return;
    if (asking.kind === 'save') {
      const result = saved(
        kept,
        text,
        latestBands(),
        live.current?.parametric?.preampDb ?? null,
        t
      );
      shape({ presets: result.presets }, true);
      // Only worth saying when it is not the name that was typed.
      setNote(result.name === text ? null : t.sound.equalizer.keptAs(result.name));
    } else if (asking.kind === 'rename') {
      const result = renamed(kept, asking.from, text, t);
      shape({ presets: result.presets }, true);
      setNote(result.name === text ? null : t.sound.equalizer.renamedTo(result.name));
    } else {
      const value = numberFrom(text);
      // Not a number: the prompt stays where it is, with what was typed
      // still in it, rather than closing as though it had been taken.
      if (value === null) return;
      if (asking.kind === 'preamp') shape({ preampDb: heldPreamp(value) }, true);
      else changeBand(asking.index, { [asking.field]: value }, true);
    }
    setPrompting(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
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
          <Text style={styles.title}>{t.sound.equalizer.title}</Text>
          <Text style={styles.hint}>
            {state.attached ? t.sound.equalizer.attached : t.sound.equalizer.saved}
          </Text>
        </View>
        <Switch
          value={state.enabled}
          onValueChange={(enabled) => void commit({ enabled })}
          {...switchColours(c, state.enabled)}
          accessibilityLabel={t.sound.equalizer.title}
        />
      </View>

      {parametric?.notice === 'carried' ? (
        <Text style={styles.notice}>{t.sound.equalizer.carried}</Text>
      ) : null}
      {parametric?.notice === 'lost' ? (
        <Text style={styles.notice} accessibilityRole="alert">
          {t.sound.equalizer.lost}
        </Text>
      ) : null}

      {/* Dimmed rather than removed when off, so the shape of what was set up
          is still there to come back to. */}
      <View style={off ? styles.dimmed : undefined} pointerEvents={off ? 'none' : 'auto'}>
        {parametric ? (
          <>
            <View style={styles.curve}>
              <ResponseCurve
                bands={bands}
                height={landscape ? CURVE_HEIGHT_WIDE : CURVE_HEIGHT}
                accent={c.accent}
              />
            </View>

            <Text style={styles.section}>{t.format.upper(t.sound.equalizer.presets)}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              // Out to the edges of the screen and back in by the same
              // amount, so the row scrolls under the margin instead of
              // being cut off at it.
              style={{ marginLeft: -(insets.left + 20), marginRight: -(insets.right + 20) }}
              contentContainerStyle={[
                styles.chips,
                { paddingLeft: insets.left + 20, paddingRight: insets.right + 20 },
              ]}
              accessibilityRole="radiogroup">
              {[...BUILT_IN, ...kept].map((preset) => (
                <Chip
                  key={preset.name}
                  label={labelOf(preset.name, t)}
                  on={current === preset.name}
                  onPress={() => choose(preset)}
                />
              ))}
            </ScrollView>

            <View style={styles.actions}>
              <Action
                label={t.sound.equalizer.saveAs}
                onPress={() => {
                  ask({
                    kind: 'save',
                    // One of the user's own, changed and saved again, most
                    // likely wants its own name back.
                    initial: currentIsMine && current ? current : '',
                    what: 'curve',
                  });
                }}
              />
              {currentIsMine && current ? (
                <>
                  <Action
                    label={t.sound.equalizer.rename}
                    onPress={() => ask({ kind: 'rename', from: current })}
                  />
                  {/* Asked twice, in the same place, rather than through a
                      dialog: the second press is the confirmation, and
                      anything else pressed in between calls it off. The
                      curve itself stays in force either way; only the name
                      it was kept under goes. */}
                  <Action
                    label={
                      armed === current ? t.sound.equalizer.confirmDelete(current) : t.common.delete
                    }
                    danger
                    onPress={() => {
                      if (armed !== current) {
                        setArmed(current);
                        return;
                      }
                      setArmed(null);
                      setNote(null);
                      shape({ presets: removed(kept, current) }, true);
                    }}
                  />
                </>
              ) : null}
              <Action
                label={t.sound.equalizer.importAutoEq}
                onPress={() => {
                  setArmed(null);
                  setImporting(true);
                }}
              />
            </View>
            {note ? <Text style={styles.said}>{note}</Text> : null}

            <Text style={styles.section}>{t.format.upper(t.sound.equalizer.bands)}</Text>
            <View style={styles.bands}>
              {bands.map((band, index) => (
                <BandEditor
                  key={index}
                  index={index}
                  band={band}
                  open={open === index}
                  accent={c.accent}
                  onToggle={() => setOpen(open === index ? null : index)}
                  onDrag={(change) => changeBand(index, change, false)}
                  onSettle={(change) => changeBand(index, change, true)}
                  onType={(field) => ask({ kind: 'band', index, field })}
                  onRemove={() => {
                    setOpen(null);
                    shape({ bands: latestBands().filter((_, at) => at !== index) }, true);
                  }}
                />
              ))}
              {bands.length === 0 ? (
                <Text style={styles.hint}>{t.sound.equalizer.noBands}</Text>
              ) : null}
            </View>
            {bands.length < MAX_BANDS ? (
              <Pressable
                android_ripple={pressed}
                style={styles.add}
                accessibilityRole="button"
                onPress={() => {
                  const next = [
                    ...latestBands(),
                    // Flat, so that adding it changes nothing until it is
                    // moved, and somewhere there is not a band already.
                    heldBand({ type: 'peak', frequencyHz: nextBandHz(latestBands()), gainDb: 0, q: 1 }),
                  ];
                  shape({ bands: next }, true);
                  setOpen(next.length - 1);
                }}>
                <Text style={styles.addLabel}>{t.sound.equalizer.addBand}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.hint, styles.full]}>{t.sound.equalizer.full(MAX_BANDS)}</Text>
            )}

            <Text style={styles.section}>{t.format.upper(t.sound.equalizer.preamp)}</Text>
            <View style={styles.tone}>
              <View style={styles.kinds} accessibilityRole="radiogroup">
                <Chip
                  label={t.sound.equalizer.automatic}
                  on={preampDb === null}
                  onPress={() => shape({ preampDb: null }, true)}
                />
                <Chip
                  label={t.sound.equalizer.byHand}
                  on={preampDb !== null}
                  onPress={() => {
                    // From where the automatic one had it, so that changing
                    // who decides does not change the level.
                    if (preampDb === null) shape({ preampDb: Number(automatic.toFixed(1)) }, true);
                  }}
                />
              </View>
              {preampDb === null ? (
                <Text style={styles.hint}>
                  {automatic === 0
                    ? t.sound.equalizer.nothingBoosted
                    : t.sound.equalizer.turnedDown(
                        formatDb(Math.abs(automatic), t).replace('+', '')
                      )}
                </Text>
              ) : (
                <>
                  <Slider
                    label={t.sound.equalizer.preamp}
                    // A value typed past the end of the slider sits at the end.
                    value={Math.min(MAX_PREAMP_DB, Math.max(PREAMP_SLIDER_MIN, preampDb))}
                    min={PREAMP_SLIDER_MIN}
                    max={MAX_PREAMP_DB}
                    centre={0}
                    accent={c.accent}
                    snap={(value) => Math.round(value * 2) / 2}
                    format={(value) => formatDb(value, t)}
                    onDrag={(value) => shape({ preampDb: value }, false)}
                    onSettle={(value) => shape({ preampDb: value }, true)}
                  />
                  <View style={styles.actions}>
                    <Action
                      label={t.sound.equalizer.typeIt(formatDb(preampDb, t))}
                      accessibilityLabel={t.sound.equalizer.typePreamp(formatDb(preampDb, t))}
                      onPress={() => ask({ kind: 'preamp' })}
                    />
                  </View>
                  <Text style={styles.hint}>
                    {preampDb > automatic + 0.05
                      ? t.sound.equalizer.clipsAbove(formatDb(automatic, t))
                      : t.sound.equalizer.lowEnough}
                  </Text>
                </>
              )}
            </View>
          </>
        ) : (
          <Text style={[styles.notice, styles.unbuilt]}>{t.sound.equalizer.unbuilt}</Text>
        )}

        <Text style={styles.section}>{t.format.upper(t.sound.equalizer.tone)}</Text>
        <View style={styles.tone}>
          {state.bassSupported ? (
            <Slider
              label={t.sound.equalizer.bassBoost}
              value={state.bass}
              min={0}
              max={1000}
              accent={c.accent}
              format={(strength) => t.sound.percent(Math.round(strength / 10))}
              onDrag={(value) => push({ bass: Math.round(value) })}
              onSettle={(value) => void commit({ bass: Math.round(value) })}
            />
          ) : null}
          {state.virtualizerSupported ? (
            <Slider
              label={t.sound.equalizer.surround}
              value={state.virtualizer}
              min={0}
              max={1000}
              accent={c.accent}
              format={(strength) => t.sound.percent(Math.round(strength / 10))}
              onDrag={(value) => push({ virtualizer: Math.round(value) })}
              onSettle={(value) => void commit({ virtualizer: Math.round(value) })}
            />
          ) : null}
          <Slider
            label={t.sound.equalizer.loudness}
            value={state.loudness}
            min={0}
            max={state.maxLoudnessMb}
            accent={c.accent}
            format={decibels}
            onDrag={(value) => push({ loudness: Math.round(value) })}
            onSettle={(value) => void commit({ loudness: Math.round(value) })}
          />
          <Text style={styles.hint}>{t.sound.equalizer.toneNote}</Text>
        </View>

        <Pressable
          android_ripple={pressed}
          style={styles.reset}
          accessibilityRole="button"
          onPress={() => {
            setOpen(null);
            setArmed(null);
            setNote(null);
            // The curve goes back to flat. The curves kept under names stay:
            // they were put away on purpose, and this is not their button.
            const flat = live.current?.parametric
              ? { parametric: { ...live.current.parametric, bands: [], preampDb: null } }
              : {};
            setState((before) =>
              before?.parametric
                ? { ...before, parametric: { ...before.parametric, bands: [], preampDb: null } }
                : before
            );
            void commit({ ...flat, bass: 0, virtualizer: 0, loudness: 0 });
          }}>
          <Text style={styles.resetLabel}>{t.sound.equalizer.resetAll}</Text>
        </Pressable>
      </View>

      <TextPrompt
        visible={prompting}
        {...promptFor(asking, bands, preampDb, t)}
        onSubmit={typed}
        onClose={() => setPrompting(false)}
      />
      <ImportSheet
        visible={importing}
        onClose={() => setImporting(false)}
        onImport={(result, said, name) => {
          setImporting(false);
          setOpen(null);
          setNote(said);
          // In force at once, with the file's own preamp where it gave one
          // and the automatic one where it did not.
          shape({ bands: result.bands, preampDb: heldPreamp(result.preampDb) }, true);
          // And then asked for a name, since a correction is the one curve
          // that cannot be made again by hand. Backing out of that leaves
          // it in force and unnamed, to be kept later or not.
          ask({ kind: 'save', initial: name, what: 'correction' });
        }}
      />
    </ScrollView>
  );
}

/** What the one prompt on the screen says, for whichever thing it is asking. */
function promptFor(asking: Asking | null, bands: Band[], preampDb: number | null, t: Strings) {
  const say = t.sound.equalizer.prompt;
  if (asking?.kind === 'save') {
    return {
      heading: asking.what === 'curve' ? say.keepCurveAs : say.keepCorrectionAs,
      placeholder: say.namePlaceholder,
      initial: asking.initial,
      confirmLabel: say.keep,
    };
  }
  if (asking?.kind === 'rename') {
    return { heading: t.common.rename, placeholder: say.aName, initial: asking.from };
  }
  if (asking?.kind === 'preamp') {
    return {
      heading: t.sound.equalizer.preamp,
      hint: say.preampHint(MIN_PREAMP_DB, MAX_PREAMP_DB),
      placeholder: '-6',
      initial: preampDb === null ? '' : String(preampDb),
      keyboardType: 'numeric' as const,
      confirmLabel: say.set,
    };
  }
  if (asking?.kind === 'band') {
    const band = bands[asking.index];
    const number = asking.index + 1;
    if (asking.field === 'frequencyHz') {
      return {
        heading: say.frequency(number),
        hint: say.frequencyHint(MIN_HZ, MAX_HZ),
        placeholder: '1000',
        initial: band ? String(band.frequencyHz) : '',
        // Not the number pad: a k is allowed, and it has no k on it.
        confirmLabel: say.set,
      };
    }
    if (asking.field === 'gainDb') {
      return {
        heading: say.gain(number),
        hint: say.gainHint(MAX_GAIN_DB),
        placeholder: t.format.decimal(-3.5),
        initial: band ? String(band.gainDb) : '',
        keyboardType: 'numeric' as const,
        confirmLabel: say.set,
      };
    }
    return {
      heading: say.q(number),
      hint: say.qHint(MIN_Q, MAX_Q),
      placeholder: t.format.decimal(0.7),
      initial: band ? formatQ(band.q, t) : '',
      keyboardType: 'numeric' as const,
      confirmLabel: say.set,
    };
  }
  return { heading: '', placeholder: '' };
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <Pressable
      android_ripple={pressed}
      style={[styles.chip, on && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}>
      <Text style={[styles.chipLabel, on && styles.chipLabelOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Action({
  label,
  accessibilityLabel,
  danger,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <Pressable
      android_ripple={pressed}
      style={styles.action}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}>
      <Text style={[styles.actionLabel, danger && styles.actionDanger]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function settingsOf(state: EqualizerState): EqualizerSettings {
  const settings: EqualizerSettings = {
    enabled: state.enabled,
    bass: state.bass,
    virtualizer: state.virtualizer,
    loudness: state.loudness,
  };
  // Without the note about the old equalizer, which is the player's to keep or
  // drop and not a setting.
  if (state.parametric) {
    settings.parametric = {
      bands: state.parametric.bands,
      preampDb: state.parametric.preampDb,
      presets: state.parametric.presets,
    };
  }
  // Handed back as they came, and only if they came; see `EqualizerState`.
  if (state.preset !== undefined) settings.preset = state.preset;
  if (state.bands !== undefined) settings.bands = state.bands;
  return settings;
}

/** `+6`, `−3`, `0` — millibels said in the decibels they are heard in. */
function decibels(millibels: number): string {
  const db = Math.round(millibels / MB_PER_DB);
  if (db === 0) return '0';
  return db > 0 ? `+${db}` : `−${Math.abs(db)}`;
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
  notice: {
    color: c.textSecondary,
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: c.surface,
    ...outlined(c),
  },
  unbuilt: { marginTop: 20 },

  dimmed: { opacity: 0.35 },

  curve: { paddingTop: 18 },

  section: {
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
    paddingTop: 26,
    paddingBottom: 12,
  },

  chips: { gap: 8 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 18,
    // The edge is the chip: there is no fill until it is on. So it is as wide
    // as an outline where a theme draws those, on or off, and nothing moves.
    borderWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderColor: c.borderStrong,
  },
  // Ringed in the accent itself where there are outlines, since the fill is
  // the accent held back and is not far from the card it is on.
  chipOn: { backgroundColor: c.accentMuted, borderColor: c.accentMuted, ...outlined(c, c.accent) },
  chipLabel: { color: c.textSecondary, fontSize: 13 },
  chipLabelOn: { color: c.text, fontWeight: '600' },

  // Wrapping, so four of them are two lines on a narrow phone rather than a
  // row running off the side of it.
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 2, paddingTop: 8 },
  action: { paddingVertical: 9 },
  actionLabel: { color: c.accent, fontSize: 13.5 },
  actionDanger: { color: c.danger },
  said: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, paddingTop: 4 },

  bands: { gap: 6 },
  add: { alignSelf: 'flex-start', paddingVertical: 12 },
  addLabel: { color: c.accent, fontSize: 14.5 },
  full: { paddingTop: 12 },

  tone: { gap: 18 },

  reset: { alignItems: 'center', paddingTop: 32 },
  resetLabel: { color: c.accent, fontSize: 14.5 },
}));
