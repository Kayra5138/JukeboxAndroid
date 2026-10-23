import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `Última compilación: ${when}`,
  lastBuiltUnknown: 'Última compilación: disponible tras instalar el nuevo APK',

  sections: {
    look: 'Aspecto',
    sound: 'Sonido',
    player: 'Reproductor',
    library: 'Biblioteca',
    downloads: 'Descargas y Descubrir',
    data: 'Tus datos',
    views: 'Vistas de la biblioteca',
    experimental: 'Experimental',
  },
  categories: {
    look: 'El tema, los álbumes en estantería, las animaciones y las vistas que ofrece la biblioteca.',
    sound: 'El ecualizador y los efectos, la igualación del volumen, el fundido, y la velocidad y el tono.',
    player: 'Cuánto saltan los botones de avance y retroceso, qué suena cuando se acaba la cola y el idioma al que se traducen las letras.',
    library: 'La carpeta de tu música, las etiquetas y portadas, y los archivos que pueden ser la misma canción.',
    waiting: (count) => `${format.number(count)} por decidir`,
    downloads: 'La cola de descargas y su botón flotante, Descubrir, y mantener al día el descargador de YouTube.',
    data: 'Copia de seguridad de todo, importación de copias, aviso de nuevas versiones y ListenBrainz (experimental).',
  },

  language: {
    title: 'Idioma',
    note: 'El idioma de la app. No sigue el del teléfono.',
  },
  theme: {
    title: 'Tema',
    open: 'Colores, cristal o uno tuyo.',
    note: 'Sistema sigue el modo claro u oscuro del teléfono.',
    pair: {
      light: 'En modo claro',
      dark: 'En modo oscuro',
      note: 'Los dos temas entre los que cambia Sistema, igual que el teléfono.',
    },
    shuffle: {
      title: 'Un tema distinto cada vez',
      on: 'Activado',
      toggle: 'Elegir uno al azar cada vez que se abre la app',
      note: 'Marca los temas entre los que elegir. El elegido se queda hasta la próxima vez que abras la app, y mientras tanto puedes cambiarlo a mano.',
      empty: 'Marca al menos un tema para que esto haga algo.',
    },
  },
  customTheme: {
    open: 'Colores del tema personalizado',
    openNote: 'Elige un fondo y un color de acento para el tema personalizado. Todo lo demás se calcula a partir de ellos.',
    preview: 'Vista previa',
    background: 'Fondo',
    accent: 'Acento',
    surface: 'Tarjetas',
    automatic: 'Automático',
    automaticNote: 'Calculado a partir del fondo',
    presets: 'Colores sugeridos',
    hue: 'Matiz',
    saturation: 'Saturación',
    lightness: 'Luminosidad',
    degrees: (value) => `${value}°`,
    percent: (value) => `${value} %`,
    hex: 'Código de color',
    nudged: (colour) => `Se muestra como ${colour} para que todo lo que tenga encima se pueda leer.`,
    note:
      'Los colores del texto se calculan a partir de estos para que siempre se pueda leer. Por eso mismo, un color que elijas puede aclararse u oscurecerse un poco.',
    use: 'Usar este tema',
    reset: 'Restablecer',
    sample: {
      title: 'Título de la canción',
      line: 'Artista · Álbum',
      chip: 'Aleatorio',
      button: 'Reproducir',
    },
  },

  tags: { note: 'Información de las pistas y portadas de álbumes' },
  rack: {
    title: 'Álbumes en estantería',
    note:
      'Con el teléfono en horizontal, pasa las fundas de los discos en lugar de leer una lista. Toca la de delante para abrirla.',
  },
  heart: { title: 'Corazón', note: 'Un corazón en el reproductor. No guarda nada.' },
  listButton: {
    title: 'Botón de añadir a lista',
    note:
      'Un botón en el reproductor que añade la canción que suena a una de tus listas sin pasar por su menú.',
  },
  autoplaySizes: { title: 'Canciones parecidas cada vez', library: 'De tu biblioteca', fresh: 'Nuevas de Discover', note: 'Cuántas se añaden cada vez que se rellena la cola, para «Seguir con canciones parecidas» y para una canción reproducida con parecidas. Cada canción nueva es una descarga. Mezcla toma tres cuartos de cada una.' },
  tap: {
    title: 'Al tocar una canción',
    note: 'Qué suena después de una canción que tocas en Tracks o en los resultados de búsqueda.',
    sheetNote: 'Play y Shuffle sobre un álbum o una lista, Shuffle all y Discover no cambian con esto. El menú de cada canción tiene «Reproducir con canciones parecidas» y «Reproducir solo esta» para una vez.',
    list: { label: 'El resto de la lista', note: 'Las canciones siguientes, en el orden mostrado.' },
    shuffled: { label: 'El resto de la lista, aleatorio', note: 'Primero esta, luego las demás de la lista en orden aleatorio.' },
    similar: { label: 'Canciones parecidas', note: 'Esta, y luego un grupo de canciones parecidas de tu biblioteca o de Discover, como elijas. Después, la cola sigue según «Seguir con canciones parecidas».' },
    only: { label: 'Solo esa canción', note: 'Nada después, salvo que «Seguir con canciones parecidas» añada algo.' },
    source: { title: 'Canciones parecidas de', note: 'De dónde vienen las primeras canciones tras una que tocas. Después, manda «Seguir con canciones parecidas».' },
    everywhere: { title: 'También en álbumes y listas', note: 'También al tocar una canción en la página de un álbum, lista, artista o carpeta. Desactivado, suenan en su propio orden.' },
  },
  autoplay: {
    title: 'Seguir con canciones parecidas',
    note: 'Cuando la cola está a punto de acabarse, se añaden al final canciones parecidas a las que estabas escuchando.',
    sheetNote: 'Se añaden unas canciones antes del final, así que suenan como el resto de la cola, también con la pantalla bloqueada. Nunca con la repetición activada.',
    off: {
      label: 'Desactivado',
      note: 'No se añade nada. La música se detiene al acabar la cola.',
    },
    library: {
      label: 'De tu biblioteca',
      note: 'Elegidas por etiquetas, artistas y lo que sueles escuchar junto. Funciona sin conexión.',
    },
    fresh: {
      label: 'Canciones nuevas',
      note: 'Canciones que aún no tienes, encontradas por Descubrir. Usa la red y descarga de YouTube como Descubrir, y respeta su ajuste de Wi-Fi.',
    },
    mixed: {
      label: 'Mezcla',
      note: 'Dos de tu biblioteca y luego una nueva. Las nuevas usan la red y las descargas de YouTube como Descubrir, y respetan su ajuste de Wi-Fi.',
    },
  },
  downloads: {
    note: 'Lo que se está descargando, lo que espera y lo que ha terminado.',
    button: {
      title: 'Botón flotante de descargas',
      note: 'Un botón redondo sobre la app mientras se descarga algo, y durante unos minutos después. Tócalo para ver cómo va.',
    },
    check: {
      title: 'Buscar un descargador de YouTube más reciente',
      note: 'Como mucho una vez al día, y solo cuando abres Descargas o descargas algo, Jukebox pregunta a GitHub cuál es la última versión de yt-dlp. No se envía nada sobre ti ni sobre tu biblioteca, y no se descarga nada hasta que tú lo digas.',
    },
  },
  discover: { note: 'Cuántas canciones tiene la lista, cada cuánto se renueva y lo que has descartado.' },
  still: {
    title: 'Sin animaciones decorativas',
    note:
      'Para teléfonos que pierden fotogramas. El reproductor aparece en lugar de subir, y el juego deja de iluminarse al ganar o perder una vida. Las teclas siguen cayendo: eso es el juego, no decoración.',
  },
  moreButton: {
    title: 'Tres puntos en cada fila',
    note:
      'Al final de cada fila de pistas, abren el mismo menú que una pulsación larga. Mantener pulsada una fila también funciona sin ellos.',
  },
  tabs: {
    title: 'Pestañas',
    searchNote: 'Descubrir y las descargas de YouTube están en esta pestaña y desaparecen con ella.',
    aside: 'Biblioteca y Ajustes siempre están.',
  },

  views: {
    notes: {
      tracks: 'Todas las pistas, una por fila.',
      albums: 'Discos, reunidos según lo que dicen las etiquetas.',
      artists: 'Todos los artistas a los que se atribuye alguna canción. Una canción de dos artistas aparece en ambos.',
      folders: 'Las carpetas donde están los archivos, dentro de la carpeta de la biblioteca.',
    },
    onlyHint: 'Es la única vista activada, así que sigue activada',
    toggleHint: 'Muestra u oculta esta vista en la biblioteca',
    asideOne: 'Con una sola vista activada, la biblioteca la muestra sin selector. Siempre queda al menos una activada.',
    asideMany: 'El selector de la biblioteca ofrece las vistas activadas. Siempre queda al menos una activada.',
  },

  sameSong: {
    note: (count) =>
      oneOrMany(
        count,
        'Un archivo que parece una canción que ya tenías en otro archivo. Su historial se mantiene aparte hasta que decidas.',
        `${format.number(count)} archivos que parecen canciones que ya tenías en otro archivo. Su historial se mantiene aparte hasta que decidas.`
      ),
  },
  exportAll: {
    title: 'Exportar todo',
    note:
      'Tu historial de escucha, listas, etiquetas, letras y ajustes, en un archivo que guardas donde quieras. No incluye la música.',
    failed: 'No se ha podido guardar la copia de seguridad.',
  },
  importBackup: {
    title: 'Importar',
    note: 'Trae una copia de seguridad. Verás lo que contiene y se te preguntará antes de cambiar nada.',
    failed: 'No se ha podido importar.',
    refused: (reason) => `${reason} No se ha cambiado nada en este teléfono.`,
  },

  playback: {
    title: 'Reproducción',
    note: (speed) => `Velocidad y tono · ${speed}×`,
  },
  equalizer: { note: 'Bandas, graves, sonido envolvente y realce de volumen' },
  effects: { note: 'Amplitud, crossfeed, rotación y nivel' },
  jump: {
    title: 'Salto',
    note: 'Cuántos segundos avanzan o retroceden en la pista los dos botones a cada lado de reproducir.',
  },
  crossfade: { note: 'Cómo una pista da paso a la siguiente' },
  loudness: {
    title: 'Igualar el volumen',
    note:
      'Las pistas suaves suben y las fuertes bajan. Un álbum escuchado en orden conserva sus partes suaves y fuertes.',
  },
  lyricsLanguage: {
    title: 'Traducir las letras a',
    note:
      'Las letras se traducen en el teléfono. Cualquier idioma que no sea el inglés pasa por el inglés, y la primera vez se descarga un segundo modelo.',
  },
};
