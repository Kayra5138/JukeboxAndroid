import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Pressable } from '../components/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormScroll } from '../components/FormScroll';
import { ColourEditor } from '../components/theme/ColourEditor';
import { ThemePreview } from '../components/theme/ThemePreview';
import { useT } from '../lib/i18n/index';
import { customColours, DEFAULT_SEEDS, sameSeeds, type CustomSeeds, type SeedRole } from '../lib/theme/custom.ts';
import {
  chooseTheme,
  makeStyles,
  outlined,
  outlinedClip,
  saveCustomTheme,
  scene,
  switchColours,
  useColours,
  useCustomSeeds,
  usePressed,
  useThemeChoice,
  type Palette,
} from '../lib/theme/index';
import { useLandscape } from '../lib/ui/layout';

/** The three colours in the order they are asked for, and the token each one ends up as. */
const ROLES: { role: SeedRole; token: keyof Palette }[] = [
  { role: 'background', token: 'bg' },
  { role: 'accent', token: 'accent' },
  { role: 'surface', token: 'surface' },
];

/**
 * Where the Custom theme is made: a picture of the app, and under it the two
 * or three colours the picture is made from.
 *
 * There is no button to save with. Like every other setting it is kept as it
 * is changed — but "as it is changed" is the finger lifting, a suggestion
 * tapped, a code typed, and not each step of a drag. Keeping it is what
 * redraws the app, every screen of it, and doing that as fast as a slider
 * moves would have the slider stutter under the finger. So what is being
 * dragged is held here as a draft, which only the picture and this screen's
 * own swatches are drawn from, and handed over when it comes to rest.
 *
 * The colours are the Custom theme's whether or not that is the theme in use,
 * so they can be worked on from under another theme and looked at in the
 * picture; the button at the foot turns to it, and is not there once it has.
 */
export default function CustomThemeScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const say = t.settings.customTheme;
  const sideways = useLandscape();

  const saved = useCustomSeeds();
  const inUse = useThemeChoice() === 'custom';
  const [draft, setDraft] = useState(saved);
  /** The one colour whose controls are out. One at a time: three sets of sliders is a wall. */
  const [open, setOpen] = useState<SeedRole | null>(null);

  const made = customColours(draft);

  const keep = (next: CustomSeeds) => {
    setDraft(next);
    if (!sameSeeds(next, saved)) saveCustomTheme(next);
  };

  const picture = (
    <View style={styles.picture}>
      <Text style={styles.section}>{t.format.upper(say.preview)}</Text>
      <ThemePreview colours={made.colours} />
    </View>
  );

  const edges = { paddingLeft: insets.left + 20, paddingRight: insets.right + 20 };

  return (
    <View style={styles.screen}>
      {/*
        Held above the colours rather than scrolled away with them, upright:
        the third colour's sliders are a screen down, and a picture that has
        to be scrolled back to is not one that can be watched while dragging.
        Sideways there is no height to spare for it, and it goes with the rest.
      */}
      {sideways ? null : <View style={[styles.held, edges]}>{picture}</View>}

      <FormScroll contentContainerStyle={[styles.content, edges, { paddingBottom: insets.bottom + 40 }]}>
        {sideways ? picture : null}

        <View style={styles.card}>
          {ROLES.map(({ role, token }, index) => {
            const picked = draft[role];
            const shown = made.colours[token];
            const expanded = open === role;
            return (
              <View key={role}>
                {index > 0 ? <View style={styles.rule} /> : null}
                <Pressable
                  android_ripple={pressed}
                  accessibilityRole="button"
                  accessibilityLabel={`${say[role]}, ${picked ?? say.automatic}`}
                  accessibilityState={{ expanded }}
                  style={styles.row}
                  onPress={() => setOpen(expanded ? null : role)}>
                  {/* What it came out as, which is what the app will wear; the line under says so where that differs. */}
                  <View style={[styles.swatch, { backgroundColor: shown }]} />
                  <View style={styles.rowText}>
                    <Text style={styles.title}>{say[role]}</Text>
                    <Text style={styles.code}>{picked ?? say.automatic}</Text>
                  </View>
                  <Text style={[styles.chevron, expanded && styles.chevronOpen]}>›</Text>
                </Pressable>

                {picked !== null && picked !== shown ? (
                  <Text style={styles.nudged}>{say.nudged(shown)}</Text>
                ) : null}

                {expanded && role === 'surface' ? (
                  <View style={styles.automatic}>
                    <View style={styles.rowText}>
                      <Text style={styles.title}>{say.automatic}</Text>
                      <Text style={styles.code}>{say.automaticNote}</Text>
                    </View>
                    <Switch
                      value={picked === null}
                      accessibilityLabel={say.automatic}
                      // Turned off, it starts from the card it had, so that nothing moves until something is moved.
                      onValueChange={(on) => keep({ ...draft, surface: on ? null : shown })}
                      {...switchColours(c, picked === null)}
                    />
                  </View>
                ) : null}

                {expanded && picked !== null ? (
                  <ColourEditor
                    role={role}
                    value={picked}
                    onChange={(colour) => setDraft({ ...draft, [role]: colour })}
                    onCommit={(colour) => keep({ ...draft, [role]: colour })}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={styles.aside}>{say.note}</Text>

        {inUse ? null : (
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            style={styles.use}
            onPress={() => chooseTheme('custom')}>
            <Text style={styles.useLabel}>{say.use}</Text>
          </Pressable>
        )}

        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          style={styles.reset}
          onPress={() => keep(DEFAULT_SEEDS)}>
          <Text style={styles.resetLabel}>{say.reset}</Text>
        </Pressable>
      </FormScroll>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  held: { paddingTop: 14, paddingBottom: 6 },
  content: { paddingTop: 14 },
  picture: { marginBottom: 14 },

  section: {
    color: c.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },

  // One surface with its rows ruled off inside it, as the settings are. Clipped to its corners.
  card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: c.text, fontSize: 15.5 },
  code: { color: c.textMuted, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  chevron: { color: c.textDisabled, fontSize: 20, lineHeight: 22, width: 14, textAlign: 'center' },
  // The same mark turned to point down, rather than another glyph the phone's font may not have.
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  // An edge in this theme's colours: the swatch of the card's own colour would otherwise not be there.
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  nudged: {
    color: c.textFaint,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginTop: -4,
  },
  automatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },

  aside: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginTop: 10, marginHorizontal: 4 },

  use: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 24,
    ...outlined(c, c.primary),
  },
  useLabel: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  reset: { alignItems: 'center', paddingTop: 26 },
  resetLabel: { color: c.accent, fontSize: 14.5 },
}));
