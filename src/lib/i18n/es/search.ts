import { format } from './format.ts';
import { oneOrMany } from '../write.ts';
import type { Strings } from '../en/index.ts';

export const search: Strings['search'] = {
  modes: {
    discover: 'Descubrir',
    download: 'Descargar',
    videos: 'Vídeos',
    playlists: 'Playlists',
  },

  unavailable: {
    heading: 'YouTube necesita una versión nueva de la app',
    body: 'Instala la versión actualizada de la app para buscar y descargar música. Tu biblioteca sigue disponible.',
    downloads: 'Instala una versión nueva de la app para activar las descargas de YouTube.',
  },

  intro: {
    videos: 'Busca en YouTube o pega el enlace de un vídeo. Guarda el audio en tu biblioteca.',
    playlist:
      'Busca una playlist o pega su enlace de YouTube. Abre un resultado para ver sus pistas y descargarlas. Se revisan las primeras 500 entradas de la playlist.',
  },
  inputLabel: {
    videos: 'Busca en YouTube o pega el enlace de un vídeo',
    playlist: 'Nombre de la playlist o enlace de YouTube',
  },
  placeholder: {
    videos: 'Canción, artista o enlace de YouTube',
    playlist: 'Nombre de la playlist o enlace de YouTube',
  },

  formats: { mp3: 'MP3', original: 'Audio original' },
  formatHint: {
    mp3: 'Se convierte a MP3 tras la descarga.',
    original: 'Conserva el códec de audio original siempre que se pueda.',
  },

  searching: 'Buscando en YouTube…',
  results: (count) => `Resultados · ${format.number(count)}`,
  empty: {
    none: 'No hay resultados. Prueba con otra búsqueda u otro enlace.',
    videos: 'Busca por canción y artista para encontrar la grabación que quieres.',
    playlist: 'Busca por el nombre de la playlist o pega su enlace.',
  },

  playlist: 'Playlist',
  openPlaylist: 'Abrir playlist',
  openPlaylistLabel: (title) => `Abrir la playlist ${title}`,
  downloadLabel: (title) => `Descargar ${title}`,
  download: { mp3: 'Descargar MP3', original: 'Descargar audio' },
  adding: 'Añadiendo…',

  addingPlaylist: 'Añadiendo playlist…',
  downloadListed: {
    mp3: 'Descargar las pistas mostradas · MP3',
    original: 'Descargar las pistas mostradas · Audio original',
  },
  listedHint:
    'Se omiten las pistas ya descargadas o en cola. Los vídeos privados, eliminados o en directo pueden no estar disponibles.',
  listCreated: (name) => `Lista creada: ${name}. Las pistas descargadas aparecerán en Listas.`,
  inLibrary: 'En tu biblioteca',
  alreadyHave: (count) =>
    oneOrMany(count, '1 canción ya estaba en tu biblioteca y no se ha vuelto a descargar.', `${format.number(count)} canciones ya estaban en tu biblioteca y no se han vuelto a descargar.`),
  unnamedPlaylist: 'Playlist de YouTube',

  jobLine: (status, mp3) => `${status} · ${mp3 ? 'MP3' : 'Original'}`,

  status: {
    finding: 'Buscándola en YouTube',
    queued: 'En cola',
    preparing: 'Preparando…',
    downloading: (percent) => `Descargando · ${percent} %`,
    converting: 'Convirtiendo el audio…',
    saving: 'Añadiendo a la biblioteca…',
    cancelling: 'Cancelando…',
    cancelled: 'Cancelada',
    failed: 'Error en la descarga',
    done: 'En la biblioteca',
    missing: 'Archivo eliminado',
  },

  failed: {
    search: 'La búsqueda ha fallado. Inténtalo de nuevo.',
    queue: 'No se ha podido poner la descarga en cola.',
    queuePlaylist: 'No se ha podido poner la playlist en cola.',
    cancel: 'No se ha podido cancelar la descarga.',
    read: 'No se han podido leer las descargas.',
    readReopen: 'No se han podido leer las descargas. Vuelve a abrir Buscar.',
  },

  errors: {
    playlistLink: 'Pega el enlace de una playlist de YouTube o busca por el nombre de la playlist.',
    videoLink: 'Escribe el nombre de una canción o un enlace válido a un vídeo de YouTube.',
    queueFull: 'La cola de descargas está llena. Espera a que terminen algunas pistas e inténtalo de nuevo.',
    update: 'YouTube ha cambiado y el descargador de esta versión aún no sabe leerlo. Busca uno más reciente en Descargas o actualiza Jukebox.',
    unavailable: 'Este vídeo o esta playlist no está disponible. Prueba otra playlist pública u otra búsqueda.',
    unreachable: 'No se ha podido conectar con YouTube. Comprueba tu conexión e inténtalo de nuevo.',
    refused: 'YouTube no ha podido completar esta solicitud. Inténtalo más tarde o elige otro resultado.',
  },
};
