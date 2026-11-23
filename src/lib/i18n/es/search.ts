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

  tapes: {
    intro:
      'Audiolibros, pódcasts, charlas y grabaciones largas de YouTube, descargados en la carpeta Tapes de tu biblioteca y que siguen donde los dejaste. Busca o pega el enlace de un vídeo o una lista, o el de un canal para seguirlo.',
    placeholder: { videos: 'Título, programa o enlace de YouTube', playlist: 'Libro, serie o enlace de lista' },
    empty: { videos: 'Busca un libro, un programa, una charla o una clase.', playlist: 'Busca una lista para descargarla como un casete: un libro por partes o una temporada de un programa.' },
    downloadBook: (count) => `Descargar los ${format.number(count)} como un solo casete`,
    bookHint: 'Van a una carpeta con el nombre de la lista, numerados en su orden, y suenan uno tras otro.',
    added: (name) => `De camino a Tapes/${name}`,
    sources: { youtube: 'YouTube', podcasts: 'Seguir', books: 'Libros', files: 'Teléfono' },
    /** Books from the Internet Archive: see `books/archive.ts`, `BooksPane` and the book screen. */
    /** Files on the phone brought into the Tapes folder: see `FilesPane`. */
    files: {
      intro: 'Libros, grabaciones y charlas que ya están en tu teléfono, copiados en una carpeta de tus casetes. Los archivos elegidos se quedan donde están.',
      choose: 'Elegir archivos',
      chooseOther: 'Elegir otros archivos',
      folder: 'Nombre de la carpeta',
      folderPlaceholder: 'Cómo se llama el libro o la grabación',
      folderNote: 'Van a la carpeta de casetes de tu biblioteca con este nombre, en el orden de sus números.',
      copy: (count) => oneOrMany(count, 'Copiar a casetes', `Copiar ${format.number(count)} archivos a casetes`),
      chosen: (count) => oneOrMany(count, '1 archivo elegido', `${format.number(count)} archivos elegidos`),
      copied: (done, of) => done === of ? oneOrMany(done, 'Copiado a tus casetes.', `${format.number(done)} archivos copiados a tus casetes.`) : `Copiados ${format.number(done)} de ${format.number(of)} archivos; el resto no se pudo leer.`,
      failed: 'No se pudo copiar ninguno de los archivos.',
      pickFailed: 'No se pudieron elegir los archivos.',
      toTapes: 'Ir a casetes',
    },
    books: {
      intro: 'Libros de dominio público leídos en voz alta por voluntarios de LibriVox y guardados gratis en el Internet Archive. Busca por título o autor, o pega la dirección de algo para escuchar en archive.org.',
      placeholder: 'Título, autor o enlace de archive.org',
      nothingFound: 'No se encontraron libros.',
      searchFailed: 'No se pudo buscar en el Internet Archive.',
      anyLanguage: 'Todos los idiomas',
      popular: 'Los más escuchados',
      bookFailed: 'No se pudo leer ese libro del Internet Archive.',
      stats: (parts, minutes, here) => `${oneOrMany(parts, '1 parte', `${format.number(parts)} partes`)} · ${minutes >= 60 ? `${format.number(Math.floor(minutes / 60))} h ${format.number(minutes % 60)} min` : `${format.number(minutes)} min`}${here > 0 ? ` · ${format.number(here)} en el teléfono` : ''}`,
      fetchAll: 'Descargar el libro entero',
      fetchRest: (count) => oneOrMany(count, 'Descargar la última parte', `Descargar las otras ${format.number(count)} partes`),
      size: (mb) => `Unos ${format.number(mb)} MB en total`,
      parts: (count) => oneOrMany(count, '1 parte', `${format.number(count)} partes`),
    },
    podcasts: {
      intro: 'Sigue un pódcast o un canal de YouTube y sus episodios nuevos llegarán solos a tus casetes, o ábrelo y descarga solo los episodios que quieras. Busca o pega la dirección de un feed o de un canal.',
      /** Under the button on a show not followed: that its episodes can be had without following it. */
      withoutFollowing: 'No hace falta seguirlo para escuchar: descarga abajo el episodio que quieras. Si lo sigues, los nuevos llegan solos.',
      /** Where podcasts can be had from: said under the intro. */
      /** The title of a followed or followable show's own screen, a podcast or a YouTube channel. */
      showTitle: 'Programa',
      sources: 'De dónde: cualquier programa del directorio de pódcasts de Apple, que tiene casi todos los pódcasts con feed público, incluida la mayoría de Spotify; cualquier dirección de feed, de Anchor, Buzzsprout, Libsyn, Podbean, SoundCloud y demás; y canales de YouTube.',
      placeholder: 'Nombre del pódcast o canal, o un enlace',
      searchFailed: 'No se pudieron buscar pódcasts. Revisa tu conexión.',
      feedFailed: 'No se pudo leer el feed de este pódcast.',
      /** A feed asked for by a link from outside the app, before it is read: where it is, and whether to. */
      linkAsk: '¿Abrir un feed desde un enlace?',
      linkAskBody: (host: string) => `Un enlace pide leer el feed del pódcast en ${host}. Ábrelo solo si confías en el origen del enlace.`,
      linkOpen: 'Abrir',
      linkRefused: 'Ese enlace apunta a una dirección de este teléfono o de tu propia red, que un enlace no puede leer.',
      notChannel: 'Esa no es la dirección de un canal de YouTube, o no se encontró el canal.',
      channelsHeading: 'Canales de YouTube',
      podcastsHeading: 'Pódcasts',
      subscribers: (count) => oneOrMany(count, '1 suscriptor', `${format.number(count)} suscriptores`),
      channelsFailed: 'No se pudieron buscar canales en YouTube.',
      nothingFound: 'No se encontraron pódcasts.',
      yours: 'Tus pódcasts',
      noneYet: 'Todavía no sigues ningún pódcast.',
      wifiOnly: 'Episodios nuevos solo con wifi',
      wifiOnlyNote: 'Los episodios de los pódcasts que sigues se descargan solos solo con wifi. Aun así puedes descargar cualquier episodio a mano.',
      follow: 'Seguir',
      following: 'Siguiendo',
      unfollow: 'Dejar de seguir',
      autoDownload: 'Descargar los episodios más recientes',
      autoDownloadNote: (keep) => oneOrMany(keep, 'Se mantiene descargado el episodio más reciente.', `Se mantienen descargados los ${format.number(keep)} episodios más recientes.`),
      keep: (count) => format.number(count),
      episodes: (count) => `Episodios · ${format.number(count)}`,
      noEpisodes: 'Este feed no tiene episodios con archivo.',
      download: 'Descargar',
      /** The button on an episode or a part, read aloud with what it fetches, in the order the language puts them. */
      downloadNamed: (title: string) => `Descargar ${title}`,
      continue: 'Continuar',
      start: 'Empezar',
      more: 'Más',
      less: 'Menos',
      stats: (total, here) => `${format.number(total)} ${oneOrMany(total, 'episodio', 'episodios')} · ${format.number(here)} en el móvil`,
      play: 'Reproducir',
      /** The episodes shown by when they came out: see `podcasts/when.ts`. */
      when: { label: 'Cuándo', all: 'Todos', week: 'Última semana', month: 'Último mes', quarter: 'Últimos 3 meses' },
      newest: 'Más recientes primero',
      oldest: 'Más antiguos primero',
      noneThen: 'No hay episodios de esta época.',
      fetchNext: 'Descargar los siguientes episodios',
      fetchNextNote: (count) =>
        oneOrMany(count, 'Mientras escuchas un episodio antiguo, se descarga el siguiente para que esté listo cuando este termine.', `Mientras escuchas un episodio antiguo, se descargan los ${format.number(count)} siguientes para que el próximo esté listo al terminar cada uno.`),
      line: (date, length) => [date, length].filter(Boolean).join(' · '),
    },
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
  backToResults: 'Volver a los resultados',
  openPlaylistLabel: (title) => `Abrir la playlist ${title}`,
  downloadLabel: (title) => `Descargar ${title}`,
  adding: 'Añadiendo…',
  listenLabel: (title) => `Escuchar ${title} sin guardarla`,
  readying: 'Preparando…',
  listenDrop: 'No guardar',

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
    listened: 'Lista, sin guardar',
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
