import { useIsFocused } from 'expo-router';

import { TransitionsPage } from '../../../components/sound/TransitionsPage';

/** The page, in the tab: see `TransitionsPage`, which the player's card of settings opens in itself. */
export default function TransitionsScreen() {
  return <TransitionsPage focused={useIsFocused()} />;
}
