import { Linking, StyleSheet, Switch, Text, View } from 'react-native';

import { Pressable } from '../Pressable';
import { useRows } from '../settings/rows';
import { useT } from '../../lib/i18n/index';
import { setUpdateCheckWanted, useUpdateCheckWanted, useUpdateOffer } from '../../lib/support/updateStore';
import { makeStyles, switchColours, useColours, usePressed } from '../../lib/theme/index';

/**
 * The row at the top of the Settings tab that says a newer Jukebox is out,
 * and nothing at all while there is none.
 *
 * Under the version line, because that is the number it is news about. It
 * opens the release's page and does nothing else: the app does not install
 * itself, and somebody who installed it through Obtainium is told there.
 */
export function UpdateRow() {
  const offer = useUpdateOffer();
  const t = useT();
  const rows = useRows();
  const styles = useStyles();
  const pressed = usePressed();
  if (!offer) return null;
  return (
    <View style={[rows.card, styles.card]}>
      <Pressable
        android_ripple={pressed}
        accessibilityRole="link"
        accessibilityHint={t.support.update.hint}
        style={rows.row}
        onPress={() => void Linking.openURL(offer.url).catch(() => {})}>
        <View style={rows.line}>
          <View style={styles.named}>
            <View style={styles.dot} importantForAccessibility="no" />
            <Text style={rows.title}>{t.support.update.available(offer.version)}</Text>
          </View>
          <Text style={rows.chevron} importantForAccessibility="no">›</Text>
        </View>
        <Text style={rows.muted}>{t.support.update.note}</Text>
      </Pressable>
    </View>
  );
}

/**
 * The switch for the look itself, on the page of Your data under a heading
 * of its own, worded and placed as the one for yt-dlp is on the page of
 * downloads: what it asks of whom, how often, and that nothing else goes.
 */
export function UpdateCheckSetting() {
  const wanted = useUpdateCheckWanted();
  const t = useT();
  const c = useColours();
  const rows = useRows();
  const styles = useStyles();
  const said = t.support.update;
  return (
    <View style={styles.section}>
      <Text style={rows.section}>{t.format.upper(said.heading)}</Text>
      <View style={rows.card}>
        <View style={rows.row}>
          <View style={rows.line}>
            <Text style={rows.title}>{said.check.title}</Text>
            <Switch
              value={wanted}
              accessibilityLabel={said.check.title}
              onValueChange={setUpdateCheckWanted}
              {...switchColours(c, wanted)}
            />
          </View>
          <Text style={rows.muted}>{said.check.note}</Text>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    // Under the version line, with the room the categories keep from each other.
    card: { marginTop: 16 },
    named: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    // The same mark as on the tab, so that the one is seen to be about the other.
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
    // As far from the card above as ListenBrainz's heading is from its own.
    section: { marginTop: 26 },
  })
);
