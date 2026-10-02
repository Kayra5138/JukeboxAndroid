import { version } from '../../../package.json';
import JukeboxAudio from '../../../modules/jukebox-audio';
import { db } from '../db/index.ts';
import { scanLibrary } from '../media/library.ts';
import {
  mergeTables,
  referencedArtwork,
  referencedIds,
  remapTables,
  summarise,
  type Summary,
} from './apply.ts';
import { BACKUP_FORMAT, parseBackup, type Backup, type BackupTrack, type Cell } from './format.ts';
import { matchTracks } from './match.ts';
import { holdsAnything, readSettings, readTables, restore, type BackupDb } from './store.ts';

export { BackupError } from './format.ts';
export type { Summary } from './apply.ts';

/**
 * Taking everything the app has kept out of it, and putting it back.
 *
 * This file is only the errands: asking the database, the library and the
 * phone for things, in order. Every decision about what a backup means -- which
 * song is which, what is kept when two versions disagree -- is made in the
 * files beside it, where it can be tested without any of those three.
 */

function open(): BackupDb {
  const database = db();
  return {
    all: <T,>(sql: string, ...params: Cell[]) => database.getAllSync<T>(sql, params),
    run: (sql: string, ...params: Cell[]) => {
      database.runSync(sql, params);
    },
    transaction: (work: () => void) => database.withTransactionSync(work),
  };
}

/** What the player was told that the database does not hold. */
async function readSound(): Promise<Backup['sound']> {
  const sound: Backup['sound'] = {};
  // Each is asked for by itself and allowed to fail by itself. A phone with no
  // equalizer still has a history worth saving.
  try {
    sound.effects = await JukeboxAudio.getAudioEffectsAsync?.();
  } catch {}
  try {
    const all = await JukeboxAudio.getTransitionsAsync?.();
    if (all) {
      // Its settings, without what the phone said about its own limits.
      const settings: Record<string, unknown> = { ...all };
      for (const key of ['maxAutoMs', 'maxManualMs', 'maxPauseMs', 'maxSeekMs', 'defaults']) {
        delete settings[key];
      }
      sound.transitions = settings;
    }
  } catch {}
  try {
    const state = await JukeboxAudio.getEqualizerAsync?.();
    if (state) {
      sound.equalizer = {
        enabled: state.enabled,
        preset: state.preset,
        bands: state.bands,
        bass: state.bass,
        virtualizer: state.virtualizer,
        loudness: state.loudness,
      };
    }
  } catch {}
  return sound;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

/**
 * Hands the player its settings back.
 *
 * The player checks whatever it is given, so these are passed on as they were
 * found. The equalizer is the exception worth a look first: its bands are the
 * phone's, and a set made for five bands means nothing to a phone with ten.
 */
async function writeSound(sound: Backup['sound']): Promise<void> {
  try {
    if (isObject(sound.effects)) await JukeboxAudio.setAudioEffectsAsync?.(sound.effects as never);
  } catch {}
  try {
    if (isObject(sound.transitions)) {
      await JukeboxAudio.setTransitionsAsync?.(sound.transitions as never);
    }
  } catch {}
  try {
    const wanted = sound.equalizer;
    const here = await JukeboxAudio.getEqualizerAsync?.();
    if (
      here &&
      isObject(wanted) &&
      Array.isArray(wanted.bands) &&
      wanted.bands.length === here.bandCount &&
      wanted.bands.every((band) => typeof band === 'number')
    ) {
      await JukeboxAudio.setEqualizerAsync?.(wanted as never);
    }
  } catch {}
}

/** A name with the day in it, so two backups in one folder can be told apart. */
function fileName(now: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `Jukebox-backup-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}.zip`;
}

/**
 * Everything the app has kept, as one backup.
 *
 * Every song the tables mention is written down with a description of itself:
 * where its file is, what it is called, how long it runs. That description is
 * the only thing that will find the song again on a phone where its id is
 * different. A song that has been deleted since is described from the last
 * time it was played, which is the last anybody knew of it.
 */
async function gather(): Promise<Backup> {
  const database = open();
  const tables = readTables(database);
  const library = new Map((await scanLibrary()).map((track) => [track.id, track]));

  const lastHeard = new Map<string, { title: Cell; artist: Cell; filename: Cell }>();
  for (const row of tables.plays) {
    lastHeard.set(row.track_id as string, {
      title: row.title ?? null,
      artist: row.artist ?? null,
      filename: row.filename ?? null,
    });
  }

  const text = (value: Cell | undefined) => (typeof value === 'string' ? value : null);
  const tracks: BackupTrack[] = [];
  for (const id of referencedIds(tables)) {
    const track = library.get(id);
    const heard = lastHeard.get(id);
    tracks.push(
      track
        ? {
            id,
            filename: track.filename,
            folder: track.folder,
            title: track.title,
            artist: track.artist,
            durationSec: track.durationSec,
          }
        : {
            id,
            filename: text(heard?.filename),
            folder: null,
            title: text(heard?.title),
            artist: text(heard?.artist),
            durationSec: null,
          }
    );
  }

  return {
    format: BACKUP_FORMAT,
    app: version,
    exportedAt: Date.now(),
    tracks,
    settings: readSettings(database),
    sound: await readSound(),
    tables,
  };
}

/**
 * Saves everything to a file the user chooses a place for.
 *
 * Answers false if they backed out of choosing, which is not a failure.
 */
export async function exportBackup(): Promise<boolean> {
  if (!JukeboxAudio.exportBackupAsync) throw new Error('Install the updated Android build to export.');

  const backup = await gather();
  return JukeboxAudio.exportBackupAsync(
    fileName(new Date(backup.exportedAt)),
    JSON.stringify(backup),
    referencedArtwork(backup.tables)
  );
}

/** A backup that has been read and looked at, and not yet acted on. */
export type Opened = {
  backup: Backup;
  /** Which library track each of the backup's songs is here. */
  to: Map<string, string>;
  artworkHome: string;
  summary: Summary;
  /** Whether the phone already holds something an import could overwrite. */
  occupied: boolean;
};

/**
 * Lets the user choose a backup, and says what is in it.
 *
 * Nothing is changed. This is everything that can be found out beforehand --
 * that the file is a backup, how much is in it, how many of its songs are on
 * this phone -- so that the question put to the user afterwards is one they
 * can answer. Null if they backed out of choosing.
 */
export async function openBackup(): Promise<Opened | null> {
  if (!JukeboxAudio.openBackupAsync) throw new Error('Install the updated Android build to import.');

  const picked = await JukeboxAudio.openBackupAsync();
  if (!picked) return null;

  const backup = parseBackup(picked.json);
  const to = matchTracks(backup.tracks, await scanLibrary());
  return {
    backup,
    to,
    artworkHome: picked.artworkHome,
    summary: summarise(backup.tables, to),
    occupied: holdsAnything(open()),
  };
}

/**
 * Brings an opened backup in.
 *
 * Merging reads what the phone holds and what the backup holds and writes the
 * two combined; replacing writes the backup alone. Either way it is written in
 * one go or not at all. The pictures are moved first, because a cover that
 * turns up without its row is harmless and a row without its cover is not.
 *
 * The player's own settings come across only when replacing. Merging is adding
 * a history to a phone somebody has already set up the way they like it.
 */
export async function applyBackup(opened: Opened, mode: 'merge' | 'replace'): Promise<void> {
  const { backup, to, artworkHome } = opened;
  const { tables } = remapTables(backup.tables, to, backup.tracks, artworkHome);

  await JukeboxAudio.adoptBackupArtworkAsync?.(referencedArtwork(tables));

  const database = open();
  const final = mode === 'merge' ? mergeTables(readTables(database), tables) : tables;
  restore(database, final, backup.settings, mode);

  if (mode === 'replace') await writeSound(backup.sound);
}

/** Starts the app again so that everything on screen is read afresh. */
export async function restart(): Promise<void> {
  await JukeboxAudio.restartAsync?.();
}
