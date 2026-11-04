import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

const months = (count: number) => `${format.number(count)} ${oneOrMany(count, 'mes', 'meses')}`;
const times = (count: number) => oneOrMany(count, 'una vez', `${format.number(count)} veces`);

export const space: Strings['space'] = {
  title: 'Liberar espacio',
  rowNote: 'Canciones que nunca escuchas, saltas o tienes dos veces, y los archivos más grandes',
  note: 'Canciones que podrían irse para hacer sitio en el teléfono, cada una con el motivo. Marca las que quieras quitar; Android vuelve a preguntar antes de eliminar nada.',
  groups: {
    copy: 'Copias de la misma canción',
    skipped: 'Saltadas a menudo',
    neverPlayed: 'Nunca reproducidas',
    forgotten: 'Sin reproducir desde hace tiempo',
    large: 'Archivos más grandes',
  },
  groupSize: (count, size) => `${common.songs(count)} · ${size}`,
  megabytes: (mb) => `${format.decimal(mb, 1)} MB`,
  gigabytes: (gb) => `${format.decimal(gb, 1)} GB`,
  why: {
    copy: 'Se queda otra copia de esta canción, que recibe sus escuchas',
    skipped: (skips, heard, after) =>
      heard === 0
        ? `Saltada ${times(skips)}, de media a los ${format.number(after)} s, nunca escuchada hasta el final`
        : `Saltada ${times(skips)}, de media a los ${format.number(after)} s, escuchada hasta el final ${times(heard)}`,
    neverPlayed: (added) => `Nunca reproducida, en el teléfono desde el ${format.date(new Date(added))}`,
    forgotten: (last) => `Reproducida por última vez el ${format.date(new Date(last))}`,
    large: 'Uno de los archivos más grandes',
  },
  listSeparator: ', ',
  inLists: (names) => `En ${names}`,
  showHint: 'Muestra u oculta las canciones de este grupo',
  tickGroup: (group) => `Todo ${group}`,
  delete: (count, size) => `Eliminar ${common.songs(count)} (${size})`,
  freed: (count, size) => `${common.songs(count)} ${oneOrMany(count, 'eliminada', 'eliminadas')}, ${size} liberados.`,
  notDeleted: 'No se eliminó nada.',
  empty: 'Nada que liberar: todas las canciones se han escuchado hace poco, ninguna se salta a menudo y ninguna está dos veces.',
  auto: {
    heading: 'Automáticamente',
    title: 'Eliminar descargas sin escuchar',
    off: 'Desactivado. Las canciones que Jukebox descargó por sí misma pueden eliminarse solas cuando nadie las ha escuchado en un tiempo. Los archivos que llegaron de otra forma nunca se tocan.',
    after: (count) =>
      `Las canciones que Jukebox descargó por sí misma se eliminan cuando pasan ${months(count)} sin escucharlas; se revisa una vez al día. Nunca la canción que suena, ni un archivo que llegó de otra forma.`,
    months: 'Meses sin escuchar',
    monthCount: (count) => months(count),
    favorites: 'También canciones en Favoritos',
    lists: 'También canciones en listas',
  },
};
