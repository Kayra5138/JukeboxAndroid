import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const lyrics: Strings['lyrics'] = {
  none: 'No se ha encontrado la letra.',
  translating: 'Traduciendo…',
  seekTo: (seconds) => `Ir al segundo ${seconds}`,

  translation: {
    romaji:
      'Esta letra está en japonés escrito con letras latinas, y no se ha encontrado una versión en la escritura original que traducir en su lugar.',
    unsupported: 'No hay traducción para este idioma.',
    unavailable: 'La traducción no está disponible en este dispositivo.',
    misaligned: 'La traducción no coincidía línea por línea.',
    failed: 'No se ha podido traducir.',
  },

  from: {
    file: 'Del archivo',
    lrc: 'De un archivo .lrc',
    lookup: 'De LRCLIB',
  },

  stored: (timed, from, lines) =>
    `${timed ? 'Sincronizada' : 'Texto sin sincronizar'}, ${from === 'file' ? 'del propio archivo' : 'de un archivo .lrc junto a él'}` +
    (lines > 0 ? ` · ${oneOrMany(lines, '1 línea', `${format.number(lines)} líneas`)}` : ''),

  found: {
    file: 'Encontrada en el propio archivo y guardada.',
    lrc: 'Encontrada en un archivo .lrc junto a la canción y guardada.',
  },

  folders: {
    title: 'Leer archivos .lrc junto a las canciones',
    note: 'La letra de un archivo .lrc con el mismo nombre que la canción se muestra antes de buscar nada en internet. Android solo deja que una app lea estos archivos desde una carpeta que tú elijas, así que se te pide una vez la carpeta donde está tu música.',
    add: 'Añadir otra carpeta',
    remove: 'Quitar',
    removeLabel: (folder) => `Dejar de leer archivos .lrc en ${folder}`,
    elsewhere: 'Esa carpeta no está en el teléfono, así que ninguna de tus canciones está en ella. Elige la carpeta del teléfono donde está tu música.',
  },
};
