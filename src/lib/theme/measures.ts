/**
 * The app's measures: how big writing is, how round corners are, how far
 * apart things stand. Chosen once, with Kayra, on 19 November 2026 (Balanced
 * type, Soft corners, Dense spacing, a 46 cover in a row), and taken from
 * here by every building block rather than written out as a number in each:
 * see CLAUDE.md §3–4.
 *
 * Colours are the theme's (`tokens.ts`); these are the same in every theme.
 */

/** Sizes of writing, by what it is for. Six, where there were ten body sizes and seven titles. */
export const TYPE = {
  /** A section's small capitals over a card. */
  label: 11,
  /** A line under a card, a hint, a note after something was done. */
  hint: 12.5,
  /** The line under a title: an artist, an explanation, a value beside a row. */
  small: 13,
  /** A row's name, a button's word: what is read. */
  body: 15.5,
  /** A dialog's or a card's own heading. */
  heading: 16,
  /** The name at the head of a record, a list, a show or a book (`MediaHead`). */
  head: 22,
  /** A page's or a tab's title. */
  title: 24,
} as const;

/** The line height that goes with each size where lines can wrap. */
export const LEADING = {
  hint: 18,
  small: 18,
  body: 21,
} as const;

/** How round corners are. Four, where there were eleven. */
export const RADIUS = {
  /** A tick box. */
  check: 5,
  /** A button, a field, a cover in a row. */
  control: 10,
  /** A card, a dialog. */
  card: 14,
  /** A chip, a pill, a round button. */
  pill: 999,
  /** A cover in a row of a list. */
  cover: 6,
} as const;

/** Steps of space, the only ones used between and inside things. */
export const SPACE = {
  /** Between the lines of one thing: a title and the line under it. */
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  /** Between two cards, always: they never touch (CLAUDE.md §6). */
  xl: 24,
} as const;

/** A row of a card or a list: its padding, top and bottom and at the sides. */
export const ROW = { vertical: 12, horizontal: 14 } as const;

/**
 * A page's own margins: at the sides, above its first card, and under its
 * last, past whatever keeps it clear of the bars along the foot. The last is
 * generous on purpose (32, and 72 more), so that the last row can always be
 * scrolled up into the open, whatever the bars measure and however the page
 * was opened. See `usePageRoom`.
 */
export const PAGE = { side: 16, top: 16, bottom: 32 + 72 } as const;

/** The space between two cards, and between a card and the heading of the next. */
export const CARD_GAP = SPACE.xl;

/** A tick box or a round choice: one size wherever it is. */
export const CHECK = 20;

/** A mark on a button, or beside a word: play, pause, shuffle. */
export const ICON = 20;

/** The same beside a word on a small button, or in a close line: Continue, Pause. */
export const ICON_SMALL = 14;

/**
 * The height of a thing to be pressed: a finger's, and a smaller one in a row or a card's corner; and the width of
 * each of the marks pressed at the end of a row (`RowControl`), side by side, the rest of a finger given round them.
 */
export const TOUCH = { normal: 44, small: 36, row: 32 } as const;

/** The cover at the head of a record, a list, a show or a book: one size for all of them (19 November 2026). */
export const HEAD_COVER = 96;

/** The cover in a row of a list: one size for every list. */
export const ROW_COVER = 46;

/** And in a close-set row, where many are to be seen at once: the queue, a picker (19 November 2026). */
export const ROW_COVER_COMPACT = 36;

/** How faint something switched off is. */
export const DISABLED = 0.35;

/**
 * How far the edge of something that scrolls fades out where there is more of it past that edge: the column down
 * the left of a page held sideways, which does not otherwise look as if it moves (20 November 2026).
 */
export const FADE_EDGE = 48;

/** How thick a bar of how far something has got is: a download, a list being made, a part of a book (`ProgressBar`). */
export const PROGRESS = 3;

/** The column of times down a list of points in something long: its marks, its chapters (`TimedRow`). */
export const TIME_COLUMN = 56;
