import { StyleSheet, View } from 'react-native';

import { TipCard } from './TipCard';
import { useT } from '../../lib/i18n/index';
import { makeStyles } from '../../lib/theme/index';
import { useTip } from '../../lib/ui/tipsStore';
import { useUnderBars } from '../UnderBars';

/**
 * Discover's tip, on the first visit: what the list is, and that on a new
 * install it is made from the library until there is listening to go on.
 *
 * Over the list and not in its header. The list says where its rows are
 * without measuring them, from a header whose height is worked out in
 * advance; a card in there would put every row a card's height from where
 * the list thinks it is.
 */
export function DiscoverTip() {
  const t = useT();
  const styles = useStyles();
  const tip = useTip('discover');
  // Clear of what is laid over the top of the tab in a theme of glass, as the list it is over would be.
  const under = useUnderBars();
  if (!tip.shown) return null;
  return (
    <View style={[styles.place, under.top > 0 && { paddingTop: 8 + under.top }]}>
      <TipCard text={t.welcome.tips.discover} onDismiss={tip.dismiss} />
    </View>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({
  place: { paddingHorizontal: 16, paddingTop: 8 },
}));
