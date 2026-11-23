import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles } from '../lib/theme/index';
import { PROGRESS } from '../lib/theme/measures';

/**
 * How far something has got, [value] from nought to one, as a thin line
 * filling in the accent: a download, a list being made, the library being
 * read, a part of a book listened to. Each drew its own, in three
 * thicknesses, two colours of track and two of fill.
 */
export function ProgressBar({ value, style }: { value: number; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const share = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);
  return (
    <View style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    track: { height: PROGRESS, borderRadius: PROGRESS, backgroundColor: c.borderStrong, overflow: 'hidden' },
    fill: { height: PROGRESS, backgroundColor: c.accent },
  })
);
