import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

/*
  Italian tells one from many and nothing else, and nought takes the plural
  ("0 brani"), which is exactly what `oneOrMany` does. "Album" does not change.
*/
export const common: Strings['common'] = {
  cancel: 'Annulla',
  save: 'Salva',
  done: 'Fine',
  ok: 'OK',
  close: 'Chiudi',
  back: 'Indietro',
  delete: 'Elimina',
  remove: 'Rimuovi',
  add: 'Aggiungi',
  edit: 'Modifica',
  rename: 'Rinomina',
  yes: 'Sì',
  no: 'No',
  tryAgain: 'Riprova',
  retry: 'Riprova',
  import: 'Importa',
  clear: 'Deseleziona',
  selectAll: 'Seleziona tutto',
  off: 'Disattivato',
  saved: 'Salvato.',
  loading: 'Caricamento…',

  search: 'Cerca',
  clearSearch: 'Cancella la ricerca',

  play: 'Riproduci',
  pause: 'Pausa',
  nextTrack: 'Brano successivo',
  previousTrack: 'Brano precedente',
  shuffle: 'Casuale',
  addToQueue: 'Aggiungi alla coda',
  moveUp: 'Sposta su',
  moveDown: 'Sposta giù',

  unknownArtist: 'Artista sconosciuto',
  unknownAlbum: 'Album sconosciuto',

  tracks: (count) => `${format.number(count)} ${oneOrMany(count, 'brano', 'brani')}`,
  songs: (count) => `${format.number(count)} ${oneOrMany(count, 'canzone', 'canzoni')}`,
  albums: (count) => `${format.number(count)} album`,
  artists: (count) => `${format.number(count)} ${oneOrMany(count, 'artista', 'artisti')}`,
  lists: (count) => `${format.number(count)} ${oneOrMany(count, 'lista', 'liste')}`,
  files: (count) => `${format.number(count)} file`,
  minutes: (count) => `${format.number(count)} min`,
  hours: (count) => `${format.number(count)} h`,

  fileUnreadable: 'Impossibile leggere il file.',
  pictureFailed: 'Impossibile caricare l’immagine.',

  drawFailed: 'Si è verificato un problema nel mostrare questa schermata.',
};
