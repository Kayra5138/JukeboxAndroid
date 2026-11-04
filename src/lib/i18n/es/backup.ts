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
  followed: (count) => oneOrMany(count, '1 programa seguido', `${format.number(count)} programas seguidos`),
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

  history: {
    title: 'Importar historial de escucha',
    note: 'Tus escuchas de Last.fm, Spotify o ListenBrainz, de los archivos que te dejan descargar. Verás lo que se ha encontrado y se te preguntará antes de cambiar nada.',
    question: '¿Importar estas escuchas?',
    range: (from, to) => (from === to ? `Todas del ${from}.` : `Del ${from} al ${to}.`),
    matched: (matched, total) =>
      `${format.number(matched)} de ${format.number(total)} ${oneOrMany(matched, 'es de una canción', 'son de canciones')} de tu biblioteca. Las demás se guardan con sus propios nombres y cuentan igualmente en tus estadísticas.`,
    short: (count) =>
      `${oneOrMany(count, 'Una escucha dura', `${format.number(count)} escuchas duran`)} menos de medio minuto y ${oneOrMany(count, 'se descarta', 'se descartan')}.`,
    already: (count) =>
      `${oneOrMany(count, 'Una escucha ya está', `${format.number(count)} escuchas ya están`)} en tu historial y ${oneOrMany(count, 'se descarta', 'se descartan')}.`,
    nothing: 'Todas sus escuchas ya están en tu historial o son demasiado cortas para contar.',
    added: (count) =>
      `${format.number(count)} ${oneOrMany(count, 'escucha añadida', 'escuchas añadidas')} a tu historial.`,
    notHistory:
      'Eso no es un historial de escucha que Jukebox pueda leer. Elige los archivos que te dio Last.fm, Spotify o ListenBrainz: CSV o JSON, o el zip en el que venían.',
    tooBig: 'Ese archivo es demasiado grande para leerlo.',
    failed: 'No se han podido importar las escuchas. No se ha cambiado nada.',
  },
};
