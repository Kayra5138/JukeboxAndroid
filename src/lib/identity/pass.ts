import type { BackupDb } from '../backup/store.ts';
import {
  describe,
  difference,
  propose,
  settle,
  type FileRow,
  type Noted,
  type Proposal,
  type Scanned,
} from './plan.ts';
import {
  describeLost,
  dropPairs,
  notePairs,
  owners,
  readdress,
  readFiles,
  readPairs,
  writeFiles,
} from './store.ts';

/**
 * What the tables held when they were last read, so that a scan which changes
 * nothing -- nearly all of them -- asks the database nothing either.
 *
 * Whoever holds one of these must be the only writer of those tables, and
 * must empty it after writing them by any other road than [takeIn].
 */
export type Memory = {
  files: Map<string, FileRow> | null;
  pairs: Noted[] | null;
  /** Whether the twins written down have been looked at since the app started. */
  weighed: boolean;
};

const NOTHING: Proposal = { moves: [], asks: [], alike: [] };

/**
 * Takes in what a scan returned.
 *
 * Writes down the files it has not seen before or that have changed, and if
 * any have appeared, looks among them for the ones that have stopped turning
 * up. A file found again to the byte has its history moved to it; anything
 * less certain is left for the user to decide.
 *
 * A scan that returns nothing teaches nothing. That is what an audio
 * permission taken away looks like, and an empty folder chosen by mistake,
 * and neither is every song on the phone having gone. Nothing is forgotten
 * for want of being seen in any case: the descriptions simply stay.
 */
export function takeIn(database: BackupDb, tracks: Scanned[], memory: Memory, now: number): void {
  if (tracks.length === 0) return;

  const files = (memory.files ??= readFiles(database));
  const pairs = (memory.pairs ??= readPairs(database));

  // Only built if it is asked for, which on an ordinary scan it is not.
  let ids: Set<string> | null = null;
  const here = (id: string) => (ids ??= new Set(tracks.map((track) => track.id))).has(id);

  // The first scan there has ever been. The songs that were already lost by
  // now are described from their listens, so that they can at least be asked
  // about; from here on a description is written while the file is still here.
  const lost = files.size === 0 ? describeLost(database, here) : [];
  const known = lost.length > 0 ? new Map(lost.map((row) => [row.id, row])) : files;

  const found = difference(known, tracks);
  const twins = pairs.filter((pair) => pair.state === 'alike');
  // Twins are weighed once when the app starts, since either may have been
  // listened to since, and again whenever one of a pair is not where it was.
  const due =
    twins.length > 0 &&
    (!memory.weighed || twins.some((pair) => here(pair.from) !== here(pair.to)));
  if (found.changed.length === 0 && lost.length === 0 && !due) return;

  const proposal =
    found.fresh.length > 0 ? propose(found.gone, found.fresh, tracks.map(describe)) : NOTHING;
  const mentioned = [...proposal.moves, ...proposal.asks, ...proposal.alike, ...twins].flatMap(
    (pair) => [pair.from, pair.to]
  );
  const own = mentioned.length > 0 ? owners(database, mentioned) : new Set<string>();
  const settled = settle(proposal, pairs, (id) => own.has(id), here);

  // One change. A history moved without its description updated, or the other
  // way about, would be found again on the next scan and moved a second time.
  database.transaction(() => {
    writeFiles(database, [...lost, ...found.changed], now);
    dropPairs(database, settled.retired);
    notePairs(database, settled.alike, 'alike', now);
    notePairs(database, settled.asks, 'asked', now);
    readdress(database, settled.moves, here);
  });
  memory.files = null;
  memory.pairs = null;
  memory.weighed = true;
}
