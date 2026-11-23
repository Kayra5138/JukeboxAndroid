import { StyleSheet, View } from 'react-native';
import { LEADING, SPACE, TYPE, TOUCH } from '../lib/theme/measures';
import { Text } from './settings/Find';

import { NumberStepper } from './NumberStepper';
import { useT } from '../lib/i18n/index';
import { SIZE_RANGES } from '../lib/player/autoplay/plan';
import { setAutoplaySizes, useAutoplaySizes } from '../lib/player/autoplay/setting';
import { makeStyles } from '../lib/theme/index';

/**
 * A row of the player's settings: how many similar songs are picked at a
 * time, from the library and from Discover. For the end of any queue and for
 * a queue begun as similar songs alike, so it stands under both choices.
 *
 * Any number in a range, one more or one less or typed, as the jump buttons'
 * are: what somebody wants, rather than one of a few offered.
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
        <NumberStepper
          name={said.library}
          range={SIZE_RANGES.library}
          value={sizes.library}
          onChange={(library) => setAutoplaySizes({ ...sizes, library })}
        />
      </View>
      <View style={styles.line}>
        <Text style={styles.label}>{said.fresh}</Text>
        <NumberStepper
          name={said.fresh}
          range={SIZE_RANGES.fresh}
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
    row: { paddingHorizontal: SPACE.l, paddingVertical: SPACE.m, gap: SPACE.s },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.m, minHeight: TOUCH.row },
    title: { color: c.text, fontSize: TYPE.body },
    label: { color: c.textSecondary, fontSize: TYPE.small, flexShrink: 1 },
    muted: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
  })
);
