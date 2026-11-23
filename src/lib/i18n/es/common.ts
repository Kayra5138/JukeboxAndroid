import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

/*
  Spanish tells one from many and nothing else, and zero takes the plural:
  "1 pista", "0 pistas", "3 pistas". So `oneOrMany` is the right rule here.
*/
export const common: Strings['common'] = {
  cancel: 'Cancelar',
  /** For a moment after something is taken out, the way to have it back (`ui/undo.ts`). */
  undo: 'Deshacer',
  undone: { reset: 'Restablecido', removedFromList: (title: string) => `Quitada de la lista: ${title}`, letGo: (title: string) => `Descartada: ${title}` },
  save: 'Guardar',
  done: 'Hecho',
  ok: 'Aceptar',
  typeNumber: 'Escribir un número',
  wholeFrom: (min, max) => `Un número entero del ${format.number(min)} al ${format.number(max)}`,
  close: 'Cerrar',
  back: 'Atrás',
  delete: 'Eliminar',
  remove: 'Quitar',
  add: 'Añadir',
  edit: 'Editar',
  rename: 'Renombrar',
  yes: 'Sí',
  no: 'No',
  tryAgain: 'Inténtalo de nuevo',
  retry: 'Reintentar',
  import: 'Importar',
  clear: 'Borrar',
  selectAll: 'Seleccionar todo',
  off: 'Desactivado',
  saved: 'Guardado.',
  loading: 'Cargando…',

  search: 'Buscar',
  clearSearch: 'Borrar la búsqueda',

  play: 'Reproducir',
  pause: 'Pausar',
  nextTrack: 'Pista siguiente',
  previousTrack: 'Pista anterior',
  shuffle: 'Aleatorio',
  addToQueue: 'Añadir a la cola',
  moveUp: 'Subir',
  moveDown: 'Bajar',

  unknownArtist: 'Artista desconocido',
  unknownAlbum: 'Álbum desconocido',

  tracks: (count) => `${format.number(count)} ${oneOrMany(count, 'pista', 'pistas')}`,
  songs: (count) => `${format.number(count)} ${oneOrMany(count, 'canción', 'canciones')}`,
  albums: (count) => `${format.number(count)} ${oneOrMany(count, 'álbum', 'álbumes')}`,
  artists: (count) => `${format.number(count)} ${oneOrMany(count, 'artista', 'artistas')}`,
  lists: (count) => `${format.number(count)} ${oneOrMany(count, 'lista', 'listas')}`,
  files: (count) => `${format.number(count)} ${oneOrMany(count, 'archivo', 'archivos')}`,
  minutes: (count) => `${format.number(count)} min`,
  hours: (count) => `${format.number(count)} h`,

  fileUnreadable: 'No se ha podido leer ese archivo.',
  shareWith: 'Compartir con',
  shareFailed: 'No se ha podido compartir.',
  pictureFailed: 'No se ha podido cargar esa imagen.',

  drawFailed: 'Algo ha fallado al mostrar esta pantalla.',

  drawFailedCopy: 'Copiar los detalles',

  drawFailedCopied: 'Copiado. Envíalo a quien pueda revisarlo.',

  drawFailedNotCopied: 'No se pudo copiar.',
};
