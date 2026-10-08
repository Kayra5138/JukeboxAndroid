import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '../components/Pressable';
import { useT } from '../lib/i18n/index';
import {
  makeStyles,
  outlinedClip,
  scene,
  setThemeShuffle,
  setThemeShuffled,
  switchColours,
  useColours,
  usePressed,
  useThemeShuffle,
} from '../lib/theme/index';
import { ThemePicker } from '../lib/theme/ThemePicker';

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
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const insets = useSafeAreaInsets();
  const shuffle = useThemeShuffle();
  const [drawOpen, setDrawOpen] = useState(false);
  const said = t.settings.theme.shuffle;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right, paddingBottom: 32 + insets.bottom },
        ]}>
        <View style={styles.card}>
          <View style={styles.row}>
            <ThemePicker />
            <Text style={styles.muted}>{t.settings.theme.note}</Text>
          </View>
        </View>

        {/*
          Always here, whichever theme is chosen: the colours are the Custom
          theme's whether or not it is the one in use, and its tile above is
          drawn from them, so they can be settled on before it is turned to.
        */}
        <View style={[styles.card, styles.after]}>
          <Link href="/theme" asChild>
            <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row}>
              <View style={styles.line}>
                <Text style={styles.title}>{t.settings.customTheme.open}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.muted}>{t.settings.customTheme.openNote}</Text>
            </Pressable>
          </Link>
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
                <Text style={styles.chevron}>{drawOpen ? '⌄' : '›'}</Text>
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
                    {...switchColours(c, shuffle.on)}
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
                  <Text accessibilityRole="alert" style={styles.warning}>
                    {said.empty}
                  </Text>
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
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, ...scene(c) },
    content: { paddingTop: 12 },
    card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) },
    after: { marginTop: 16 },
    row: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },
    title: { color: c.text, fontSize: 15.5, flexShrink: 1 },
    muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
    warning: { color: c.warning, fontSize: 12.5, lineHeight: 18 },
    value: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    valueText: { color: c.textSecondary, fontSize: 14 },
    chevron: { color: c.textDisabled, fontSize: 20, lineHeight: 22 },
  })
);
