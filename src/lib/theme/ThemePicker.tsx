import { Pressable, StyleSheet, Text, View } from 'react-native';

import { chooseTheme, makeStyles, usePressed, useThemeOffers, type Palette, type ThemeGroup } from './index';
import { useT, type Strings } from '../i18n/index';

/** The heading over each group. The first has none: it is the app as it comes. */
const HEADINGS: Record<ThemeGroup, keyof Strings['themes'] | null> = {
  basic: null,
  light: 'lightGroup',
  dark: 'darkGroup',
  special: 'specialGroup',
};

/**
 * The themes, to choose between by looking.
 *
 * Three could be a row of words. A dozen cannot: "Midnight blue" and "Forest"
 * say something, but not enough to choose on, and trying each in turn to see
 * is a dozen redraws of the whole app. So each is offered as a small picture
 * of itself — its page, a card on it, a line of its text, a dot of its
 * accent — with its name underneath, and they are set out in the groups the
 * registry puts them in: the app as it comes, then the light ones, the dark
 * ones, and the ones that are something else.
 *
 * The pictures are painted with the theme's own tokens, which is the one
 * place outside a `ThemeScope` that colours not belonging to the theme in
 * use are drawn; everything around them — the names, the ring round the one
 * chosen — is the theme in use, as it is everywhere.
 */
export function ThemePicker() {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const { chosen, groups } = useThemeOffers();

  return (
    <View style={styles.picker}>
      {groups.map(({ group, offers }) => {
        const heading = HEADINGS[group];
        return (
          <View key={group} style={styles.group}>
            {heading ? <Text style={styles.heading}>{t.themes[heading]}</Text> : null}
            <View style={styles.tiles}>
              {offers.map((offer) => {
                const on = offer.id === chosen;
                return (
                  <Pressable
                    android_ripple={pressed}
                    key={offer.id}
                    accessibilityRole="button"
                    accessibilityLabel={t.themes[offer.nameKey]}
                    accessibilityState={{ selected: on }}
                    style={styles.tile}
                    onPress={() => chooseTheme(offer.id)}>
                    <View style={[styles.ring, on && styles.ringOn]}>
                      <View style={styles.swatch}>
                        {offer.samples.map((sample) => (
                          <Sample key={sample.id} colours={sample.colours} />
                        ))}
                      </View>
                    </View>
                    <Text style={[styles.name, on && styles.nameOn]} numberOfLines={2}>
                      {t.themes[offer.nameKey]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * A theme in a thumbnail: its page, with a card on it carrying a line of
 * text, a quieter line, and its accent.
 *
 * Takes whatever width it is given, so that following the phone can be two
 * of these side by side, the light and the dark it goes between.
 */
function Sample({ colours }: { colours: Palette }) {
  return (
    <View style={[sample.page, { backgroundColor: colours.bg }]}>
      <View style={[sample.card, { backgroundColor: colours.surface, borderColor: colours.border }]}>
        <View style={sample.lines}>
          <View style={[sample.line, { backgroundColor: colours.text }]} />
          <View style={[sample.lineShort, { backgroundColor: colours.textMuted }]} />
        </View>
        <View style={[sample.dot, { backgroundColor: colours.accent }]} />
      </View>
    </View>
  );
}

/** Shapes only. The colours are each sample's own and are handed in as it is drawn. */
const sample = StyleSheet.create({
  page: { flex: 1, justifyContent: 'flex-end', padding: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 5,
    paddingVertical: 6,
  },
  lines: { flex: 1, gap: 3 },
  line: { height: 3, borderRadius: 1.5, width: '90%' },
  lineShort: { height: 3, borderRadius: 1.5, width: '55%' },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
});

const useStyles = makeStyles((c) => StyleSheet.create({
  picker: { gap: 14, marginTop: 8, marginBottom: 6 },
  group: { gap: 8 },
  heading: { color: c.textFaint, fontSize: 12, fontWeight: '600' },
  /*
    As many to a row as fit, at one width, so that the rows line up down the
    card whatever the width of the phone and a last row of one is not a tile
    stretched to the width of three.
  */
  tiles: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 10 },
  tile: { width: 86, gap: 4 },
  /*
    The mark of the one chosen, and room for it round the ones that are not,
    so that choosing does not move anything. Round the outside of the picture
    rather than over it: the picture is another theme's colours, and a ring
    in this theme's accent laid on those could vanish against any of them.
  */
  ring: { borderRadius: 12, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  ringOn: { borderColor: c.accent },
  /*
    An edge of its own, in this theme's colours: a sample whose page is the
    colour of the card the picker lies on would otherwise have no outline.
  */
  swatch: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  name: { color: c.textSecondary, fontSize: 12.5, lineHeight: 16, marginLeft: 3 },
  nameOn: { color: c.text, fontWeight: '600' },
}));
