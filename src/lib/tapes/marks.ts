import { useMemo, useSyncExternalStore } from 'react';

import { db, readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { recognise } from '../identity/index.ts';
import { scanEverything } from '../media/library.ts';
import { createStore } from '../ui/store.ts';

/**
 * Places marked in tapes as they are listened to — a line worth coming back
 * to, where a chapter really begins — each with a note of what is there if
 * one was written. In the database (`tape_marks`); shown on a tape's bar in
 * the player, in a list of the tape's own there, and all together on a
 * screen of their own.
 */
export type TapeMark = { id: number; trackId: string; positionSec: number; note: string | null; createdAt: number };

type Row = { id: number; track_id: string; position_sec: number; note: string | null; created_at: number };

const markOf = (row: Row): TapeMark => ({
  id: row.id,
  trackId: row.track_id,
  positionSec: row.position_sec,
  note: row.note,
  createdAt: row.created_at,
});

/** Every mark, by when it was made, latest first; read again whenever one is made, changed or taken away. */
const marks = createStore<readonly TapeMark[] | null>(null);

function readAll(): readonly TapeMark[] {
  try {
    return db().getAllSync<Row>('SELECT * FROM tape_marks ORDER BY created_at DESC').map(markOf);
  } catch {
    // No table yet: none marked.
    return [];
  }
}

function changed(): void {
  marks.set(readAll());
}

function all(): readonly TapeMark[] {
  let now = marks.get();
  if (now === null) {
    now = readAll();
    marks.set(now);
  }
  return now;
}

/** A blank note is no note. */
const noteOf = (note: string | null | undefined) => (note?.trim() ? note.trim() : null);

/** [trackId] marked at [positionSec], with [note]. */
export function addMark(trackId: string, positionSec: number, note?: string | null): void {
  db().runSync(
    'INSERT INTO tape_marks (track_id, position_sec, note, created_at) VALUES (?, ?, ?, ?)',
    trackId,
    Math.max(0, positionSec),
    noteOf(note),
    Date.now()
  );
  changed();
}

export function setMarkNote(id: number, note: string | null): void {
  db().runSync('UPDATE tape_marks SET note = ? WHERE id = ?', noteOf(note), id);
  changed();
}

export function removeMark(id: number): void {
  db().runSync('DELETE FROM tape_marks WHERE id = ?', id);
  changed();
}

/** Read again after marks were taken away elsewhere: with the tapes they were in, deleted. */
export function marksChanged(): void {
  if (marks.get() !== null) changed();
}

/**
 * The marks of tapes deleted in the app before their marks went with them,
 * taken away once. Only those of a tape the app knows was erased: not under
 * the library folder, and no longer looked for as a file that may have
 * moved (`identity/`). The files are compared with what was known of them
 * first, so a tape whose file changed its name has its marks taken along to
 * it before anything is looked at; and one gone some other way, a card taken
 * out or a file moved by hand, keeps its marks for when it is found again.
 */
export async function sweepMarksOnce(): Promise<void> {
  try {
    if (readSetting(SETTINGS.marksSwept) === 'true') return;
    const marked = () => db().getAllSync<{ track_id: string }>('SELECT DISTINCT track_id FROM tape_marks').map((row) => row.track_id);
    if (marked().length > 0) {
      const tracks = await scanEverything();
      // Nothing read is no reading: tried again next time.
      if (tracks.length === 0) return;
      recognise(tracks);
      const here = new Set(tracks.map((track) => track.id));
      const looked = new Set(db().getAllSync<{ id: string }>('SELECT track_id AS id FROM track_files').map((row) => row.id));
      const gone = marked().filter((id) => !here.has(id) && !looked.has(id));
      if (gone.length > 0) {
        db().runSync(`DELETE FROM tape_marks WHERE track_id IN (${gone.map(() => '?').join(',')})`, ...gone);
        marksChanged();
      }
    }
    writeSetting(SETTINGS.marksSwept, 'true');
  } catch (error) {
    console.warn('Could not tidy the marks of deleted tapes', error);
  }
}

/** Every mark, latest made first. */
export function useAllMarks(): readonly TapeMark[] {
  return useSyncExternalStore(marks.subscribe, all);
}

/** [trackId]'s marks, in the order they come in it. */
export function useMarks(trackId: string | null): readonly TapeMark[] {
  const every = useAllMarks();
  return useMemo(
    () => (trackId ? every.filter((mark) => mark.trackId === trackId).sort((a, b) => a.positionSec - b.positionSec) : []),
    [every, trackId]
  );
}
