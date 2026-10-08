import { Easing } from 'react-native-reanimated';

import { LANES } from '../../lib/tiles/game';

/*
  The board is drawn by a fixed set of views that notes are lent as they come
  into sight and give back when they are done with. A chart of five thousand
  notes therefore costs what a chart of forty does, because the number of views
  is the number on screen rather than the number in the song.

  Ten, and the figure matters. Every view in the pool costs a style worked out
  and a property written on the other thread sixty times a second whether or
  not anything is lent to it, so the pool is a per-frame bill paid in full
  regardless of how much of it is used. A board two and a half tiles tall holds
  about four at once; this is that with room to spare, and not the two dozen it
  was when tiles were a fraction of the size.
*/
/*
  Lent per column rather than from one shared heap, which is what lets a key be
  a fixed colour. A slot that could show any column has to be told its colour
  every frame, and a colour is not a number that can be animated; a slot that
  belongs to one column knows its own and never changes it.

  Four apiece. A board under three tiles tall can show two in a column at once,
  and a struck one lingers while it falls out, so this is that with room over.
*/
export const PER_LANE = 4;
export const POOL = LANES * PER_LANE;
export const POOL_SLOTS = Array.from({ length: POOL }, (_, index) => index);

/*
  Each tile is told eight numbers a frame, laid end to end in one array. Not
  where it is across the board -- a slot belongs to one column for the whole of
  a run, so its left edge is settled when it is built and never mentioned
  again.
*/
export const FIELDS = 8;
export const F_Y = 0;
export const F_TAIL = 1;
export const F_ON = 2;
/** 1 while a key is waiting, less once it has been struck. */
export const F_LIT = 3;
/** How much of a held key has been kept down, nought to one. */
export const F_FILL = 4;
/** 1 while a finger is actually on it, which is when the gauge is bright. */
export const F_GLOW = 5;
/** 1 at the instant a key is struck, falling to nought as the light goes out. */
export const F_FLASH = 6;
/** 1 at the instant a held key is kept to the end, falling to nought after it. */
export const F_KEPT = 7;

/**
 * How long the light from a struck key lasts.
 *
 * Long enough to be seen as something happening and short enough that four in
 * a bar do not run into one another. The flash is the only part of this screen
 * that exists purely to be enjoyed; everything else on it is telling the
 * player something.
 */
export const FLASH_MS = 320;

/**
 * How long a kept hold goes on glowing.
 *
 * Longer than the light off a tap, because it is the end of something that
 * took a second or more of a finger held still, and a reward the length of a
 * blink would be over before the hand had come off the glass to see it.
 */
export const KEPT_MS = 520;

/**
 * How many keys in a row buy a life back.
 *
 * Far enough that it is a stretch of real playing rather than a few lucky
 * taps, and near enough to be worth reaching for once a life has gone. A life
 * is only ever given back when one is missing -- it buys nothing at full
 * strength, so there is no hoarding and the count simply starts again.
 */
export const CLEAN_FOR_A_LIFE = 50;

/**
 * How bright a key is once it has been struck.
 *
 * It is not taken off the board: it goes on falling, dimmed, and leaves at the
 * bottom with everything else. Blinking out at the moment of the press reads
 * as the tile never having been there, which is indistinguishable from a tap
 * that did nothing — and taking it away also takes away the one piece of
 * evidence that the press landed.
 */
export const SPENT_INK = 0.28;

/**
 * The height the tail is drawn at before it is stretched.
 *
 * Scaling a one-point bar to three hundred magnifies every rounding error in
 * its edges by the same three hundred, which is seen as the bar shimmering
 * while a key is held. A base near the size it will actually be asked for
 * keeps the factor close to one.
 */
export const TAIL_BASE = 240;

/**
 * The height the whole key is drawn at before it is stretched to its length.
 *
 * Near the size of an ordinary key, so a tap is drawn at about life size and
 * even the longest hold is only stretched a few times -- a bar scaled by ten
 * magnifies every rounding error in its edges by ten with it.
 */
export const BODY_BASE = 320;

/**
 * The gauge drawn along a held key, and the room left at each end of it.
 *
 * The gap is in points and the same at both ends, which is the whole reason
 * this is not drawn inside the tail. The tail is only the part of a hold above
 * the key, so a gauge living in it stopped where the key began and left the
 * key's whole height bare underneath -- far more room below than above, and
 * neither of them a margin anybody chose. Laid over the tile instead, it spans
 * the hold and the key together and can be inset equally.
 */
export const GAUGE_BASE = 900;
export const GAUGE_GAP = 30;

/**
 * How tall a tile's own frame is.
 *
 * Bigger than any screen on purpose. The frame hangs above the bottom with the
 * key at its foot, so a tail has somewhere to grow into without the view being
 * resized — and resizing is the one thing that would drag layout back into a
 * loop that is otherwise nothing but transforms.
 */
export const BOX = 1600;

/**
 * How long a gap between frames has to be before the app is taken as having
 * been away rather than as having run a frame slowly.
 *
 * Nothing is carried across such a gap: the record played on without anybody
 * watching, and guessing over it would land the board a minute out.
 */
export const AWAY_MS = 400;

/**
 * How far out the clock may be before it is set rather than caught up with.
 *
 * Under this the disagreement is ordinary and gets absorbed by running at a
 * slightly different speed; see [CATCH_MS]. Over it the record is somewhere
 * else entirely and the board goes there at once, because there is no speed
 * that would reach the right place soon enough to be worth it.
 *
 * It does NOT end the run. That it used to is the whole of why the game was
 * unplayable: the player is read four times a second and guessed at between,
 * and a guess that misses by a quarter of a second is ordinary. Treating that
 * as somebody seeking the record away ended every run on the first note.
 */
export const RESYNC_MS = 400;

/**
 * How a disagreement under that is settled: by running at a slightly different
 * speed until it is gone, never by moving the board.
 *
 * It used to be moved -- a fifth of the error applied to the position, four
 * times a second. That is a jump, and at the opening of a song it is a visible
 * one in both directions: the player's reported position is erratic for a
 * second or two after a seek while the renderer starts, so the corrections
 * disagree with each other and the board was seen stepping forwards and back
 * between about the third key and the seventh.
 *
 * Changing the rate cannot do that. The board stays a continuous function of
 * time -- it only ever runs a little fast or a little slow -- and since the
 * drift is bounded well inside unity it can never run backwards at all, which
 * is the half of the fault that was most obvious.
 *
 * Five percent is far below what the eye reads as a change of speed on a
 * falling object, and settles a tenth of a second of error in two seconds.
 */
export const CATCH_MS = 500;
export const MAX_DRIFT = 0.05;

export const BACK = '#0b0d12';
export const DIM = 'rgba(255,255,255,0.08)';
export const TEXT = '#f4f6fb';
export const MUTED = 'rgba(244,246,251,0.55)';
export const FALLBACK_KEY = '#6f7cff';

/*
  The two colours a life changes hands in, and how far they are ever allowed
  to come up.

  The first version went to full opacity in a seventieth of a second, which is
  a flashbulb rather than a warning: the whole board jumped, and the thing a
  player was actually doing -- reading keys that are still falling -- got
  harder at exactly the moment it mattered. Now it barely rises at all, and
  takes long enough getting there that the eye reads it as the board colouring
  rather than as something striking it.

  Dim enough that it has to be described as a tint. That is the point: it is
  peripheral vision's job, and peripheral vision does not need much.
*/
export const HURT = '#5c1020';
export const HEAL = '#0f4a37';

/** How far up the wash ever comes. Nowhere near all the way. */
export const HURT_PEAK = 0.26;
export const HEAL_PEAK = 0.2;

/*
  And how slowly. A rise shorter than the time it takes to notice something is
  seen as a flicker; these are long enough to be seen arriving and leaving,
  which is what makes them soft rather than merely faint.
*/
export const WASH_IN_MS = 180;
export const WASH_OUT_MS = 520;

/*
  How a run that has ended is left on the board.

  It used to be wiped. The moment the last life went, every key vanished and a
  page of figures was put where they had been, so the one thing a player wants
  to know just then -- what happened -- was the first thing taken away. Now the
  board stops and stays, and the page comes up over it.

  Which of the two endings it was is kept where the board can read it, because
  the board is drawn on the other thread and has to know in the same frame the
  run ends, not a render later.
*/
export const END_NONE = 0;
export const END_LOST = 1;
export const END_WON = 2;

/**
 * How long the board takes to come back to the key that was let past.
 *
 * A key is only lost once it has left the bottom, so at the moment it is lost
 * it is the one key that cannot be seen. The board is run back by the height
 * of it and set down with the key standing at the foot of its column. Long
 * enough to be seen as the board being brought back rather than as a jump,
 * short enough to be over before the page starts to arrive.
 */
export const SETTLE_MS = 520;
export const SETTLE = Easing.out(Easing.cubic);

/**
 * How far behind the sweep a stopped board looks for keys to draw.
 *
 * A running board draws from the oldest key still in sight. One that has been
 * run back has keys in sight again that the sweep had already left behind, and
 * this is how many of those it is prepared to find: a board's worth of rows,
 * doubled, with the longest hold on top.
 */
export const BEHIND = 24;

/** The colour the move that ended the run is shown in. */
export const BLAME = '#ff3b52';

/*
  When the page at the end arrives, and how slowly.

  After a loss it waits: the board has to come back, and the key or the tap
  that did it has to be looked at, before anything is laid over the top. After
  a run that reached the end there is nothing to study, so it comes sooner.
*/
export const LOST_WAIT_MS = 950;
export const WON_WAIT_MS = 400;
export const RISE_MS = 650;

export const CONFETTI_PIECES = 72;

/**
 * How long after everything has been stopped the screen is left.
 *
 * A few frames at any refresh rate: long enough for the other thread to have
 * finished the frame it was in when it was told to stop, short enough that
 * nobody pressing Back feels a wait.
 */
export const LEAVE_AFTER_MS = 80;

/*
  The veil the page at the end is read through. Dark enough for figures and no
  darker, because what is behind it is the reason it is a veil; and thinner at
  whichever end the move that ended the run is at.
*/
export const VEIL = ['rgba(11,13,18,0.6)', 'rgba(11,13,18,0.6)', 'rgba(11,13,18,0.6)'] as const;
export const VEIL_OFF_FOOT = ['rgba(11,13,18,0.64)', 'rgba(11,13,18,0.6)', 'rgba(11,13,18,0.22)'] as const;
export const VEIL_OFF_HEAD = ['rgba(11,13,18,0.22)', 'rgba(11,13,18,0.6)', 'rgba(11,13,18,0.64)'] as const;

export type Phase = 'setup' | 'starting' | 'playing' | 'paused' | 'over';
/** How a run ended: a key let past, a tap on nothing, the end of the record, or cut short. */
export type End = 'lapse' | 'empty' | 'won' | 'stopped';
/** The end of the board that holds the move worth seeing. */
export type Keep = 'head' | 'foot' | null;
export type Loading = 'idle' | 'making' | 'ready' | 'missing';
