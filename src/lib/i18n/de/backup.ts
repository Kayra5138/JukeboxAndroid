import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const backup: Strings['backup'] = {
  imported: 'Importiert',
  importedBody:
    'Alles ist übernommen. Jukebox muss neu starten, um es anzuzeigen: Was jetzt zu sehen ist, wurde vor dem Import gelesen.',
  restart: 'Jukebox neu starten',

  question: 'Dieses Backup importieren?',
  made: (when, app) =>
    when
      ? app
        ? `Erstellt am ${when} mit Jukebox ${app}.`
        : `Erstellt am ${when}.`
      : app
        ? `Ein Backup von Jukebox ${app}.`
        : 'Ein Backup.',
  listens: (count) => `${format.number(count)} ${oneOrMany(count, 'Wiedergabe', 'Wiedergaben')}`,
  tagged: (count) =>
    `${format.number(count)} ${oneOrMany(count, 'Song mit Tags', 'Songs mit Tags')}`,
  withLyrics: (count) =>
    `${format.number(count)} ${oneOrMany(count, 'Song mit Songtext', 'Songs mit Songtext')}`,

  songs: (found, total) => {
    if (total === 0) return 'Es enthält keine Songs.';
    const missing = total - found;
    const one =
      'Seine Wiedergaben bleiben erhalten, aber seine Tags, sein Songtext und seine Plätze in Listen haben keinen Song, zu dem sie gehören, und werden weggelassen.';
    const many =
      'Ihre Wiedergaben bleiben erhalten, aber ihre Tags, Songtexte und Plätze in Listen haben keinen Song, zu dem sie gehören, und werden weggelassen.';
    /* None of them here: said as such, since "the others" would have nothing to be other than. */
    if (found === 0) {
      return total === 1
        ? `Der Song darin ist nicht auf diesem Gerät. ${one}`
        : `Keiner der ${format.number(total)} Songs darin ist auf diesem Gerät. ${many}`;
    }
    const here = `${format.number(found)} von ${format.number(total)} ${oneOrMany(total, 'Song', 'Songs')} darin ${oneOrMany(found, 'ist', 'sind')} in deiner Bibliothek.`;
    if (missing <= 0) return here;
    return missing === 1
      ? `${here} Der übrige ist nicht auf diesem Gerät. ${one}`
      : `${here} Die übrigen ${format.number(missing)} sind nicht auf diesem Gerät. ${many}`;
  },

  importing: 'Wird importiert…',
  merge: 'Zusammenführen',
  mergeHint: 'Zum Vorhandenen hinzufügen. Von diesem Gerät wird nichts entfernt.',
  replace: 'Ersetzen',
  replaceHint:
    'Löscht alles Vorhandene und verwendet stattdessen das Backup. Das kann nicht rückgängig gemacht werden.',

  notABackup: 'Diese Datei ist kein Jukebox-Backup.',
  newer: 'Dieses Backup stammt aus einer neueren Jukebox-Version. Aktualisiere die App, um es zu lesen.',
  needsBuildToExport: 'Installiere die aktualisierte Android-Version, um zu exportieren.',
  needsBuildToImport: 'Installiere die aktualisierte Android-Version, um zu importieren.',
};
