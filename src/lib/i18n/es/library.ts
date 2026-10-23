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
  },

  nothingMatches: (query) => `Nada coincide con «${query}».`,
  noAlbums:
    'Aún no hay álbumes. Un disco solo aparece cuando se han buscado los datos de sus pistas: la carpeta donde está un archivo no es un álbum.',
  back: '‹ Atrás',
  trackMenu: 'Opciones de la pista',
  albumMenu: 'Opciones del álbum',

  screen: {
    viewSwitch: 'Vista de la biblioteca',
    searchHints: {
      tracks: 'Títulos, artistas y etiquetas',
      albums: 'Títulos, artistas y etiquetas',
      artists: 'Busca artistas',
      folders: 'Busca carpetas',
    },
    /* The order has to fit a button 56 points wide: eight letters at most. */
    sort: 'Orden',
    sortShort: { name: 'A–Z', added: 'Añadido', played: 'Escucha' },
    sortedBy: {
      name: 'Ordenado por nombre',
      added: 'Ordenado por cuándo se añadió',
      played: 'Ordenado por última escucha',
    },
    sortHint: 'Cambia el orden de la biblioteca',
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
    playNext: { label: 'Reproducir a continuación', hint: 'Justo después de la pista actual' },
    addToQueue: { label: common.addToQueue, hint: 'Al final' },
    playSimilar: { label: 'Reproducir con canciones parecidas', hint: 'Esta, y luego un grupo de canciones parecidas' },
    playOnly: { label: 'Reproducir solo esta', hint: 'La cola es solo esta canción' },
    album: { label: 'Ir al álbum', hint: 'El resto del disco, en orden' },
    addToPlaylist: { label: 'Añadir a una lista', hint: 'Una de tus listas, o una nueva' },
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

  shortFiles: {
    title: 'Ocultar archivos cortos',
    note: 'Deja fuera las notas de voz, los tonos de llamada y los sonidos de notificación por su duración. No se borra nada.',
    under: (seconds) => `Menos de ${format.number(seconds)} s`,
    shorterThan: (seconds) => `Menos de ${format.number(seconds)} segundos`,
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
    confirmAll: (files, songs) =>
      `¿Eliminar ${oneOrMany(files, '1 archivo', `${format.number(files)} archivos`)}? Se conserva una copia de ${oneOrMany(songs, 'la canción', `cada una de las ${format.number(songs)} canciones`)}, y las escuchas, etiquetas, letra y posiciones en listas de cada archivo eliminado pasan antes a ella. Android vuelve a preguntar antes de eliminar nada.`,
    confirm: (files) => `Eliminar ${oneOrMany(files, '1 archivo', `${format.number(files)} archivos`)}`,
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
};
