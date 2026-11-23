import { useState } from 'react';
import { LEADING, RADIUS, SPACE, TYPE, CARD_GAP } from '../../lib/theme/measures';
import { ScreenState } from '../ScreenState';
import { SectionLabel } from '../settings/rows';
import { offerUndo } from '../../lib/ui/undo';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../settings/Find';
import { Switch } from '../Switch';
import { TextButton } from '../Button';
import { Segmented } from '../Segmented';

import { BandEditor, type BandField } from '../equalizer/BandEditor';
import { ImportSheet } from '../equalizer/ImportSheet';
import { CURVE, ResponseCurve } from '../equalizer/ResponseCurve';
import { Slider } from '../Fader';
import { TextPrompt } from '../TextPrompt';
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
} from '../../lib/equalizer/bands';
import { useEqualizer } from '../../lib/equalizer/useEqualizer';
import { BUILT_IN, labelOf, matching, removed, renamed, saved } from '../../lib/equalizer/presets';
import { useT, type Strings } from '../../lib/i18n/index';
import { makeStyles, outlined, scene, useColours } from '../../lib/theme/index';
import { useLandscape } from '../../lib/ui/layout';
import { useAnnounce } from '../../lib/ui/announce';
import { useBack } from '../../lib/ui/back';
import { haptic } from '../../lib/ui/haptics';
import { PageScroll, usePageRoom } from '../Page';

/** Loudness is offered in whole decibels; the framework counts hundredths. */
const MB_PER_DB = 100;

/**
 * How far the preamp slider goes down. The setting itself goes further, for
 * the file that asks for it, and that far it is typed: a slider reaching to
 * minus thirty would spend half its length on values nobody wants.
 */
const PREAMP_SLIDER_MIN = -20;

/** Where the tone sliders are felt: at nothing, which is the bottom of each. */
const NONE = [0] as const;

/** What a prompt is open to ask for, when one is. */
type Asking =
  | { kind: 'band'; index: number; field: BandField }
  | { kind: 'preamp' }
  // What is being kept decides the heading: a curve made here, or a correction brought in.
  | { kind: 'save'; initial: string; what: 'curve' | 'correction' }
  | { kind: 'rename'; from: string };

/**
 * [focused] where it is a page of the tab, for whether it is the one in front
 * and Back its own; in the player's card (`PageInCard`) it is always that.
 */
export function EqualizerPage({ focused = true }: { focused?: boolean }) {
  // The page's own margins, which the row of presets reaches out past to the edges.
  const room = usePageRoom();
  const landscape = useLandscape();
  const t = useT();
  const styles = useStyles();
  const c = useColours();
  const { state, setState, missing, live, push, commit, shape } = useEqualizer();

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
  // Said aloud when it appears: it comes up where nobody's attention is, after a press elsewhere.
  useAnnounce(note);
  /** The preset "Delete" has been pressed on once, waiting to be pressed again. */
  const [armed, setArmed] = useState<string | null>(null);
  // Back folds a band's editor away, and lets a preset waiting to be deleted off, before it leaves.
  useBack(open != null && focused, () => setOpen(null));
  useBack(armed != null && focused, () => setArmed(null));

  if (missing) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Text style={styles.note}>{t.sound.equalizer.missing}</Text>
      </View>
    );
  }

  if (!state) {
    return (
      <View style={styles.screen}>
        <ScreenState kind="loading" />
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
    <PageScroll>
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
          accessibilityLabel={t.sound.equalizer.title}
        />
      </View>

      {parametric?.notice === 'carried' ? (
        <Text style={styles.notice}>{t.sound.equalizer.carried}</Text>
      ) : null}
      {parametric?.notice === 'lost' ? (
        <Text style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          {t.sound.equalizer.lost}
        </Text>
      ) : null}

      {/* Dimmed rather than removed when off, so the shape of what was set up
          is still there to come back to. */}
      {/* Never folded away and made again as it is turned off and on: see `TrackStrip`. */}
      <View collapsable={false} style={off ? styles.dimmed : undefined} pointerEvents={off ? 'none' : 'auto'}>
        {parametric ? (
          <>
            <View style={styles.curve}>
              <ResponseCurve
                bands={bands}
                height={landscape ? CURVE.wide : CURVE.page}
                accent={c.accent}
              />
            </View>

            <SectionLabel>{t.sound.equalizer.presets}</SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              // Out to the edges of the screen and back in by the same
              // amount, so the row scrolls under the margin instead of
              // being cut off at it.
              style={{ marginLeft: -room.paddingLeft, marginRight: -room.paddingRight }}
              contentContainerStyle={{ paddingLeft: room.paddingLeft, paddingRight: room.paddingRight }}>
              {/*
                Without a mark when the curve is none of them, having been
                shaped by hand.
              */}
              <Segmented
                variant="outline"
                wrap={false}
                options={[...BUILT_IN, ...kept].map((preset) => ({ value: preset.name, label: labelOf(preset.name, t) }))}
                value={current}
                onChange={(name) => {
                  const preset = [...BUILT_IN, ...kept].find((candidate) => candidate.name === name);
                  if (preset) choose(preset);
                }}
              />
            </ScrollView>

            <View style={styles.actions}>
              <TextButton
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
                  <TextButton
                    label={t.sound.equalizer.rename}
                    onPress={() => ask({ kind: 'rename', from: current })}
                  />
                  {/* Asked twice, in the same place, rather than through a
                      dialog: the second press is the confirmation, and
                      anything else pressed in between calls it off. The
                      curve itself stays in force either way; only the name
                      it was kept under goes. */}
                  <TextButton
                    label={
                      armed === current ? t.sound.equalizer.confirmDelete(current) : t.common.delete
                    }
                    tone="danger"
                    onPress={() => {
                      if (armed !== current) {
                        haptic('choices', 'tick');
                        setArmed(current);
                        return;
                      }
                      haptic('results', 'heavy');
                      setArmed(null);
                      setNote(null);
                      shape({ presets: removed(kept, current) }, true);
                    }}
                  />
                </>
              ) : null}
              <TextButton
                label={t.sound.equalizer.importAutoEq}
                onPress={() => {
                  setArmed(null);
                  setImporting(true);
                }}
              />
            </View>
            {note ? <Text style={styles.said}>{note}</Text> : null}

            <SectionLabel>{t.sound.equalizer.bands}</SectionLabel>
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
              <TextButton
                label={t.sound.equalizer.addBand}
                size="body"
                style={styles.add}
                onPress={() => {
                  haptic('choices', 'tick');
                  const next = [
                    ...latestBands(),
                    // Flat, so that adding it changes nothing until it is
                    // moved, and somewhere there is not a band already.
                    heldBand({ type: 'peak', frequencyHz: nextBandHz(latestBands()), gainDb: 0, q: 1 }),
                  ];
                  shape({ bands: next }, true);
                  setOpen(next.length - 1);
                }}
              />
            ) : (
              <Text style={[styles.hint, styles.full]}>{t.sound.equalizer.full(MAX_BANDS)}</Text>
            )}

            <SectionLabel>{t.sound.equalizer.preamp}</SectionLabel>
            <View style={styles.tone}>
              <Segmented
                variant="outline"
                options={[
                  { value: 'automatic', label: t.sound.equalizer.automatic },
                  { value: 'byHand', label: t.sound.equalizer.byHand },
                ]}
                value={preampDb === null ? 'automatic' : 'byHand'}
                onChange={(who) => {
                  if (who === 'automatic') shape({ preampDb: null }, true);
                  // From where the automatic one had it, so that changing
                  // who decides does not change the level.
                  else if (preampDb === null) shape({ preampDb: Number(automatic.toFixed(1)) }, true);
                }}
              />
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
                    <TextButton
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

        <SectionLabel>{t.sound.equalizer.tone}</SectionLabel>
        <View style={styles.tone}>
          {state.bassSupported ? (
            <Slider
              label={t.sound.equalizer.bassBoost}
              value={state.bass}
              min={0}
              max={1000}
              notches={NONE}
              accent={c.accent}
              format={(strength) => t.format.percent(Math.round(strength / 10))}
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
              notches={NONE}
              accent={c.accent}
              format={(strength) => t.format.percent(Math.round(strength / 10))}
              onDrag={(value) => push({ virtualizer: Math.round(value) })}
              onSettle={(value) => void commit({ virtualizer: Math.round(value) })}
            />
          ) : null}
          <Slider
            label={t.sound.equalizer.loudness}
            value={state.loudness}
            min={0}
            max={state.maxLoudnessMb}
            notches={NONE}
            accent={c.accent}
            format={decibels}
            onDrag={(value) => push({ loudness: Math.round(value) })}
            onSettle={(value) => void commit({ loudness: Math.round(value) })}
          />
          <Text style={styles.hint}>{t.sound.equalizer.toneNote}</Text>
        </View>

        <TextButton
          label={t.sound.equalizer.resetAll}
          size="body"
          style={styles.reset}
          onPress={() => {
            haptic('results', 'confirm');
            setOpen(null);
            setArmed(null);
            setNote(null);
            // Offered back for a moment, as a song taken out of a list is: a whole curve made by hand is gone in one press.
            const was = live.current;
            if (was) offerUndo(t.common.undone.reset, () => void commit(was));
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
          }}
        />
      </View>

      <TextPrompt
        page
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
    </PageScroll>
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

/** `+6`, `−3`, `0` — millibels said in the decibels they are heard in. */
function decibels(millibels: number): string {
  const db = Math.round(millibels / MB_PER_DB);
  if (db === 0) return '0';
  return db > 0 ? `+${db}` : `−${Math.abs(db)}`;
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  centred: { alignItems: 'center', justifyContent: 'center', padding: SPACE.xl },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.l },
  switchText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  title: { color: c.text, fontSize: TYPE.heading, fontWeight: '600' },
  hint: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.small },
  note: { color: c.textMuted, fontSize: TYPE.small, textAlign: 'center', lineHeight: LEADING.body },
  notice: {
    color: c.textSecondary,
    fontSize: TYPE.hint,
    lineHeight: 19,
    marginTop: SPACE.m,
    padding: SPACE.m,
    borderRadius: RADIUS.control,
    backgroundColor: c.surface,
    ...outlined(c),
  },
  unbuilt: { marginTop: SPACE.l },

  dimmed: { opacity: 0.35 },

  curve: { paddingTop: SPACE.l },


  // Wrapping, so four of them are two lines on a narrow phone rather than a
  // row running off the side of it.
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACE.l, rowGap: SPACE.xxs, paddingTop: SPACE.s },
  said: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint, paddingTop: SPACE.xs },

  bands: { gap: SPACE.xs },
  add: { alignSelf: 'flex-start', marginVertical: SPACE.xs },
  full: { paddingTop: SPACE.m },

  tone: { gap: SPACE.l },

  // Apart from the rest, in the middle, the way back to flat.
  reset: { alignSelf: 'center', marginTop: CARD_GAP },
}));
