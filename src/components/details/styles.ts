import { StyleSheet } from 'react-native';

import { makeStyles } from '../../lib/theme/index';
import { LEADING, SPACE, TYPE } from '../../lib/theme/measures';

/** What the three tabs of the details screen have in common, so they look like one screen. */
export const useShared = makeStyles((c) => StyleSheet.create({
  content: { padding: 20, paddingBottom: 48, gap: SPACE.m },
  /*
    The small words are drawn a step darker and a weight heavier than the
    faintest level, and no smaller than the app's hint: at 11 and 12 in the
    faintest grey they were hard to read over a theme of glass, whose page is
    a coloured sky and not a flat ground.
  */
  section: {
    color: c.textMuted,
    fontSize: TYPE.label,
    fontWeight: '600',
    letterSpacing: 0.8,
    paddingTop: SPACE.l,
  },
  field: { gap: 6 },
  label: { color: c.textSecondary, fontSize: TYPE.label, fontWeight: '600', letterSpacing: 0.8 },
  hint: { color: c.textMuted, fontSize: TYPE.small, lineHeight: LEADING.small },
  note: { color: c.success, fontSize: TYPE.small, lineHeight: LEADING.small },
  noteBad: { color: c.warning, fontSize: TYPE.small, lineHeight: LEADING.small },
  complaint: { color: c.warning, fontSize: TYPE.small },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
}));
