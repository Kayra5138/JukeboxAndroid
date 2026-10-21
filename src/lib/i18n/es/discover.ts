import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

const n = format.number;

export const discover: Strings['discover'] = {
  panel: {
    heading: 'Para lo próximo que escuches',
    refresh: 'Actualizar',
    updated: (date) => `Actualizada el ${date}`,

    familiar: (because) => `Más de tus artistas · ${because}`,
    fresh: (because) => `Un artista nuevo · ${because}`,
  },

  header: {
    notYet: 'Aún no hay lista',
    about: 'Acerca de Descubrir',
    settings: 'Ajustes de Descubrir',
    findMore: 'Buscar más',
    dismiss: 'Descartar',
  },

  about: {
    heading: 'Acerca de Descubrir',
    what:
      'Canciones que aún no tienes, elegidas a partir de lo que has escuchado en los últimos 30 días: más de tus artistas y artistas cercanos a ellos.',
    source:
      'Lo que escuchas se lee en este teléfono. Las sugerencias vienen de ListenBrainz y MusicBrainz, y el audio de una canción se descarga de YouTube cuando toca reproducirla.',
    keep: '«Guardar» pone una canción en tu biblioteca. Sale de la lista, porque ya la has encontrado.',
    exclude:
      '«No me interesa» la quita de la lista, y no se vuelve a recomendar. Desde el menú puedes decir lo mismo de su artista.',
    room: 'En ambos casos, otra canción ocupa su sitio. Desliza una fila hacia un lado para hacer lo mismo, o mantenla pulsada para ver más opciones.',
  },

  row: {
    keep: 'Guardar en la biblioteca',
    exclude: 'No me interesa',
    swipeKeep: 'Guardar',
    swipeExclude: 'Descartar',
    willPlay: 'Sonará cuando esté lista',
    preview: 'Avance · la canción está en camino',
    previewStop: 'Detiene el avance. La canción sonará igualmente cuando esté lista',
    willKeep: 'A la biblioteca cuando esté lista',
    keeping: 'Guardando en la biblioteca…',
    failed: 'No se ha podido descargar · toca para reintentar',
    needsBuild: 'Necesita la app actualizada',
    waitingWifi: 'Esperando Wi-Fi · toca para descargar',
    percent: (percent) => `${n(percent)} %`,
    gettingReady: 'Descargándose',
    hint: 'Reproduce la canción, descargándola antes si hace falta',
    nowPlaying: (title) => `Sonando: ${title}`,
    menu: 'Opciones de la canción',
  },

  menu: {
    play: { label: 'Reproducir', hint: 'Se descarga antes, si hace falta' },
    keep: { label: 'Guardar en la biblioteca', hint: 'Tuya para siempre, y fuera de esta lista' },
    exclude: { label: 'No me interesa', hint: 'Fuera de la lista, y no se vuelve a recomendar' },
    neverArtist: {
      label: (artist) => `Nunca ${artist}`,
      hint: 'No se vuelve a recomendar nada de este artista',
    },
    why: 'Por qué esta canción',
    seeds: (artists) => `Porque escuchas a ${artists}`,
    tags: (tags) => `Etiquetada como ${tags}`,
    freshArtist: 'Un artista nuevo en tu biblioteca',
  },

  empty: {
    building: 'Preparando tu lista…',
    none: 'Aún no hay lista. Pulsa Actualizar y Descubrir creará una a partir de lo que escuchas.',
    findingMore: 'Buscando más canciones…',
    short: (missing) =>
      oneOrMany(missing, 'Queda 1 hueco libre.', `Quedan ${n(missing)} huecos libres.`),
  },

  player: {
    kept: 'Guardada en la biblioteca',
  },

  preview: {
    label: 'Avance',
    note: 'La canción completa empieza cuando esté lista',
    stop: 'Detener el avance',
  },

  settings: {
    heading: 'Descubrir',
    title: 'Ajustes de Descubrir',
    count: 'Canciones para descubrir',
    countNote: 'Mitad de artistas conocidos, mitad nuevos. Las canciones guardadas y descartadas se reemplazan al momento.',
    refresh: 'Actualizar la lista',
    everyDays: (days) => `${n(days)} d`,
    manual: 'Manual',
    refreshNote:
      'Android decide cuándo puede ejecutarse el trabajo en segundo plano. Una actualización pendiente también se hace al volver a abrir Jukebox. Los descubrimientos no guardados se reemplazan; las canciones en cola se conservan hasta que la reproducción ya no las necesita.',
    ready: 'Tener preparadas las siguientes canciones',
    readyNone: 'Ninguna',
    readyNote:
      'Se descargan por adelantado para que un toque las reproduzca al instante: las primeras de la lista, o las que siguen a la que suena. Con «Ninguna», cada canción se descarga al tocarla.',
    wifi: 'Preparar canciones solo con Wi-Fi',
    wifiNote: 'Usa Wi-Fi sin límite de datos. Una canción que tocas se descarga con la conexión que haya.',
    preview: 'Reproducir un avance mientras se descarga una canción',
    previewNote:
      'Una canción que tocas y aún no está lista empieza al momento con un avance de 30 segundos de Deezer, y la canción completa la sustituye desde el principio cuando llega. Un avance no cuenta como escucha.',
    nextList: 'Tu lista actual se queda como está. La próxima se elegirá así.',
    excluded: 'Canciones descartadas',
    noneExcluded: 'No hay canciones descartadas.',
    allowAgain: 'Volver a permitir',
    allowAgainLabel: (title) => `Volver a permitir ${title}`,
    unblock: 'Desbloquear',
    unblockLabel: (artist) => `Desbloquear a ${artist}`,
    failed: 'No se han podido actualizar los ajustes de Descubrir. Inténtalo de nuevo.',
  },

  state: {
    idle: 'Toca para descargar y reproducir',
    starting: 'Empezando…',
    waitingFind: 'Esperando a que se busque',
    waitingDownload: 'Esperando para descargar',
    waitingRetry: 'Se reintentará en un momento',
    finding: 'Buscando la grabación…',
    preparing: 'Iniciando la descarga…',
    downloading: (percent) => `Descargando · ${n(percent)} %`,
    converting: 'Terminando…',
    saving: 'Casi lista…',
    ready: 'Lista para reproducir',
    playing: 'Sonando',
    willPlay: (doing) => `${doing} Sonará cuando esté lista.`,
    preview: (doing) => `Sonando un avance. ${doing}`,
    willKeep: (doing) => `${doing} Se guardará en la biblioteca cuando esté lista.`,
    keeping: 'Guardando en la biblioteca…',
    waitingWifi: 'Esperando Wi-Fi · toca para descargar ya',
  },

  failure: {
    generic: 'Esta descarga no ha podido terminar.',
    fileMissing: 'El archivo ya no está en el teléfono.',
    noRecording: 'No se ha encontrado ninguna grabación de esta canción.',
    notASong: 'El vídeo encontrado es una emisión en directo, o es demasiado largo para ser la canción.',
    stopped: 'Se ha detenido la descarga.',
    needsBuild: 'Instala el APK actualizado para descargar canciones de Descubrir.',
    retry: (reason) => `${reason} Toca para reintentar.`,
  },

  status: {
    building: 'Buscando canciones…',
    filling: (known, total) => `Buscando canciones · ${n(known)} de ${n(total)}`,
    findingOffline: 'Sin conexión. El resto de la lista se buscará cuando haya conexión.',
    findingPaused: 'Las descargas están en pausa. Reanúdalas y se buscará el resto de la lista.',
    findingLater: 'Algunas canciones no se han podido comprobar ahora. Descubrir lo volverá a intentar más tarde.',
    buildingArtists: (done, total) =>
      `Buscando canciones · ${n(done)} de ${n(total)} ${oneOrMany(total, 'artista', 'artistas')}`,
    preparing: (ready, target) =>
      `Hay una lista nueva en camino · ${n(ready)} de ${n(target)} ${oneOrMany(target, 'canción lista', 'canciones listas')}.${ready > 0 ? ' Vuelve a actualizar para verla ya.' : ''}`,
    offline: 'Sin conexión. Tu lista se conserva; se buscarán canciones nuevas cuando haya conexión.',
    offlineEmpty: 'Sin conexión. Descubrir creará tu lista cuando haya conexión.',
    noLibrary: 'Descubrir parte de la música de este teléfono, y aún no ha encontrado ninguna.',
    noTaste:
      'Tus canciones no dicen de quién son, así que Descubrir no tiene ningún artista del que partir. Busca sus datos en Ajustes → Biblioteca → Etiquetas.',
    unreachable: 'No se ha podido acceder a las recomendaciones. Tu lista se conserva; inténtalo más tarde.',
    unreachableEmpty: 'No se ha podido acceder a las recomendaciones. Inténtalo más tarde.',
    exhausted: 'Aún no hay suficientes canciones nuevas. Tu lista se queda como está.',
    exhaustedEmpty: 'Aún no hay nada nuevo que recomendar. Escucha un poco más y vuelve a intentarlo.',
    timedOut: 'La búsqueda de canciones ha tardado demasiado y se ha detenido. Inténtalo de nuevo.',
    throttled: 'Descubrir acaba de buscar. Inténtalo de nuevo dentro de un minuto.',
    failed: 'Descubrir no ha podido terminar. Inténtalo de nuevo.',
    waitingWifi: 'Las siguientes canciones se descargarán cuando haya Wi-Fi. Toca una canción para descargarla ya.',
    waitingConnection: 'Las siguientes canciones se descargarán cuando haya conexión.',
    paused: 'Las descargas están en pausa. Reanúdalas para traer canciones.',
  },

  notice: {
    kept: (title) => `${title} se ha guardado en la biblioteca.`,
    excluded: (title) => `${title} no se volverá a recomendar.`,
    excludedArtist: (artist) => `No se volverá a recomendar a ${artist}.`,
    restored: (title) => `${title} ha vuelto a la lista.`,
    refreshed: 'Aquí tienes tu nueva lista.',
    keepFailed: (title) => `No se ha podido guardar ${title} en la biblioteca. Inténtalo de nuevo.`,
    wrongFile: (title) => `El archivo de ${title} era otra canción. Se está buscando la correcta para guardarla.`,
    undo: 'Deshacer',
  },

  engine: {
    needsTaste: 'Descubrir no tiene ningún artista ni ninguna etiqueta de los que partir.',
    nothingFetched:
      'No se han podido obtener recomendaciones. Tu lista actual de Descubrir se conserva; inténtalo más tarde.',
  },

  taste: {
    popularity: 'Popularidad de las canciones',
    popularityKnown: 'Conocidas',
    popularityAny: 'Sin preferencia',
    popularityDeep: 'Poco conocidas',
    popularityNote:
      'Si Descubrir se inclina por artistas conocidos y sus canciones más escuchadas, o por artistas y canciones que menos gente ha encontrado. Sin preferencia, un artista nuevo se presenta con una de sus canciones más conocidas.',

    neverArtistLabel: (artist) => `No volver a recomendar a ${artist}`,
    blockedArtists: 'Artistas bloqueados',
    noneBlockedArtists: 'No hay artistas bloqueados.',
    blockedArtistsNote:
      'Descartar una canción también hace menos probable que se recomiende a su artista. Con tres canciones descartadas de un mismo artista, Descubrir lo deja fuera durante seis meses.',
  },

  why: {
    moreFrom: (artist) => `Más de ${artist}`,
    becauseYouPlay: (artists) => `Porque escuchas a ${artists}`,
    both: (first, second) => `${first} y ${second}`,
    like: (artist) => `Como ${artist}`,
    withGenre: (line, genre) => `${line} · ${genre}`,
    fromTags: (tags) => `Por tus escuchas de ${tags}`,
    unexplained: 'Elegida para ti',
    veryNear: 'Muy cerca de lo que escuchas',
    near: 'Cerca de lo que escuchas',
    farther: 'Un paso más allá',
  },

  gathering: {
    around: (artist, done, total) =>
      `Explorando en torno a ${artist} · ${n(done)} de ${n(total)} ${oneOrMany(total, 'artista', 'artistas')}`,
    artists: (done, total) => `${n(done)} de ${n(total)} ${oneOrMany(total, 'artista', 'artistas')}`,
    naming: 'Averiguando qué canciones son…',
    offline: 'Sin conexión. Descubrir buscará canciones nuevas cuando haya conexión.',
    throttled: 'El servicio de recomendaciones ha pedido a Descubrir que vaya más despacio. Inténtalo de nuevo dentro de unos minutos.',
    nothing: 'Esta vez no se ha encontrado nada nuevo. Tu lista actual de Descubrir se conserva; inténtalo más tarde.',
  },
};
