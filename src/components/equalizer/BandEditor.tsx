import { StyleSheet, Text, View } from 'react-native';
import { LEADING, RADIUS, SPACE, TYPE, TOUCH } from '../../lib/theme/measures';
import { Pressable } from '../Pressable';
import { Segmented } from '../Segmented';

import { Slider } from '../Fader';
import {
  MAX_GAIN_DB,
  MAX_Q,
  MIN_Q,
  formatDb,
  formatHz,
  formatQ,
  hzAtPosition,
  positionOfHz,
  roundedHz,
  roundedQ,
  type Band,
  type BandType,
} from '../../lib/equalizer/bands';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlined, usePressed } from '../../lib/theme/index';
import { haptic } from '../../lib/ui/haptics';
import { TextButton } from '../Button';
import { Chevron } from '../settings/rows';

const TYPES: BandType[] = ['peak', 'lowShelf', 'highShelf'];

/** Which of a band's three numbers is being typed rather than dragged. */
export type BandField = 'frequencyHz' | 'gainDb' | 'q';

/*
  The width is dragged along a log scale, like the frequency and for the same
  reason: from 0.1 to 1 is as much of a change as from 1 to 10, and a linear
  slider would give the first of those a tenth of its length.
*/
const Q_LOW = Math.log10(MIN_Q);
const Q_HIGH = Math.log10(MAX_Q);

const halves = (value: number) => Math.round(value * 2) / 2;

/**
 * One band of the equalizer: a line saying what it is, and under it, when it
 * is the one being worked on, everything that changes it.
 *
 * One open at a time, which is the screen's doing and not this component's.
 * Twelve bands each showing three sliders would be a page nobody could find
 * their place on; twelve lines with one of them open is a list.
 *
 * The sliders are quick and coarse on purpose -- half a decibel, a frequency
 * to two or three figures -- because that is as finely as a thumb can place
 * anything. The three numbers under them are for exactness: tapping one asks
 * for it to be typed, and a typed value is kept to the digit, which is what
 * copying a published correction by hand needs.
 */
export function BandEditor({
  index,
  band,
  open,
  accent,
  onToggle,
  onDrag,
  onSettle,
  onType,
  onRemove,
}: {
  index: number;
  band: Band;
  open: boolean;
  accent: string;
  onToggle: () => void;
  /** While a slider is moving. Reaches the player; see the screen for what else. */
  onDrag: (change: Partial<Band>) => void;
  /** Once it is let go, or a kind is chosen. */
  onSettle: (change: Partial<Band>) => void;
  /** Asked for one of the numbers to be typed. */
  onType: (field: BandField) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const say = t.sound.band;
  const number = index + 1;
  const hz = formatHz(band.frequencyHz, t);
  const db = formatDb(band.gainDb, t);
  const q = formatQ(band.q, t);

  return (
    <View style={[styles.band, open && styles.bandOpen]}>
      <Pressable
        android_ripple={pressed}
        style={styles.line}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={say.said(number, say.types[band.type], hz, db, q)}
        accessibilityHint={open ? say.closes : say.opens}>
        <Text style={styles.number}>{number}</Text>
        <Text style={styles.kind} numberOfLines={1}>
          {say.types[band.type]}
        </Text>
        <Text style={styles.figure} numberOfLines={1}>
          {hz}
        </Text>
        <Text
          style={[styles.figure, styles.gain, band.gainDb !== 0 && { color: accent }]}
          numberOfLines={1}>
          {db}
        </Text>
        {/* The app's one chevron, stood on end: down for more, up for less. */}
        <Chevron turned={open ? 'up' : 'down'} />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <Segmented
            variant="outline"
            size="compact"
            options={TYPES.map((type) => ({
              value: type,
              label: say.types[type],
              accessibilityLabel: say.kind(number, say.types[type]),
            }))}
            value={band.type}
            onChange={(type) => onSettle({ type })}
          />

          <Slider
            label={say.frequency}
            // Along the same log axis the curve is drawn on, so a thumb's
            // width here is the same distance as a thumb's width up there.
            value={positionOfHz(band.frequencyHz)}
            min={0}
            max={1}
            accent={accent}
            snap={(position) => positionOfHz(roundedHz(hzAtPosition(position)))}
            format={(position) => formatHz(hzAtPosition(position), t)}
            onDrag={(position) => onDrag({ frequencyHz: roundedHz(hzAtPosition(position)) })}
            onSettle={(position) => onSettle({ frequencyHz: roundedHz(hzAtPosition(position)) })}
          />
          <Slider
            label={say.gain}
            value={band.gainDb}
            min={-MAX_GAIN_DB}
            max={MAX_GAIN_DB}
            centre={0}
            accent={accent}
            snap={halves}
            format={(value) => formatDb(value, t)}
            onDrag={(gainDb) => onDrag({ gainDb })}
            onSettle={(gainDb) => onSettle({ gainDb })}
          />
          <Slider
            label={band.type === 'peak' ? say.widthQ : say.cornerQ}
            value={Math.log10(band.q)}
            min={Q_LOW}
            max={Q_HIGH}
            accent={accent}
            snap={(log) => Math.log10(roundedQ(10 ** log))}
            format={(log) => formatQ(10 ** log, t)}
            onDrag={(log) => onDrag({ q: roundedQ(10 ** log) })}
            onSettle={(log) => onSettle({ q: roundedQ(10 ** log) })}
          />
          <Text style={styles.hint}>
            {band.type === 'peak' ? say.peakHint : say.shelfHint}
          </Text>

          <View style={styles.exact}>
            <Text style={styles.exactLabel}>{say.typeIt}</Text>
            <Exact
              text={hz}
              label={say.typeFrequency(number, hz)}
              onPress={() => onType('frequencyHz')}
            />
            <Exact
              text={db}
              label={say.typeGain(number, db)}
              onPress={() => onType('gainDb')}
            />
            <Exact
              text={`Q ${q}`}
              label={say.typeQ(number, q)}
              onPress={() => onType('q')}
            />
          </View>

          <TextButton
            label={say.removeThis}
            tone="danger"
            style={styles.remove}
            accessibilityLabel={say.remove(number)}
            onPress={() => {
              haptic('choices', 'tick');
              onRemove();
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function Exact({ text, label, onPress }: { text: string; label: string; onPress: () => void }) {
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <Pressable
      android_ripple={pressed}
      style={styles.exactButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Text style={styles.exactText} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  band: { borderRadius: RADIUS.control, backgroundColor: c.surface, ...outlined(c) },
  bandOpen: { backgroundColor: c.surfaceRaised },

  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
    paddingHorizontal: SPACE.m,
    // Tall enough to be a target for a thumb on its own.
    minHeight: TOUCH.normal,
  },
  number: {
    color: c.textFaint,
    fontSize: TYPE.hint,
    width: 18,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  kind: { color: c.text, fontSize: TYPE.small, flex: 1, minWidth: 0 },
  figure: { color: c.textSecondary, fontSize: TYPE.small, fontVariant: ['tabular-nums'] },
  // A fixed width, so the frequencies above and below line up whatever the
  // gains beside them say.
  gain: { width: 68, textAlign: 'right' },

  body: { paddingHorizontal: SPACE.m, paddingBottom: SPACE.m, gap: SPACE.l },
  hint: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.small },

  exact: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.s },
  exactLabel: { color: c.textFaint, fontSize: TYPE.hint, marginRight: SPACE.xxs },
  exactButton: {
    paddingHorizontal: SPACE.m,
    paddingVertical: SPACE.s,
    borderRadius: RADIUS.cover,
    backgroundColor: c.bg,
    ...outlined(c),
  },
  exactText: { color: c.text, fontSize: TYPE.small, fontVariant: ['tabular-nums'] },

  remove: { alignSelf: 'flex-start' },
}));
