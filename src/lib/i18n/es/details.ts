import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

const files = (count: number) => `${format.number(count)} ${oneOrMany(count, 'archivo', 'archivos')}`;

/** What a file's fields are called in a line that says which were written. */
const FIELD_NAMES: Record<string, string> = {
  title: 'título',
  artist: 'artista',
  album: 'álbum',
  albumArtist: 'artista del álbum',
  genre: 'género',
  year: 'año',
  track: 'número de pista',
  disc: 'número de disco',
  cover: 'portada',
};

/* "A, B y C". Before a word that starts with an i sound, Spanish says "e" instead of "y". */
function listed(items: string[]): string {
  if (items.length <= 1) return items.join('');
  const last = items[items.length - 1]!;
  const and = /^h?[iíIÍ](?![aeiouáéó])/.test(last) ? 'e' : 'y';
  return `${items.slice(0, -1).join(', ')} ${and} ${last}`;
}

export const details: Strings['details'] = {
  screen: {
    tabs: { general: 'General', tags: 'Etiquetas', lyrics: 'Letra' },
    missing:
      'Esa pista ya no está en la biblioteca. Puede que se haya eliminado, movido o dejado fuera de la carpeta que lee Jukebox.',
    goBack: 'Volver',
  },

  lookUp: 'Buscar datos',
  searchFailed: 'No se ha podido completar la búsqueda.',

  general: {
    fields: {
      title: 'Título',
      artist: 'Artista',
      album: 'Álbum',
      albumArtist: 'Artista del álbum',
      year: 'Año de publicación',
      trackNumber: 'Número de pista',
      discNumber: 'Número de disco',
    },
    notAYear: 'Eso no es un año.',
    notAPlace: 'Un número entero, de 1 en adelante.',

    chooseCoverLabel: 'Elegir una portada de la galería',
    noCover: 'Sin portada',
    chooseFromGallery: 'Elegir de la galería',
    removeCover: 'Quitar portada',
    keepCover: 'Mantener la que tenía',
    coverChosen: 'Portada elegida. Guarda para conservarla.',

    lookUpHint:
      'Busca el título y el artista tal como están escritos abajo y rellena lo que encuentre: nombres, álbum, año, posición en el disco y portada.',
    nothingFound: 'No se ha encontrado nada para ese título y ese artista.',
    found: (sources, withCover) =>
      `Encontrado en ${listed(sources)}${withCover ? ', con portada' : ''}. Revísalo y guarda para conservarlo.`,

    discard: 'Descartar mi edición',
    saveHint:
      'Lo que guardes aquí se considera tuyo: al volver a buscar los datos de la biblioteca, esta pista se respetará en lugar de sobrescribirse.',
    editGone: 'Tu edición se ha descartado. Una búsqueda puede volver a rellenar esto.',

    inFile: 'En el archivo',
    writeLabel: 'Escribir estos detalles en el archivo',
    writeToFile: 'Escribir en el archivo',
    saveFirst: 'Guarda primero. Solo se escribe en el archivo lo que se ha guardado.',
    writeHint:
      'Escribir en el archivo pone en él el título, el artista, el álbum, el año y los números de pista y de disco ' +
      'tal como los muestra la biblioteca, la primera etiqueta como género y la portada guardada aquí, ' +
      'para que otros reproductores y otros dispositivos los encuentren. Android pide permiso ' +
      'antes de cambiar nada. Todo lo demás que contenga el archivo se deja como está, ' +
      'y la letra no se escribe.',
    cannotWrite: 'Solo se puede escribir en archivos MP3 y FLAC. Los detalles de este se quedan en la app.',
    nothingWritten: 'No se ha escrito nada.',
    couldNotWrite: 'No se ha podido escribir.',

    listening: 'Escuchas',
    timesPlayed: 'Veces escuchada',
    playedToEnd: 'Escuchada hasta el final',
    timeSpent: 'Tiempo de escucha',
    firstPlayed: 'Primera escucha',
    lastPlayed: 'Última escucha',
    never: 'nunca',
    listenedSeconds: (seconds) => oneOrMany(seconds, '1 segundo', `${format.number(seconds)} segundos`),
    listenedMinutes: (minutes) => oneOrMany(minutes, '1 minuto', `${format.number(minutes)} minutos`),
    listenedHours: (hours, minutes) => `${format.number(hours)}h ${minutes}min`,

    file: 'Archivo',
    name: 'Nombre',
    folder: 'Carpeta',
    length: 'Duración',
    detailsFrom: 'Origen de los datos',
    unknown: 'desconocido',
    from: {
      notLookedUp: 'sin buscar',
      yourEdit: 'tu edición',
      notFound: 'no encontrados',
      lookup: 'una búsqueda',
    },
  },

  tags: {
    lookUpHint:
      'Busca las etiquetas de esta pista. Las que hayas escrito tú se quedan; las que trajo antes una búsqueda se sustituyen por lo que encuentre ahora.',
    noneFound: 'No se han encontrado etiquetas para esta pista.',
    found: (count, source) =>
      oneOrMany(
        count,
        `1 encontrada en ${source}. Ordénala y guarda para conservarla.`,
        `${format.number(count)} encontradas en ${source}. Ordénalas y guarda para conservarlas.`
      ),
    saveHint:
      'La primera etiqueta es la que cuenta como género. Una etiqueta que escribas se considera tuya: ninguna búsqueda posterior la quitará.',
  },

  editor: {
    label: 'Etiquetas',
    add: 'Añadir una etiqueta',
    moveUp: (tag) => `Subir ${tag}`,
    moveDown: (tag) => `Bajar ${tag}`,
    remove: (tag) => `Quitar ${tag}`,
  },

  tagPrompt: {
    heading: (count) =>
      oneOrMany(count, 'Añadir una etiqueta a 1 pista', `Añadir una etiqueta a ${format.number(count)} pistas`),
    placeholder: 'Etiqueta',
  },

  lyrics: {
    lookUpHint:
      'Busca la letra de esta pista igual que al reproducirla, y sustituye la guardada si la encuentra.',
    nothingMatched: 'Nada coincide con esta pista. La búsqueda de abajo no descarta nada.',
    foundAndSaved: 'Encontrada y guardada.',
    nothingCameBack: 'No ha salido nada con eso.',
    cleared: 'Borrada. La próxima búsqueda volverá a buscarla.',
    notSeconds: 'Eso no es un número de segundos.',

    stored: 'Lo guardado',
    none: 'Nada todavía',
    kept: (timed, byHand, lines) =>
      `${timed ? 'Sincronizada' : 'Texto sin sincronizar'}, ${byHand ? 'elegida a mano' : 'de LRCLIB'}` +
      (lines > 0 ? ` · ${oneOrMany(lines, '1 línea', `${format.number(lines)} líneas`)}` : ''),
    forget: 'Olvidar esta y volver a buscar',
    saveChanges: 'Guardar cambios',
    timedHint:
      'Cada línea lleva delante su tiempo. Cambia las palabras y deja los corchetes, o la línea pierde su sitio.',
    plainHint: 'Cambia lo que quieras. La letra guardada se considera tuya y ninguna búsqueda la sustituye.',

    timing: 'Sincronización',
    timingHint:
      'Desplaza todas las líneas a la vez. Úsalo cuando la letra es correcta pero llega antes o después de tiempo: abre el reproductor y ajústalo hasta que encaje, o toca la cifra y escríbela. Un desplazamiento positivo hace que la letra llegue más tarde.',
    earlier: (seconds) => `−${seconds}s`,
    later: (seconds) => `+${seconds}s`,
    shiftedEarlier: (written) => `−${written}s`,
    shiftedLater: (written) => `+${written}s`,
    noShift: 'sin desplazar',
    reset: 'Restablecer',
    offsetHeading: '¿Cuánto va desfasada la letra?',
    offsetPlaceholder: 'Segundos, p. ej. 1,5 o -0,75',
    typeOffset: 'Escribir un desplazamiento exacto',
    wordsField: 'Letra',

    byHand: 'Buscar a mano',
    byHandHint:
      'Aquí no se descarta nada, a diferencia de la búsqueda automática, que rechaza todo lo que no coincide en duración; por eso algunas pistas nunca encuentran su letra.',
    queryPlaceholder: 'Artista y título',
    candidateTimed: 'sincronizada',
    candidatePlain: 'sin sincronizar',

    paste: 'Pegar',
    pasteHint: 'Acepta un archivo LRC o texto sin más. Con marcas de tiempo, queda sincronizada.',
    savePasted: 'Guardar lo pegado',
  },

  library: {
    coversSaved: (count) =>
      oneOrMany(count, '1 portada de álbum añadida.', `${format.number(count)} portadas de álbum añadidas.`),
    stoppedOffline: (matched) =>
      `No respondía nada, así que la búsqueda se ha detenido tras ${format.number(matched)} ${oneOrMany(matched, 'coincidencia', 'coincidencias')}. No se ha escrito nada para el resto: siguen esperando su turno.`,
    serviceUnreachable: (service) =>
      `No se ha podido conectar con ${service}, así que la búsqueda ha seguido sin él. Lo que lo necesitaba se ha dejado como estaba y se intentará la próxima vez.`,
    stoppedUnexpectedly: 'La búsqueda se ha detenido inesperadamente.',

    nothingAnswered: 'No responde nada. Deteniendo.',
    rateLimited: 'Uno de los servicios ha pedido una pausa. Se le volverá a preguntar dentro de un minuto.',
    lookingUp: 'Buscando…',
    lookingUpProgress: (done, total) =>
      `Buscando… ${format.number(done)} de ${format.number(total)} ${oneOrMany(total, 'pista completada', 'pistas completadas')}`,
    lookingUpAlbum: (album, done, total) =>
      `Buscando «${album}»… ${format.number(done)} de ${format.number(total)} ${oneOrMany(total, 'pista completada', 'pistas completadas')}`,
    soFar: (matched, covers) =>
      `${format.number(matched)} ${oneOrMany(matched, 'encontrada', 'encontradas')}, ${format.number(covers)} ${oneOrMany(covers, 'portada', 'portadas')} por ahora`,
    stop: 'Detener',
    lookupChannel: 'Búsquedas de datos',

    selected: (count) =>
      `${format.number(count)} ${oneOrMany(count, 'seleccionada', 'seleccionadas')}`,
    summary: (matched, edited, notFound, untried) =>
      [
        `${format.number(matched)} ${oneOrMany(matched, 'encontrada', 'encontradas')}`,
        edited > 0 ? `${format.number(edited)} ${oneOrMany(edited, 'editada', 'editadas')}` : null,
        `${format.number(notFound)} sin encontrar`,
        `${format.number(untried)} sin buscar`,
      ]
        .filter(Boolean)
        .join(' · '),
    reset: 'Restablecer',
    lookUpMissing: 'Buscar las que faltan',
    hint: 'Toca una pista para corregirla a mano. Arrastra hacia abajo por las casillas para seleccionar varias seguidas.',
    searchPlaceholder: 'Busca en estas pistas',

    noGenre: 'sin género',
    noMatch: 'sin coincidencias',
    notLookedUp: 'aún sin buscar',
    matchedSpoken: (artist, title) => `Encontrada: ${artist}, ${title}`,
    manualSpoken: (artist, title) => `Puesta a mano: ${artist}, ${title}`,
  },

  selection: {
    more: 'Más…',
    moreHint: 'Todo lo que se puede hacer con las pistas seleccionadas',
    heading: (count) =>
      oneOrMany(count, '1 pista seleccionada', `${format.number(count)} pistas seleccionadas`),
    sections: { find: 'Buscar datos', change: 'Cambiar', other: 'Otros' },
    actions: {
      lookUp: {
        label: 'Buscar datos',
        hint: 'Olvida lo que se encontró antes para ellas y las vuelve a buscar, portadas incluidas. Tus propios cambios se quedan.',
      },
      covers: {
        label: 'Buscar portadas',
        hint: 'Solo portadas, para las que no tienen. No se vuelve a buscar nada más, y una portada que elegiste o quitaste se queda como está.',
      },
      lyrics: {
        label: 'Buscar letras',
        hint: 'Primero en los archivos y en los .lrc, luego en LRCLIB. La letra que elegiste se queda.',
      },
      edit: {
        label: 'Editar datos a la vez',
        hint: 'Artista, artista del álbum, álbum o año, en todas de una vez',
      },
      addTag: { label: 'Añadir una etiqueta', hint: 'Una etiqueta, para todas' },
      removeTag: { label: 'Quitar una etiqueta', hint: 'Una de sus etiquetas, quitada de todas' },
      cover: { label: 'Elegir portada', hint: 'Una imagen de tu galería, para todas' },
      write: {
        label: 'Escribir en archivos',
        hint: 'Escribe en los propios archivos los datos que muestra la biblioteca. Android pregunta antes.',
      },
      addToList: { label: 'Añadir a una lista', hint: 'Las pone en una de tus listas' },
      reset: {
        label: 'Restablecer',
        hint: 'Olvida lo que las búsquedas encontraron para ellas. Tus propios cambios se quedan.',
      },
      delete: { label: 'Eliminar del teléfono', hint: 'Borra los archivos. Android pregunta antes.' },
    },
    busy: 'Ya hay una búsqueda en marcha. Espera a que termine o detenla.',

    editHeading: (count) => oneOrMany(count, 'Editar 1 pista', `Editar ${format.number(count)} pistas`),
    editHint:
      'Rellena solo lo que deba ser igual en todas. Una casilla vacía deja cada pista como está; para vaciar un campo en todas, marca la opción de debajo. Los títulos y los números de pista y de disco no se tocan.',
    keepEach: 'Cada una conserva el suyo',
    empty: 'Vacío',
    clearOn: { remove: 'Quitar de todas', own: 'Usar el artista de cada archivo' },
    cleared: { remove: 'Se quitará de todas', own: 'El artista de cada archivo' },
    edited: (count) =>
      oneOrMany(
        count,
        'Guardado. Ahora es un cambio tuyo y las búsquedas no lo tocan.',
        `Guardado en ${format.number(count)} pistas. Ahora son cambios tuyos y las búsquedas no los tocan.`
      ),

    tagAdded: (tag, count) =>
      `«${tag}» ya está en ${format.number(count)} ${oneOrMany(count, 'pista', 'pistas')}.`,
    removeTagHeading: (count) =>
      oneOrMany(count, 'Quitar una etiqueta de 1 pista', `Quitar una etiqueta de ${format.number(count)} pistas`),
    tagOption: (tag, count) => `${tag} · ${format.number(count)}`,
    noTags: 'Ninguna de estas pistas tiene etiquetas.',
    tagRemoved: (tag, count) =>
      `Se ha quitado «${tag}» de ${format.number(count)} ${oneOrMany(count, 'pista', 'pistas')}.`,

    resetQuestion: (count) =>
      oneOrMany(count, '¿Restablecer 1 pista?', `¿Restablecer ${format.number(count)} pistas?`),
    resetBody:
      'Se olvida lo que las búsquedas encontraron para ellas y cuentan como no buscadas. Tus propios cambios se quedan. No se puede deshacer.',

    coversProgress: (done, total) =>
      `Buscando portadas… ${format.number(done)} de ${format.number(total)} pistas listas`,
    coversNone: 'No se han encontrado portadas nuevas.',
    lyricsProgress: (done, total) =>
      `Buscando letras… ${format.number(done)} de ${format.number(total)} pistas listas`,
    lyricsSoFar: (found) => `${format.number(found)} encontradas hasta ahora`,
    lyricsFound: (found, wanted, had) =>
      [
        wanted > 0 ? `Letra encontrada para ${format.number(found)} de ${format.number(wanted)}.` : null,
        had > 0 ? oneOrMany(had, '1 ya la tenía.', `${format.number(had)} ya la tenían.`) : null,
      ]
        .filter(Boolean)
        .join(' ') || 'Nada que buscar: la letra de estas pistas la elegiste tú.',
    lyricsOffline:
      'No se ha podido conectar con LRCLIB, así que la búsqueda se ha detenido. El resto se puede intentar más tarde.',
  },

  write: {
    heading: (count) => `¿Escribir los detalles en ${files(count)}?`,
    body: (count) =>
      `Se ${oneOrMany(count, 'modificará', 'modificarán')} ${files(count)}: el título, el artista, el álbum, el año, ` +
      'los números de pista y de disco, la primera etiqueta como género y la portada guardada que muestra la biblioteca ' +
      'se escriben en el propio archivo. Android te pedirá permiso. Todo lo demás que haya en cada ' +
      'archivo se deja como está.',
    noneHeading: 'No se puede escribir en ninguno de estos',
    noneBody: 'Solo se puede escribir en archivos MP3 y FLAC, y no en la pista que está sonando.',
    skipping: (otherKind, playing) =>
      otherKind > 0 && playing
        ? `Se ${oneOrMany(otherKind, 'omitirá', 'omitirán')} ${files(otherKind)} de otro tipo, y también la pista que está sonando.`
        : otherKind > 0
          ? `Se ${oneOrMany(otherKind, 'omitirá', 'omitirán')} ${files(otherKind)} de otro tipo.`
          : 'Se omitirá la pista que está sonando.',
    confirmLabel: (count) => `Escribir los detalles en ${files(count)}`,
    confirm: 'Escribir',
    nothingWritten: 'No se ha escrito nada.',
    couldNotStart: 'No se ha podido empezar.',

    writing: 'Escribiendo en los archivos',
    progressLabel: (done, total) => `Escritos: ${format.number(done)} de ${files(total)}`,
    progress: (done, total) => `${format.number(done)} de ${format.number(total)}`,
    stopping: 'Se detendrá al terminar este archivo.',
    keepOpen: 'Cada archivo se comprueba antes de tocar el original. Mantén la app abierta.',
    stopLabel: 'Detener tras el archivo que se está escribiendo',
    stop: 'Detener',
    stoppedShort: (count) => `Detenido con ${files(count)} sin intentar.`,

    written: (changed) =>
      changed.length > 0
        ? `Escrito: ${listed(changed.map((name) => FIELD_NAMES[name] ?? name))}.`
        : 'Escrito.',
    unchanged: 'Ya decía todo esto. Se ha dejado como estaba.',
    skippedPlaying: 'Omitido: está sonando. Inténtalo de nuevo cuando no lo esté.',
    skippedFormat: 'Omitido: solo se puede escribir en archivos MP3 y FLAC.',
    failed: (reason) => `Error: ${reason}`,
    noReason: 'No se ha podido escribir. El archivo no se ha tocado.',

    summary: (counts) => {
      const parts: string[] = [];
      if (counts.written > 0) {
        parts.push(`${oneOrMany(counts.written, 'Se ha escrito', 'Se han escrito')} ${files(counts.written)}.`);
      }
      if (counts.unchanged > 0) {
        parts.push(`${files(counts.unchanged)} ya ${oneOrMany(counts.unchanged, 'coincidía', 'coincidían')}.`);
      }
      if (counts.skipped > 0) {
        parts.push(`${oneOrMany(counts.skipped, 'Se ha omitido', 'Se han omitido')} ${files(counts.skipped)}.`);
      }
      if (counts.failed > 0) {
        parts.push(`${files(counts.failed)} ${oneOrMany(counts.failed, 'ha fallado', 'han fallado')}.`);
      }
      return parts.length > 0 ? parts.join(' ') : 'Nada que escribir.';
    },
  },

  same: {
    note:
      'Parecen una sola canción en dos archivos. Al combinarlos, todo lo que tiene el primer archivo pasa al segundo: sus escuchas, etiquetas, letra y posiciones en listas. Si los mantienes separados, ambos se quedan como están y no se te vuelve a preguntar por esta pareja.',
    failed: (error) => `No se ha podido hacer y no se ha cambiado nada. ${error}`,
    empty: 'No queda nada por decidir.',
    from: 'De',
    into: 'A',
    keepApart: 'Mantener separados',
    merge: 'Combinar',
    bulk: {
      mergeDelete: 'Combinar y eliminar el primer archivo',
      deleteToo: 'Eliminar también el primer archivo de cada par',
      deleteNote: 'Android pregunta antes de eliminar nada.',
      notDeleted: 'Los archivos no se han eliminado.',
      deleted: (count) => oneOrMany(count, '1 archivo eliminado.', `${format.number(count)} archivos eliminados.`),
      choose: 'Elegir este par',
      chosen: (count) => oneOrMany(count, '1 par elegido', `${format.number(count)} pares elegidos`),
      merge: (count) => `Combinar ${format.number(count)}`,
      keepApart: (count) => `No combinar ${format.number(count)}`,
      confirm: (count) =>
        oneOrMany(
          count,
          '¿Combinar 1 par? Las escuchas, etiquetas, letra y posiciones en listas del primer archivo pasan al segundo, y no se pueden volver a separar.',
          `¿Combinar ${format.number(count)} pares? En cada uno, las escuchas, etiquetas, letra y posiciones en listas del primer archivo pasan al segundo, y no se pueden volver a separar.`
        ),
      done: (done, skipped) =>
        skipped > 0
          ? `${oneOrMany(done, '1 par resuelto', `${format.number(done)} pares resueltos`)}; ${oneOrMany(skipped, '1 ya estaba resuelto', `${format.number(skipped)} ya estaban resueltos`)} por otra respuesta.`
          : oneOrMany(done, '1 par resuelto.', `${format.number(done)} pares resueltos.`),
    },
    unknown: 'Desconocido',
    noFileName: 'Nombre de archivo desconocido',
    holds: (side) => {
      const parts: string[] = [];
      if (side.listens > 0) {
        parts.push(oneOrMany(side.listens, '1 escucha', `${format.number(side.listens)} escuchas`));
      }
      if (side.tags > 0) {
        parts.push(oneOrMany(side.tags, '1 etiqueta', `${format.number(side.tags)} etiquetas`));
      }
      if (side.lyrics) parts.push('letra');
      if (side.lists > 0) {
        parts.push(oneOrMany(side.lists, 'en 1 lista', `en ${format.number(side.lists)} listas`));
      }
      return parts.length > 0 ? parts.join(' · ') : 'Nada todavía';
    },
  },
};
