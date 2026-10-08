import { ThemeScope } from '../lib/theme/index';
import TilesScreen from '../screens/tiles/TilesScreen';

/**
 * The game, held dark whatever theme the rest of the app is in.
 *
 * It is lit like an arcade — bright keys falling down a black board, washed
 * in colour from the record's own cover — and none of that survives being put
 * on white. Said here, around the whole route, so that nothing in the game has
 * to know there is a choice.
 */
export default function Tiles() {
  return (
    <ThemeScope theme="dark" statusBar>
      <TilesScreen />
    </ThemeScope>
  );
}
