import { useState } from 'react';
import { LEADING, RADIUS, SPACE, TYPE, CARD_GAP } from '../../../lib/theme/measures';
import { SectionLabel, Chevron } from '../../../components/settings/rows';
import { offerUndo } from '../../../lib/ui/undo';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../../components/settings/Find';
import { Switch } from '../../../components/Switch';
import { Pressable } from '../../../components/Pressable';

import { PageScroll } from '../../../components/Page';
import { ColourEditor } from '../../../components/theme/ColourEditor';
import { ThemePreview } from '../../../components/theme/ThemePreview';
import { useT } from '../../../lib/i18n/index';
import { customColours, DEFAULT_SEEDS, sameSeeds, type CustomSeeds, type SeedRole } from '../../../lib/theme/custom.ts';
import {
  chooseTheme,
  makeStyles,
  outlinedClip,
  saveCustomTheme,
  useCustomSeeds,
  usePressed,
  useThemeChoice,
  type Palette,
} from '../../../lib/theme/index';
import { useLandscape } from '../../../lib/ui/layout';
import { useBack } from '../../../lib/ui/back';
import { haptic } from '../../../lib/ui/haptics';
import { useIsFocused } from 'expo-router';
import { Button, TextButton } from '../../../components/Button';

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
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const say = t.settings.customTheme;
  const sideways = useLandscape();

  const saved = useCustomSeeds();
  const inUse = useThemeChoice() === 'custom';
  const [draft, setDraft] = useState(saved);
  /** The one colour whose controls are out. One at a time: three sets of sliders is a wall. */
  const [open, setOpen] = useState<SeedRole | null>(null);
  // Back closes a colour's editor before it leaves: what was picked is kept as it was picked.
  const focused = useIsFocused();
  useBack(open != null && focused, () => setOpen(null));

  const made = customColours(draft);

  const keep = (next: CustomSeeds) => {
    setDraft(next);
    if (!sameSeeds(next, saved)) saveCustomTheme(next);
  };

  const picture = (
    <View style={styles.picture}>
      <SectionLabel after={false}>{say.preview}</SectionLabel>
      <ThemePreview colours={made.colours} />
    </View>
  );

  return (
    /*
      The picture held above the colours rather than scrolled away with them,
      upright: the third colour's sliders are a screen down, and a picture
      that has to be scrolled back to is not one that can be watched while
      dragging. Sideways there is no height to spare for it, and it goes with
      the rest.

      Marked where it says what was looked for in Settings; not scrolled to,
      the form keeping its scroller to itself.
    */
    <PageScroll form head={sideways ? undefined : picture}>
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
                <Chevron turned={expanded ? 'down' : null} />
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
        <Button
          kind="primary"
          wide
          label={say.use}
          onPress={() => {
            haptic('results', 'confirm');
            chooseTheme('custom');
          }}
        />
      )}

      <TextButton
        label={say.reset}
        size="body"
        style={styles.reset}
        onPress={() => {
          haptic('results', 'confirm');
          // Offered back for a moment: three colours picked by hand are gone in one press.
          const was = draft;
          keep(DEFAULT_SEEDS);
          if (!sameSeeds(was, DEFAULT_SEEDS)) offerUndo(t.common.undone.reset, () => {
            setDraft(was);
            saveCustomTheme(was);
          });
        }}
      />
    </PageScroll>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  picture: { marginBottom: SPACE.m },


  // One surface with its rows ruled off inside it, as the settings are. Clipped to its corners.
  card: { backgroundColor: c.surface, borderRadius: RADIUS.card, overflow: 'hidden', ...outlinedClip(c) },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: SPACE.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingHorizontal: SPACE.l, paddingVertical: SPACE.m },
  rowText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  title: { color: c.text, fontSize: TYPE.body },
  code: { color: c.textMuted, fontSize: TYPE.hint, fontVariant: ['tabular-nums'] },
  // The same mark turned to point down, rather than another glyph the phone's font may not have.
  // An edge in this theme's colours: the swatch of the card's own colour would otherwise not be there.
  swatch: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  nudged: {
    color: c.textFaint,
    fontSize: TYPE.hint,
    lineHeight: LEADING.hint,
    paddingHorizontal: SPACE.l,
    paddingBottom: SPACE.m,
    marginTop: -SPACE.xs,
  },
  automatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.m,
    paddingHorizontal: SPACE.l,
    paddingBottom: SPACE.m,
  },

  aside: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.hint, marginTop: SPACE.s, marginHorizontal: SPACE.xs },
  // Apart from the rest, in the middle, the way back to where it began.
  reset: { alignSelf: 'center', marginTop: CARD_GAP },
}));
