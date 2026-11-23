import { usePathname } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOAT_MARGIN, useSpot } from './DownloadsButton';
import { BesideDownloads, Snack } from './Snack';
import { useT } from '../lib/i18n/index';
import { haptic } from '../lib/ui/haptics';
import { takeUndo, useUndoOffer, type UndoOffer } from '../lib/ui/undo';

/**
 * A song taken out of a list or let go from the player, offered back for a
 * few seconds at the foot of the screen (`lib/ui/undo.ts`): drawn over the
 * navigator, as the downloads button is, so that it stays where it is while
 * a page goes, and placed as that button is, above the bars along the foot.
 * The same card as Discover's notice of a song turned away.
 */
export function UndoNotice() {
  const offer = useUndoOffer();
  if (!offer) return null;
  // A new one for each offer, which rises as it comes.
  return <Offered key={offer.id} offer={offer} />;
}

function Offered({ offer }: { offer: UndoOffer }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const spot = useSpot(usePathname());
  return (
    <BesideDownloads>
      {(room) => (
        <View
          pointerEvents="box-none"
          // As far from the left edge as from the right, and clear of the downloads button while it is there.
          style={[SPOT, { left: insets.left + FLOAT_MARGIN, right: spot.right + room, bottom: spot.bottom }]}>
          <Snack
            text={offer.text}
            bad={offer.bad}
            action={
              offer.undo
                ? {
                    label: t.common.undo,
                    onPress: () => {
                      haptic('choices', 'tick');
                      takeUndo();
                    },
                  }
                : undefined
            }
          />
        </View>
      )}
    </BesideDownloads>
  );
}

const SPOT = { position: 'absolute' } as const;
