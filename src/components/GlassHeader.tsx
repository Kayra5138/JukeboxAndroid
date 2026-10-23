import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackIcon } from './Icons';
import { Pressable } from './Pressable';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlineWidth, usePressed } from '../lib/theme/index';
import { HEADER_BAR } from '../lib/ui/bars';
import { Frost, useFrosted, useSceneTarget } from './Frosted';
import { barGlass } from './UnderBars';

/**
 * The bar at the top of a pushed screen, in a theme of glass: the way back
 * and the screen's name, drawn as part of the screen.
 *
 * The navigator's own bar is drawn apart from the screen, in a layer of its
 * own, so when one screen of glass was opened over another the screen below
 * went out of focus and darker and its bar did not: its name stood sharp
 * behind the new screen's, in the same place, and the two read as one smear.
 * Drawn here, the bar is in the page and goes back with it.
 *
 * Laid out to the same measures as the bar it stands in for, so that going
 * from a theme of glass to one without moves nothing.
 *
 * Glass itself, as every bar is that something can pass under: washed with
 * the page dense enough to be read over whatever does, and edged where the
 * theme draws edges. [over] lays it over the top of the screen instead of
 * above it, for a screen whose list runs on beneath it (see `UnderBars`);
 * otherwise it takes its room, and the screen begins under it.
 */
export function GlassHeader({
  title,
  onBack,
  over = false,
}: {
  title: string;
  onBack: (() => void) | null;
  over?: boolean;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const insets = useSafeAreaInsets();
  // What scrolls under it, out of focus behind it: only where it is laid over a list. See `Frosted`.
  const target = useSceneTarget();
  const frosted = useFrosted(over ? target : null);
  return (
    <View style={[styles.bar, over && styles.over, frosted && styles.clear, { paddingTop: insets.top, height: HEADER_BAR + insets.top }]}>
      {frosted && target ? <Frost target={target} edge="bottom" /> : null}
      {onBack ? (
        <Pressable
          android_ripple={{ ...pressed, borderless: true, radius: 22 }}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          hitSlop={4}
          style={styles.back}
          onPress={onBack}>
          <BackIcon size={22} />
        </Pressable>
      ) : null}
      <Text accessibilityRole="header" style={[styles.title, !onBack && styles.titleAlone]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    ...barGlass(c),
    borderBottomWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderBottomColor: c.border,
  },
  /*
    Over the top of the screen, and drawn over what is scrolled there though
    it comes first in the page: first, so that a screen reader starts with
    the way back and the name, as it always has.
  */
  over: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
  /** Its fill left to `Frost`, which draws it over the blur. */
  clear: { backgroundColor: 'transparent' },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  title: { flex: 1, minWidth: 0, color: c.text, fontSize: 20, fontWeight: '500', marginLeft: 20, marginRight: 16 },
  titleAlone: { marginLeft: 16 },
}));
