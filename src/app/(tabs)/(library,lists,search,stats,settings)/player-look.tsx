import { View } from 'react-native';

import { CoverLookSettings } from '../../../components/CoverLookSettings';
import { SettingsPage, useRows } from '../../../components/settings/rows';

/**
 * How the player looks: what stands where the cover is, for songs and for
 * tapes, what moves with the music round it, and a knock on the beat.
 * Opened from Settings → Look & feel, under the theme.
 */
export default function PlayerLookScreen() {
  const styles = useRows();
  return (
    <SettingsPage>
      <View style={styles.card}>
        <CoverLookSettings />
      </View>
    </SettingsPage>
  );
}
