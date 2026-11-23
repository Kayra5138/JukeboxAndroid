import { View } from 'react-native';

import { SleepSettings, SoundSettings } from '../../../components/PlayerSettings';
import { SettingsPage } from '../../../components/settings/rows';
import { CARD_GAP } from '../../../lib/theme/measures';

/**
 * Speed, pitch, what shapes the sound and the sleep timer: Settings → Sound.
 * The same parts as the player's own card of its settings (`PlayerPanel`),
 * one under the other.
 */
export default function PlaybackScreen() {
  return (
    <SettingsPage>
      <View style={GROUPS}>
        <SoundSettings />
        <SleepSettings />
      </View>
    </SettingsPage>
  );
}

const GROUPS = { gap: CARD_GAP };
