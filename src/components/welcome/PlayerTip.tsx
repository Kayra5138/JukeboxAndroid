import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TipCard } from './TipCard';
import { useT } from '../../lib/i18n/index';
import { makeStyles } from '../../lib/theme/index';
import { useTip } from '../../lib/ui/tipsStore';

/**
 * The player's tip, the first time it is opened: that it has the words, that
 * they can be translated, and what is behind the gear.
 *
 * Laid over the foot of the player and not into it. The player's column is
 * measured to the point — the artwork folds away against a height worked out
 * from what is left below it — and a card pushed into the flow would be taken
 * out of the queue's room and given back when it went. Over the queue, the
 * worst it does is cover two rows of it until it is put away.
 */
export function PlayerTip() {
  const t = useT();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const tip = useTip('player');
  if (!tip.shown) return null;
  return (
    <View pointerEvents="box-none" style={[styles.place, { bottom: insets.bottom + 56 }]}>
      <TipCard text={t.welcome.tips.player} onDismiss={tip.dismiss} style={styles.card} />
    </View>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({
  place: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  card: { width: '100%', maxWidth: 520 },
}));
