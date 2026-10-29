/** The sizes the row of buttons under the controls may be drawn at, roomiest first. */
const OPTION_STEPS: readonly { size: number; gap: number }[] = [
  { size: 44, gap: 8 },
  { size: 44, gap: 4 },
  { size: 44, gap: 0 },
  { size: 40, gap: 0 },
  { size: 36, gap: 0 },
];

/**
 * How the row of buttons under the controls is laid out in [width]: the
 * roomiest of `OPTION_STEPS` that puts all [count] in one line, the icon
 * shrunk with the button; and only where even the smallest will not do, two
 * lines of the same length, or as near as an odd count allows. Nought width
 * is a row not yet laid out, and is drawn as it always was.
 */
export function optionsFit(width: number, count: number, icon: number): { size: number; gap: number; icon: number; rows: 1 | 2 } {
  if (width <= 0) return { size: 44, gap: 8, icon, rows: 1 };
  for (const step of OPTION_STEPS) {
    if (count * step.size + (count - 1) * step.gap <= width) {
      return { ...step, icon: step.size >= 44 ? icon : Math.round(icon * (step.size / 44)), rows: 1 };
    }
  }
  const smallest = OPTION_STEPS[OPTION_STEPS.length - 1]!;
  return { ...smallest, gap: 4, icon: Math.round(icon * (smallest.size / 44)), rows: 2 };
}

/**
 * The next way to draw the transport, given that drawn with gaps of [gap]
 * at [scale] it takes [taken] of the [room] it has: as it is where it fits;
 * otherwise its four gaps closed by as much as it is over; and once they are
 * closed, everything smaller in proportion, down to six tenths. Asked again
 * after each redraw until it fits. Nought room is a row not yet measured.
 */
export function transportFit(room: number, taken: number, gap: number, scale: number): { gap: number; scale: number } {
  if (room <= 0 || taken <= room) return { gap, scale };
  const over = taken - room;
  if (gap > 0) return { gap: Math.max(0, Math.floor(gap - over / 4)), scale };
  return { gap: 0, scale: Math.max(0.6, Math.floor(scale * (room / taken) * 100) / 100) };
}
