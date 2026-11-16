import { AppState } from 'react-native';
import { defaultDatabaseDirectory } from 'expo-sqlite';

import JukeboxAudio from '../../../modules/jukebox-audio';
import { strings } from '../i18n/languages';
import { libraryState, subscribeLibrary } from '../library/index';
import { librarySetAside, setAsideRules, watchSetAside } from '../library/setAside';
import {
  shuffleLabel,
  shuffleNamesOf,
  shuffleSource,
  shuffleTracks,
  shuffleWordsFor,
  watchShuffle,
} from '../lists/shuffleSource';
import { db } from './index';

/**
 * A copy of what the car, the widget and the notification need to read.
 *
 * They are answered by the playback service, which is not JavaScript and has
 * to read the library for itself. It used to open this database to do it, and
 * that lost data. Not sometimes: every time.
 *
 * The service reads with Android's SQLite and this side writes with the copy
 * of SQLite that expo-sqlite carries, and two copies of SQLite in one process
 * cannot see each other's locks. So the service, believing it was alone,
 * tidied up when it had finished reading: it folded the write-ahead log into
 * the database and deleted it. This side went on writing into the log it
 * still held open, which by then was a file with no name. Everything written
 * from that moment looked saved, read back correctly, and was gone the next
 * time the app was closed or updated: corrections to a song, covers picked
 * from the gallery, the listens of a whole drive.
 *
 * So the service never opens this database again. What it needs is written
 * out here, by this side's own SQLite, into a small database of its own, and
 * handed over by renaming it into place. A rename is all or nothing, so the
 * service only ever sees a whole copy, and nobody holds the two files open at
 * once.
 *
 * The copy runs a little behind: a minute at most while the app is open, and
 * it is brought up to date whenever the app leaves the screen, which is
 * before anybody gets into a car.
 */

/** The file being written, in the same folder as the database. The service knows it by this name. */
const NEXT = 'car.next.db';

/** How often the copy is brought up to date while the app is open. */
const EVERY_MS = 60_000;

/** How long after the shuffle button's choice or the library changes the copy follows. */
const SOON_MS = 2_000;

/**
 * What goes across, and nothing else.
 *
 * The listens go as two columns of the dozen they have, and of the settings
 * only where the library is and what is left out of it: the service has no
 * use for the rest, and a copy is one more place for somebody's listening to
 * be kept.
 */
const TABLES: Record<string, string> = {
  settings: `SELECT key, value FROM main.settings WHERE key IN ('library:root', 'library:leftOut', 'library:shortest')`,
  playlists: `SELECT * FROM main.playlists`,
  playlist_tracks: `SELECT * FROM main.playlist_tracks`,
  track_tags: `SELECT track_id, tag, position FROM main.track_tags`,
  plays: `SELECT track_id, started_at FROM main.plays`,
  track_metadata: `SELECT track_id, status, title, artist, album, album_artist, track_number, artwork_url, cover_removed_at FROM main.track_metadata`,
  // The covers tracks with no row of their own were given by their record:
  // the car's tiles should wear what the phone's rows do.
  shared_covers: `SELECT track_id, artwork_url FROM main.shared_covers`,
  // The shows followed, by name and folder alone: the car's Tapes tell a
  // show's episodes from a book's parts by the folder they are in.
  podcasts: `SELECT title, folder FROM main.podcasts`,
};

/** How many rows this connection had changed when the copy was last made. */
let copiedAt = -1;

/**
 * What the shuffle button plays and says was worked out from, as it was when
 * the copy was last made: the library, the choice and the language. None of
 * them is a row of this database changing, and any of them changes what the
 * car's shuffle and the widget's are.
 */
let shuffledFrom: unknown[] = [];

const shuffleMarks = (): unknown[] => [libraryState(), shuffleSource(), shuffleLabel(), strings(), setAsideRules()];

/**
 * The shuffle button's, for the car and the widget, which cannot work it out
 * for themselves: a smart list's songs and those made from the listening are
 * known only here. Its words, and its songs in the list's order -- none for
 * everything, which they read for themselves. Nothing at all before the
 * library has been read, and they then shuffle everything, as they did.
 */
function shuffleRows(): { carTitle: string; widgetText: string | null; ids: string[] } | null {
  const state = libraryState();
  if (state.kind !== 'library') return null;
  const t = strings();
  const wanted = shuffleSource();
  const { tracks, name, gone } = shuffleTracks(wanted, state.tracks, shuffleNamesOf(t), librarySetAside());
  const playing = gone ? { kind: 'all' as const } : wanted;
  const words = shuffleWordsFor(t, playing, shuffleLabel(), name);
  return { carTitle: words.spoken, widgetText: words.shown, ids: playing.kind === 'all' ? [] : tracks.map((track) => track.id) };
}
let copying = false;

function changes(): number {
  return db().getFirstSync<{ n: number }>('SELECT total_changes() AS n')?.n ?? 0;
}

/**
 * Writes the copy and hands it over. Never throws: a car showing yesterday's
 * names is a small thing, and nothing that saves a song should fail over it.
 */
export async function publishCarCopy(): Promise<void> {
  if (copying || !JukeboxAudio.publishCarCopyAsync) return;
  copying = true;
  try {
    const database = db();
    const path = `${String(defaultDatabaseDirectory).replace(/^file:\/\//, '')}/${NEXT}`;

    // Not attached from an earlier try that died half way. An error here is
    // the usual case, since usually it is not.
    try {
      database.execSync('DETACH DATABASE car');
    } catch {
      // Nothing was attached.
    }

    const marks = shuffleMarks();
    const shuffle = shuffleRows();
    database.execSync(`ATTACH DATABASE '${path.replace(/'/g, "''")}' AS car`);
    try {
      // One transaction, so the file is either the whole copy or not touched.
      database.execSync(
        [
          'BEGIN',
          ...Object.entries(TABLES).flatMap(([name, select]) => [
            `DROP TABLE IF EXISTS car."${name}"`,
            `CREATE TABLE car."${name}" AS ${select}`,
          ]),
          'DROP TABLE IF EXISTS car.shuffle_words',
          'DROP TABLE IF EXISTS car.shuffle_tracks',
          'DROP TABLE IF EXISTS car.set_aside_tracks',
        ].join(';\n')
      );
      /*
        The songs set aside, by id, worked out here as the Tracks view works
        them out: the car keeps them out of its Tracks and of shuffling
        everything, as the phone does, and could not tell for itself which
        record or artist a song is filed under the way the phone does.
      */
      if (libraryState().kind === 'library') {
        database.execSync('CREATE TABLE car.set_aside_tracks (track_id TEXT PRIMARY KEY)');
        const aside = database.prepareSync('INSERT OR IGNORE INTO car.set_aside_tracks (track_id) VALUES (?)');
        try {
          for (const id of librarySetAside()) aside.executeSync(id);
        } finally {
          aside.finalizeSync();
        }
      }
      if (shuffle) {
        database.execSync('CREATE TABLE car.shuffle_words (car_title TEXT, widget_text TEXT); CREATE TABLE car.shuffle_tracks (position INTEGER, track_id TEXT)');
        database.runSync('INSERT INTO car.shuffle_words (car_title, widget_text) VALUES (?, ?)', shuffle.carTitle, shuffle.widgetText);
        const insert = database.prepareSync('INSERT INTO car.shuffle_tracks (position, track_id) VALUES (?, ?)');
        try {
          shuffle.ids.forEach((id, position) => insert.executeSync(position, id));
        } finally {
          insert.finalizeSync();
        }
      }
      database.execSync('COMMIT');
    } catch (error) {
      try {
        database.execSync('ROLLBACK');
      } catch {
        // It had not begun, or had already ended.
      }
      throw error;
    } finally {
      database.execSync('DETACH DATABASE car');
    }

    // Writing the copy changes rows too, in the copy, and they are counted.
    // So the count is taken after the writing, or every copy would look like a
    // reason to make another. But before the handing over, which is waited
    // for: a song saved while it waits is not in this copy, and counted after
    // it would pass for copied and stay out of the car until something else
    // was saved.
    const written = changes();
    await JukeboxAudio.publishCarCopyAsync();
    copiedAt = written;
    shuffledFrom = marks;
  } catch (error) {
    console.warn('The copy for the car could not be written.', error);
  } finally {
    copying = false;
  }
}

function publishIfChanged(): void {
  try {
    const marks = shuffleMarks();
    const moved = marks.some((mark, at) => mark !== shuffledFrom[at]);
    if (moved || changes() !== copiedAt) void publishCarCopy();
  } catch {
    // A database that will not open has bigger problems than a stale copy.
  }
}

/** Keeps the copy up to date for as long as the app is running. Answers with how to stop. */
export function keepCarCopy(): () => void {
  void publishCarCopy();
  const timer = setInterval(publishIfChanged, EVERY_MS);
  const leaving = AppState.addEventListener('change', (state) => {
    if (state !== 'active') publishIfChanged();
  });
  /*
    What the shuffle button plays chosen again, or the library read again:
    the widget's tile says so within seconds rather than within the minute.
    Held a moment first, a library being read changing several times running.
  */
  let soon: ReturnType<typeof setTimeout> | null = null;
  const presently = () => {
    if (soon) clearTimeout(soon);
    soon = setTimeout(() => {
      soon = null;
      publishIfChanged();
    }, SOON_MS);
  };
  const shuffling = watchShuffle(presently);
  const setting = watchSetAside(presently);
  const reading = subscribeLibrary(presently);
  return () => {
    clearInterval(timer);
    if (soon) clearTimeout(soon);
    leaving.remove();
    shuffling();
    setting();
    reading();
  };
}
