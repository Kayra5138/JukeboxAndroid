import { useIsFocused } from 'expo-router';
import { LEADING, RADIUS, SPACE, TYPE, TOUCH } from '../../../lib/theme/measures';
import { Note } from '../../../components/Note';
import { LinkRow, Chevron } from '../../../components/settings/rows';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../../components/settings/Find';
import { Switch } from '../../../components/Switch';

import { OptionSheet } from '../../../components/OptionSheet';
import { Pressable } from '../../../components/Pressable';
import { useT } from '../../../lib/i18n/index';
import {
  chooseSystemTheme,
  makeStyles,
  outlinedClip,
  setThemeShuffle,
  setThemeShuffled,
  usePressed,
  useSystemThemes,
  useThemeOffers,
  useThemeShuffle,
  type ThemeId,
} from '../../../lib/theme/index';
import { ThemePicker } from '../../../lib/theme/ThemePicker';
import { useBack } from '../../../lib/ui/back';
import { PageScroll } from '../../../components/Page';

/**
 * The themes: choosing one, making one, and being surprised by one.
 *
 * A screen of its own, opened from a row in Settings. The themes used to be
 * laid out in Settings itself, and with two dozen of them, each a picture,
 * they were most of that screen; everything else there was found by
 * scrolling past them.
 *
 * Three things, in the order they are wanted. The picker first, since nine
 * times in ten this screen is opened to tap a picture and leave. Then the
 * way into the colours of the theme somebody makes for themselves. Then the
 * draw: a theme at random each time the app is opened, out of the ones
 * ticked — folded away until it is asked for, because it is a second set of
 * all the same pictures and two of those on one screen is one to mistake for
 * the other.
 */
export default function ThemesScreen() {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const shuffle = useThemeShuffle();
  const [drawOpen, setDrawOpen] = useState(false);
  // Back folds the draw away before it leaves.
  const focused = useIsFocused();
  useBack(drawOpen && focused, () => setDrawOpen(false));
  const said = t.settings.theme.shuffle;
  /*
    The pair following the phone goes between, and which side of it is being
    chosen just now. Any theme the picker offers may stand on either side.
  */
  const pair = useSystemThemes();
  const [choosing, setChoosing] = useState<'light' | 'dark' | null>(null);
  const { groups } = useThemeOffers();
  const themes = groups
    .flatMap((group) => group.offers)
    .flatMap((offer) => (offer.id === 'system' ? [] : [{ value: offer.id, label: t.themes[offer.nameKey] }]));
  const named = (id: ThemeId) => themes.find((theme) => theme.value === id)?.label ?? id;

  const sheets = (
    <OptionSheet
      page
      visible={choosing !== null}
      heading={choosing ? t.settings.theme.pair[choosing] : ''}
      note={t.settings.theme.pair.note}
      options={themes}
      chosen={choosing ? pair[choosing] : pair.light}
      onChoose={(theme) => {
        if (choosing) chooseSystemTheme(choosing, theme);
      }}
      onClose={() => setChoosing(null)}
      // As they look and not as they are called, the same as where a theme is chosen for itself.
      picture={
        choosing ? (
          <ThemePicker
            marked={[pair[choosing]]}
            one
            onPick={(theme) => {
              if (theme !== 'system') chooseSystemTheme(choosing, theme);
              setChoosing(null);
            }}
          />
        ) : undefined
      }
    />
  );

  return (
    <PageScroll sheets={sheets}>
      <View style={styles.card}>
        <View style={styles.row}>
          <ThemePicker />
          <Text style={styles.muted}>{t.settings.theme.note}</Text>
        </View>
        {/*
          What System means, in the card with the picker it is a tile of.
          The tile shows the pair; these two rows are where it is chosen.
        */}
        {(['light', 'dark'] as const).map((mode) => (
          <View key={mode}>
            <View style={styles.rule} />
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              style={styles.row}
              onPress={() => setChoosing(mode)}>
              <View style={styles.line}>
                <Text style={styles.title}>{t.settings.theme.pair[mode]}</Text>
                <View style={styles.value}>
                  <Text style={styles.valueText} numberOfLines={1}>
                    {named(pair[mode])}
                  </Text>
                  <Chevron />
                </View>
              </View>
            </Pressable>
          </View>
        ))}
      </View>

      {/*
        Always here, whichever theme is chosen: the colours are the Custom
        theme's whether or not it is the one in use, and its tile above is
        drawn from them, so they can be settled on before it is turned to.
      */}
      <View style={[styles.card, styles.after]}>
        <LinkRow
          title={t.settings.customTheme.open}
          hint={t.settings.customTheme.openNote}
          href="/theme"
        />
      </View>

      <View style={[styles.card, styles.after]}>
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          accessibilityState={{ expanded: drawOpen }}
          style={styles.row}
          onPress={() => setDrawOpen(!drawOpen)}>
          <View style={styles.line}>
            <Text style={styles.title}>{said.title}</Text>
            <View style={styles.value}>
              <Text style={styles.valueText}>{shuffle.on ? said.on : t.common.off}</Text>
              <Chevron turned={drawOpen ? 'down' : null} />
            </View>
          </View>
        </Pressable>
        {drawOpen ? (
          <>
            <View style={styles.rule} />
            <View style={styles.row}>
              <View style={styles.line}>
                <Text style={styles.title}>{said.toggle}</Text>
                <Switch
                  value={shuffle.on}
                  accessibilityLabel={said.toggle}
                  onValueChange={setThemeShuffle}
                />
              </View>
              <Text style={styles.muted}>{said.note}</Text>
              {/*
                Said only when it is true and matters: the draw is on and
                has nothing to draw from, which is a switch that is on and
                does nothing.
              */}
              {shuffle.on && shuffle.pool.length === 0 ? (
                <Note tone="warn">
                  {said.empty}
                </Note>
              ) : null}
            </View>
            <View style={styles.rule} />
            <View style={styles.row}>
              <ThemePicker
                marked={shuffle.pool}
                onPick={(theme) => {
                  if (theme !== 'system') setThemeShuffled(theme, !shuffle.pool.includes(theme));
                }}
              />
            </View>
          </>
        ) : null}
      </View>
    </PageScroll>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: { backgroundColor: c.surface, borderRadius: RADIUS.card, overflow: 'hidden', ...outlinedClip(c) },
    after: { marginTop: SPACE.xl },
    row: { paddingHorizontal: SPACE.l, paddingVertical: SPACE.m, gap: SPACE.xs },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: SPACE.l },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.m, minHeight: TOUCH.row },
    title: { color: c.text, fontSize: TYPE.body, flexShrink: 1 },
    muted: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
    value: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
    valueText: { color: c.textSecondary, fontSize: TYPE.small },
  })
);
