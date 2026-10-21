import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const lists: Strings['lists'] = {
  naming: {
    heading: 'Pon nombre a la lista',
    placeholder: 'Nombre de la lista',
    create: 'Crear',
  },

  screen: {
    newList: 'Nueva lista',
    fromTag: 'Desde una etiqueta',
    empty: 'Aún no hay nada. Una lista es un orden que tú eliges, que es justo lo que las etiquetas no pueden guardar.',
    followingTag: (count, tag) =>
      `${format.number(count)} ${oneOrMany(count, 'pista', 'pistas')} · sigue la etiqueta ${tag}`,
    fromListening: 'Según lo que escuchas',
    discover: 'Descubrir',
    discoverHint: 'Música que no tienes, a partir de lo que escuchas',

    tagSheet: {
      heading: 'Crear una lista desde una etiqueta',
      follows: 'Sigue la etiqueta',
      copy: 'Una copia',
      followsHint:
        'Siempre lo que lleve la etiqueta. Si etiquetas algo más adelante, aparece aquí; no se puede reordenar ni quitar nada.',
      copyHint:
        'Toma lo que lleva la etiqueta ahora mismo. Después cada una va por su lado, así que puedes ordenar la lista a tu gusto.',
      noTags: 'Aún no hay etiquetas. Busca primero los datos de algunas pistas.',
    },
  },

  auto: {
    mostPlayed: { name: 'Más escuchadas', hint: 'Lo que vuelves a poner una y otra vez' },
    recentlyFound: { name: 'Nuevas este mes', hint: 'Escuchadas por primera vez desde principios de mes' },
    forgotten: { name: 'Olvidadas', hint: 'Muy escuchadas en su día, y sin escuchar desde hace medio año' },
    skipped: { name: 'Más saltadas', hint: 'Las que siempre te saltas' },
  },

  picker: {
    heading: (count) =>
      oneOrMany(count, 'Añadir 1 pista a', `Añadir ${format.number(count)} pistas a`),
    noLists: 'Aún no hay listas.',
    newList: 'Nueva lista…',
    already: (list) => `Ya estaba todo en ${list}`,
    added: (count, list) =>
      oneOrMany(
        count,
        `1 pista añadida a ${list}`,
        `${format.number(count)} pistas añadidas a ${list}`
      ),
  },

  trackPicker: {
    heading: 'Añadir pistas',
    search: 'Busca en la biblioteca',
    alreadyHere: 'Ya está en esta lista',
    add: (count) => `Añadir ${format.number(count)} ${oneOrMany(count, 'pista', 'pistas')}`,
  },

  list: {
    album: 'Álbum',
    artist: 'Artista',
    folder: 'Carpeta',
    list: 'Lista',

    everythingTagged: (tag) => `Todo lo etiquetado con ${tag}, tal como está ahora`,
    away: (count) =>
      oneOrMany(
        count,
        '1 más no está ahora en la biblioteca',
        `${format.number(count)} más no están ahora en la biblioteca`
      ),

    addTracks: 'Añadir pistas',
    cover: 'Portada',
    deleteList: 'Eliminar lista',

    albums: 'Álbumes',
    tracks: 'Pistas',
    opensAlbum: 'Abre el álbum',

    empty: {
      editable: 'Aún no hay nada aquí. Añade pistas arriba o mándalas aquí desde la biblioteca.',
      tag: 'Aún nada lleva esa etiqueta. Añádela a algunas pistas y aparecerán aquí.',
      album: 'Ese disco ya no está en la biblioteca.',
      artist: 'Ya no hay nada en la biblioteca atribuido a este artista.',
      folder: 'Ya no hay nada en esa carpeta.',
      auto: 'Todavía no hay nada que encaje. Escucha unas cuantas cosas primero.',
    },

    mightBelong: 'Podrían encajar aquí',
    mightBelongHint:
      'Según las etiquetas en las que ya se apoya la lista, con más peso para las poco comunes que para una que lleve media biblioteca.',

    choosePicture: 'Elegir una imagen…',
    firstFour: 'Usar las cuatro primeras',

    renameHeading: 'Renombrar la lista',
    deleteQuestion: (name) => `¿Eliminar «${name}»?`,
    deleteHint: 'Se elimina la lista. Las pistas siguen en el teléfono.',
  },

  files: {
    importFiles: 'Importar listas M3U…',
    exportAll: 'Exportar todas las listas…',
    export: 'Exportar…',
    untitled: 'Lista importada',
    reading: 'Leyendo las listas…',

    conflict: {
      heading: (name) => `Ya hay una lista llamada «${name}»`,
      hint: 'El archivo puede ocupar su lugar, conservando la portada, o entrar como una lista aparte.',
      replace: 'Reemplazarla',
      keepBoth: (name) => `Añadir como «${name}»`,
      skip: 'Omitir este archivo',
    },

    result: {
      heading: 'Importado',
      imported: (name, found, total) =>
        `Lista ${name} importada: ${format.number(found)} de ${format.number(total)} encontradas`,
      repeated: (count) =>
        oneOrMany(
          count,
          'Una pista aparecía más de una vez en el archivo; en la lista aparece solo una vez.',
          `${format.number(count)} pistas aparecían más de una vez en el archivo; en la lista cada una aparece solo una vez.`
        ),
      showMissing: (count) =>
        oneOrMany(count, 'Ver la no encontrada', `Ver las ${format.number(count)} no encontradas`),
      hideMissing: 'Ocultarlas',
      reasons: {
        notFound: 'Nada de la biblioteca coincide',
        ambiguous: 'Coincide más de una pista',
        web: 'Una dirección web, no un archivo',
      },
      tooBig: (file) => `${file} es demasiado grande para ser una lista.`,
      unreadable: (file) => `No se ha podido leer ${file} como lista.`,
      empty: (file) => `${file} está vacío.`,
      skipped: (file) => `Se ha omitido ${file}.`,
      encoding: (encoding) => `Leído como ${encoding}`,
      open: 'Abrir',
    },

    exportSheet: {
      heading: 'Exportar como lista M3U',
      headingAll: 'Exportar todas las listas',
      phone: 'Rutas del teléfono',
      phoneHint:
        'Rutas completas como /storage/emulated/0/Music/…, que entienden los demás reproductores de este teléfono, pongas donde pongas el archivo.',
      library: 'Desde la carpeta de la biblioteca',
      libraryHint:
        'Rutas que empiezan dentro de la carpeta de la biblioteca, para un ordenador con la misma música. Pon el archivo en la raíz de esa carpeta.',
      save: 'Guardar…',
      chooseFolder: 'Elegir una carpeta…',
      allHint:
        'Un archivo .m3u8 por cada una de tus listas, en la carpeta que elijas. Si ya hay uno con el mismo nombre, se reemplaza.',
    },

    saved: (name) => `${name} guardada como lista M3U`,
    savedAll: (count, folder) =>
      oneOrMany(count, `1 lista guardada en ${folder}`, `${format.number(count)} listas guardadas en ${folder}`),
    notSaved: (names) => `Sin guardar: ${names}`,
    leftOut: (count) =>
      oneOrMany(
        count,
        'Se ha dejado fuera 1 pista: ahora no está en la carpeta de la biblioteca.',
        `Se han dejado fuera ${format.number(count)} pistas: ahora no están en la carpeta de la biblioteca.`
      ),
    failed: (reason) => `No ha funcionado: ${reason}`,
  },
};
