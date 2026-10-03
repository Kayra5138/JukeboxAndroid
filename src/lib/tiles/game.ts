import type { Chart, ChartNote } from '../../../modules/jukebox-audio';

/**
 * The rules of the game, with nothing about drawing or touching in them.
 *
 * Separated so they can be read and tested without a screen. The version this
 * replaces had its rules spread through a frame callback, a gesture handler and
 * a React effect, and the three disagreed about when a note existed — which is
 * why pressing a tile could make it vanish and count as a miss at the same
 * time. There is one set of rules here and everything else asks it.
 */

export const LANES = 4;

/** How many may be lost before a run is over. */
export const LIVES = 5;

/**
 * How fast the board moves, which is the whole of what difficulty means.
 *
 * Not how many notes there are: thinning a chart takes notes out of bars and
 * leaves something that no longer follows the song. The same chart played
 * faster is harder in the way a song played faster is harder.
 */
export type Speed = {
  id: string;
  name: string;
  /** How long a tile is on the board before it reaches the bottom. */
  onScreenMs: number;
  /**
   * How often two keys arrive together, counted in rows. Nought is never.
   *
   * A count rather than a chance, so the same song gives the same board every
   * time -- a score means nothing against a chart that is dealt afresh on each
   * run.
   */
  doubleEvery: number;
};

export const SPEEDS: Speed[] = [
  { id: 'easy', name: 'Easy', onScreenMs: 1500, doubleEvery: 0 },
  { id: 'normal', name: 'Normal', onScreenMs: 800, doubleEvery: 0 },
  /*
    Quicker than anything below it and the only one that ever asks for two
    fingers. Rarely, and never in neighbouring columns -- two keys side by side
    are one wide key as far as a thumb travelling between them is concerned,
    and the whole of what makes a pair hard is that they are apart.
  */
  { id: 'hard', name: 'Hard', onScreenMs: 600, doubleEvery: 7 },
  /*
    And one past it, for anybody who has run out of Hard.

    Two thirds of Hard's time on the board, which is the step that is felt --
    half of it leaves a key visible for a quarter of a second, which is below
    the time it takes to see one and move, and stops being difficulty and
    starts being a lottery. Pairs come half again as often, because what makes
    this one hard should be the same thing that made Hard hard rather than a
    new rule nobody was warned about.
  */
  { id: 'harder', name: 'Harder', onScreenMs: 400, doubleEvery: 5 },
];

/**
 * The one anybody should meet first, and what an unknown name falls back to.
 *
 * Named rather than counted. The fallback used to be the middle of the list by
 * position, and the position moved the moment a difficulty was dropped -- so a
 * player whose saved choice no longer existed was quietly handed a faster game
 * than the one anybody would choose for a stranger.
 */
export function speedById(id: string | null): Speed {
  return (
    SPEEDS.find((speed) => speed.id === id) ??
    SPEEDS.find((speed) => speed.id === 'easy') ??
    SPEEDS[0]!
  );
}

/**
 * How much of a hold has to be kept before it counts as kept.
 *
 * Short of all of it, because the end of a hold is the least interesting part
 * of it: the key is already won, the finger is already down, and what is left
 * is waiting. Ending it early gives the hand back sooner and makes the gauge
 * fill at a rate somebody can see happening.
 */
export const HOLD_WIN = 0.6;

/** When a held key is won, which is before it is over. */
export function holdWonAt(atMs: number, holdMs: number): number {
  'worklet';
  return atMs + holdMs * HOLD_WIN;
}

/** What a kept hold is worth: a point a row, the key's own included. */
export function holdWorth(holdMs: number, rowMs: number): number {
  'worklet';
  if (rowMs <= 0) return 1;
  return Math.max(1, Math.round(holdMs / rowMs) + 1);
}

/**
 * A note as the game holds it: when, where, how long, and whether it is done.
 *
 * Kept as parallel arrays rather than objects because the frame callback walks
 * them sixty times a second on the UI thread, and an array of numbers is the
 * one shape that costs nothing to cross into a worklet.
 */
export type Run = {
  atMs: Float64Array;
  lane: Int8Array;
  holdMs: Float64Array;
  /** 0 waiting, 1 being held, 2 finished with. */
  state: Int8Array;
  /** When each was finished with, so a struck key can fade rather than vanish. */
  doneAt: Float64Array;
  /**
   * How much of a held key was actually kept down, nought to one.
   *
   * Stored rather than worked out from when it finished, because those two
   * are only the same thing for a hold somebody took. A hold that was never
   * pressed is finished with as well -- it is missed when its key goes past
   * the line -- and reading its ending as progress would draw it on the board
   * as half kept, which is a lie about what the player did.
   */
  fill: Float64Array;
  /**
   * When a finger went down on each held key.
   *
   * A key may be struck anywhere on its way down, which is usually well before
   * the moment it is nominally due. Measuring the hold from that nominal moment
   * meant the gauge sat at nothing for as long as the player was early -- it
   * looked as though pressing had done nothing and the bar only woke up later.
   * Measured from the press, it starts moving under the finger that started it.
   */
  heldFrom: Float64Array;
  /** The earliest note not yet finished with, so the sweep stays short. */
  cursor: number;
  /** Which note each lane is holding, or -1. */
  held: Int32Array;
};

export function runOf(notes: ChartNote[]): Run {
  return {
    atMs: Float64Array.from(notes.map((n) => n.atMs)),
    lane: Int8Array.from(notes.map((n) => n.lane)),
    holdMs: Float64Array.from(notes.map((n) => n.holdMs)),
    state: new Int8Array(notes.length),
    doneAt: new Float64Array(notes.length),
    fill: new Float64Array(notes.length),
    heldFrom: new Float64Array(notes.length),
    cursor: 0,
    held: Int32Array.from([-1, -1, -1, -1]),
  };
}

/**
 * Where a tile is drawn, in pixels down the board.
 *
 * The one piece of geometry in the game. The board draws from it and a finger
 * is tested against it, so the two cannot disagree — and they did, in the
 * version this replaces, which is what made it unplayable in a way that
 * looking at it never explained.
 *
 * `foot` is the bottom edge; `top` is the top of everything that must be
 * touched, which for a held note includes its tail.
 */
export function tileAt(
  atMs: number,
  holdMs: number,
  nowMs: number,
  onScreenMs: number,
  travel: number,
  tall: number
): { foot: number; top: number } {
  'worklet';
  const born = atMs - onScreenMs;
  const foot = ((nowMs - born) / onScreenMs) * travel;
  const tail = (holdMs / onScreenMs) * travel;
  return { foot, top: foot - tall - tail };
}

/** Whether a touch that far down the board is inside that tile. */
export function touching(
  y: number,
  atMs: number,
  holdMs: number,
  nowMs: number,
  onScreenMs: number,
  travel: number,
  tall: number
): boolean {
  'worklet';
  const { foot, top } = tileAt(atMs, holdMs, nowMs, onScreenMs, travel, tall);
  return y <= foot && y >= top;
}

/** Which of the four columns a touch is in. */
export function laneAt(x: number, width: number): number {
  'worklet';
  if (width <= 0) return 0;
  const lane = Math.floor((x / width) * LANES);
  if (lane < 0) return 0;
  if (lane > LANES - 1) return LANES - 1;
  return lane;
}

/**
 * How long after its moment a tile is still on the board.
 *
 * Which is how long a note can still be hit, and when it becomes a miss. A
 * note is missed when its tile has gone past the bottom, and by nothing else —
 * there is no window, no line, and no grade.
 */
export function aliveForMs(tall: number, travel: number, onScreenMs: number): number {
  'worklet';
  if (travel <= 0) return onScreenMs;
  return (tall / travel) * onScreenMs;
}

/*
  The row lengths a song allows, as multiples of its own step.

  The step is half a beat, so the first list is every length that keeps the
  keys on the straight grid: sixteenths and eighths, and whole numbers of
  half-beats above them. The second is what sits between those -- triplets and
  dotted lengths, which still come round to the beat every few rows but lean
  against it on the way.
*/
const ON_THE_GRID = [0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16];
const BETWEEN = [1 / 6, 3 / 16, 1 / 3, 3 / 8, 2 / 3, 3 / 4, 4 / 3, 3 / 2, 5 / 2];

/**
 * How far from what was asked a row on the straight grid may be before one of
 * the lengths in between is taken instead.
 *
 * The straight grid is where the keys sound most like the song, so it is kept
 * whenever it is close enough that nobody could feel the difference in speed.
 * Past that, the difference in speed is the thing being felt, and a leaning
 * rhythm at the right pace is better than a square one at the wrong one.
 */
const GRID_WITHIN = 1.12;

/**
 * How long a row is, for a difficulty that asks for [wantedMs] on a song whose
 * grid is [stepMs].
 *
 * A row is both things at once -- how often a key arrives and, because every
 * key is the same height, how fast the board moves -- so it is the whole of how
 * hard a difficulty is, and it has to come out much the same on every song or
 * the names mean nothing. It did not. A row was the nearest *whole* number of
 * steps to what was asked and never less than one, which follows the song
 * faithfully and the difficulty hardly at all: a slow ballad whose step was
 * longer than the row being asked for got the step, two and a half times too
 * slow, and a song whose step fell just short of one and a half rows got a row
 * a third too quick. Same word on the button, a different game underneath.
 *
 * Now the row is the length nearest to what was asked out of everything the
 * song's grid divides into, which is never more than about a sixth off. The
 * keys still land on the music; they are no longer allowed to wander from the
 * pace to do it.
 */
export function rowFor(wantedMs: number, stepMs: number, barSteps = 0): number {
  // A record with no pulse in it gets the row it asked for, since there is
  // nothing to line it up with.
  if (!(stepMs > 0) || !(wantedMs > 0)) return wantedMs;
  if (barSteps > 0) return rowInBar(wantedMs, stepMs * barSteps, barSteps);

  // How far off a row is, as a ratio that reads the same slow or fast.
  const off = (multiple: number) => {
    const ratio = (stepMs * multiple) / wantedMs;
    return ratio > 1 ? ratio : 1 / ratio;
  };
  const nearest = (multiples: readonly number[]) =>
    multiples.reduce((best, here) => (off(here) < off(best) ? here : best));

  const straight = nearest(ON_THE_GRID);
  if (off(straight) <= GRID_WITHIN) return stepMs * straight;
  return stepMs * nearest([...ON_THE_GRID, ...BETWEEN]);
}

/**
 * How far off a row that leans against the beat may be before any whole number
 * of rows to the bar is taken instead.
 */
const LEAN_WITHIN = 1.2;

/**
 * How long a row is on a song whose bars are known: the bar divided into a
 * whole number of rows.
 *
 * Which is what makes a chorus the same keys every time it comes round. A row
 * that is some number of steps long lands on the music, but three steps into
 * an eight-step bar it lands somewhere different in every bar, and the same
 * passage is cut into different keys on each return. A bar cut into a whole
 * number of rows is cut the same way every time.
 *
 * The number is chosen the way the row always was: the straight divisions
 * first -- halves of halves, where the keys sound most like the song -- then
 * the ones that lean against the beat and come round to it, and past those
 * whatever whole number is nearest the pace that was asked for. A bar of six
 * steps is two beats of three, so its straight divisions are different ones.
 */
function rowInBar(wantedMs: number, barMs: number, barSteps: number): number {
  const off = (rows: number) => {
    const ratio = barMs / rows / wantedMs;
    return ratio > 1 ? ratio : 1 / ratio;
  };
  const nearest = (counts: readonly number[]) =>
    counts.reduce((best, here) => (off(here) < off(best) ? here : best));

  const triple = barSteps % 3 === 0;
  const straight = triple ? [1, 2, 6, 12, 24, 48] : [1, 2, 4, 8, 16, 32, 64];
  const leaning = triple ? [3, 4, 8, 9, 18, 36] : [3, 6, 12, 24, 48];

  const even = nearest(straight);
  if (off(even) <= GRID_WITHIN) return barMs / even;
  const leant = nearest([...straight, ...leaning]);
  if (off(leant) <= LEAN_WITHIN) return barMs / leant;
  const any = Math.max(1, Math.round(barMs / wantedMs));
  return barMs / (off(any) < off(leant) ? any : leant);
}

/** How many parts of a step the chart's lanes and accents are written at. */
export const SLOTS = 4;

/**
 * Where in the chart a moment of the recording is.
 *
 * A chart is written in grid time, where every step is the same length. The
 * band it was made from does not play that evenly, so the chart also says
 * where each step really falls -- its `lines` -- and this reads a position in
 * the recording through them. It is what lets the board be a ladder of equal
 * rows and still land every one of them on the beat: the rows do not bend, the
 * clock does, by a few parts in a hundred and never backwards.
 *
 * Before the first line and after the last it carries on at the pace of the
 * nearest step, and a song with no lines is its own grid.
 */
export function toGrid(
  lines: readonly number[] | undefined | null,
  stepMs: number,
  songMs: number
): number {
  'worklet';
  const count = lines ? lines.length : 0;
  if (!lines || count < 2 || !(stepMs > 0)) return songMs;

  let line = 0;
  if (songMs >= lines[count - 1]!) {
    line = count - 2;
  } else if (songMs > lines[0]!) {
    // The line at or before this moment, by halving: a song is a thousand
    // steps, and this is asked sixty times a second.
    let low = 0;
    let high = count - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (lines[middle]! <= songMs) low = middle;
      else high = middle;
    }
    line = low;
  }
  const gap = lines[line + 1]! - lines[line]!;
  if (!(gap > 0)) return line * stepMs;
  return (line + (songMs - lines[line]!) / gap) * stepMs;
}

/** How long the chart is in its own time: the song's length, read through its lines. */
export function gridLength(chart: Chart): number {
  const lines = chart.lines;
  if (!lines || lines.length < 2 || !(chart.stepMs > 0)) return chart.durationMs;
  return (lines.length - 1) * chart.stepMs;
}

/**
 * Where the first row starts, so that rows and bars begin together.
 *
 * Rows are counted from here rather than from the start of the record. A bar
 * is a whole number of rows, but only if a row starts where a bar does.
 */
export function rowAnchor(chart: Chart, rowMs: number): number {
  const bar = chart.barSteps ?? 0;
  if (!(bar > 0) || !(chart.stepMs > 0) || !(rowMs > 0)) return 0;
  return ((chart.barAt ?? 0) * chart.stepMs) % rowMs;
}

/**
 * How far around a row its neighbours are asked what the usual level is.
 *
 * Long enough to span a couple of bars, so a dip is measured against the
 * passage it happens in rather than against the beat either side of it; short
 * enough that a verse quieter than its chorus is simply a quiet verse, with a
 * usual level of its own, and not four minutes of rests.
 */
const EASE_AROUND_MS = 4_000;

/**
 * How far below its neighbours a row has to fall before it is left empty.
 *
 * As a share of their usual level. Deliberately mild: this is not looking for
 * silence, which the chart's pauses already mark, but for the places where the
 * music eases -- the end of a phrase, the half-bar where the band drops back --
 * so that a song is not one unbroken column of keys from start to finish.
 *
 * Seven tenths is about three decibels, and was chosen by counting rather than
 * by ear: on three records of different kinds it leaves between a seventh and
 * a fifth of the rows empty, where six tenths left a tenth and eight tenths a
 * quarter. A sixth is enough to be felt as the board breathing and not so much
 * that the song is being skipped.
 */
const EASE_UNDER = 0.7;

/** What a chart writes the usual level of a passage as, in its own `ease`. */
const EASE_USUAL = 20;

/**
 * Which rows fall where the music eases off, as a flag for every row up to
 * [last].
 *
 * Each row's own level is the average of the curve across it, and what it is
 * compared with is the middle value of the rows around it -- the median, not
 * the mean, so one crash nearby does not make every ordinary row beside it
 * look like a dip. Nothing is flagged on a chart that carries no curve.
 */
export function easedRows(chart: Chart, rowMs: number, last: number, anchor = 0): boolean[] {
  const eased = new Array<boolean>(Math.max(0, last + 1)).fill(false);

  /*
    A chart that has already asked how loud each moment is against its
    surroundings is simply read. That is the same question as below, answered
    where the song was analysed and made the same for every bar of a kind --
    so a rest belongs to the passage and comes back with it, instead of being
    worked out afresh from whatever rows happen to be either side.
  */
  const codes = chart.ease;
  if (codes && chart.stepMs > 0 && rowMs > 0) {
    const slotMs = chart.stepMs / SLOTS;
    for (let row = 0; row <= last; row++) {
      const from = Math.max(0, Math.floor((anchor + row * rowMs) / slotMs + 1e-6));
      const to = Math.min(codes.length, Math.max(from + 1, Math.ceil((anchor + (row + 1) * rowMs) / slotMs - 1e-6)));
      if (from >= to) continue;
      let sum = 0;
      for (let slot = from; slot < to; slot++) {
        const code = codes.charCodeAt(slot);
        sum += code >= 97 ? code - 87 : code - 48;
      }
      eased[row] = sum / (to - from) < EASE_USUAL * EASE_UNDER;
    }
    return eased;
  }

  const levels = chart.levels;
  const every = chart.levelMs ?? 0;
  if (!levels || levels.length === 0 || !(every > 0) || !(rowMs > 0)) return eased;

  // Running totals, so a row's average is two look-ups however long it is.
  const total = new Float64Array(levels.length + 1);
  for (let i = 0; i < levels.length; i++) total[i + 1] = total[i]! + levels[i]!;

  const levelOf = (row: number) => {
    const from = Math.min(levels.length - 1, Math.max(0, Math.floor((anchor + row * rowMs) / every + 1e-6)));
    const to = Math.min(
      levels.length,
      Math.max(from + 1, Math.floor((anchor + (row + 1) * rowMs) / every + 1e-6))
    );
    return (total[to]! - total[from]!) / (to - from);
  };

  const own = new Float64Array(last + 1);
  for (let row = 0; row <= last; row++) own[row] = levelOf(row);

  const reach = Math.max(2, Math.round(EASE_AROUND_MS / rowMs));
  for (let row = 0; row <= last; row++) {
    const from = Math.max(0, row - reach);
    const to = Math.min(last, row + reach);
    const around = Array.from(own.subarray(from, to + 1)).sort((a, b) => a - b);
    const usual = around[Math.floor(around.length / 2)]!;
    eased[row] = own[row]! < usual * EASE_UNDER;
  }
  return eased;
}

/**
 * How tall a tile is against its own width. Every tile, always.
 *
 * The one number the whole board is built from. Fix the height and the time a
 * row takes stops being something a chart can choose: it is the height divided
 * by how fast the board moves, and that is what makes a ladder with no gaps
 * possible at all.
 */
export const TILE_ASPECT = 3;

/**
 * The board as a ladder: one tile a row, every row, no gaps and no overlaps.
 *
 * This replaces placing a tile at each onset and hoping the heights worked
 * out. They never quite did — notes arrived closer together than a tile was
 * tall and had to be nudged into other lanes or dropped, and the stretches of
 * a song with nothing in them came out as an empty board with nothing to do.
 *
 * Here the grid comes first. Time is cut into rows of [rowMs], every row gets
 * exactly one tile, and the chart only decides *which lane* that tile is in.
 * A tile ending is therefore the same instant as the next one beginning, which
 * is the thing that could not be guaranteed before and now cannot fail: there
 * is one tile at a time by construction, not by arrangement.
 *
 * A hold is a tile that covers several rows, so its length is always a whole
 * number of tiles — never one and a half.
 *
 * The one exception to "every row" is a pause in the record. Filling the quiet
 * stretches was meant for the parts of a song that are thin, not the parts
 * that are empty: keys arriving through a silent intro or a gap between two
 * movements are keys with nothing to follow, which is a metronome and not the
 * song. So rows inside the chart's `quiet` spans are left empty, and the
 * ladder picks up again where the music does.
 *
 * And a second, gentler one: rows where the music merely eases off, found from
 * the chart's loudness curve by [easedRows]. Those are left empty as well, so
 * that the board breathes where the song does instead of asking for a key on
 * every row from the first bar to the last.
 */
export function ladderFrom(
  chart: Chart,
  fromMs: number,
  rowMs: number,
  leadMs = 0,
  lanes = LANES,
  doubleEvery = 0
): ChartNote[] {
  if (rowMs <= 0) return [];

  /*
    Rows are counted from the start of the record rather than from wherever the
    run happens to begin, so the ladder lands on the same moments whatever the
    player has done. Otherwise starting two bars in would shift every tile in
    the song by a fraction of a row and the grid would stop agreeing with the
    music.
  */
  const anchor = rowAnchor(chart, rowMs);
  const startOf = (at: number) => anchor + at * rowMs;
  const first = Math.ceil((fromMs + leadMs - anchor) / rowMs - 1e-9);
  const last = Math.floor((gridLength(chart) - anchor) / rowMs);

  /*
    Which lane the record suggests for each row, from the onsets that fall in
    it. The loudest band wins, which is `lane` on the chart's own notes; a row
    with nothing in it gets whatever the next row does not need.
  */
  const suggested = new Map<number, ChartNote>();
  for (const note of chart.notes) {
    const row = Math.round((note.atMs - anchor) / rowMs);
    if (!suggested.has(row)) suggested.set(row, note);
  }

  const out: ChartNote[] = [];
  /*
    Every column the row before this one used -- both of them where it was a
    pair, which is the whole reason this is a list rather than a number.

    It was a number, and that was a bug anybody could see: a pair recorded only
    its first column, so the row after could land in the second one and two
    keys would meet end to end in the same column. Which is precisely what a
    hold looks like, so the player is shown a hold and then blamed for not
    holding it.
  */
  let before: number[] = [];
  let row = first;

  /*
    Whether a row falls in a pause, and so gets nothing.

    Unless the chart put a note on it. The analysis never leaves a note inside
    a pause, so one that lands there has been carried in by rounding -- onto
    the half-beat grid and then onto a row -- and it is nearly always the key
    that brings the music back, rounded a fraction early. That one is the
    point of the passage after the pause; losing it to the edge of the span
    would start every return a beat late.

    A span that runs to the end of the record is taken to run past it. The
    last row can sit exactly on the final millisecond, which a span ending
    there does not include, and a song that fades out would otherwise end on
    one key alone after seconds of nothing.
  */
  const quiet = chart.quiet ?? [];
  const silent = (at: number) =>
    !suggested.has(at) &&
    quiet.some(
      ([start, end]) => startOf(at) >= start && (startOf(at) < end || end >= gridLength(chart))
    );

  /*
    And whether it falls where the music eases off, which also gets nothing.

    Without the exception the pauses make for a row with a note of its own. A
    pause is silence, so a note found in one was rounded in from its edge; a
    dip is still music, and a note in it is a soft note, which is exactly the
    kind a row is being left empty to let pass.
  */
  const eased = easedRows(chart, rowMs, last, anchor);
  const empty = (at: number) => silent(at) || eased[at] === true;

  /*
    What the chart says about the moment a row starts at: which lane the song
    suggests there, and how hard the music hits.

    Read by the slot the row starts in, a quarter of a step at a time. A chart
    made before these were written has neither, and the board does what it did
    then.
  */
  const slotMs = chart.stepMs > 0 ? chart.stepMs / SLOTS : 0;
  const slotOf = (at: number) => Math.floor(startOf(at) / slotMs + 1e-6);
  const laneCodes = slotMs > 0 && chart.lanes ? chart.lanes : null;
  const accentCodes = slotMs > 0 && chart.accents ? chart.accents : null;
  const songLane = (at: number): number | null => {
    if (!laneCodes) return null;
    const code = laneCodes.charCodeAt(slotOf(at)) - 48;
    return code >= 0 && code < lanes ? code : null;
  };
  const accentOf = (at: number): number => {
    if (!accentCodes) return -1;
    const code = accentCodes.charCodeAt(slotOf(at));
    if (code >= 48 && code <= 57) return code - 48;
    if (code >= 97 && code <= 122) return code - 87;
    return -1;
  };

  /*
    How hard a row has to hit to be given a second key.

    The same share of the rows as before -- one in `doubleEvery` -- but the ones
    where the music hits hardest rather than every so-many-th. Counting rows
    put a pair on whatever happened to be seventh; this puts it on the crash.
    And because a chorus hits in the same places every time, its pairs are in
    the same places every time.
  */
  let pairAbove = Infinity;
  if (accentCodes && doubleEvery > 0) {
    const hits: number[] = [];
    for (let at = Math.ceil(-anchor / rowMs - 1e-9); at <= last; at++) {
      if (!empty(at)) hits.push(accentOf(at));
    }
    hits.sort((a, b) => b - a);
    if (hits.length > 0) pairAbove = hits[Math.min(hits.length - 1, Math.floor(hits.length / doubleEvery))]!;
  }
  // Never two pairs in a row: the hands need a key between them to get back.
  let lastPair = -Infinity;

  /*
    Where a row sits in its bar, counted in rows.

    For the one thing below that has to be decided the same way in every bar:
    which of two neighbouring rows gives way when the song wants them both in
    one column.
  */
  const perBar = laneCodes && (chart.barSteps ?? 0) > 0 ? Math.round(((chart.barSteps ?? 0) * chart.stepMs) / rowMs) : 0;
  const barRow = perBar > 0 ? Math.round(((chart.barAt ?? 0) * chart.stepMs - anchor) / rowMs) : 0;
  const inBar = (at: number) => (((at - barRow) % perBar) + perBar) % perBar;
  const wants = (at: number): number | null => (at < 0 || at > last || empty(at) ? null : songLane(at));

  /**
   * The lane a row takes when the song suggests the same one for its
   * neighbour.
   *
   * A tune holds a note for longer than a row, and two keys cannot follow one
   * another down a column: end to end they are a hold. So one of each two has
   * to step aside. It used to be whichever came second, which depends on what
   * came before it -- and so the same held note was played left-right in one
   * chorus and right-left in the next. Now it is the row on the odd place in
   * its bar, every time, and it steps to the nearest column that neither of
   * its neighbours wants.
   */
  const settled = (at: number): number | null => {
    const want = wants(at);
    if (want == null || perBar <= 0) return want;
    const prev = wants(at - 1);
    const next = wants(at + 1);
    if ((prev !== want && next !== want) || inBar(at) % 2 === 0) return want;
    let best = -1;
    for (let other = 0; other < lanes; other++) {
      if (other === want || other === prev || other === next) continue;
      if (best < 0 || Math.abs(other - want) < Math.abs(best - want)) best = other;
    }
    return best < 0 ? want : best;
  };

  while (row <= last) {
    if (empty(row)) {
      /*
        Nothing was here to be followed, so there is nothing for the next key
        to be kept clear of either. Starting afresh lets the first key after a
        pause go wherever the song wants it, rather than being moved out of a
        column that was last used seconds ago.
      */
      before = [];
      row++;
      continue;
    }

    const source = suggested.get(row) ?? null;

    /*
      Never in a column the row before used. Two tiles that meet end to end in
      one column read as a single tall tile, which is exactly the thing a hold
      is -- so whatever the song suggests has to move if the column is still
      warm.
    */
    const wanted = settled(row) ?? (source ? source.lane : ((before[0] ?? -2) + 2) % lanes);
    const lane = freeLane(wanted, before, lanes);

    /*
      A hold covers whole rows and nothing else. Rounded rather than floored so
      that a chord held for a row and a half is a two-row hold rather than a
      one-row tap; anything under a row and a half is simply a tap.
    */
    let rows = 1;
    if (source && source.holdMs > 0) {
      rows = Math.max(1, Math.round((rowMs + source.holdMs) / rowMs));
      // Not past the end of the record, and not so long it fills the board.
      rows = Math.min(rows, last - row + 1, MOST_HELD_ROWS);
      /*
        And not into a pause. A held key whose tail runs on into silence asks
        for a finger to stay down on nothing, so it ends on the last row
        before the pause begins -- shorter than the sound suggested, and the
        sound was ending anyway.
      */
      for (let along = 1; along < rows; along++) {
        if (empty(row + along)) {
          rows = along;
          break;
        }
      }
    }

    const holdMs = rows > 1 ? (rows - 1) * rowMs : 0;
    out.push({ atMs: startOf(row), lane, holdMs });

    /*
      Now and then, a second key in the same row.

      Never beside the first: two columns that touch are one wide target as far
      as a thumb crossing between them is concerned, and the whole of what makes
      a pair worth playing is that the hands have to be in two places. Never on
      a hold either -- a finger already pinned to the glass cannot be asked for
      a second key and then blamed for the third.
    */
    const used = [lane];
    const paired = accentCodes
      ? accentOf(row) > pairAbove && row - lastPair > 1
      : row % doubleEvery === 0;
    if (doubleEvery > 0 && holdMs === 0 && paired) {
      const second = partnerFor(lane, before, lanes);
      if (second >= 0) {
        out.push({ atMs: startOf(row), lane: second, holdMs: 0 });
        used.push(second);
        lastPair = row;
      }
    }

    before = used;
    row += rows;
  }

  return out;
}

/**
 * [wanted] if nothing is in the way, else the nearest column that is free.
 *
 * Nearest rather than next along, so a key the song asked for in the third
 * column does not end up in the first when the second would have done. What
 * the song suggested is a real preference, and the point of moving a key is to
 * move it as little as the rule allows.
 */
function freeLane(wanted: number, blocked: readonly number[], lanes: number): number {
  const start = ((wanted % lanes) + lanes) % lanes;
  if (!blocked.includes(start)) return start;
  for (let step = 1; step < lanes; step++) {
    for (const side of [start + step, start - step]) {
      const lane = ((side % lanes) + lanes) % lanes;
      if (!blocked.includes(lane)) return lane;
    }
  }
  return start;
}

/**
 * A column far enough from [lane] to be a second key rather than a wider one,
 * and not one the row before was already using.
 *
 * Furthest away rather than merely two apart, so a pair is as plain as the
 * board can make it. Answers -1 when there is nowhere left that satisfies
 * both, which simply means this row carries one key instead of two.
 */
function partnerFor(lane: number, blocked: readonly number[], lanes: number): number {
  let best = -1;
  let far = 1;
  for (let other = 0; other < lanes; other++) {
    if (blocked.includes(other)) continue;
    const gap = Math.abs(other - lane);
    if (gap >= 2 && gap > far) {
      far = gap;
      best = other;
    }
  }
  return best;
}

/**
 * How many rows a held key may cover.
 *
 * Long enough to be worth holding, short enough that a thumb pinned to the
 * glass is not missing everything else arriving while it is down.
 */
const MOST_HELD_ROWS = 4;

/** What a run amounts to. */
export type Score = {
  hit: number;
  /** Held keys kept down to their end, which are worth more than striking one. */
  bonus: number;
  missed: number;
  combo: number;
  best: number;
  total: number;
};

export const NOTHING_YET: Score = { hit: 0, bonus: 0, missed: 0, combo: 0, best: 0, total: 0 };

/** What a run is worth: a point a key, and another for every hold kept. */
export function pointsOf(score: Score): number {
  return score.hit + score.bonus;
}

export function accuracyOf(score: Score): number {
  const judged = score.hit + score.missed;
  return judged === 0 ? 0 : score.hit / judged;
}
