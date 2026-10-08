import { StyleSheet } from 'react-native';

import { makeStyles, outlined } from '../../lib/theme/index';

/** What the three tabs of the details screen have in common, so they look like one screen. */
export const useShared = makeStyles((c) => StyleSheet.create({
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  section: {
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
    paddingTop: 18,
  },
  field: { gap: 6 },
  label: { color: c.textSecondary, fontSize: 12, letterSpacing: 1 },
  input: {
    backgroundColor: c.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    color: c.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...outlined(c),
  },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 18 },
  note: { color: c.success, fontSize: 13 },
  noteBad: { color: c.warning, fontSize: 13 },
  complaint: { color: c.warning, fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 44,
  },
  actionWide: { flex: 1 },
  actionOff: { opacity: 0.35 },
  actionLabel: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  button: {
    backgroundColor: c.surfaceRaised,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
    ...outlined(c),
  },
  buttonLabel: { color: c.text, fontSize: 14 },
  link: { color: c.accent, fontSize: 13.5 },
}));
