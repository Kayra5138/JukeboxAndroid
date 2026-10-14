import { StyleSheet, Switch, Text, View } from 'react-native';

import { useT } from '../lib/i18n/index';
import { makeStyles, switchColours, useColours } from '../lib/theme/index';
import { setHeartWanted, useHeartWanted } from '../lib/ui/heartWanted';

/** The last row of the player's settings: whether the player has its heart. See `Heart.tsx`. */
export function HeartSetting() {
  const wanted = useHeartWanted();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <Text style={styles.title}>{t.settings.heart.title}</Text>
        <Switch
          value={wanted}
          accessibilityLabel={t.settings.heart.title}
          onValueChange={setHeartWanted}
          {...switchColours(c, wanted)}
        />
      </View>
      <Text style={styles.muted}>{t.settings.heart.note}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },
    title: { color: c.text, fontSize: 15.5, flexShrink: 1 },
    muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  })
);
