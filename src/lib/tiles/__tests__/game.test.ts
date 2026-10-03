import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { Chart, ChartNote } from '../../../../modules/jukebox-audio';
import {
  accuracyOf,
  aliveForMs,
  holdWonAt,
  easedRows,
  holdWorth,
  ladderFrom,
  laneAt,
  LANES,
  runOf,
  pointsOf,
  gridLength,
  rowAnchor,
  rowFor,
  SLOTS,
  speedById,
  SPEEDS,
  tileAt,
  toGrid,
  touching,
} from '../game.ts';

/*
  A board the size of a phone. Written as numbers rather than symbols because
  the fault these guard against is two places disagreeing about the same
  geometry, and symbols agreeing with themselves proves nothing.
*/
const TRAVEL = 1800;
const SPAN = 1500;
const TALL = 260;

const note = (atMs: number, lane = 0, holdMs = 0): ChartNote => ({ atMs, lane, holdMs });
const chartOf = (notes: ChartNote[]): Chart => ({
  version: 1,
  durationMs: 60_000,
  stepMs: 250,
  notes,
});

describe('where a tile is', () => {
  it('has its foot at the bottom of the board at the moment it is due', () => {
    assert.equal(Math.round(tileAt(5000, 0, 5000, SPAN, TRAVEL, TALL).foot), TRAVEL);
  });

  it('is at the very top a whole span before it is due', () => {
    assert.equal(Math.round(tileAt(5000, 0, 5000 - SPAN, SPAN, TRAVEL, TALL).foot), 0);
  });

  it('covers its own height above its foot', () => {
    const { foot, top } = tileAt(5000, 0, 4000, SPAN, TRAVEL, TALL);
    assert.equal(Math.round(foot - top), TALL);
  });

  it('covers its tail as well when it is held', () => {
    const held = tileAt(5000, 800, 4000, SPAN, TRAVEL, TALL);
    const tap = tileAt(5000, 0, 4000, SPAN, TRAVEL, TALL);
    assert.ok(held.top < tap.top);
  });
});

describe('what a finger lands on', () => {
  const at = (nowMs: number) => tileAt(5000, 0, nowMs, SPAN, TRAVEL, TALL);

  it('is the tile, wherever on the board it is', () => {
    // A quarter of the way down, which is where a player reaches for one.
    const now = 5000 - SPAN * 0.75;
    const { foot, top } = at(now);
    assert.ok(foot < TRAVEL / 2, 'this tile should still be high up');
    assert.ok(touching((foot + top) / 2, 5000, 0, now, SPAN, TRAVEL, TALL));
  });

  it('is nothing, just above or just below it', () => {
    const now = 5000 - SPAN / 2;
    const { foot, top } = at(now);
    assert.ok(!touching(foot + 4, 5000, 0, now, SPAN, TRAVEL, TALL));
    assert.ok(!touching(top - 4, 5000, 0, now, SPAN, TRAVEL, TALL));
  });

  it('includes the striped tail of a held note', () => {
    const now = 4000;
    const { top } = tileAt(5000, 900, now, SPAN, TRAVEL, TALL);
    assert.ok(touching(top + 10, 5000, 900, now, SPAN, TRAVEL, TALL));
  });
});

describe('which column a touch is in', () => {
  it('divides the width into four', () => {
    assert.equal(laneAt(10, 400), 0);
    assert.equal(laneAt(110, 400), 1);
    assert.equal(laneAt(210, 400), 2);
    assert.equal(laneAt(399, 400), 3);
  });

  it('never answers with a column that does not exist', () => {
    assert.equal(laneAt(-50, 400), 0);
    assert.equal(laneAt(99999, 400), LANES - 1);
    assert.equal(laneAt(10, 0), 0);
  });
});

describe('how long a note can be hit for', () => {
  it('is how long its own tile takes to pass', () => {
    // A tile a seventh of the board tall, on a board crossed in 1500 ms.
    assert.equal(Math.round(aliveForMs(TALL, TRAVEL, SPAN)), Math.round((260 / 1800) * 1500));
  });

  it('never answers with nothing, however odd the board', () => {
    assert.ok(aliveForMs(TALL, 0, SPAN) > 0);
  });
});

describe('the ladder', () => {
  const ROW = 250;
  /*
    Onsets scattered off the grid on purpose: the ladder's whole job is that
    the board does not inherit the song's gaps and crowding, so a chart that is
    uneven is the one worth building from.
  */
  const messy = chartOf([note(40, 1), note(260, 3), note(300, 0), note(1700, 2, 900)]);

  it('leaves no gap anywhere, however the song is spaced', () => {
    const tiles = ladderFrom(messy, 0, ROW);
    assert.ok(tiles.length > 1);
    for (let index = 1; index < tiles.length; index++) {
      const before = tiles[index - 1]!;
      // The instant one ends is the instant the next begins. Not "close to":
      // a gap of a single millisecond is a gap, and the point of the ladder is
      // that there cannot be one.
      assert.equal(tiles[index]!.atMs, before.atMs + before.holdMs + ROW);
    }
  });

  it('never puts two in a row in the same lane', () => {
    // Two tiles meeting end to end in one column read as one tall tile, which
    // is what a hold is -- so a tap after a tap has to move.
    const tiles = ladderFrom(messy, 0, ROW);
    for (let index = 1; index < tiles.length; index++) {
      assert.notEqual(tiles[index]!.lane, tiles[index - 1]!.lane);
    }
  });

  it('never reuses a column from the row before, pairs and all', () => {
    /*
      The test the single-key one above could not make. A pair used to record
      only its first column as taken, so the next row could land in its second
      and two keys would meet end to end -- a hold, as far as the eye is
      concerned, which the player is then blamed for not holding.

      Every spacing, because the fault only showed where a pair happened to be
      followed by a row the song wanted in the partner's column.
    */
    for (const every of [1, 2, 3, 5, 7]) {
      const tiles = ladderFrom(messy, 0, ROW, 0, LANES, every);
      const rows = new Map<number, number[]>();
      for (const tile of tiles) {
        rows.set(tile.atMs, [...(rows.get(tile.atMs) ?? []), tile.lane]);
      }
      const moments = [...rows.keys()].sort((a, b) => a - b);
      for (let index = 1; index < moments.length; index++) {
        const now = rows.get(moments[index]!)!;
        const last = rows.get(moments[index - 1]!)!;
        for (const lane of now) {
          assert.ok(
            !last.includes(lane),
            `every ${every}: lane ${lane} used twice running at ${moments[index]}`
          );
        }
      }
    }
  });

  it('lands every tile on the grid', () => {
    for (const tile of ladderFrom(messy, 0, ROW)) {
      assert.equal(tile.atMs % ROW, 0);
    }
  });

  it('makes a hold a whole number of tiles and never a fraction', () => {
    const tiles = ladderFrom(messy, 0, ROW);
    const held = tiles.filter((tile) => tile.holdMs > 0);
    assert.ok(held.length > 0, 'the chart has a hold in it to carry over');
    for (const tile of held) assert.equal(tile.holdMs % ROW, 0);
  });

  it('takes its lanes from the song where the song has something to say', () => {
    // The first row covers the onset at 40ms, which the analysis put in lane 1.
    assert.equal(ladderFrom(messy, 0, ROW)[0]!.lane, 1);
  });

  it('starts past the lead, so the first key is watched the whole way down', () => {
    const tiles = ladderFrom(messy, 0, ROW, 600);
    assert.ok(tiles[0]!.atMs >= 600);
  });

  it('stops at the end of the record', () => {
    const tiles = ladderFrom(messy, 0, ROW);
    const last = tiles[tiles.length - 1]!;
    assert.ok(last.atMs + last.holdMs <= messy.durationMs);
  });

  it('has nothing to offer without a row length', () => {
    assert.deepEqual(ladderFrom(messy, 0, 0), []);
  });
});

describe('a pause in the record', () => {
  const ROW = 250;
  /*
    Three seconds of nothing from five seconds in. Chosen on row lines so the
    edges are exact: the row at 4750 is the last before it and the row at 8000
    the first after, and anything else about where the board resumes would be
    a question about rounding rather than about pauses.
  */
  const PAUSE: [number, number] = [5000, 8000];
  const song = chartOf([note(40, 1), note(260, 3), note(1700, 2, 900), note(9000, 0)]);
  const paused = { ...song, quiet: [PAUSE] };

  const inPause = (at: number) => at >= PAUSE[0] && at < PAUSE[1];

  it('puts no key in it', () => {
    const tiles = ladderFrom(paused, 0, ROW);
    assert.ok(tiles.length > 0);
    for (const tile of tiles) assert.ok(!inPause(tile.atMs), `a key at ${tile.atMs}`);
  });

  it('carries on either side of it', () => {
    // A pause is a gap in the board, not the end of it. The rows right up to
    // it and right after it are as full as any other.
    const moments = new Set(ladderFrom(paused, 0, ROW).map((tile) => tile.atMs));
    assert.ok(moments.has(PAUSE[0] - ROW), 'the row before the pause is empty');
    assert.ok(moments.has(PAUSE[1]), 'the row the music comes back on is empty');
  });

  it('cuts a hold short rather than let it run into the silence', () => {
    // Long enough to be four rows on its own, which from 4500 would cover the
    // first two rows of the pause.
    const holding = chartOf([note(4500, 1, 900)]);
    const free = ladderFrom(holding, 0, ROW).find((tile) => tile.atMs === 4500)!;
    assert.equal(free.holdMs, 3 * ROW, 'the hold should be four rows with no pause in the way');

    const cut = ladderFrom({ ...holding, quiet: [PAUSE] }, 0, ROW).find((tile) => tile.atMs === 4500)!;
    assert.ok(cut.holdMs > 0, 'still a hold, only a shorter one');
    assert.ok(cut.atMs + cut.holdMs < PAUSE[0], `the hold runs on to ${cut.atMs + cut.holdMs}`);
  });

  it('never puts a pair in it either', () => {
    const tiles = ladderFrom(paused, 0, ROW, 0, LANES, 1);
    for (const tile of tiles) assert.ok(!inPause(tile.atMs), `a key at ${tile.atMs}`);
    // And pairs still come on both sides, so the pause is all that was taken.
    const counts = new Map<number, number>();
    for (const tile of tiles) counts.set(tile.atMs, (counts.get(tile.atMs) ?? 0) + 1);
    assert.ok([...counts].some(([at, count]) => at < PAUSE[0] && count === 2));
    assert.ok([...counts].some(([at, count]) => at >= PAUSE[1] && count === 2));
  });

  it('lets the first key after it go where the song wants', () => {
    /*
      The row before the pause used lane 1, and the song asks for lane 1 again
      when the music returns. Seconds apart, the two cannot be read as one tall
      key, so there is no reason to move the second out of the way.
    */
    const again = chartOf([note(4750, 1), note(8000, 1)]);
    const tiles = ladderFrom({ ...again, quiet: [PAUSE] }, 0, ROW);
    assert.equal(tiles.find((tile) => tile.atMs === 4750)!.lane, 1);
    assert.equal(tiles.find((tile) => tile.atMs === 8000)!.lane, 1);
  });

  it('keeps the key that brings the music back, even rounded a moment early', () => {
    /*
      The pause measured as ending at 8100, the music's first note at 8010 --
      which the row grid puts at 8000, inside the span by a hundred
      milliseconds. That key is what the player is waiting for; the edge of a
      span is not precise enough to throw it away.
    */
    const tiles = ladderFrom({ ...chartOf([note(8010, 2)]), quiet: [[5000, 8100]] }, 0, ROW);
    const back = tiles.find((tile) => tile.atMs === 8000);
    assert.ok(back, 'the returning key was dropped');
    assert.equal(back.lane, 2);
    // The rest of the span is still empty.
    for (const tile of tiles) {
      if (tile.atMs !== 8000) assert.ok(!(tile.atMs >= 5000 && tile.atMs < 8100), `${tile.atMs}`);
    }
  });

  it('can open the song or close it', () => {
    // Notes only in the middle: the analysis never leaves one inside a pause.
    const middle = chartOf([note(9000, 0), note(30_000, 2, 900)]);
    const tiles = ladderFrom({ ...middle, quiet: [[0, 3000], [55_000, 60_000]] }, 0, ROW);
    assert.ok(tiles[0]!.atMs >= 3000, `the first key is at ${tiles[0]!.atMs}`);
    const last = tiles[tiles.length - 1]!;
    assert.ok(last.atMs + last.holdMs < 55_000, `the last key runs to ${last.atMs + last.holdMs}`);
  });

  it('leaves nothing to play in a record that is silent throughout', () => {
    assert.deepEqual(ladderFrom({ ...chartOf([]), quiet: [[0, 60_000]] }, 0, ROW), []);
  });

  it('changes nothing about a song without one', () => {
    // The spans are an addition to the ladder, not a new one: no spans, or a
    // chart from before they existed, has to give the board it always did.
    for (const every of [0, 3, 7]) {
      const plain = ladderFrom(song, 0, ROW, 600, LANES, every);
      assert.deepEqual(ladderFrom({ ...song, quiet: [] }, 0, ROW, 600, LANES, every), plain);
      assert.deepEqual(ladderFrom({ ...song, quiet: undefined }, 0, ROW, 600, LANES, every), plain);
    }
  });
});

describe('how long a row is', () => {
  const off = (row: number, wanted: number) => (row > wanted ? row / wanted : wanted / row);

  it('is what was asked for on a record with no pulse', () => {
    assert.equal(rowFor(200, 0), 200);
  });

  it('takes the song\'s own step when that is what was asked for', () => {
    assert.equal(rowFor(250, 250), 250);
    assert.equal(rowFor(500, 250), 500);
  });

  it('stays on the straight grid when the straight grid is close', () => {
    // Ten per cent off a whole step: near enough that the pace is the same to
    // a hand, so the keys keep the plain rhythm.
    assert.equal(rowFor(220, 200), 200);
    assert.equal(rowFor(180, 200), 200);
  });

  it('divides the step for a slow song instead of crawling', () => {
    // The fault this replaces: a step longer than the row being asked for used
    // to be taken whole, and a Hard on a ballad came out two and a half times
    // too slow.
    const row = rowFor(200, 490);
    assert.ok(row < 300, `a 200 ms row on a 490 ms step came out as ${row}`);
    assert.ok(off(row, 200) < 1.16, `${row} is too far from 200`);
  });

  it('does not take a step that is a third too quick', () => {
    // The other half of it: a step just short of one and a half rows used to
    // round to one step, and the board ran a third faster than its name.
    const row = rowFor(200, 135);
    assert.ok(off(row, 200) < 1.16, `${row} is too far from 200`);
  });

  it('is never far from what was asked, whatever the song', () => {
    // Every difficulty against every tempo the analysis can report. This is
    // the property the whole change is for: one name, one pace.
    let worst = 1;
    let where = '';
    for (let wanted = 110; wanted <= 650; wanted += 7) {
      for (let step = 60; step <= 500; step += 1) {
        const far = off(rowFor(wanted, step), wanted);
        if (far > worst) {
          worst = far;
          where = `${wanted} ms on a ${step} ms step`;
        }
      }
    }
    assert.ok(worst < 1.16, `${worst.toFixed(3)} off at ${where}`);
  });

  it('is always a length the song\'s grid divides into', () => {
    for (const [wanted, step] of [[200, 135], [133, 400], [267, 90], [500, 310]] as const) {
      const multiple = rowFor(wanted, step) / step;
      // Sixteenths of a step cover every length in both lists.
      const inSixteenths = multiple * 48;
      assert.ok(
        Math.abs(inSixteenths - Math.round(inSixteenths)) < 1e-9,
        `${wanted} on ${step} gave ${multiple} steps`
      );
    }
  });
});

describe('where the music eases off', () => {
  const ROW = 250;
  const EVERY = 50;

  /** A minute at the usual level, with [from, to) ms brought down to [level]. */
  const curve = (dips: [number, number, number][]) => {
    const levels = new Array<number>(60_000 / EVERY).fill(100);
    for (const [from, to, level] of dips) {
      for (let at = from; at < to; at += EVERY) levels[at / EVERY] = level;
    }
    return levels;
  };
  const song = (dips: [number, number, number][]): Chart => ({
    ...chartOf([note(40, 1), note(260, 3), note(9000, 0)]),
    levelMs: EVERY,
    levels: curve(dips),
  });
  const lastRow = Math.floor(60_000 / ROW);

  it('marks the rows of a dip and no others', () => {
    const eased = easedRows(song([[10_000, 10_500, 40]]), ROW, lastRow);
    const marked = eased.flatMap((on, row) => (on ? [row * ROW] : []));
    assert.deepEqual(marked, [10_000, 10_250]);
  });

  it('leaves those rows empty and carries on either side', () => {
    const tiles = ladderFrom(song([[10_000, 10_500, 40]]), 0, ROW);
    const moments = new Set(tiles.map((tile) => tile.atMs));
    assert.ok(!moments.has(10_000) && !moments.has(10_250), 'a key in the dip');
    assert.ok(moments.has(9_750), 'the row before the dip is empty');
    assert.ok(moments.has(10_500), 'the row after the dip is empty');
  });

  it('takes no notice of a small drop', () => {
    // Three quarters of the usual level is the song being played a little
    // softer, not easing off.
    const eased = easedRows(song([[10_000, 10_500, 75]]), ROW, lastRow);
    assert.ok(!eased.includes(true));
  });

  it('judges a row against the passage it is in, not the whole song', () => {
    // Half a minute at a third of the level is a quiet verse with a usual
    // level of its own. Only the rows at its two edges could be argued about,
    // and the middle of it must be as full as anywhere.
    const eased = easedRows(song([[20_000, 50_000, 33]]), ROW, lastRow);
    for (let at = 26_000; at < 44_000; at += ROW) {
      assert.equal(eased[at / ROW], false, `the row at ${at} was left empty`);
    }
  });

  it('is not fooled by one loud moment beside an ordinary row', () => {
    const levels = curve([]);
    for (let at = 10_000; at < 10_250; at += EVERY) levels[at / EVERY] = 900;
    const eased = easedRows({ ...song([]), levels }, ROW, lastRow);
    assert.ok(!eased.includes(true));
  });

  it('cuts a hold short rather than let it run through a dip', () => {
    const held: Chart = {
      ...chartOf([note(9_000, 2, 1_500)]),
      levelMs: EVERY,
      levels: curve([[9_500, 10_000, 40]]),
    };
    const tile = ladderFrom(held, 0, ROW).find((each) => each.atMs === 9_000);
    assert.ok(tile, 'the held key is missing');
    assert.ok(tile.atMs + ROW + tile.holdMs <= 9_500, `it runs to ${tile.atMs + ROW + tile.holdMs}`);
  });

  it('leaves a soft note in a dip unplayed', () => {
    // Unlike a pause, where a note is kept because it was rounded in from the
    // edge. A note in a dip is a soft note, and letting it pass is the point.
    const soft: Chart = {
      ...chartOf([note(10_000, 1)]),
      levelMs: EVERY,
      levels: curve([[10_000, 10_500, 40]]),
    };
    const moments = new Set(ladderFrom(soft, 0, ROW).map((tile) => tile.atMs));
    assert.ok(!moments.has(10_000));
  });

  it('changes nothing on a chart with no curve', () => {
    const plain = chartOf([note(40, 1), note(260, 3), note(9000, 0)]);
    assert.ok(!easedRows(plain, ROW, lastRow).includes(true));
    assert.deepEqual(
      ladderFrom(plain, 0, ROW),
      ladderFrom({ ...plain, levelMs: EVERY, levels: curve([]) }, 0, ROW)
    );
  });
});

describe('the run as the game holds it', () => {
  it('starts with nothing played and no lane holding anything', () => {
    const run = runOf([note(0), note(500, 2, 300)]);
    assert.equal(run.cursor, 0);
    assert.deepEqual(Array.from(run.state), [0, 0]);
    assert.deepEqual(Array.from(run.doneAt), [0, 0]);
    // Nothing has been held yet, and a hold nobody takes must stay at nought
    // rather than inherit a figure from when it was finished with.
    assert.deepEqual(Array.from(run.fill), [0, 0]);
    assert.deepEqual(Array.from(run.heldFrom), [0, 0]);
    assert.deepEqual(Array.from(run.held), [-1, -1, -1, -1]);
    assert.deepEqual(Array.from(run.lane), [0, 2]);
    assert.deepEqual(Array.from(run.holdMs), [0, 300]);
  });
});

describe('speed', () => {
  it('falls back to the gentlest anybody would pick for themselves', () => {
    // Not the middle of the list. The middle moved when the names did, and
    // landing a stranger on it would hand them the fast one by default.
    assert.equal(speedById('nonsense').id, 'easy');
    assert.equal(speedById(null).id, 'easy');
    // Including the names that used to exist and no longer do.
    assert.equal(speedById('wild').id, 'easy');
  });

  it('gets faster down the list, which is what harder means here', () => {
    for (let i = 1; i < SPEEDS.length; i++) {
      assert.ok(
        SPEEDS[i]!.onScreenMs < SPEEDS[i - 1]!.onScreenMs,
        `${SPEEDS[i]!.id} should be quicker than ${SPEEDS[i - 1]!.id}`
      );
    }
  });

  it('asks for two fingers only at the top, and never takes it back', () => {
    // Named rather than counted: the rule is about which difficulties are
    // gentle, not about where they happen to sit in the list today. This
    // assertion used to name `hard` alone and had to be rewritten the first
    // time anything was added above it, which is the mistake worth not
    // repeating.
    const gentle = new Set(['easy', 'normal']);
    for (const speed of SPEEDS) {
      assert.equal(speed.doubleEvery > 0, !gentle.has(speed.id), speed.id);
    }

    // And once pairs start they only ever get more frequent, so no difficulty
    // is easier than the one below it in the one way that is not speed.
    const asking = SPEEDS.filter((speed) => speed.doubleEvery > 0);
    for (let i = 1; i < asking.length; i++) {
      assert.ok(
        asking[i]!.doubleEvery <= asking[i - 1]!.doubleEvery,
        `${asking[i]!.id} asks for pairs less often than ${asking[i - 1]!.id}`
      );
    }
  });
});

describe('a held key', () => {
  it('is won before it is over, so the hand is given back', () => {
    assert.ok(holdWonAt(1000, 1000) < 2000);
    assert.ok(holdWonAt(1000, 1000) > 1000);
  });

  it('is worth a point for every row it covers, its own included', () => {
    // A hold used to be worth one however long it was, which made a four-row
    // key worth the same as the tap beside it.
    assert.equal(holdWorth(0, 250), 1);
    assert.equal(holdWorth(250, 250), 2);
    assert.equal(holdWorth(750, 250), 4);
  });

  it('is worth something whatever the board is doing', () => {
    assert.equal(holdWorth(500, 0), 1);
  });
});

describe('two at once', () => {
  const ROW = 250;
  const song = chartOf([note(40, 1), note(1700, 2, 900), note(5000, 0)]);

  it('never puts a pair in neighbouring columns', () => {
    const tiles = ladderFrom(song, 0, ROW, 0, LANES, 3);
    const rows = new Map<number, number[]>();
    for (const tile of tiles) {
      rows.set(tile.atMs, [...(rows.get(tile.atMs) ?? []), tile.lane]);
    }
    let pairs = 0;
    for (const [, lanes] of rows) {
      if (lanes.length < 2) continue;
      pairs++;
      assert.equal(lanes.length, 2, 'never more than two at once');
      // Side by side is one wide target as far as a travelling thumb cares.
      assert.ok(Math.abs(lanes[0]! - lanes[1]!) >= 2, `lanes ${lanes}`);
    }
    assert.ok(pairs > 0, 'the chart should have produced some pairs');
  });

  it('never asks for a second key while a finger is pinned to a hold', () => {
    const tiles = ladderFrom(song, 0, ROW, 0, LANES, 1);
    const held = tiles.filter((tile) => tile.holdMs > 0);
    assert.ok(held.length > 0);
    for (const hold of held) {
      assert.equal(tiles.filter((tile) => tile.atMs === hold.atMs).length, 1);
    }
  });

  it('leaves the board alone when nothing asked for pairs', () => {
    const tiles = ladderFrom(song, 0, ROW, 0, LANES, 0);
    const moments = new Set(tiles.map((tile) => tile.atMs));
    assert.equal(moments.size, tiles.length, 'one key a row');
  });
});

describe('the score', () => {
  it('counts a kept hold on top of the key it belongs to', () => {
    // Striking a held key is the point; keeping it down is the extra. A hold
    // let go of early is therefore worth exactly what a tap is, and never less.
    assert.equal(pointsOf({ hit: 4, bonus: 0, missed: 0, combo: 0, best: 4, total: 10 }), 4);
    assert.equal(pointsOf({ hit: 4, bonus: 2, missed: 0, combo: 0, best: 4, total: 10 }), 6);
  });

  it('is nothing out of nothing before anything is played', () => {
    assert.equal(accuracyOf({ hit: 0, bonus: 0, missed: 0, combo: 0, best: 0, total: 0 }), 0);
  });

  it('counts only what was judged', () => {
    assert.equal(accuracyOf({ hit: 3, bonus: 0, missed: 1, combo: 0, best: 3, total: 50 }), 0.75);
  });
});

/*
  A chart as the analysis now makes them: on a grid that follows the beat, with
  a lane and an accent written for every quarter of a step, and bars.

  Eight steps to the bar, four hundred milliseconds to the step, and a tune
  that is the same four bars twice over -- so whatever the board does with the
  first four it has to do again with the second.
*/
const STEP = 400;
const BAR = 8;
function song(bars: number, pattern: (bar: number, slot: number) => number, extra: Partial<Chart> = {}): Chart {
  const steps = bars * BAR;
  let lanes = '';
  let accents = '';
  for (let slot = 0; slot < steps * SLOTS; slot++) {
    const bar = Math.floor(slot / (BAR * SLOTS));
    lanes += String(pattern(bar, slot % (BAR * SLOTS)));
    // Hardest on the first step of the bar, then on its fifth, soft elsewhere.
    const within = slot % (BAR * SLOTS);
    accents += within === 0 ? 'z' : within === 4 * SLOTS ? 'm' : '2';
  }
  return {
    version: 10,
    durationMs: steps * STEP,
    stepMs: STEP,
    notes: [],
    lines: Array.from({ length: steps + 1 }, (_, index) => index * STEP),
    barSteps: BAR,
    barAt: 0,
    lanes,
    accents,
    ...extra,
  };
}
/** A tune that climbs through the bar, the same in every bar of the same parity. */
const twice = (bar: number, slot: number) => (Math.floor(slot / SLOTS) + (bar % 4)) % LANES;

describe('song time and grid time', () => {
  it('is the same thing for a song with no lines', () => {
    assert.equal(toGrid(undefined, 250, 1234), 1234);
    assert.equal(toGrid([], 250, 1234), 1234);
    assert.equal(toGrid([0, 250], 0, 1234), 1234);
  });

  it('puts every line exactly on its step', () => {
    const lines = [100, 520, 910, 1340, 1750];
    lines.forEach((at, index) => assert.equal(toGrid(lines, 400, at), index * 400));
  });

  it('goes evenly between two lines, however far apart they are', () => {
    const lines = [0, 500, 900];
    // Half way through a long step and half way through a short one are both
    // half a step.
    assert.equal(toGrid(lines, 400, 250), 200);
    assert.equal(toGrid(lines, 400, 700), 600);
  });

  it('carries on at the nearest pace before the first line and after the last', () => {
    const lines = [1000, 1400, 1900];
    assert.equal(toGrid(lines, 400, 600), -400);
    assert.equal(toGrid(lines, 400, 2400), 1200);
  });

  it('never goes backwards', () => {
    const lines = [0];
    // A band that speeds up and slows down by a tenth either way.
    for (let index = 1; index < 600; index++) lines.push(lines[index - 1]! + 400 + 40 * Math.sin(index / 9));
    let before = -Infinity;
    for (let ms = -500; ms < lines[lines.length - 1]! + 500; ms += 7) {
      const now = toGrid(lines, 400, ms);
      assert.ok(now > before, `at ${ms}`);
      before = now;
    }
  });

  it('measures the chart by its lines and not by the recording', () => {
    assert.equal(gridLength(song(4, twice, { durationMs: 99_999 })), 4 * BAR * STEP);
    assert.equal(gridLength(chartOf([])), 60_000);
  });
});

describe('how long a row is when the bars are known', () => {
  const BAR_MS = STEP * BAR;

  it('is always the bar cut into a whole number of rows', () => {
    for (const bars of [6, 8]) {
      for (const step of [160, 215, 272, 333, 412, 440]) {
        for (const wanted of [140, 200, 280, 360, 520, 700]) {
          const rows = (step * bars) / rowFor(wanted, step, bars);
          assert.ok(Math.abs(rows - Math.round(rows)) < 1e-9, `${wanted} on ${step}x${bars}: ${rows}`);
          assert.ok(rows >= 1);
        }
      }
    }
  });

  it('is never far from what was asked', () => {
    let worst = 1;
    for (const bars of [6, 8]) {
      for (let step = 160; step <= 440; step += 7) {
        for (let wanted = 130; wanted <= 560; wanted += 11) {
          const row = rowFor(wanted, step, bars);
          worst = Math.max(worst, row > wanted ? row / wanted : wanted / row);
        }
      }
    }
    // A fifth, and a shade more where a bar is so short that it holds only
    // two or three rows and the next whole number is a long way off.
    assert.ok(worst <= 1.25, `the worst is ${worst.toFixed(3)} times off`);
  });

  it('takes a straight division when one is close', () => {
    assert.equal(rowFor(400, STEP, BAR), BAR_MS / 8);
    assert.equal(rowFor(430, STEP, BAR), BAR_MS / 8);
    assert.equal(rowFor(210, STEP, BAR), BAR_MS / 16);
  });

  it('leans against the beat when that is nearer the pace', () => {
    assert.equal(rowFor(280, STEP, BAR), BAR_MS / 12);
    assert.equal(rowFor(540, STEP, BAR), BAR_MS / 6);
  });

  it('cuts a bar of six steps the way that bar is counted', () => {
    // Two beats of three: six rows are its steps, and two its beats.
    assert.equal(rowFor(250, 250, 6), 250);
    assert.equal(rowFor(700, 250, 6), 750);
  });

  it('starts its rows where a bar starts', () => {
    const late = song(4, twice, { barAt: 3 });
    const row = rowFor(300, STEP, BAR);
    const anchor = rowAnchor(late, row);
    assert.ok(anchor >= 0 && anchor < row);
    // The bar begins three steps in, and a whole number of rows before that.
    const rows = (3 * STEP - anchor) / row;
    assert.ok(Math.abs(rows - Math.round(rows)) < 1e-9);
    assert.equal(rowAnchor(chartOf([]), row), 0);
  });
});

describe('a song played the way it was learned', () => {
  /** The keys of one bar, as lanes in order, for comparing bars. */
  const barOf = (tiles: ChartNote[], bar: number) =>
    tiles
      .filter((tile) => tile.atMs >= bar * BAR * STEP - 1e-6 && tile.atMs < (bar + 1) * BAR * STEP - 1e-6)
      .map((tile) => `${Math.round(tile.atMs - bar * BAR * STEP)}:${tile.lane}:${Math.round(tile.holdMs)}`)
      .join(' ');

  it('takes its lanes from the song', () => {
    // One lane all bar would be end to end in a column, so the tune moves.
    const tiles = ladderFrom(song(2, (_bar, slot) => Math.floor(slot / SLOTS) % LANES), 0, STEP);
    assert.deepEqual(tiles.slice(0, 8).map((tile) => tile.lane), [0, 1, 2, 3, 0, 1, 2, 3]);
  });

  it('gives the same bar the same keys, at every speed', () => {
    const chart = song(16, twice);
    for (const wanted of [140, 190, 210, 280, 330, 400, 520, 700]) {
      const row = rowFor(wanted, STEP, BAR);
      for (const pairs of [0, 5, 7]) {
        const tiles = ladderFrom(chart, 0, row, 0, LANES, pairs);
        // Bars four apart are the same music. The first four are left out: a
        // song's first key has nothing before it to be kept clear of.
        for (let bar = 4; bar < 12; bar++) {
          assert.equal(barOf(tiles, bar + 4), barOf(tiles, bar), `rows of ${row} ms, pairs ${pairs}, bar ${bar}`);
        }
      }
    }
  });

  it('gives it the same keys when the bars do not start with the record', () => {
    const chart = song(16, twice, { barAt: 5 });
    const row = rowFor(280, STEP, BAR);
    const tiles = ladderFrom(chart, 0, row, 0, LANES, 7);
    const from = 5 * STEP;
    const cut = (bar: number) =>
      tiles
        .filter((tile) => tile.atMs >= from + bar * BAR * STEP - 1e-6 && tile.atMs < from + (bar + 1) * BAR * STEP - 1e-6)
        .map((tile) => `${Math.round(tile.atMs - from - bar * BAR * STEP)}:${tile.lane}`)
        .join(' ');
    // The tune comes round every four bars wherever the bar lines are drawn.
    for (let bar = 4; bar < 9; bar++) assert.equal(cut(bar + 4), cut(bar), `bar ${bar}`);
  });

  it('still never puts two keys end to end in a column', () => {
    const flat = ladderFrom(song(4, () => 2), 0, STEP);
    for (let index = 1; index < flat.length; index++) assert.notEqual(flat[index]!.lane, flat[index - 1]!.lane);
  });

  it('puts its pairs where the music hits hardest', () => {
    const tiles = ladderFrom(song(8, twice), 0, STEP, 0, LANES, 7);
    const paired = new Map<number, number>();
    for (const tile of tiles) paired.set(tile.atMs, (paired.get(tile.atMs) ?? 0) + 1);
    const pairs = [...paired.entries()].filter(([, count]) => count === 2).map(([at]) => at);
    assert.ok(pairs.length >= 3, `${pairs.length} pairs`);
    // Every one on the first step of a bar, which is where the accent is.
    for (const at of pairs) assert.equal(at % (BAR * STEP), 0, `a pair at ${at}`);
  });

  it('never puts one pair straight after another', () => {
    const loud = song(8, twice, { accents: 'z'.repeat(8 * BAR * SLOTS).replace(/z(?=.{3}(.{4})*$)/g, 'y') });
    const tiles = ladderFrom(loud, 0, STEP, 0, LANES, 2);
    const count = new Map<number, number>();
    for (const tile of tiles) count.set(tile.atMs, (count.get(tile.atMs) ?? 0) + 1);
    const rows = [...count.keys()].sort((a, b) => a - b);
    for (let index = 1; index < rows.length; index++) {
      assert.ok(!(count.get(rows[index]!) === 2 && count.get(rows[index - 1]!) === 2), `at ${rows[index]}`);
    }
  });

  it('rests where the chart says the music eases, in every bar alike', () => {
    // The last quarter of every bar is at half the level of what is around it.
    let ease = '';
    for (let slot = 0; slot < 8 * BAR * SLOTS; slot++) ease += slot % (BAR * SLOTS) >= 6 * SLOTS ? 'a' : 'k';
    const chart = song(8, twice, { ease });
    for (const wanted of [200, 400]) {
      const row = rowFor(wanted, STEP, BAR);
      // Up to the end of the chart; the row that sits on its last moment is
      // past everything the chart has said anything about.
      const tiles = ladderFrom(chart, 0, row).filter((tile) => tile.atMs < 8 * BAR * STEP);
      for (const tile of tiles) {
        assert.ok(tile.atMs % (BAR * STEP) < 6 * STEP, `a key at ${tile.atMs} in the rest`);
      }
      // And keys everywhere else.
      assert.equal(new Set(tiles.map((tile) => tile.atMs)).size, (8 * 6 * STEP) / row);
    }
    assert.deepEqual(easedRows(chart, STEP, 7), [false, false, false, false, false, false, true, true]);
  });

  it('steps a held note aside the same way every time', () => {
    // One note for a whole bar, then another: the tune holds, the keys cannot.
    const held = song(8, (bar) => (bar % 2 === 0 ? 1 : 3));
    const tiles = ladderFrom(held, 0, STEP).filter((tile) => tile.atMs < 8 * BAR * STEP);
    const lanes = tiles.map((tile) => tile.lane);
    assert.equal(lanes.length, 8 * BAR);
    for (let index = 1; index < lanes.length; index++) assert.notEqual(lanes[index], lanes[index - 1]);
    // The rows on the even places are the song's lane; the odd ones stepped aside.
    for (let index = 0; index < lanes.length; index += 2) assert.equal(lanes[index], Math.floor(index / BAR) % 2 === 0 ? 1 : 3);
    // And every bar of the same note is the same keys.
    for (let bar = 0; bar < 6; bar++) {
      assert.deepEqual(lanes.slice((bar + 2) * BAR, (bar + 3) * BAR), lanes.slice(bar * BAR, (bar + 1) * BAR), `bar ${bar}`);
    }
  });

  it('runs to the end of the chart, which is not the length of the recording', () => {
    const chart = song(4, twice, { durationMs: 1_000 });
    const tiles = ladderFrom(chart, 0, STEP);
    assert.equal(tiles[tiles.length - 1]!.atMs, 4 * BAR * STEP);
  });

  it('plays a chart from before any of this the way it always did', () => {
    const old = chartOf([note(0, 1), note(500, 3), note(1000, 0)]);
    const tiles = ladderFrom(old, 0, 250, 0, LANES, 7);
    // Rows from the first moment of the record, the lanes its notes name, and
    // a pair on every seventh row.
    const at = (ms: number) => tiles.filter((tile) => tile.atMs === ms).map((tile) => tile.lane);
    assert.equal(at(0)[0], 1);
    assert.equal(at(500)[0], 3);
    assert.equal(at(1000)[0], 0);
    for (const tile of tiles) assert.equal(tile.atMs % 250, 0);
    const pairs = tiles.filter((tile, index) => index > 0 && tiles[index - 1]!.atMs === tile.atMs).map((tile) => tile.atMs / 250);
    assert.ok(pairs.length > 5);
    for (const row of pairs) assert.equal(row % 7, 0, `a pair on row ${row}`);
  });
});
