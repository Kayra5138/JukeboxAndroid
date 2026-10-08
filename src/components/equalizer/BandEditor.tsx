import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { makeStyles, outlined, outlineWidth, usePressed } from '../../lib/theme/index';

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
        <Text style={[styles.chevron, open ? styles.chevronUp : styles.chevronDown]}>›</Text>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <View style={styles.kinds} accessibilityRole="radiogroup">
            {TYPES.map((type) => {
              const on = band.type === type;
              return (
                <Pressable
                  android_ripple={pressed}
                  key={type}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => onSettle({ type })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={say.kind(number, say.types[type])}>
                  <Text style={on ? styles.chipLabelOn : styles.chipLabel}>{say.types[type]}</Text>
                </Pressable>
              );
            })}
          </View>

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

          <Pressable
            android_ripple={pressed}
            style={styles.remove}
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={say.remove(number)}>
            <Text style={styles.removeLabel}>{say.removeThis}</Text>
          </Pressable>
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
  band: { borderRadius: 10, backgroundColor: c.surface, ...outlined(c) },
  bandOpen: { backgroundColor: c.surfaceRaised },

  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    // Tall enough to be a target for a thumb on its own.
    minHeight: 48,
  },
  number: {
    color: c.textFaint,
    fontSize: 12,
    width: 18,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  kind: { color: c.text, fontSize: 14, flex: 1, minWidth: 0 },
  figure: { color: c.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
  // A fixed width, so the frequencies above and below line up whatever the
  // gains beside them say.
  gain: { width: 68, textAlign: 'right' },
  chevron: { color: c.textDisabled, fontSize: 17, width: 14, textAlign: 'center' },
  chevronDown: { transform: [{ rotate: '90deg' }] },
  chevronUp: { transform: [{ rotate: '-90deg' }] },

  body: { paddingHorizontal: 12, paddingBottom: 14, gap: 16 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 16,
    // The edge is the chip: there is no fill until it is on. So it is as wide
    // as an outline where a theme draws those, on or off, and nothing moves.
    borderWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderColor: c.borderStrong,
  },
  // Ringed in the accent itself where there are outlines, since the fill is
  // the accent held back and is not far from the card it is on.
  chipOn: { backgroundColor: c.accentMuted, borderColor: c.accentMuted, ...outlined(c, c.accent) },
  chipLabel: { color: c.textSecondary, fontSize: 13 },
  chipLabelOn: { color: c.text, fontSize: 13, fontWeight: '600' },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 18 },

  exact: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  exactLabel: { color: c.textFaint, fontSize: 12, marginRight: 2 },
  exactButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: c.bg,
    ...outlined(c),
  },
  exactText: { color: c.text, fontSize: 13, fontVariant: ['tabular-nums'] },

  remove: { alignSelf: 'flex-start', paddingVertical: 6 },
  removeLabel: { color: c.danger, fontSize: 13.5 },
}));
