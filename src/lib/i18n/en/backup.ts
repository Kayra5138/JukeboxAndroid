import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/** Exporting everything, and bringing a backup in. */
export const backup = {
  imported: 'Imported',
  importedBody:
    'Everything is in. Jukebox has to start again to show it: what is on screen now was read before the import.',
  restart: 'Restart Jukebox',

  question: 'Import this backup?',
  /** When the backup was made and by which version, as far as it says. */
  made: (when: string | null, app: string | null) =>
    `${when ? `Made ${when}` : 'A backup'}${app ? ` by Jukebox ${app}` : ''}.`,
  listens: (count: number) => `${format.number(count)} ${oneOrMany(count, 'listen', 'listens')}`,
  tagged: (count: number) =>
    `${format.number(count)} ${oneOrMany(count, 'tagged song', 'tagged songs')}`,
  /** The podcasts and channels a backup follows, said where it follows any. */
  followed: (count: number) => oneOrMany(count, '1 show followed', `${format.number(count)} shows followed`),
  withLyrics: (count: number) =>
    `${format.number(count)} ${oneOrMany(count, 'song with lyrics', 'songs with lyrics')}`,

  /** How many of the backup's songs are on this phone, and what becomes of the rest. */
  songs: (found: number, total: number) => {
    if (total === 0) return 'It does not mention any songs.';
    const missing = total - found;
    const here = `${format.number(found)} of ${format.number(total)} ${oneOrMany(total, 'song', 'songs')} in it ${oneOrMany(found, 'is', 'are')} in your library.`;
    return missing > 0
      ? `${here} The other ${format.number(missing)} ${oneOrMany(missing, 'is', 'are')} not on this phone. Their listens are kept, but their tags, lyrics and places in lists have no song to go with and are left out.`
      : here;
  },

  importing: 'Importing…',
  merge: 'Merge',
  mergeHint: 'Add it to what is here. Nothing on this phone is removed.',
  replace: 'Replace',
  replaceHint: 'Delete what is here and use the backup instead. This cannot be undone.',

  notABackup: 'That file is not a Jukebox backup.',
  newer: 'That backup was made by a newer Jukebox. Update the app to read it.',
  needsBuildToExport: 'Install the updated Android build to export.',
  needsBuildToImport: 'Install the updated Android build to import.',

  /** Settings → Your data: listens brought in from another app's history, and what is asked first. */
  history: {
    title: 'Import listening history',
    note: 'Your listens from Last.fm, Spotify, Apple Music or ListenBrainz, from the files they let you download. You are shown what was found and asked before anything changes.',
    question: 'Import these listens?',
    /** The first and last listen brought in, each a date. */
    range: (from: string, to: string) => (from === to ? `All on ${from}.` : `From ${from} to ${to}.`),
    /** How many of the listens are of songs in the library; [total] is never nought. */
    matched: (matched: number, total: number) =>
      `${format.number(matched)} of the ${format.number(total)} ${oneOrMany(matched, 'is of a song', 'are of songs')} in your library. The rest are kept under their own names, and count in your statistics all the same.`,
    /** Said only where [count] is not nought. */
    short: (count: number) =>
      `${format.number(count)} shorter than half a minute ${oneOrMany(count, 'is', 'are')} left out.`,
    /** Said only where [count] is not nought. */
    already: (count: number) =>
      `${format.number(count)} already in your history ${oneOrMany(count, 'is', 'are')} left out.`,
    nothing: 'Every listen in them is in your history already, or too short to count.',
    added: (count: number) => `${format.number(count)} ${oneOrMany(count, 'listen', 'listens')} added to your history.`,
    notHistory:
      'That is not a listening history Jukebox can read. Choose the files Last.fm, Spotify, Apple Music or ListenBrainz gave you: CSV or JSON, or the zip they came in.',
    tooBig: 'That file is too big to read.',
    failed: 'The listens could not be imported. Nothing was changed.',
  },
};
