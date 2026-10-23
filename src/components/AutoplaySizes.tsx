import { StyleSheet, Text, View } from 'react-native';

import { Segmented } from './Segmented';
import { useT } from '../lib/i18n/index';
import { SIZE_CHOICES } from '../lib/player/autoplay/plan';
import { setAutoplaySizes, useAutoplaySizes } from '../lib/player/autoplay/setting';
import { makeStyles } from '../lib/theme/index';

/**
 * A row of the player's settings: how many similar songs are picked at a
 * time, from the library and from Discover. For the end of any queue and for
 * a queue begun as similar songs alike, so it stands under both choices.
 *
 * The numbers themselves, as the jump buttons' are: a few that anybody would
 * want, readable at a glance.
 */
export function AutoplaySizes() {
  const t = useT();
  const styles = useStyles();
  const sizes = useAutoplaySizes();
  const said = t.settings.autoplaySizes;
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{said.title}</Text>
      <View style={styles.line}>
        <Text style={styles.label}>{said.library}</Text>
        <Segmented
          role="button"
          variant="chips"
          size="compact"
          options={SIZE_CHOICES.library.map((count) => ({ value: count, label: String(count) }))}
          value={sizes.library}
          onChange={(library) => setAutoplaySizes({ ...sizes, library })}
        />
      </View>
      <View style={styles.line}>
        <Text style={styles.label}>{said.fresh}</Text>
        <Segmented
          role="button"
          variant="chips"
          size="compact"
          options={SIZE_CHOICES.fresh.map((count) => ({ value: count, label: String(count) }))}
          value={sizes.fresh}
          onChange={(fresh) => setAutoplaySizes({ ...sizes, fresh })}
        />
      </View>
      <Text style={styles.muted}>{said.note}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },
    title: { color: c.text, fontSize: 15.5 },
    label: { color: c.textSecondary, fontSize: 14, flexShrink: 1 },
    muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  })
);
