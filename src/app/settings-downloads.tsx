import { View } from 'react-native';

import { DownloadsSettings } from '../components/downloads/SettingsRows';
import { SettingsPage, useRows } from '../components/settings/rows';

/**
 * What the app fetches: the downloads and the button that floats over them,
 * and Discover, whose songs are fetched the same way.
 *
 * The rows are a component of their own, because the first of them says how
 * the queue stands and so is drawn again as often as the queue is read.
 */
export default function DownloadsSettingsScreen() {
  const styles = useRows();
  return (
    <SettingsPage>
      <View style={styles.card}>
        <DownloadsSettings />
      </View>
    </SettingsPage>
  );
}
