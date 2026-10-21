import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import { barWashOf } from '../../lib/theme/effects';
import { makeStyles, outlined, usePressed } from '../../lib/theme/index';
import { glassOf } from '../../lib/theme/Veil';

/**
 * One of the newcomer's tips: a sentence, and the one button that puts it
 * away.
 *
 * A card of the page's own surface, so that it sits in a glass theme the way
 * every other card does, and nothing about it is in the way: it is laid in
 * the flow above whatever it is about, or over a corner of the player, and
 * the screen under it works as it did. One tap and it is gone for good; the
 * way back is on Settings → Look.
 */
export function TipCard({
  text,
  onDismiss,
  style,
}: {
  text: string;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.text}>{text}</Text>
      <Pressable
        android_ripple={pressed}
        accessibilityRole="button"
        accessibilityHint={t.welcome.tips.dismissHint}
        hitSlop={6}
        style={styles.button}
        onPress={onDismiss}>
        <Text style={styles.buttonLabel}>{t.welcome.tips.dismiss}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    /*
      In a theme of glass, the wash the bars are drawn with rather than a
      card's: a tip is a sentence to be read over whatever is behind it, the
      player's cover or a list going by, and a card of glass let that through
      until the words were hard to make out. The wash is worked out to keep
      text readable over black or white beneath.
    */
    backgroundColor: glassOf(c) > 0 ? barWashOf(c) : c.surface,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 10,
    ...outlined(c),
  },
  text: { flex: 1, minWidth: 0, color: glassOf(c) > 0 ? c.text : c.textSecondary, fontSize: 13, lineHeight: 19 },
  button: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: c.surfaceRaised,
    ...outlined(c),
  },
  buttonLabel: { color: c.text, fontSize: 13, fontWeight: '600' },
}));
