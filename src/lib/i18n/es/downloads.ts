import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

const n = format.number;

/*
  "En espera" and "descargando" do not change with the count; "terminadas" and
  "fallidas" agree with "descargas", which is feminine.
*/
export const downloads: Strings['downloads'] = {
  short: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `En pausa · ${n(waiting)} en espera` : 'En pausa';
    if (underWay > 0 && waiting > 0) return `${n(underWay)} descargando, ${n(waiting)} en espera`;
    if (underWay > 0) return `${n(underWay)} descargando`;
    return waiting > 0 ? `${n(waiting)} en espera` : '';
  },
  state: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `En pausa, ${n(waiting)} en espera` : 'En pausa';
    if (underWay > 0 && waiting > 0) return `Descargando ${n(underWay)}, ${n(waiting)} en espera`;
    if (underWay > 0) return `Descargando ${n(underWay)}`;
    return waiting > 0 ? `${n(waiting)} en espera` : 'No se está descargando nada';
  },
  pausedNote: 'No se empieza nada nuevo hasta que reanudes las descargas. Lo que ya se está descargando termina.',
  automaticNote: (count) =>
    count === 1
      ? 'Una descarga es automática: la pidió Descubrir. Espera a que no se esté descargando nada más.'
      : `${n(count)} descargas son automáticas: las pidió Descubrir. Esperan a que no se esté descargando nada más.`,

  pause: 'Pausar',
  resume: 'Reanudar',
  cancelAll: 'Cancelar todo',
  cancelAllQuestion: '¿Cancelar todas las descargas?',
  cancelAllHint: 'Se cancela todo lo que espera y todo lo que se está descargando. Lo que ya está en tu biblioteca se queda.',
  keep: 'Mantenerlas',

  sections: { now: 'Ahora', next: 'A continuación', history: 'Historial' },
  clear: 'Borrar',
  clearLabel: 'Borrar el historial de descargas',

  source: {
    discover: 'Descubrir',
    search: 'Buscar',
    album: (name) => `Álbum: ${name}`,
    playlist: (name) => `Playlist: ${name}`,
  },
  automatic: 'Automática · espera a las demás',
  retrying: (why) => (why ? `Reintentando · ${why}` : 'Reintentando'),

  doNext: 'Descargar a continuación',
  doNextLabel: (title) => `Descargar ${title} a continuación`,
  cancelLabel: (title) => `Cancelar ${title}`,
  retryLabel: (title) => `Reintentar ${title}`,
  moveUp: 'Subir',
  moveDown: 'Bajar',

  empty: {
    heading: 'Aún no hay descargas',
    body: 'Aquí aparece lo que descargas desde Buscar, desde Descubrir o para completar un álbum, junto con lo que aún espera su turno.',
  },
  unavailable: 'Instala una versión nueva de la app para descargar música.',
  readFailed: 'No se han podido leer las descargas.',

  extractor: {
    heading: 'Descargador de YouTube',
    version: (version) => `yt-dlp ${version}`,
    current: 'Al día',
    available: (version) => `${version} está disponible`,
    unchecked: 'Aún no se ha buscado una versión más reciente',
    checked: (days) =>
      days === 0
        ? 'comprobado hoy'
        : days === 1
          ? 'comprobado ayer'
          : `comprobado hace ${n(days)} ${oneOrMany(days, 'día', 'días')}`,
    check: 'Buscar actualización',
    checking: 'Comprobando…',
    update: 'Actualizar',
    waiting: 'Esperando a que termine la descarga actual…',
    downloading: (version, percent) => `Descargando ${version} · ${n(percent)} %`,
    trying: 'Probando la nueva versión…',
    restoring: 'Restaurando la versión que traía Jukebox…',
    updated: (version) => `Ahora con ${version}. Las descargas que fallaron se pueden reintentar.`,
    restore: (version) => `Volver a ${version}, la que traía Jukebox`,
    checkFailed: 'No se ha podido buscar una actualización.',
    trouble: {
      network: 'No se ha podido conectar con GitHub. Comprueba la conexión e inténtalo de nuevo.',
      answer: 'GitHub no ha respondido con una versión. Inténtalo más tarde.',
      checksum: 'El archivo recibido no es el que indica la versión publicada. No se ha cambiado nada.',
      broken: 'La nueva versión no funciona en este teléfono. Sigue instalada la que tenías.',
      failed: 'No se ha podido actualizar. Sigue instalada la versión que tenías.',
    },
    rowUpdate: 'Actualizar',
    rowCheck: 'Comprobar',
    rowUpdateLabel: (title) => `Actualizar el descargador de YouTube para reintentar ${title}`,
    rowCheckLabel: (title) => `Buscar un descargador de YouTube más reciente para reintentar ${title}`,
  },

  button: {
    label: (state) => (state ? `Descargas: ${state}` : 'Descargas'),
    finished: 'terminadas',
    heading: 'Descargas',
    idle: 'Ahora mismo no se está descargando nada',
    paused: 'En pausa',
    allDone: 'Todo terminado',
    waiting: (count) => `${n(count)} en espera`,
    done: (count) => `${n(count)} ${oneOrMany(count, 'terminada', 'terminadas')}`,
    failed: (count) => `${n(count)} ${oneOrMany(count, 'fallida', 'fallidas')}`,
    open: 'Abrir descargas',
  },
};
