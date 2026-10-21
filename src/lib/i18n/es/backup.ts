import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const backup: Strings['backup'] = {
  imported: 'Importado',
  importedBody:
    'Ya está todo dentro. Jukebox tiene que reiniciarse para mostrarlo: lo que ves ahora en pantalla se leyó antes de importar.',
  restart: 'Reiniciar Jukebox',

  question: '¿Importar esta copia de seguridad?',
  made: (when, app) =>
    when
      ? app
        ? `Creada el ${when} con Jukebox ${app}.`
        : `Creada el ${when}.`
      : app
        ? `Una copia creada con Jukebox ${app}.`
        : 'Una copia de seguridad.',
  listens: (count) => `${format.number(count)} ${oneOrMany(count, 'escucha', 'escuchas')}`,
  tagged: (count) =>
    `${format.number(count)} ${oneOrMany(count, 'canción etiquetada', 'canciones etiquetadas')}`,
  withLyrics: (count) =>
    `${format.number(count)} ${oneOrMany(count, 'canción con letra', 'canciones con letra')}`,

  songs: (found, total) => {
    if (total === 0) return 'No incluye ninguna canción.';
    const missing = total - found;
    const rest = oneOrMany(
      missing,
      'Sus escuchas se conservan, pero sus etiquetas, su letra y sus posiciones en listas no tienen canción a la que asociarse y se descartan.',
      'Sus escuchas se conservan, pero sus etiquetas, letras y posiciones en listas no tienen canción a la que asociarse y se descartan.'
    );
    if (total === 1) {
      return found === 1
        ? 'La canción que contiene está en tu biblioteca.'
        : `La canción que contiene no está en este teléfono. ${rest}`;
    }
    if (found === 0) {
      return `Ninguna de las ${format.number(total)} canciones que contiene está en este teléfono. ${rest}`;
    }
    if (found === total) return `Las ${format.number(total)} canciones que contiene están en tu biblioteca.`;
    const here = `${format.number(found)} de las ${format.number(total)} canciones que contiene ${oneOrMany(found, 'está', 'están')} en tu biblioteca.`;
    return missing > 0
      ? `${here} ${oneOrMany(missing, 'La otra no está', `Las otras ${format.number(missing)} no están`)} en este teléfono. ${rest}`
      : here;
  },

  importing: 'Importando…',
  merge: 'Combinar',
  mergeHint: 'Se suma a lo que ya hay. No se elimina nada de este teléfono.',
  replace: 'Reemplazar',
  replaceHint: 'Se borra lo que hay y se usa la copia en su lugar. No se puede deshacer.',

  notABackup: 'Ese archivo no es una copia de seguridad de Jukebox.',
  newer: 'Esa copia se creó con una versión más reciente de Jukebox. Actualiza la app para leerla.',
  needsBuildToExport: 'Instala la versión actualizada de la app para exportar.',
  needsBuildToImport: 'Instala la versión actualizada de la app para importar.',
};
