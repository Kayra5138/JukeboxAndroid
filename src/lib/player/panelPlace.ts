import { PAGE, SPACE } from '../theme/measures.ts';

/** A rectangle in the player, from its top left corner. */
export type Box = { x: number; y: number; width: number; height: number };

/** Which part of the player's card of settings is showing (`PlayerPanel`). */
export type PanelTab = 'sound' | 'look' | 'sleep';

/** Where the card over the player goes, and how the player moves for it, worked out by [panelPlace]. */
export type PanelPlace = {
  /** The card itself. */
  card: Box;
  /** How far the player is moved up under it, as a number to move it down by: none, or less than none. */
  shift: number;
  /** What closes the card when touched, the part of the player left in sight where it is only to be looked at. */
  closers: Box[];
};

/**
 * Where the player's card of settings goes, and what of the player is left in
 * sight above it, nothing of it dimmed: the card is as tall as the player
 * leaves room for, and the player moves out of its way rather than the card
 * keeping to whatever room the player happens to leave.
 *
 * For how it sounds and when it stops, the time, its bar and the buttons
 * that play ([band]) are moved up to the top of the screen, and the card is
 * under them, down to the foot: what is changed is heard, and can be stopped
 * and gone back over. For how the player looks, the cover ([art]) stays
 * where it is, to be watched as it changes, and the card takes everything
 * under it; touched, the cover closes the card rather than doing what it
 * does in the player, which is out of sight. On its side, the card takes
 * the column of the list ([side]) for every tab, the cover and the buttons
 * beside it, where they are.
 *
 * [top] and [bottom] are what the phone's own bars take of the screen;
 * [band] and [art] are where they are with the player not moved.
 */
export function panelPlace({
  width,
  height,
  top,
  bottom,
  band,
  art,
  side,
  tab,
}: {
  width: number;
  height: number;
  top: number;
  bottom: number;
  band: Box;
  art: Box;
  side: Box | null;
  tab: PanelTab;
}): PanelPlace {
  const foot = height - bottom - PAGE.side;
  if (side) {
    // The list's column, short of the phone's bars, and clear of the line down its edge.
    const card = { x: side.x + PAGE.side, y: top + PAGE.side, width: side.width - 2 * PAGE.side, height: foot - top - PAGE.side };
    return { card: held(card), shift: 0, closers: [] };
  }
  if (tab === 'look') {
    const y = art.y + art.height + SPACE.m;
    return {
      card: held({ x: PAGE.side, y, width: width - 2 * PAGE.side, height: foot - y }),
      shift: 0,
      closers: [{ x: 0, y: 0, width, height: y }],
    };
  }
  const shift = Math.min(0, top + PAGE.side - band.y);
  const y = band.y + shift + band.height + SPACE.m;
  return { card: held({ x: PAGE.side, y, width: width - 2 * PAGE.side, height: foot - y }), shift, closers: [] };
}

/** Never less than nothing, should the player be laid out too tight for a card. */
function held(box: Box): Box {
  return { ...box, width: Math.max(0, box.width), height: Math.max(0, box.height) };
}
