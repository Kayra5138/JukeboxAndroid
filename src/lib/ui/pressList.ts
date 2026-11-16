import { createStore } from './store.ts';

/**
 * A menu that comes up as a list under a finger held on a button: slid down
 * to a row and let go of, with the finger never lifted, for what is too many
 * to be slices of a ring (`pressMenu.ts`) -- the lists a shuffle can play, of
 * which somebody may have forty.
 *
 * It opens beside the finger, below it where there is room and above where
 * there is not, as wide as a finger can take in a sweep. What is chosen is the
 * row the finger is level with, a little either side of the list as well. A
 * list longer than the screen has room for moves under a finger held near its
 * top or bottom, faster the nearer. The rows at its foot that are not choices
 * of the same kind (`apart`) stay where they are under the rest as it moves,
 * always to be reached.
 *
 * Let go without having moved, it stays, to be chosen from with a tap or put
 * away with Back or a tap beside it. Let go anywhere else, away from it, it is
 * called off.
 */

/** How tall a row is: two lines, a name and how many songs. */
export const LIST_ROW = 56;

/** Over the rows, the name of the menu. */
export const LIST_HEADER = 44;

/** How wide the menu is, at most. */
export const LIST_WIDTH = 300;

/** How far from the sides and ends of the screen it is kept. */
const MARGIN = 10;

/** How far from the finger it opens, so that the finger does not cover its first row. */
const GAP = 14;

/** How far either side of the list a finger still chooses the row it is level with. */
const REACH = 36;

/** Within this of the top or bottom of the rows on show, a held finger moves them. */
export const SCROLL_EDGE = 56;

/** The most the rows move in a frame, a finger at the very edge. */
const SCROLL_FASTEST = 14;

/** One row: what it is called, a line under it, whether it is the one chosen for good; `apart` for one at the foot that is not a choice of the same kind, and does not move with the rest. */
export type PressListRow = { key: string; label: string; detail?: string; checked?: boolean; apart?: boolean };

/** The menu that is up. */
export type PressListMenu = {
  /** Its top left corner on the screen, and the height it has there. */
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  rows: readonly PressListRow[];
  /** The row the finger is on, by place. */
  chosen: number | null;
  /** How far the rows have been moved up, a list longer than its room. */
  scroll: number;
  /** Let go of without a move, and staying to be tapped. */
  staying: boolean;
  /** What a row chosen does: when let go of on it, or tapped. */
  choose: (key: string) => void;
};

/** Held here for the one layer over the whole app that draws it. */
export const pressList = createStore<PressListMenu | null>(null);

/** How many of [rows], at their end, are kept at the foot. */
export function footOf(rows: readonly PressListRow[]): number {
  let foot = 0;
  while (foot < rows.length && rows[rows.length - 1 - foot]!.apart) foot += 1;
  return foot;
}

/** How tall the whole of a menu of [rows] would be. */
export function wholeHeight(rows: number): number {
  return LIST_HEADER + rows * LIST_ROW;
}

/**
 * Where a menu of [rows] goes for a finger at ([x], [y]) on a screen of
 * [width] and [height], with [top] and [bottom] taken by the phone's bars:
 * below the finger where the whole of it fits or there is more room than
 * above, above it otherwise, and no taller than the room on that side.
 */
export function listPlace(
  x: number,
  y: number,
  rows: number,
  screen: { width: number; height: number; top: number; bottom: number }
): { x: number; y: number; width: number; height: number } {
  const width = Math.min(LIST_WIDTH, screen.width - MARGIN * 2);
  const left = Math.min(Math.max(x - width / 2, MARGIN), screen.width - width - MARGIN);
  const whole = wholeHeight(rows);
  const below = screen.height - screen.bottom - MARGIN - (y + GAP);
  const above = y - GAP - (screen.top + MARGIN);
  if (whole <= below || below >= above) return { x: left, y: y + GAP, width, height: Math.min(whole, Math.max(below, 0)) };
  const height = Math.min(whole, Math.max(above, 0));
  return { x: left, y: y - GAP - height, width, height };
}

/** The row a finger at ([x], [y]) is level with, or null: beside the list, on its name, or past its ends. */
export function rowAt(x: number, y: number, menu: Pick<PressListMenu, 'x' | 'y' | 'width' | 'height' | 'rows' | 'scroll'>): number | null {
  if (x < menu.x - REACH || x > menu.x + menu.width + REACH) return null;
  const inRows = y - menu.y - LIST_HEADER;
  if (inRows < 0 || y > menu.y + menu.height) return null;
  const foot = footOf(menu.rows);
  const moving = menu.rows.length - foot;
  // On a row kept at the foot.
  const footTop = menu.y + menu.height - foot * LIST_ROW;
  if (y >= footTop) return moving + Math.min(foot - 1, Math.floor((y - footTop) / LIST_ROW));
  const place = Math.floor((inRows + menu.scroll) / LIST_ROW);
  return place >= 0 && place < moving ? place : null;
}

/** How far the rows go up (or, less than nought, down) in a frame, for a finger held at [y], and as far as there is more of them. The rows kept at the foot are not among them, so the most is as it would be with them. */
export function scrollStep(y: number, menu: Pick<PressListMenu, 'y' | 'height' | 'rows' | 'scroll'>): number {
  const most = Math.max(0, wholeHeight(menu.rows.length) - menu.height);
  if (most === 0) return 0;
  const top = menu.y + LIST_HEADER;
  // Above the rows kept at the foot, which a finger is held on to choose and not to move the rest;
  // with none, below the list as well, fastest.
  const foot = footOf(menu.rows);
  const bottom = menu.y + menu.height - foot * LIST_ROW;
  let step = 0;
  if (y > bottom - SCROLL_EDGE && (foot === 0 || y < bottom)) step = SCROLL_FASTEST * Math.min(1, (y - (bottom - SCROLL_EDGE)) / SCROLL_EDGE);
  else if (y < top + SCROLL_EDGE && y > menu.y - SCROLL_EDGE) step = -SCROLL_FASTEST * Math.min(1, (top + SCROLL_EDGE - y) / SCROLL_EDGE);
  // Nought and not minus nought, at the top with a finger near it.
  return Math.max(-menu.scroll, Math.min(most - menu.scroll, step)) || 0;
}
