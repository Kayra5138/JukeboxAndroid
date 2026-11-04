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
  followed: (count) => oneOrMany(count, '1 gefolgte Sendung', `${format.number(count)} gefolgte Sendungen`),
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

  history: {
    title: 'Hörverlauf importieren',
    note: 'Deine Wiedergaben von Last.fm, Spotify oder ListenBrainz, aus den Dateien, die du dort herunterladen kannst. Du siehst, was gefunden wurde, und wirst gefragt, bevor sich etwas ändert.',
    question: 'Diese Wiedergaben importieren?',
    range: (from, to) => (from === to ? `Alle am ${from}.` : `Von ${from} bis ${to}.`),
    matched: (matched, total) =>
      `${format.number(matched)} von ${format.number(total)} ${oneOrMany(matched, 'gehört zu einem Song', 'gehören zu Songs')} in deiner Bibliothek. Die übrigen bleiben unter ihren eigenen Namen erhalten und zählen trotzdem in deiner Statistik.`,
    short: (count) =>
      `${oneOrMany(count, 'Eine Wiedergabe ist', `${format.number(count)} Wiedergaben sind`)} kürzer als eine halbe Minute und ${oneOrMany(count, 'wird', 'werden')} ausgelassen.`,
    already: (count) =>
      `${oneOrMany(count, 'Eine Wiedergabe ist', `${format.number(count)} Wiedergaben sind`)} schon in deinem Verlauf und ${oneOrMany(count, 'wird', 'werden')} ausgelassen.`,
    nothing: 'Alle Wiedergaben darin sind schon in deinem Verlauf oder zu kurz, um zu zählen.',
    added: (count) =>
      `${format.number(count)} ${oneOrMany(count, 'Wiedergabe', 'Wiedergaben')} zu deinem Verlauf hinzugefügt.`,
    notHistory:
      'Das ist kein Hörverlauf, den Jukebox lesen kann. Wähle die Dateien, die du von Last.fm, Spotify oder ListenBrainz bekommen hast: CSV oder JSON oder die ZIP-Datei, in der sie kamen.',
    tooBig: 'Diese Datei ist zu groß, um sie zu lesen.',
    failed: 'Die Wiedergaben konnten nicht importiert werden. Es wurde nichts geändert.',
  },
};
