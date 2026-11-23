import { ICON } from '../../lib/theme/measures';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertIcon } from '../Icons';
import { useUnderBars } from '../UnderBars';
import { useDiscoverNotice } from './hooks';
import { useDiscoverActions, type DiscoverNotice as Notice } from '../../lib/discover/DiscoverProvider';
import { useT } from '../../lib/i18n/index';
import { useColours } from '../../lib/theme/index';
import { haptic } from '../../lib/ui/haptics';
import { useUndoOffers } from '../../lib/ui/undo';
import { useLandscape } from '../../lib/ui/layout';
import { BesideDownloads, Snack } from '../Snack';
import { FLOAT_MARGIN } from '../DownloadsButton';


/**
 * The last thing done to the list, said at the foot of it: a song kept, a
 * song turned away and the way to take that back, a keep that failed.
 *
 * At the foot because that is where it does not move anything. It used to be
 * a line in the header, which grew by it and pushed the list down under the
 * finger that had just pressed — and the header is the one place somebody
 * pressing a button on the tenth row is not looking.
 *
 * Drawn in the screen, over the list, so it is above the tab bar already:
 * the scene ends where the bar begins. It takes itself down; the notice
 * runs out by its own clock, ten seconds for one that can be undone.
 *
 * Nothing here is listened to while there is no notice.
 */
export function DiscoverNotice() {
  const notice = useDiscoverNotice();
  // A song turned away is offered back unless offers were turned off: Settings → Look & feel.
  const offers = useUndoOffers();
  if (!notice || (!offers && notice.kind === 'excluded')) return null;
  return <Beside notice={notice} />;
}

/** Along the foot of the list, clear of the downloads button while it is there (`BesideDownloads`). */
function Beside({ notice }: { notice: Notice }) {
  const { undo } = useDiscoverActions();
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  const t = useT();
  const c = useColours();
  // Over the bars at the foot in a theme of glass, which are laid over the list and so over this.
  const under = useUnderBars({ player: true });
  const bad = notice.kind === 'keepFailed';
  return (
    <BesideDownloads>
      {(room) => (
        <View
          // Touches beside the card itself go to the list.
          pointerEvents="box-none"
          style={[
            SPOT,
            {
              right: FLOAT_MARGIN + room,
              // Upright the tab bar keeps the scene off the strip the phone has for its gestures. On its side nothing does.
              bottom: FLOAT_MARGIN + (landscape ? insets.bottom : 0) + under.bottom,
            },
          ]}>
          <Snack
            text={notice.text}
            bad={bad}
            icon={bad ? <AlertIcon size={ICON} color={c.danger} /> : null}
            action={
              notice.canUndo
                ? {
                    label: t.discover.notice.undo,
                    onPress: () => {
                      haptic('choices', 'tick');
                      undo();
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

const SPOT = { position: 'absolute', left: FLOAT_MARGIN } as const;
