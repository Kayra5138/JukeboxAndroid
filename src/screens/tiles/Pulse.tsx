import { useEffect } from 'react';
import { type SharedValue } from 'react-native-reanimated';

import { usePlayerPosition } from '../../lib/player/PlayerProvider';

/**
 * Where the record has got to, written somewhere the board can read it.
 *
 * A leaf that draws nothing: the position changes a few times a second and
 * every one of those would re-render the whole screen if it were read higher
 * up.
 */
export function Pulse({ into }: { into: SharedValue<number> }) {
  const { positionSec } = usePlayerPosition(true);
  useEffect(() => {
    into.set(Math.max(0, Math.round(positionSec * 1000)));
  }, [into, positionSec]);
  return null;
}
