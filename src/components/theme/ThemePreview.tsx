import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../lib/i18n/index';
import { makeStyles, type Palette } from '../../lib/theme/index';

/**
 * The app in miniature, in a palette that is not the one in use: what the
 * colours being chosen would make of it.
 *
 * A piece of each thing the palette has a say in — the page, a card on it
 * with a title and a quieter line, a chip, the button that matters, a switch
 * that is on, a slider part of the way along, and the bar across the foot —
 * so that a colour that works as a page and fails as a card is seen to
 * before it is everywhere.
 *
 * Painted from the palette it is handed, like the samples in the picker, and
 * for the same reason not through a `ThemeScope`: a scope holds a theme that
 * is in the registry, and this one is not a theme yet. It is whatever the
 * sliders say at this moment, and becomes the theme when the finger lifts.
 * Only the frame round it is the theme in use.
 *
 * Hidden from a screen reader. There is nothing in it to do, and the words
 * are stand-ins.
 */
export function ThemePreview({ colours: p }: { colours: Palette }) {
  const t = useT();
  const styles = useStyles();
  const say = t.settings.customTheme.sample;

  return (
    <View
      style={[styles.frame, { backgroundColor: p.bg }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={shapes.page}>
        <Text style={[shapes.heading, { color: p.text }]} numberOfLines={1}>
          {t.nav.library}
        </Text>

        <View style={[shapes.card, { backgroundColor: p.surface }]}>
          <View style={[shapes.cover, { backgroundColor: p.surfaceRaised }]}>
            <View style={[shapes.note, { backgroundColor: p.textDisabled }]} />
          </View>
          <View style={shapes.words}>
            <Text style={[shapes.title, { color: p.accent }]} numberOfLines={1}>
              {say.title}
            </Text>
            <Text style={[shapes.line, { color: p.textMuted }]} numberOfLines={1}>
              {say.line}
            </Text>
          </View>
          <View style={[shapes.switchTrack, { backgroundColor: p.accentMuted }]}>
            <View style={[shapes.switchThumb, { backgroundColor: p.accent }]} />
          </View>
        </View>

        <View style={shapes.controls}>
          <View style={[shapes.button, { backgroundColor: p.primary }]}>
            <Text style={[shapes.buttonText, { color: p.onPrimary }]} numberOfLines={1}>
              {say.button}
            </Text>
          </View>
          <View style={[shapes.chip, { backgroundColor: p.surfaceRaised }]}>
            <Text style={[shapes.chipText, { color: p.textSecondary }]} numberOfLines={1}>
              {say.chip}
            </Text>
          </View>
          <View style={shapes.slider}>
            <View style={[shapes.rail, { backgroundColor: p.borderStrong }]} />
            <View style={[shapes.fill, { backgroundColor: p.accent }]} />
            <View style={[shapes.knob, { backgroundColor: p.accent, borderColor: p.bg }]} />
          </View>
        </View>
      </View>

      <View style={[shapes.bar, { backgroundColor: p.bar, borderTopColor: p.border }]}>
        <View style={[shapes.tabOn, { backgroundColor: p.selected }]}>
          <View style={[shapes.tabDot, { backgroundColor: p.onSelected }]} />
        </View>
        <View style={[shapes.tabDot, { backgroundColor: p.textFaint }]} />
        <View style={[shapes.tabDot, { backgroundColor: p.textFaint }]} />
        <View style={[shapes.tabDot, { backgroundColor: p.textFaint }]} />
      </View>
    </View>
  );
}

/** Shapes only. The colours are the palette's own and are handed in as it is drawn. */
const shapes = StyleSheet.create({
  page: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, gap: 10 },
  heading: { fontSize: 17, fontWeight: '600' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 10 },
  cover: { width: 38, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  note: { width: 12, height: 12, borderRadius: 6 },
  words: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 14, fontWeight: '600' },
  line: { fontSize: 12 },
  switchTrack: { width: 34, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'flex-end' },
  switchThumb: { width: 18, height: 18, borderRadius: 9 },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { borderRadius: 9, paddingHorizontal: 14, paddingVertical: 6 },
  buttonText: { fontSize: 12.5, fontWeight: '600' },
  chip: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { fontSize: 12.5 },
  slider: { flex: 1, minWidth: 30, height: 16, justifyContent: 'center' },
  rail: { height: 4, borderRadius: 2 },
  fill: { position: 'absolute', left: 0, width: '55%', height: 4, borderRadius: 2 },
  knob: { position: 'absolute', left: '50%', width: 14, height: 14, borderRadius: 7, borderWidth: 2 },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 34,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabOn: { width: 40, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tabDot: { width: 10, height: 10, borderRadius: 5 },
});

const useStyles = makeStyles((c) => StyleSheet.create({
  /*
    An edge of its own, in this theme's colours, as the picker's samples have:
    a picture whose page is the colour of the page it lies on would otherwise
    end nowhere.
  */
  frame: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
}));
