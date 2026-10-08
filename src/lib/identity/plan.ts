import type { BackupTrack } from '../backup/format.ts';
import { matchTracks, type LocalTrack } from '../backup/match.ts';

/**
 * Knowing a file again after the media store has given it a new number.
 *
 * Everything the app remembers is filed under that number, and the number
 * lasts only as long as the file stays where it is. Copy the file instead of
 * moving it, reformat the card, let the phone rebuild its media database, and
 * the song has a new one: the listens stop adding up, and the tags, the words
 * and the place in every list are left under a number nothing answers to.
 *
 * So a description of each file is kept, and after a scan the ones that have
 * stopped turning up are looked for among the ones that have only just
 * appeared. This file is the looking, and the deciding what may be done about
 * what is found. It asks nothing of a database, so it can be checked.
 */

/** What is written down about a file, which is enough to know it again. */
export type FileRow = {
  id: string;
  filename: string | null;
  folder: string | null;
  title: string | null;
  artist: string | null;
  /** Nought where the media store could not say. */
  durationSec: number;
  /** In bytes. Null from a build of the native module that does not read it. */
  size: number | null;
};

/** As much of a library track as a description is made from. */
export type Scanned = {
  id: string;
  filename: string | null;
  folder: string | null;
  title: string | null;
  artist: string | null;
  durationSec: number;
  size?: number | null;
};

/** What was filed under [from] belongs under [to]. */
export type Pair = { from: string; to: string };

/** How far apart two lengths may be before they are certainly two recordings. */
const SAME_LENGTH_SEC = 2;

const fold = (value: string | null | undefined) =>
  (value ?? '').normalize('NFKC').trim().toLowerCase();

const lengthOf = (track: Scanned) => (track.durationSec > 0 ? track.durationSec : 0);
const sizeOf = (track: Scanned) =>
  typeof track.size === 'number' && track.size > 0 ? track.size : null;

/** A length to the millisecond, which is as finely as the media store tells it. */
const millis = (seconds: number) => Math.round(seconds * 1000);

export function describe(track: Scanned): FileRow {
  return {
    id: track.id,
    filename: track.filename ?? null,
    folder: track.folder ?? null,
    title: track.title ?? null,
    artist: track.artist ?? null,
    durationSec: lengthOf(track),
    size: sizeOf(track),
  };
}

/** Whether what is written down still describes the track. Run for every track of every scan. */
function unchanged(was: FileRow, track: Scanned): boolean {
  return (
    was.size === sizeOf(track) &&
    was.durationSec === lengthOf(track) &&
    was.filename === (track.filename ?? null) &&
    was.folder === (track.folder ?? null) &&
    was.title === (track.title ?? null) &&
    was.artist === (track.artist ?? null)
  );
}

/**
 * Whether a number that used to mean one file now means another.
 *
 * A media database that is rebuilt starts counting again from one, so the new
 * numbers are the old numbers handed out in a different order: 7 was one song
 * and is now some other. The number is still there, so it would pass for a
 * file that had merely been retagged, and everything known about the first
 * song would go on being shown against the second.
 *
 * It takes a different name and a different size or length to say so. Either
 * alone is an ordinary day: a file renamed keeps its size, and a file retagged
 * or cut keeps its name. Anything not known on both sides says nothing.
 */
function replaced(was: FileRow, now: FileRow): boolean {
  if (!was.filename || !now.filename || fold(was.filename) === fold(now.filename)) return false;
  if (was.size != null && now.size != null && was.size !== now.size) return true;
  return (
    was.durationSec > 0 &&
    now.durationSec > 0 &&
    Math.abs(was.durationSec - now.durationSec) > SAME_LENGTH_SEC
  );
}

export type Difference = {
  /** Descriptions to write down: files not seen before, and files that have changed. */
  changed: FileRow[];
  /** Files with a number nothing was known about, or one that used to mean another file. */
  fresh: FileRow[];
  /** Descriptions of files the scan did not return, as they were last known. */
  gone: FileRow[];
};

/**
 * What a scan found that was not already written down.
 *
 * On nearly every scan the answer is nothing, and it is asked after every
 * scan, so it is made to cost one look in a map for each track and no more:
 * nothing is built for a track that is as it was, and the files that have gone
 * are only gathered when the count says some have.
 *
 * A file that is missing is not a file that was deleted. The folder being
 * read can have been narrowed and a card taken out, and both come back; so
 * `gone` is only ever somewhere to look, never something to tidy away.
 */
export function difference(known: Map<string, FileRow>, scanned: Scanned[]): Difference {
  const changed: FileRow[] = [];
  const fresh: FileRow[] = [];
  const gone: FileRow[] = [];

  let still = 0;
  for (const track of scanned) {
    const was = known.get(track.id);
    if (was) {
      still++;
      if (unchanged(was, track)) continue;
    }
    const now = describe(track);
    changed.push(now);
    if (!was) fresh.push(now);
    else if (replaced(was, now)) {
      gone.push(was);
      fresh.push(now);
    }
  }

  if (still < known.size) {
    const here = new Set(scanned.map((track) => track.id));
    for (const row of known.values()) if (!here.has(row.id)) gone.push(row);
  }
  return { changed, fresh, gone };
}

/**
 * Whether two descriptions are of one file: the same number of bytes and the
 * same length to the millisecond, both of them known.
 *
 * Two different recordings agreeing on both is not impossible, which is why
 * this is never asked on its own. It is asked of two files already taken for
 * one song by their names.
 */
function identical(a: FileRow, b: FileRow): boolean {
  return (
    a.size != null &&
    a.size === b.size &&
    a.durationSec > 0 &&
    millis(a.durationSec) === millis(b.durationSec)
  );
}

/** Whether two files are called the same thing, by file name or by title and artist. */
function namedAlike(a: FileRow, b: FileRow): boolean {
  const name = fold(a.filename);
  if (name && name === fold(b.filename)) return true;
  const title = fold(a.title);
  return title !== '' && title === fold(b.title) && fold(a.artist) === fold(b.artist);
}

/**
 * Which of two numbers the media store gave out first. They are counted
 * upwards, so the lower is the older file; anything that is not a number is
 * put in an order only so that there is one.
 */
function older(a: string, b: string): number {
  const x = Number(a);
  const y = Number(b);
  if (Number.isFinite(x) && Number.isFinite(y) && x !== y) return x - y;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Two ids as one key, whichever way round they are given. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

export type Proposal = {
  /** A file that went and one that came, the same to the byte. */
  moves: Pair[];
  /** A file that went and one that came, alike in name and not the same file. */
  asks: Pair[];
  /** Two files that are both here and the same to the byte. Older first. */
  alike: Pair[];
};

const asWanted = (row: FileRow): BackupTrack => ({
  id: row.id,
  filename: row.filename,
  folder: row.folder,
  title: row.title,
  artist: row.artist,
  durationSec: row.durationSec > 0 ? row.durationSec : null,
});

const asLocal = (row: FileRow): LocalTrack => ({
  id: row.id,
  filename: row.filename,
  folder: row.folder,
  title: row.title,
  artist: row.artist,
  durationSec: row.durationSec,
});

/**
 * What the files that have appeared might be.
 *
 * A file that went is looked for among the files that came, and nowhere else:
 * a track that has been in the library all along is not what a missing one
 * turned into. Which is which is the backup's question -- a description of a
 * song, and a library to find it in -- so it is put to the backup's matcher,
 * and there is one set of rules for what counts as the same song. What is
 * added here is only how sure the answer is. The same size and the same length
 * on top of the matcher's say-so is the file itself, moved. Anything short of
 * that is a likeness, and somebody has to be asked.
 *
 * One file that went to one file that came. Where two descriptions come out as
 * the same new file, at most one of them is that file to the byte and the rest
 * can only be asked about.
 *
 * Separately, a new file may be the twin of one that is still here: a copy,
 * with the original left where it was. Nothing has gone, so nothing is moved;
 * the two are noted, because the listens will now be split between them and
 * because one of them is likely to go later.
 */
export function propose(gone: FileRow[], fresh: FileRow[], scanned: FileRow[]): Proposal {
  const proposal: Proposal = { moves: [], asks: [], alike: [] };
  if (fresh.length === 0) return proposal;

  if (gone.length > 0) {
    const arrived = new Map(fresh.map((row) => [row.id, row]));
    const went = new Map(gone.map((row) => [row.id, row]));
    const claims = new Map<string, FileRow[]>();
    for (const [from, to] of matchTracks(gone.map(asWanted), fresh.map(asLocal))) {
      // A number that changed hands can come out as itself: the same file
      // after all, renamed and retagged between two scans.
      if (from === to) continue;
      const was = went.get(from)!;
      const list = claims.get(to);
      if (list) list.push(was);
      else claims.set(to, [was]);
    }
    for (const [to, claimants] of claims) {
      const now = arrived.get(to)!;
      const exact = claimants.filter((was) => identical(was, now));
      for (const was of claimants) {
        const sure = exact.length === 1 && exact[0] === was;
        (sure ? proposal.moves : proposal.asks).push({ from: was.id, to });
      }
    }
  }

  // Filed by size and length, so that finding a twin is a look in a map and
  // not a walk through the library for every file that has appeared.
  const bySizeAndLength = new Map<string, FileRow[]>();
  for (const row of scanned) {
    if (row.size == null || row.durationSec <= 0) continue;
    const key = `${row.size}:${millis(row.durationSec)}`;
    const list = bySizeAndLength.get(key);
    if (list) list.push(row);
    else bySizeAndLength.set(key, [row]);
  }
  const noted = new Set<string>();
  for (const row of fresh) {
    if (row.size == null || row.durationSec <= 0) continue;
    const twins = (bySizeAndLength.get(`${row.size}:${millis(row.durationSec)}`) ?? [])
      .filter((other) => other.id !== row.id && namedAlike(row, other))
      .sort((a, b) => older(a.id, b.id));
    const twin = twins[0];
    if (!twin || noted.has(pairKey(row.id, twin.id))) continue;
    noted.add(pairKey(row.id, twin.id));
    const [first, second] = older(twin.id, row.id) <= 0 ? [twin, row] : [row, twin];
    proposal.alike.push({ from: first.id, to: second.id });
  }

  return proposal;
}

/** A pair as it is written down, and what has been decided about it. */
export type Noted = Pair & { state: 'alike' | 'asked' | 'apart' };

export type Settled = {
  /** To be done now, without asking. */
  moves: Pair[];
  /** To be put to the user. */
  asks: Pair[];
  /** To be remembered, and nothing done. */
  alike: Pair[];
  /** Pairs already written down that no longer stand as they are. */
  retired: Pair[];
};

/**
 * What is to be done about a proposal, given what each file has to its name.
 *
 * [holds] says whether anything of the user's own is filed under an id: a
 * listen, a place in a list, something corrected by hand. [here] says whether
 * the scan returned it.
 *
 * The rule that everything else follows from is that two songs' histories are
 * never joined without somebody saying so. A move is only made onto a file
 * that has nothing of its own -- or whose own things are leaving in the same
 * breath, which is what a rebuilt media database looks like: every number
 * handed to a different song, and each song's history to be passed along the
 * chain at once. A move that would land on something is asked about instead.
 * One that carries nothing of the user's lands on nothing that matters, and
 * is let through: all it does is stop the old number being looked for.
 *
 * A likeness is only worth asking about when the file that went had something
 * to carry. A pair the user has already said is two songs is not brought up
 * again, by any route.
 *
 * Twins that were noted earlier are looked at again here. If one has gone and
 * the other is still here, that is the copy outliving the original, and the
 * original's things follow. If both are here and both have been listened to,
 * the history is split and only the user can say whether to join it.
 */
export function settle(
  proposal: Proposal,
  noted: Noted[],
  holds: (id: string) => boolean,
  here: (id: string) => boolean
): Settled {
  const settled: Settled = { moves: [], asks: [], alike: [], retired: [] };
  const state = new Map(noted.map((pair) => [pairKey(pair.from, pair.to), pair.state]));

  const candidates: Pair[] = [];
  for (const pair of proposal.moves) {
    if (state.get(pairKey(pair.from, pair.to)) !== 'apart') candidates.push(pair);
  }

  const ask = (pair: Pair) => {
    const key = pairKey(pair.from, pair.to);
    if (state.has(key) || !holds(pair.from)) return;
    state.set(key, 'asked');
    settled.asks.push({ from: pair.from, to: pair.to });
  };

  for (const pair of noted) {
    if (pair.state !== 'alike') continue;
    const first = here(pair.from);
    const second = here(pair.to);
    if (first === second) {
      if (first && holds(pair.from) && holds(pair.to)) {
        settled.retired.push({ from: pair.from, to: pair.to });
        state.delete(pairKey(pair.from, pair.to));
        ask(pair);
      }
      continue;
    }
    // One of the two has gone. Whatever it had goes to the one that is left.
    settled.retired.push({ from: pair.from, to: pair.to });
    state.delete(pairKey(pair.from, pair.to));
    candidates.push(first ? { from: pair.to, to: pair.from } : { from: pair.from, to: pair.to });
  }

  for (const pair of proposal.alike) {
    if (state.has(pairKey(pair.from, pair.to))) continue;
    if (holds(pair.from) && holds(pair.to)) ask(pair);
    else {
      state.set(pairKey(pair.from, pair.to), 'alike');
      settled.alike.push(pair);
    }
  }

  // Worked down until nothing more falls out, because a move that is refused
  // leaves its own file holding what it had, and that may be what another
  // move was counting on having left.
  let moving: Pair[] = [];
  const taken = new Set<string>();
  const refused: Pair[] = [];
  for (const pair of candidates) {
    if (taken.has(pair.to)) refused.push(pair);
    else {
      taken.add(pair.to);
      moving.push(pair);
    }
  }
  for (;;) {
    const leaving = new Set(moving.map((pair) => pair.from));
    const blocked = moving.filter(
      (pair) => holds(pair.from) && holds(pair.to) && !leaving.has(pair.to)
    );
    if (blocked.length === 0) break;
    refused.push(...blocked);
    moving = moving.filter((pair) => !blocked.includes(pair));
  }
  settled.moves = moving;

  for (const pair of refused) ask(pair);
  for (const pair of proposal.asks) ask(pair);

  return settled;
}
