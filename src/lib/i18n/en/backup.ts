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
};
