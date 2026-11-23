import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LEADING, SPACE, TYPE, RADIUS } from '../../lib/theme/measures';

import { useT } from '../../lib/i18n/index';
import { barWashOf } from '../../lib/theme/effects';
import { makeStyles, outlined } from '../../lib/theme/index';
import { glassOf } from '../../lib/theme/Veil';
import { Button } from '../Button';

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
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.text}>{text}</Text>
      <Button kind="secondary" size="small" label={t.welcome.tips.dismiss} accessibilityHint={t.welcome.tips.dismissHint} onPress={onDismiss} />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.m,
    /*
      In a theme of glass, the wash the bars are drawn with rather than a
      card's: a tip is a sentence to be read over whatever is behind it, the
      player's cover or a list going by, and a card of glass let that through
      until the words were hard to make out. The wash is worked out to keep
      text readable over black or white beneath.
    */
    backgroundColor: glassOf(c) > 0 ? barWashOf(c) : c.surface,
    borderRadius: RADIUS.control,
    paddingLeft: SPACE.m,
    paddingRight: SPACE.s,
    paddingVertical: SPACE.s,
    ...outlined(c),
  },
  text: { flex: 1, minWidth: 0, color: glassOf(c) > 0 ? c.text : c.textSecondary, fontSize: TYPE.small, lineHeight: LEADING.small },
}));
