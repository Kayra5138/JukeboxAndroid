import { version } from '../../../package.json';
import JukeboxAudio from '../../../modules/jukebox-audio';
import { db, forgetSettings } from '../db/index.ts';
import { forBridge } from '../equalizer/bridge.ts';
import { strings } from '../i18n/languages.ts';
import { scanEverything } from '../media/library.ts';
import {
  mergeTables,
  referencedArtwork,
  referencedIds,
  remapPlaces,
  remapTables,
  summarise,
  type Summary,
} from './apply.ts';
import { BACKUP_FORMAT, parseBackup, type Backup, type BackupTapes, type BackupTrack, type Cell } from './format.ts';
import { setSmartRewind, setTapeFlag, smartRewind, tapeFlag } from '../tapes/settings.ts';
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
    prepare: (sql: string) => {
      const statement = database.prepareSync(sql);
      return { run: (...params: Cell[]) => void statement.executeSync(params), done: () => statement.finalizeSync() };
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
  // The switch only. What each file was measured at stays behind: it is a
  // fact about this phone's copies, and another phone measures its own.
  try {
    const loudness = await JukeboxAudio.getLoudnessAsync?.();
    if (loudness) sound.loudness = loudness;
  } catch {}
  try {
    const state = await JukeboxAudio.getEqualizerAsync?.();
    if (state) {
      sound.equalizer = {
        enabled: state.enabled,
        // The bands, the preamp and the curves kept under names. Nothing in
        // them belongs to this phone, so they mean the same on the next one.
        ...(state.parametric
          ? {
              parametric: {
                bands: state.parametric.bands,
                preampDb: state.parametric.preampDb,
                presets: state.parametric.presets,
              },
            }
          : { preset: state.preset, bands: state.bands }),
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
 * A part of the sound setup the player would not take back, said in the log.
 *
 * Each part is tried on its own and a failure of one does not stop the rest,
 * which is right; saying nothing about it was not. A backup's equalizer went
 * unrestored for as long as it did because nothing recorded that it had.
 */
function unrestored(part: string, failure: unknown): void {
  console.warn(`The backup's ${part} could not be put back`, failure);
}

/**
 * Hands the player its settings back.
 *
 * The player checks whatever it is given, so these are passed on as they were
 * found. That goes for the equalizer too, with one case worth a look first. A
 * backup from before the app had an equalizer of its own holds levels for
 * the phone's bands and not what frequencies they were at, so they cannot be
 * turned into anything: the switch and the tone controls are put back and the
 * bands are left as they are here.
 */
async function writeSound(sound: Backup['sound']): Promise<void> {
  try {
    if (isObject(sound.effects)) await JukeboxAudio.setAudioEffectsAsync?.(forBridge(sound.effects) as never);
  } catch (failure) {
    unrestored('effects', failure);
  }
  try {
    if (isObject(sound.transitions)) {
      await JukeboxAudio.setTransitionsAsync?.(forBridge(sound.transitions) as never);
    }
  } catch (failure) {
    unrestored('crossfade', failure);
  }
  try {
    if (isObject(sound.loudness)) await JukeboxAudio.setLoudnessAsync?.(forBridge(sound.loudness) as never);
  } catch (failure) {
    unrestored('loudness', failure);
  }
  try {
    const wanted = sound.equalizer;
    const here = await JukeboxAudio.getEqualizerAsync?.();
    if (here && isObject(wanted)) {
      if (here.parametric) {
        // `preset` and `bands` are the old phone's and are not sent on.
        const { preset: _preset, bands: _bands, ...rest } = wanted;
        await JukeboxAudio.setEqualizerAsync?.(forBridge(rest) as never);
      } else if (
        // A native build that still drives the phone's equalizer: its bands
        // are the phone's, and a set made for five means nothing to ten.
        Array.isArray(wanted.bands) &&
        wanted.bands.length === here.bandCount &&
        wanted.bands.every((band) => typeof band === 'number')
      ) {
        await JukeboxAudio.setEqualizerAsync?.(forBridge(wanted) as never);
      }
    }
  } catch (failure) {
    unrestored('equalizer', failure);
  }
}

/** What the player keeps of tapes: where each was left, and its switches. Nothing, where it cannot say. */
async function readTapes(): Promise<BackupTapes | undefined> {
  try {
    return {
      places: (await JukeboxAudio.getTapePlacesAsync?.()) ?? {},
      smartRewind: smartRewind(),
      flags: { skipSilence: tapeFlag('skipSilence'), voiceClarity: tapeFlag('voiceClarity'), skipSponsors: tapeFlag('skipSponsors') },
    };
  } catch {
    return undefined;
  }
}

/**
 * Where tapes were left handed back to the player, under this phone's ids;
 * and, replacing, its switches as well, as the sound setup is.
 */
async function writeTapes(tapes: BackupTapes | undefined, to: Map<string, string>, mode: 'merge' | 'replace'): Promise<void> {
  if (!tapes) return;
  try {
    await JukeboxAudio.bringTapePlacesAsync?.(remapPlaces(tapes.places, to), mode === 'replace');
  } catch (failure) {
    unrestored('places in tapes', failure);
  }
  if (mode !== 'replace') return;
  try {
    if (tapes.smartRewind != null) setSmartRewind(tapes.smartRewind);
    for (const [name, on] of Object.entries(tapes.flags ?? {})) {
      if (on != null) setTapeFlag(name as keyof NonNullable<BackupTapes['flags']>, on);
    }
  } catch (failure) {
    unrestored('tape settings', failure);
  }
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
 * time it was played, which is the last anybody knew of it, and has a length
 * only if it was ever skipped.
 */
async function gather(): Promise<Backup> {
  const database = open();
  const tables = readTables(database);
  const tapes = await readTapes();
  // The tracks left out of the library too: a folder switched off still has
  // its plays and tags in the tables, and they need describing like any other.
  const library = new Map((await scanEverything()).map((track) => [track.id, track]));

  const lastHeard = new Map<string, { title: Cell; artist: Cell; filename: Cell }>();
  for (const row of tables.plays) {
    lastHeard.set(row.track_id as string, {
      title: row.title ?? null,
      artist: row.artist ?? null,
      filename: row.filename ?? null,
    });
  }

  // A listen does not say how long the song was, but a skip does, and for a
  // song that is gone it is the only place the length was ever written down.
  // Worth carrying: the length is what tells two files with one name apart.
  const lengthWhenSkipped = new Map<string, number>();
  for (const row of tables.skips) {
    if (typeof row.duration_sec === 'number' && row.duration_sec > 0) {
      lengthWhenSkipped.set(row.track_id as string, row.duration_sec);
    }
  }

  const text = (value: Cell | undefined) => (typeof value === 'string' ? value : null);
  const tracks: BackupTrack[] = [];
  // A tape that was only ever listened to has a place and nothing else, and needs describing to be found again too.
  for (const id of new Set([...referencedIds(tables), ...Object.keys(tapes?.places ?? {})])) {
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
            durationSec: lengthWhenSkipped.get(id) ?? null,
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
    ...(tapes ? { tapes } : {}),
    tables,
  };
}

/**
 * Saves everything to a file the user chooses a place for.
 *
 * Answers false if they backed out of choosing, which is not a failure.
 */
export async function exportBackup(): Promise<boolean> {
  if (!JukeboxAudio.exportBackupAsync) throw new Error(strings().backup.needsBuildToExport);

  const backup = await gather();
  return JukeboxAudio.exportBackupAsync(
    fileName(new Date(backup.exportedAt)),
    JSON.stringify(backup),
    referencedArtwork(backup.tables)
  );
}

/**
 * Saves everything into the folder at [tree] with no picker, the same file
 * as above, and has the oldest backups there beyond [keep] deleted. For
 * automatic backup: see `auto.ts`. Answers the name it was saved under, and
 * throws where it could not be.
 */
export async function writeBackupToFolder(tree: string, keep: number): Promise<string> {
  if (!JukeboxAudio.writeBackupToFolderAsync) throw new Error(strings().backup.needsBuildToExport);

  const backup = await gather();
  return JukeboxAudio.writeBackupToFolderAsync(
    tree,
    fileName(new Date(backup.exportedAt)),
    JSON.stringify(backup),
    referencedArtwork(backup.tables),
    keep
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
  if (!JukeboxAudio.openBackupAsync) throw new Error(strings().backup.needsBuildToImport);

  const picked = await JukeboxAudio.openBackupAsync();
  if (!picked) return null;

  const backup = parseBackup(picked.json);
  // Matched against everything under the folder, left out or not, so that a
  // restore finds the history of a folder that is switched off for now.
  const to = matchTracks(backup.tracks, await scanEverything());
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
  const here = mode === 'merge' ? readTables(database) : null;
  const final = here ? mergeTables(here, tables) : tables;
  restore(database, final, backup.settings, mode, here ?? undefined);
  // Written past the settings' own way in: read from the table again.
  forgetSettings();

  if (mode === 'replace') await writeSound(backup.sound);
  await writeTapes(backup.tapes, to, mode);
}

/** Starts the app again so that everything on screen is read afresh. */
export async function restart(): Promise<void> {
  await JukeboxAudio.restartAsync?.();
}
