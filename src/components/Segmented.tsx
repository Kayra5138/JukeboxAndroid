import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Pressable } from './Pressable';
import { SlidingMark } from './SlidingMark';
import { makeStyles, outlined, outlineWidth } from '../lib/theme/index';
import { insideBorder, withPlace, type Place } from '../lib/ui/segmented';

/** One of the choices: what it says, and what it is. */
export type SegmentedOption<Value extends string | number> = {
  value: Value;
  label: string;
  /** A line under the label, for choices that need saying more of: laid out one under another (`stack`). */
  hint?: string;
  /** What a screen reader says in place of the label, where the label alone is not enough. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
};

/**
 * One of a row of choices, of which one is the answer: a segmented switch,
 * a row of chips, a few tabs.
 *
 * There were a dozen of these, each drawn by its own screen, and each told
 * which was chosen by filling that one in: the fill vanished under one choice
 * and appeared under the next, and a wash spread under the finger on the way.
 * Here the fill is one mark, drawn once and moved to whichever is chosen (see
 * `SlidingMark`), as the tab bar's is; the eye follows it from where the
 * answer was to where it went. With the mark saying what was pressed, the
 * choices take no wash. Only the chosen label changes, heavier as well as in
 * the colour written on the mark, so that it is not colour alone that says
 * which.
 *
 * Three looks, and two sizes of each, which are the looks the screens already
 * had with their small differences settled:
 *
 * - `tray`: the choices share a tray that is a step off what it lies on, and
 *   the mark is the chosen one's fill (`selected`). For the few ways of
 *   looking at one thing: views, periods, tabs, the kind of list to make.
 * - `chips`: each choice a plate of its own, and the mark a fill over the
 *   chosen one. `strong`, on a card or a sheet, fills in the primary colour,
 *   since a plate there is already the fill a tray's mark would be; `quiet`,
 *   on the page itself, is a tray's choice set loose.
 * - `outline`: each choice an edge with nothing in it, and the mark the accent
 *   held back, for the controls about sound that draw in the accent.
 *
 * Choices take what their words need (`fit`), share the width evenly
 * (`fill`), or stand one under another (`stack`); fitted ones may run on to
 * more lines, and the mark follows them down as well as along.
 *
 * To a screen reader the row is tabs (`tab`), a group of which one is checked
 * (`radio`), or buttons of which one is selected (`button`: where pressing the
 * chosen one again does something, such as starting the timer afresh).
 *
 * The styles at the end are for a screen with a palette of its own rather than
 * the theme's — the game, which is always dark — and for laying the row out
 * among its neighbours; the looks themselves are not meant to be redrawn
 * place by place.
 */
export function Segmented<Value extends string | number>({
  options,
  value,
  onChange,
  role = 'radio',
  variant = 'tray',
  size = 'regular',
  tone = 'strong',
  layout: laid,
  wrap: wraps,
  disabled = false,
  accessibilityLabel,
  hitSlop,
  onLayout,
  style,
  optionStyle,
  plateStyle,
  markStyle,
  labelStyle,
  chosenLabelStyle,
}: {
  options: readonly SegmentedOption<Value>[];
  /** The one chosen; none, or one not among them, where nothing here is the answer (a curve changed by hand). */
  value: Value | null;
  onChange: (value: Value) => void;
  role?: 'tab' | 'radio' | 'button';
  variant?: 'tray' | 'chips' | 'outline';
  size?: 'compact' | 'regular';
  /** Chips only: on a card or sheet (`strong`), or on the page (`quiet`). */
  tone?: 'strong' | 'quiet';
  layout?: 'fit' | 'fill' | 'stack';
  wrap?: boolean;
  /** The whole row: shown, and not live. */
  disabled?: boolean;
  accessibilityLabel?: string;
  hitSlop?: PressableProps['hitSlop'];
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  optionStyle?: StyleProp<ViewStyle>;
  /** In place of the look's plate under each choice, and of its mark: for a screen with a palette of its own. */
  plateStyle?: StyleProp<ViewStyle>;
  markStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  chosenLabelStyle?: StyleProp<TextStyle>;
}) {
  const styles = useStyles();
  /** Where each choice lies in the row, by its value: what the mark and the plates are laid by. */
  const [places, setPlaces] = useState<Record<string, Place>>({});

  // Trays share their width and keep to one line; chips take what their words need and run on.
  const layout = laid ?? (variant === 'tray' ? 'fill' : 'fit');
  const wrap = wraps ?? variant !== 'tray';
  const compact = size === 'compact';
  const look =
    variant === 'tray'
      ? {
          row: compact ? styles.trayCompact : styles.tray,
          cell: layout === 'stack' ? styles.trayStackCell : compact ? styles.trayCompactCell : styles.trayCell,
          plate: null,
          mark: styles.trayMark,
          label: compact ? styles.trayCompactLabel : styles.trayLabel,
          chosen: styles.trayLabelOn,
        }
      : variant === 'chips'
        ? {
            row: compact ? styles.looseCompact : styles.loose,
            cell: compact ? styles.chipCompactCell : styles.chipCell,
            plate: tone === 'quiet' ? styles.chipQuietPlate : styles.chipPlate,
            mark: tone === 'quiet' ? styles.chipQuietMark : styles.chipMark,
            label: tone === 'quiet' ? styles.chipQuietLabel : styles.chipLabel,
            chosen: tone === 'quiet' ? styles.chipQuietLabelOn : styles.chipLabelOn,
          }
        : {
            row: compact ? styles.looseCompact : styles.loose,
            cell: compact ? styles.outlineCompactCell : styles.outlineCell,
            plate: styles.outlinePlate,
            mark: styles.outlineMark,
            label: styles.outlineLabel,
            chosen: styles.outlineLabelOn,
          };

  // A palette of its own, where a screen has one, in place of the theme's.
  const plate = plateStyle ?? look.plate;
  const mark = markStyle ?? look.mark;
  const rowStyle: StyleProp<ViewStyle> = [look.row, layout === 'stack' ? styles.stack : wrap ? styles.wrap : null, style, disabled && styles.dim];
  /*
    The mark and the plates are laid inside the row's border and a choice is
    measured from outside it, so they are taken back by its width; and they
    are rounded as the choices are, whatever a place has made of those.
  */
  const border = StyleSheet.flatten(rowStyle).borderWidth ?? 0;
  const corner = StyleSheet.flatten<ViewStyle>([look.cell, optionStyle]).borderRadius;
  const chosenPlace = value == null ? null : insideBorder(places[String(value)], border);

  return (
    <View
      accessibilityRole={role === 'tab' ? 'tablist' : role === 'radio' ? 'radiogroup' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={rowStyle}
      onLayout={onLayout}>
      {/*
        The plates under the mark, laid where the choices were measured: the
        mark has to pass over the others on its way, and a plate drawn by the
        choice itself would be over it, as the choice's words have to be.
      */}
      {plate
        ? options.map((option) => {
            const place = insideBorder(places[String(option.value)], border);
            if (!place) return null;
            return (
              <View
                key={String(option.value)}
                pointerEvents="none"
                style={[
                  styles.plate,
                  plate,
                  { left: place.x, top: place.y, width: place.width, height: place.height, borderRadius: corner },
                  option.disabled && styles.dim,
                ]}
              />
            );
          })
        : null}
      <SlidingMark place={chosenPlace} style={[mark, { borderRadius: corner }]} />
      {options.map((option) => {
        const key = String(option.value);
        const on = option.value === value;
        const off = disabled || option.disabled === true;
        /*
          Until a choice has been measured there is no mark or plate for it,
          and it is drawn as it would look, so that the first frame is not a
          row of bare words; from then on it is only its words.
        */
        const own = places[key] ? styles.bare : on ? mark : plate;
        return (
          <Pressable
            // No wash under the finger: the mark moving to the choice says it was pressed.
            key={key}
            onLayout={(event) => {
              const place = event.nativeEvent.layout;
              setPlaces((before) => withPlace(before, key, place));
            }}
            accessibilityRole={role}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityHint={option.accessibilityHint}
            accessibilityState={role === 'radio' ? { checked: on, disabled: off } : { selected: on, disabled: off }}
            disabled={off}
            hitSlop={hitSlop}
            style={[look.cell, layout === 'fill' && styles.fill, optionStyle, own, option.disabled && styles.dim]}
            onPress={() => onChange(option.value)}>
            <Text
              style={[look.label, labelStyle, on && look.chosen, on && chosenLabelStyle]}
              // On one line, made smaller to fit where it has to be rather than cut; laid one
              // under another there is the width for as many lines as it takes.
              numberOfLines={layout === 'stack' ? undefined : 1}
              adjustsFontSizeToFit={layout !== 'stack'}
              minimumFontScale={0.85}>
              {option.label}
            </Text>
            {option.hint ? <Text style={styles.hint}>{option.hint}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => {
  // An edge that is the whole of an outlined chip: drawn in every theme, and as wide as an outline where there are those.
  const edge = Math.max(StyleSheet.hairlineWidth, outlineWidth(c));
  const centred = { alignItems: 'center', justifyContent: 'center' } as const;
  return StyleSheet.create({
    /*
      The tray's inner corners are its own less the room round the choices,
      so that the mark sits in it as one rounded shape inside another.
    */
    tray: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 12, padding: 3, ...outlined(c) },
    trayCompact: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 9, padding: 2, ...outlined(c) },
    // A finger's height: drawn as a strip of words in a bar, they were some thirty points to aim at.
    trayCell: { ...centred, minHeight: 44, paddingHorizontal: 12, borderRadius: 9 },
    // As small as a legible word, for a switch beside something that wants the room more.
    trayCompactCell: { ...centred, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 7 },
    trayStackCell: { padding: 12, gap: 4, borderRadius: 9 },
    trayMark: { backgroundColor: c.selected },
    trayLabel: { color: c.textMuted, fontSize: 13.5 },
    trayCompactLabel: { color: c.textMuted, fontSize: 12.5 },
    trayLabelOn: { color: c.onSelected, fontWeight: '600' },

    loose: { flexDirection: 'row', gap: 8 },
    looseCompact: { flexDirection: 'row', gap: 6 },
    /*
      Room for an edge in every chip, on or off, coloured or not, so that the
      words do not move as the mark comes and goes.
    */
    chipCell: { ...centred, minWidth: 40, minHeight: 32, paddingHorizontal: 10, borderRadius: 8, borderWidth: outlineWidth(c) },
    chipCompactCell: { ...centred, minWidth: 32, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: outlineWidth(c) },
    chipPlate: { backgroundColor: c.surfaceRaised, ...outlined(c) },
    chipMark: { backgroundColor: c.primary, ...outlined(c, c.primary) },
    chipLabel: { color: c.textSecondary, fontSize: 13.5, fontVariant: ['tabular-nums'] },
    chipLabelOn: { color: c.onPrimary, fontWeight: '600' },
    chipQuietPlate: { backgroundColor: c.surface, ...outlined(c) },
    chipQuietMark: { backgroundColor: c.selected, ...outlined(c, c.selected) },
    chipQuietLabel: { color: c.textMuted, fontSize: 13.5, fontVariant: ['tabular-nums'] },
    chipQuietLabelOn: { color: c.onSelected, fontWeight: '600' },

    outlineCell: { ...centred, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 18, borderWidth: edge },
    outlineCompactCell: { ...centred, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, borderWidth: edge },
    outlinePlate: { borderWidth: edge, borderColor: c.borderStrong },
    // Ringed in the accent itself where there are outlines, since the fill is the accent held back
    // and is not far from the card it is on.
    outlineMark: { borderWidth: edge, backgroundColor: c.accentMuted, borderColor: c.accentMuted, ...outlined(c, c.accent) },
    outlineLabel: { color: c.textSecondary, fontSize: 13 },
    outlineLabelOn: { color: c.text, fontWeight: '600' },

    wrap: { flexWrap: 'wrap' },
    stack: { flexDirection: 'column' },
    fill: { flex: 1, minWidth: 0 },
    plate: { position: 'absolute' },
    bare: { backgroundColor: 'transparent', borderColor: 'transparent' },
    hint: { color: c.textFaint, fontSize: 12, lineHeight: 18 },
    dim: { opacity: 0.4 },
  });
});
