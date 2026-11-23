import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const library: Strings['library'] = {
  views: {
    tracks: 'Pistas',
    albums: 'Álbumes',
    artists: 'Artistas',
    folders: 'Carpetas',
    tapes: 'Casetes',
  },

  tapes: {
    left: (minutes) => `quedan ${format.number(minutes)} min`,
    played: 'Escuchado',
    heard: (heard, total) => `${format.number(heard)} / ${format.number(total)} min`,
    add: 'Añadir casetes',
    settings: 'Ajustes de casetes',
    /** A followed show's arrow, which lays its episodes out under it and folds them away. */
    showEpisodes: 'Mostrar episodios',
    hideEpisodes: 'Ocultar episodios',
    /** A tape's own details screen: see `app/tape.tsx`. */
    details: {
      title: 'Detalles del casete',
      listening: 'Escucha',
      heard: 'Escuchado',
      notBegun: 'Sin empezar',
      lastHeard: 'Última escucha',
      part: 'Parte',
      partOf: (at, of) => `${format.number(at)} de ${format.number(of)}`,
      speed: 'Velocidad',
      marks: 'Marcas',
      source: 'Origen',
      from: 'Procedencia',
      kinds: { youtube: 'Un vídeo de YouTube', playlist: 'Una lista de YouTube', podcast: 'Un episodio de pódcast', book: 'Un libro de LibriVox', byHand: 'Puesto a mano en la carpeta de casetes' },
      show: 'Programa',
      book: 'Libro',
      channel: 'Canal',
      list: 'Lista',
      published: 'Publicado',
      fetched: 'Descargado',
      chapters: 'Capítulos',
      skipped: 'Partes saltadas',
      skippedUnknown: 'Se mira la próxima vez que suene',
      skippedOff: 'Desactivado en los ajustes de casetes',
      skippedTrouble: 'No se pudo contactar con SponsorBlock; se vuelve a preguntar la próxima vez que suene',
      skippedNone: 'Nada marcado',
      skippedSome: (count, seconds) => `${oneOrMany(count, '1 parte', `${format.number(count)} partes`)} · ${format.number(seconds)} s`,
      address: 'Dirección',
      listAddress: 'Dirección de la lista',
      openSeries: 'Abrir el programa',
      file: 'Archivo',
      name: 'Nombre',
      folder: 'Carpeta',
      format: 'Formato',
      size: 'Tamaño',
      megabytes: (mb) => `${format.number(mb)} MB`,
      added: 'Llegó al teléfono',
      missing: 'Este casete ya no está en la biblioteca.',
    },
    seriesHeading: 'Siguiendo',
    singlesHeading: 'Casetes',
    booksHeading: 'Libros',
    /** The tapes view's filter: all of it, or one of its parts. */
    filter: { all: 'Todo', series: 'Siguiendo', books: 'Libros', tapes: 'Casetes' },
    seriesLine: (count, fresh) => `${format.number(count)} ${oneOrMany(count, 'episodio', 'episodios')}${fresh > 0 ? ` · ${format.number(fresh)} ${oneOrMany(fresh, 'nuevo', 'nuevos')}` : ''}`,
    seriesNone: 'Aún no se ha descargado ningún episodio',
    /** A folder of several tapes as one row: how many parts, and how many of them not begun. */
    bookLine: (count, fresh) => `${format.number(count)} partes${fresh > 0 ? ` · ${format.number(fresh)} sin empezar` : ''}`,
    count: (count) => `${format.number(count)} ${oneOrMany(count, 'casete', 'casetes')}`,
    /** Over the tapes view while tapes are being chosen. */
    selected: (count) => `${format.number(count)} ${oneOrMany(count, 'casete seleccionado', 'casetes seleccionados')}`,
    empty: (folder) => `Pon audiolibros, pódcasts y grabaciones largas en una carpeta llamada Tapes dentro de la carpeta de la biblioteca (${folder}). Aparecen aquí, siguen donde los dejaste y no se mezclan con tu música.`,
    markPlayed: 'Marcar como escuchado',
    markUnplayed: 'Marcar como no escuchado',
  },

  nothingMatches: (query) => `Nada coincide con «${query}».`,
  noAlbums:
    'Aún no hay álbumes. Un disco solo aparece cuando se han buscado los datos de sus pistas: la carpeta donde está un archivo no es un álbum.',
  back: '‹ Atrás',
  trackMenu: 'Opciones de la pista',
  albumMenu: 'Opciones del álbum',

  screen: {
    searchYouTube: (query: string) => `Buscar «${query}» en YouTube`,
    viewSwitch: 'Vista de la biblioteca',
    searchHints: {
      tracks: 'Títulos, artistas y etiquetas',
      albums: 'Títulos, artistas y etiquetas',
      artists: 'Busca artistas',
      folders: 'Busca carpetas',
      tapes: 'Buscar casetes, programas y autores',
    },
    /* The order has to fit a button 56 points wide: eight letters at most. */
    sort: 'Orden',
    sortShort: { name: 'A–Z', added: 'Añadido', played: 'Escucha', colour: 'Color' },
    sortedBy: {
      name: 'Ordenado por nombre',
      added: 'Ordenado por cuándo se añadió',
      played: 'Ordenado por última escucha',
      colour: 'Ordenado por el color de la portada',
    },
    sortHint: 'Cambia el orden de la biblioteca',
    lookSwitch: 'Cambia esta vista a su otro aspecto',
    view: 'Vista',
    looks: { list: 'Lista', shelves: 'Estantes', rack: 'Estante', map: 'Mapa' },
    shelf: { added: 'Añadidas recientemente', around: (hour: string) => `Hacia las ${hour}`, repeat: 'En bucle este mes', while: 'Sin escuchar hace tiempo', never: 'Nunca reproducidas', all: 'Todas las canciones', play: (name: string) => `Reproducir ${name}`, shuffle: (name: string) => `Reproducir ${name} en aleatorio`, queue: (name: string) => `Añadir ${name} a la cola` },
    artistMap: { drawing: 'Dibujando el mapa…', shuffle: 'Reproducir sus canciones al azar', open: 'Abrir', with: 'Con', lasso: 'Rodear artistas para mezclarlos', lassoHint: 'Rodea a los artistas que quieres mezclar', lassoChosen: 'Rodeados', putBackAll: 'Devolver a su sitio los artistas movidos a mano', movedByHand: 'Movidos a mano', putBack: 'Devolver' },
    groupSortShort: { name: 'A–Z', tracks: 'Pistas', played: 'Escuchas', added: 'Nuevo' },
    groupSortedBy: {
      name: 'Ordenado por nombre',
      tracks: 'Ordenado por número de pistas',
      played: 'Ordenado por cuánto se escuchan',
      added: 'Ordenado por lo añadido más recientemente',
    },

    selectTracks: 'Seleccionar pistas',
    stopSelecting: 'Dejar de seleccionar',
    selected: (count) =>
      `${format.number(count)} ${oneOrMany(count, 'pista seleccionada', 'pistas seleccionadas')}`,
    addToList: 'Añadir a una lista',
    addTag: 'Añadir etiqueta',
    writeToFiles: 'Escribir en archivos',
    writeToFilesSpoken: 'Escribe los detalles de las pistas seleccionadas en sus archivos',

    swipePlayNext: 'A continuación',
    swipeQueue: 'A la cola',
    queuedAll: (count) =>
      oneOrMany(count, '1 pista añadida a la cola', `${format.number(count)} pistas añadidas a la cola`),

    needsAccess: 'Jukebox necesita acceso al audio de este dispositivo.',
    nothingIn: (folder) => `No hay nada en ${folder}.`,
    shuffleAll: 'Mezclar todo',
    playsEverythingBelow: 'Jukebox reproduce todo lo que hay en esa carpeta, subcarpetas incluidas.',
    chooseFolderInSettings: 'Elige la carpeta de tu biblioteca en Ajustes.',

    folders: (count) => `${format.number(count)} ${oneOrMany(count, 'carpeta', 'carpetas')}`,
    noFolders: 'Ninguna de estas pistas indica en qué carpeta está.',
    shuffleTag: (tag) => `Mezclar «${tag}»`,
  },

  row: {
    opensTracks: 'Abre sus pistas',
    selectsTracks: 'Selecciona todas sus pistas',
    select: 'Seleccionar sus pistas',
  },

  rack: {
    open: (album) => `Abrir ${album}`,
    openHint: 'Muestra las pistas del álbum',
    bringForward: 'Pone este disco delante',
  },

  albumActions: {
    select: { label: 'Seleccionar', hint: 'Sus pistas, y luego lo que toques' },
    rest: {
      label: 'Buscar el resto del álbum',
      hint: 'Las pistas que aún no tienes',
    },
    lookUp: {
      label: 'Buscar datos del álbum',
      hint: 'Sus datos y su portada, buscando el álbum entero de una vez',
    },
    cover: {
      label: 'Elegir portada del álbum',
      hint: 'Una imagen de tu galería, para todas sus pistas',
    },
    setAside: { label: 'Apartar', hint: 'Sus canciones fuera de Pistas y del aleatorio de todo' },
    bringBack: { label: 'Recuperar', hint: 'Sus canciones de nuevo en Pistas y en el aleatorio' },
  },

  albumTools: {
    lookingUp: (done, total) =>
      `Buscando el álbum… ${format.number(done)} de ${format.number(total)}`,
    stop: 'Detener la búsqueda',
    lookedUp: (found, covers) =>
      found === 0 && covers === 0
        ? 'No se ha encontrado nada nuevo para este álbum.'
        : covers === 0
          ? `Se han encontrado datos de ${common.tracks(found)}.`
          : found === 0
            ? `Se ha encontrado portada para ${common.tracks(covers)}.`
            : `Se han encontrado datos de ${common.tracks(found)} y portada para ${common.tracks(covers)}.`,
    offline: 'No responde nada. Revisa la conexión y vuelve a intentarlo.',
    failed: 'La búsqueda se ha detenido inesperadamente.',
    coverChosen: (count) => `La portada ya está en ${common.tracks(count)}.`,
  },

  rest: {
    looking: 'Buscando el álbum…',
    release: (count, year) => (year ? `${common.tracks(count)}, ${year}` : common.tracks(count)),
    have: (have, total) => `Tienes ${format.number(have)} de ${format.number(total)}.`,
    complete: 'Tienes el álbum completo.',
    rivals: 'Hay más de un álbum con este nombre. Este es el que mejor encaja con tus pistas.',
    unsure:
      'Ninguna de tus pistas se ha reconocido en él, así que no hay nada marcado. Comprueba primero que es el álbum correcto.',
    disc: (disc) => `Disco ${format.number(disc)}`,
    ordered: (count) =>
      oneOrMany(
        count,
        '1 pista puesta en el orden del álbum.',
        `${format.number(count)} pistas puestas en el orden del álbum.`
      ),
    undoOrder: 'Deshacer',

    lookingTube: 'Buscando en YouTube…',
    readingTube: 'Leyendo el álbum…',
    source: {
      musicbrainz: 'Lista de pistas de MusicBrainz',
      youtube: (playlist, channel) =>
        `Lista de pistas de YouTube: ${[playlist, channel].filter(Boolean).join(' · ')}`,
    },
    other: { youtube: 'Buscar en YouTube en su lugar', musicbrainz: 'Usar MusicBrainz en su lugar' },
    onTrust:
      'Tomada del álbum de YouTube con este nombre. Tienes muy pocas de sus pistas para comprobarlo, así que revísala antes de descargar.',
    tubeNotFound: 'No se ha podido confirmar que ninguna playlist de YouTube sea este álbum.',

    ticks: 'Marcada para descargar',
    waiting: 'Esperando su turno',
    searching: 'Buscándola en YouTube…',
    noMatch: 'No se ha encontrado ninguna grabación que coincida',
    searchFailed: 'No se ha podido completar la búsqueda',
    byHand: 'Buscar a mano',
    byHandLabel: (title) => `Buscar ${title} a mano`,

    download: (count) =>
      `Descargar ${format.number(count)} ${oneOrMany(count, 'pista', 'pistas')}`,
    nothingTicked: 'Marca las pistas que quieres descargar',
    stop: 'Dejar de buscar',

    failed: {
      unnamed:
        'No se puede buscar este álbum. Necesita un nombre y un artista en el que coincidan la mayoría de sus pistas.',
      notFound: 'MusicBrainz no tiene ningún álbum con este nombre de este artista.',
      offline: 'No se ha podido conectar con MusicBrainz. Comprueba tu conexión e inténtalo de nuevo.',
      throttled: 'MusicBrainz ha pedido ir más despacio. Espera un minuto e inténtalo de nuevo.',
      failed: 'No se ha podido buscar el álbum.',
      gone: 'Este álbum ya no está en la biblioteca.',
      neither:
        'No se ha encontrado este álbum. MusicBrainz no lo tiene, y no se ha podido confirmar que ninguna playlist de YouTube sea este álbum.',
      tube: 'No se ha podido consultar el álbum en YouTube.',
      tooOld: 'Esta versión de Jukebox no puede buscar álbumes en YouTube. Instala una versión más reciente de la app.',
    },
  },

  menu: {
    quickNext: 'Siguiente',
    quickQueue: 'Cola',
    quickList: 'Lista',
    playNext: { label: 'Reproducir a continuación', hint: 'Justo después de la pista actual' },
    keepListened: { label: 'Guardar en la biblioteca', hint: 'Se copia a tu biblioteca, con su historial' },
    addToQueue: { label: common.addToQueue, hint: 'Al final' },
    playSimilar: { label: 'Reproducir con canciones parecidas', hint: 'Esta, y luego un grupo de canciones parecidas' },
    playOnly: { label: 'Reproducir solo esta', hint: 'La cola es solo esta canción' },
    playFromStart: { label: 'Reproducir desde el principio', hint: 'Se olvida dónde se dejó' },
    series: { label: 'Abrir el programa', hint: 'Sus episodios y cómo se descargan los nuevos' },
    tapeFolder: { label: 'Abrir su carpeta', hint: 'Todo lo demás de su carpeta' },
    tapeDetails: { label: 'Ver detalles', hint: 'Cuánto llevas, de dónde vino y el archivo' },
    share: { label: 'Compartir', hint: 'Se envía como audio: un chat lo reproduce ahí mismo' },
    shareFile: { label: 'Compartir como archivo', hint: 'Se envía el archivo tal cual: un chat lo guarda como documento' },
    album: { label: 'Ir al álbum', hint: 'El resto del disco, en orden' },
    addToPlaylist: { label: 'Añadir a una lista', hint: 'Una de tus listas, o una nueva' },
    setAside: { label: 'Apartar', hint: 'Fuera de Pistas y del aleatorio de todo' },
    bringBack: { label: 'Recuperar', hint: 'De nuevo en Pistas y en el aleatorio' },
    asideWith: { label: 'Apartada con otras', hint: 'Con su álbum, artista, carpeta o una etiqueta: se recupera en Apartadas' },
    favoriteAdd: { label: "Añadir a Favoritos", hint: "La lista que llena el corazón, lo más nuevo arriba" },
    favoriteRemove: { label: "Quitar de Favoritos", hint: "Fuera de la lista que llena el corazón" },
    tiles: { label: 'Jugar a piano tiles', hint: 'Teclas que caen al ritmo de esta grabación' },
    details: {
      label: 'Ver y editar detalles',
      hint: 'Nombres, portada, etiquetas y letra, con búsqueda para cada uno',
    },
    delete: { label: 'Eliminar del teléfono', hint: 'Borra el propio archivo, no solo esta fila' },
  },

  folders: {
    needsAccess:
      'Jukebox necesita acceso al audio de este dispositivo para poder mostrar carpetas.',
    note: 'Jukebox reproduce todo lo que hay en la carpeta que elijas, subcarpetas incluidas. Elegir una subcarpeta es la forma de dejar fuera los tonos de llamada y el audio de los juegos.',
    everything: (path) => `${path}  (todo)`,
  },

  leftOut: {
    title: 'Carpetas excluidas',
    none: 'Ninguna. Desactiva las carpetas de notas de voz, grabaciones o tonos de llamada.',
    some: (count) =>
      `${format.number(count)} ${oneOrMany(count, 'carpeta excluida', 'carpetas excluidas')} de la biblioteca`,
    note: 'Una carpeta desactivada se queda fuera de la biblioteca, con todas las carpetas que contiene. No se borra nada: sus escuchas, etiquetas y posiciones en tus listas se conservan y vuelven cuando la activas de nuevo.',
    within: 'Excluida con la carpeta que la contiene',
    spoken: (path, count) => `${path}, ${format.number(count)} ${oneOrMany(count, 'pista', 'pistas')}`,
    hint: 'Activada, la carpeta está en la biblioteca; desactivada, se queda fuera',
    empty: (root) => `No hay carpetas con música dentro de ${root}.`,
  },

  setAside: {
    title: 'Apartadas',
    none: 'Nada. Aparta un álbum, un artista o una canción que no quieras en Pistas ni en el aleatorio.',
    some: (count) => `${format.number(count)} ${oneOrMany(count, 'canción apartada', 'canciones apartadas')}`,
    note: 'Una canción apartada queda fuera de Pistas, de reproducir todo en aleatorio y de las canciones elegidas para que la música siga. Sigue en su álbum, con su artista y en su carpeta, en tus listas y en la búsqueda, y suena cuando se reproduce cualquiera de ellos. No se borra nada.',
    empty: 'No hay nada apartado. Mantén pulsado un álbum o una canción, o abre un artista o una carpeta, para apartarlo.',
    kinds: { album: 'Álbumes', artist: 'Artistas', list: 'Listas', folder: 'Carpetas', tag: 'Etiquetas', track: 'Canciones' },
    songs: (count) => `${format.number(count)} ${oneOrMany(count, 'canción', 'canciones')}`,
    bringBack: 'Recuperar',
    bringBackSpoken: (name) => `Recuperar ${name}`,
    addTag: 'Apartar una etiqueta',
    noTags: 'No quedan más etiquetas para apartar.',
    album: { set: 'Apartar este álbum', back: 'Recuperar este álbum' },
    artist: { set: 'Apartar este artista', back: 'Recuperar este artista' },
    list: { set: 'Apartar esta lista', back: 'Recuperar esta lista' },
    folder: { set: 'Apartar esta carpeta', back: 'Recuperar esta carpeta' },
  },

  shortFiles: {
    title: 'Ocultar archivos cortos',
    note: 'Deja fuera las notas de voz, los tonos de llamada y los sonidos de notificación por su duración. No se borra nada.',
    under: (seconds) => `Menos de ${format.number(seconds)} s`,
    shorterThan: (seconds) => `Menos de ${format.number(seconds)} segundos`,
  },

  autoWrite: {
    heading: "En los archivos",
    edits: { title: "Escribir lo que guardo en el archivo", note: "Al guardar los datos de una canción, sola o varias a la vez, también van al archivo, como haría Escribir en el archivo. Android pregunta antes en los archivos que Jukebox no descargó." },
    lookups: { title: "Escribir lo que encuentran las búsquedas", note: "Los datos de una canción que una búsqueda encontró y que no has editado se escriben en el archivo. Las descargas de Jukebox, enseguida, incluso en segundo plano. Los demás archivos esperan y se preguntan juntos la próxima vez que abras la app. Una canción que suena espera a la siguiente vez." },
  },
  copies: {
    title: 'Copias de la misma canción',
    some: (count) =>
      oneOrMany(count, '1 canción está más de una vez en tu biblioteca', `${format.number(count)} canciones están más de una vez en tu biblioteca`),
    review: 'Revisar',
    reviewHint: 'Abre las copias para elegir cuál conservar',
    note: 'Estos archivos parecen una misma grabación guardada más de una vez: el mismo nombre, o el mismo artista y título, y la misma duración con dos segundos de margen. Se conserva una copia de cada una. Antes de eliminar las demás, sus escuchas, etiquetas, letra y posiciones en listas pasan a ella.',
    empty: 'Ninguna canción está más de una vez en tu biblioteca.',
    cleanAll: (count) => `Limpiar las ${format.number(count)}`,
    deleteOthers: (count) =>
      oneOrMany(count, 'Eliminar la otra copia', `Eliminar las otras ${format.number(count)} copias`),
    different: 'Son canciones distintas',
    choose: 'Qué copia conservar',
    keepHint: 'Conserva esta copia y elimina las demás',
    keeps: 'Se queda',
    goes: 'Se elimina',
    why: {
      listens: 'Sugerida porque tiene más escuchas.',
      described: 'Sugerida porque tiene datos o portada.',
      folder: 'Sugerida porque está en la carpeta de la biblioteca.',
      larger: 'Sugerida porque es el archivo más grande.',
      older: 'Sugerida porque es el archivo más antiguo.',
      alike: 'Las copias son iguales; cualquiera sirve.',
    },
    yourChoice: 'Se conserva la que has elegido.',
    holds: (copy) => {
      const parts = [
        copy.listens > 0 ? oneOrMany(copy.listens, '1 escucha', `${format.number(copy.listens)} escuchas`) : 'sin escuchas',
      ];
      if (copy.described) parts.push('datos');
      if (copy.cover) parts.push('portada');
      if (copy.outside) parts.push('fuera de la carpeta de la biblioteca');
      return parts.join(' · ');
    },
    deleted: (count) => oneOrMany(count, '1 archivo eliminado.', `${format.number(count)} archivos eliminados.`),
    notDeleted: 'Los archivos no se han eliminado. Sus escuchas y lo demás ya están en la copia que se queda.',
    failed: (error) => `No se ha podido mover parte del historial, y esos archivos no se han tocado. ${error}`,
  },

  wrong: {
    title: 'Descargas que pueden ser otra canción',
    some: (count) =>
      oneOrMany(count, '1 descarga puede ser otra canción distinta de la que dice su nombre', `${format.number(count)} descargas pueden ser otras canciones distintas de las que dicen sus nombres`),
    review: 'Revisar',
    reviewHint: 'Abre esas descargas para corregir cada una',
    note: 'Cada una se descargó como una canción y recibió su nombre, pero el vídeo del que salió se llama de otra forma, así que puede ser otra canción. Reprodúcela para oír cuál es y luego dale el nombre del vídeo, elimínala o indica que es correcta. No cambia nada hasta que elijas.',
    empty: 'Ninguna descarga parece ser otra canción.',
    filedAs: 'Guardada como',
    videoWas: 'El vídeo era',
    facts: (length, listens) =>
      `${length} · ${listens > 0 ? oneOrMany(listens, '1 escucha', `${format.number(listens)} escuchas`) : 'sin escuchas'}`,
    playHint: 'Reproduce este archivo',
    rename: 'Ponerle su nombre',
    delete: 'Eliminar',
    right: 'Es correcta',
    sheetNote: 'Tomado del título del vídeo. Cámbialo si no es del todo correcto. Se guarda como tu propia edición, que ninguna búsqueda sobrescribe.',
    titleField: 'Título',
    artistField: 'Artista',
    renamed: (title) => `Renombrada como «${title}».`,
    deleted: 'Eliminada.',
    notDeleted: 'El archivo no se ha eliminado.',
    keptRight: 'Se queda como está. No se volverá a preguntar.',
    failed: (error) => `No se ha podido hacer. ${error}`,
  },

  shuffle: {
    menu: 'Aleatorio',
    everything: 'Todas las canciones',
    change: 'Cambiar lo que reproduce el botón…',
    heading: 'El botón aleatorio reproduce',
    note: 'Mantén pulsado el botón para mezclar otra cosa solo una vez. El widget y el coche reproducen lo mismo.',
    labelHeading: 'El botón aleatorio dice',
    label: { name: 'El nombre de lo que reproduce', words: 'Un texto tuyo', icon: 'Nada, solo el icono' },
    wordsHeading: 'Texto del botón aleatorio',
    wordsPlaceholder: 'Aleatorio',
    spoken: (name) => `Aleatorio: ${name}`,
  },
};
