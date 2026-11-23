import { useIsFocused } from 'expo-router';

import { EqualizerPage } from '../../../components/sound/EqualizerPage';

/** The page, in the tab: see `EqualizerPage`, which the player's card of settings opens in itself. */
export default function EqualizerScreen() {
  return <EqualizerPage focused={useIsFocused()} />;
}
