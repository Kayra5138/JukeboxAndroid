import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

/*
  "Titel" (track), "Künstler" (artist) and "Ordner" (folder) are the same in
  the singular and the plural, so those counts are one wording; the others
  choose between two.
*/
export const common: Strings['common'] = {
  cancel: 'Abbrechen',
  save: 'Speichern',
  done: 'Fertig',
  ok: 'OK',
  close: 'Schließen',
  back: 'Zurück',
  delete: 'Löschen',
  remove: 'Entfernen',
  add: 'Hinzufügen',
  edit: 'Bearbeiten',
  rename: 'Umbenennen',
  yes: 'Ja',
  no: 'Nein',
  tryAgain: 'Erneut versuchen',
  retry: 'Wiederholen',
  import: 'Importieren',
  /* Beside "Alle auswählen", once everything is chosen: it un-chooses. */
  clear: 'Alle abwählen',
  selectAll: 'Alle auswählen',
  off: 'Aus',
  saved: 'Gespeichert.',
  loading: 'Wird geladen…',

  search: 'Suchen',
  clearSearch: 'Suche löschen',

  play: 'Abspielen',
  pause: 'Pause',
  nextTrack: 'Nächster Titel',
  previousTrack: 'Vorheriger Titel',
  shuffle: 'Zufällig',
  addToQueue: 'Zur Warteschlange',
  moveUp: 'Nach oben verschieben',
  moveDown: 'Nach unten verschieben',

  unknownArtist: 'Unbekannter Künstler',
  unknownAlbum: 'Unbekanntes Album',

  tracks: (count) => `${format.number(count)} Titel`,
  songs: (count) => `${format.number(count)} ${oneOrMany(count, 'Song', 'Songs')}`,
  albums: (count) => `${format.number(count)} ${oneOrMany(count, 'Album', 'Alben')}`,
  artists: (count) => `${format.number(count)} Künstler`,
  lists: (count) => `${format.number(count)} ${oneOrMany(count, 'Liste', 'Listen')}`,
  files: (count) => `${format.number(count)} ${oneOrMany(count, 'Datei', 'Dateien')}`,
  minutes: (count) => `${format.number(count)} Min.`,
  hours: (count) => `${format.number(count)} Std.`,

  fileUnreadable: 'Diese Datei konnte nicht gelesen werden.',
  pictureFailed: 'Dieses Bild ließ sich nicht laden.',

  drawFailed: 'Beim Anzeigen dieses Bildschirms ist etwas schiefgelaufen.',
};
