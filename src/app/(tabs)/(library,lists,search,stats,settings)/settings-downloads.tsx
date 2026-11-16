import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DownloadsSettings } from '../../../components/downloads/SettingsRows';
import { NumberStepper } from '../../../components/NumberStepper';
import { SettingsPage, useRows } from '../../../components/settings/rows';
import { useT } from '../../../lib/i18n/index';
import { listenDays, LISTEN_DAYS_RANGE, setListenDays } from '../../../lib/listen/index';

/**
 * What the app fetches: the downloads and the button that floats over them,
 * and Discover, whose songs are fetched the same way; and how long a song
 * listened to from the Search tab and not kept stays (see `lib/listen`).
 *
 * The rows are a component of their own, because the first of them says how
 * the queue stands and so is drawn again as often as the queue is read.
 */
export default function DownloadsSettingsScreen() {
  const styles = useRows();
  const t = useT();
  const said = t.settings.downloads.listen;
  const [days, setDays] = useState(() => listenDays());
  return (
    <SettingsPage>
      <View style={styles.card}>
        <DownloadsSettings />
      </View>
      <View style={[styles.card, apart.card]}>
        <View style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{said.title}</Text>
            <NumberStepper
              name={said.title}
              range={LISTEN_DAYS_RANGE}
              value={days}
              label={said.days}
              onChange={(value) => {
                setListenDays(value);
                setDays(value);
              }}
            />
          </View>
          <Text style={styles.muted}>{said.note}</Text>
        </View>
      </View>
    </SettingsPage>
  );
}

const apart = StyleSheet.create({
  // A card of its own under the downloads', set off from it as cards are on every settings page.
  card: { marginTop: 16 },
});
