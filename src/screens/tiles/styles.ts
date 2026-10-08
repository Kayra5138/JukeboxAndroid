import { StyleSheet } from 'react-native';

import { BACK, BLAME, BODY_BASE, BOX, DIM, GAUGE_BASE, GAUGE_GAP, MUTED, TEXT } from './constants';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BACK },
  board: { flex: 1, overflow: 'hidden' },
  rule: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: DIM },
  /*
    A wash over the picture, heaviest at the bottom.

    The keys arrive at the foot of the screen and that is where they have to be
    read quickest, so that is where the background is asked to be quietest.
  */
  settle: { backgroundColor: 'rgba(8,9,14,0.55)' },

  tile: { position: 'absolute', top: 0, height: BOX },
  body: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BODY_BASE,
    overflow: 'hidden',
    transformOrigin: ['50%', '100%', 0],
  },
  /*
    The gauge, and the room around it.

    Inset as a share rather than in points, because the bar it sits in is
    stretched: a margin given in points would be multiplied by however many
    rows long the hold is, and come out ten times bigger on a long one than on
    a short one.
  */
  gauge: {
    position: 'absolute',
    left: '40%',
    width: '20%',
    bottom: GAUGE_GAP,
    height: GAUGE_BASE,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.42)',
    overflow: 'hidden',
    transformOrigin: ['50%', '100%', 0],
  },
  gaugeFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    transformOrigin: ['50%', '100%', 0],
  },
  underside: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  spark: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  /*
    Built the way the body is -- one fixed height, stretched from the foot --
    so it covers a hold of any length without layout being asked.
  */
  crown: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BODY_BASE,
    backgroundColor: 'rgba(255,255,255,0.95)',
    transformOrigin: ['50%', '100%', 0],
  },

  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tally: { alignItems: 'flex-start', gap: 6, minWidth: 64 },
  score: { color: TEXT, fontSize: 30, fontWeight: '700' },
  lives: { flexDirection: 'row', gap: 6 },
  life: { width: 11, height: 11, borderRadius: 6, backgroundColor: TEXT },

  /* Across the middle, and thin: it answers how far through, not how fast. */
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    marginTop: 12,
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    borderRadius: 2,
    backgroundColor: TEXT,
    transformOrigin: ['0%', '50%', 0],
  },

  stop: { padding: 10, borderRadius: 999, backgroundColor: DIM, marginTop: 4 },
  /* Kept in the row so nothing beside it moves; only unseen. */
  gone: { opacity: 0 },
  pauseBars: { flexDirection: 'row', gap: 4 },
  pauseBar: { width: 4, height: 15, borderRadius: 1, backgroundColor: TEXT },

  pauseScreen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,13,18,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  pauseTitle: { color: TEXT, fontSize: 26, fontWeight: '700', marginBottom: 8 },
  quiet: { paddingVertical: 12, paddingHorizontal: 20 },
  quietLabel: { color: MUTED, fontSize: 15 },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,13,18,0.96)',
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 18,
  },
  /* The page at the end. Its darkness is the veil drawn inside it. */
  ending: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  endingBody: { gap: 18 },
  why: { color: TEXT, fontSize: 16, lineHeight: 22, marginTop: -8 },
  lost: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BODY_BASE,
    backgroundColor: BLAME,
    transformOrigin: ['50%', '100%', 0],
  },
  slip: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 3,
    borderColor: BLAME,
    backgroundColor: 'rgba(255,59,82,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slipBar: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: BLAME },
  paper: { position: 'absolute', left: 0, top: 0, borderRadius: 2 },
  title: { color: TEXT, fontSize: 28, fontWeight: '700' },
  leave: { position: 'absolute', left: 20, padding: 8 },
  big: { color: TEXT, fontSize: 64, fontWeight: '800' },
  note: { color: MUTED, fontSize: 15, lineHeight: 21 },
  small: { color: MUTED, fontSize: 13, lineHeight: 18 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: DIM },
  chipOn: { backgroundColor: TEXT },
  chipLabel: { color: TEXT, fontSize: 14 },
  chipLabelOn: { color: BACK, fontWeight: '600' },
  offset: { color: TEXT, fontSize: 15, minWidth: 74, textAlign: 'center' },
  go: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  goOff: { opacity: 0.5 },
  goLabel: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
