import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const sound: Strings['sound'] = {
  percent: (value) => `${format.number(value)} %`,

  effects: {
    failures: {
      unsupported: 'Instala la versión actualizada de la app para usar los efectos.',
      unreadable: 'No se han podido leer los efectos. Quedan desactivados hasta que se vuelva a intentar.',
      unsent: 'Ese ajuste no ha llegado al reproductor.',
    },
    title: 'Efectos',
    presets: {
      off: { name: 'Desactivado', hint: 'La grabación tal cual' },
      mono: { name: 'Mono', hint: 'Lo mismo en los dos oídos, para un solo auricular' },
      wide: { name: 'Amplio', hint: 'Los lados, más abiertos' },
      headphones: { name: 'Auriculares', hint: 'Saca de tu cabeza las mezclas con paneo extremo' },
      '8d': { name: '8D', hint: 'El sonido gira despacio a tu alrededor' },
      karaoke: { name: 'Casi karaoke', hint: 'Aleja el centro' },
    },
    voices: {
      off: { name: 'Desactivado', hint: 'La grabación tal cual' },
      robot: { name: 'Robot', hint: 'Modulada con un tono grave: metálica, como una campana' },
      vintage: { name: 'Vintage', hint: 'Menos bits, un reloj más tosco y sin agudos' },
      swirl: { name: 'Remolino', hint: 'Un barrido lento, como un avión que pasa por encima' },
      chipmunk: { name: 'Ardilla', hint: 'Una quinta más aguda, sin cambiar el tempo' },
      squeak: { name: 'Más ardilla', hint: 'Una octava entera, ya más allá de una voz' },
    },
    ownSettings: 'Tus propios ajustes',
    howMuch: 'Intensidad',
    voiceNote:
      'Cada voz conserva los armónicos propios de la grabación y los altera, así que debajo la canción sigue siendo la misma. Baja la intensidad para oír más de la grabación original.',

    stereo: 'Estéreo',
    width: 'Amplitud',
    mono: 'Mono',
    asRecorded: 'Como se grabó',
    balance: 'Balance',
    centre: 'Centro',
    left: (percent) => `${percent} % izquierda`,
    right: (percent) => `${percent} % derecha`,
    swap: { title: 'Intercambiar canales', note: 'La izquierda pasa a ser la derecha. Para un cable mal conectado.' },

    headphones: 'Auriculares',
    crossfeed: 'Crossfeed',
    crossfeedNote:
      'Un poco de cada canal llega al oído contrario, con retraso y apagado, como ocurriría con altavoces. Hace más llevaderas las mezclas antiguas con paneo extremo. Con altavoces no aporta nada que merezca la pena.',

    rotation: 'Rotación',
    depth: 'Profundidad',
    turnTakes: 'Una vuelta dura',
    seconds: (count) => `${count}s`,
    rotationNote:
      'Lo que se suele llamar 8D: el sonido gira despacio a tu alrededor. Pensado para auriculares; con un altavoz solo parece que el volumen va y viene.',

    level: 'Nivel',
    preamp: 'Preamplificador',
    decibels: (value) => `${value > 0 ? '+' : ''}${format.decimal(value, 1)} dB`,
    levelNote:
      'Bájalo si la amplitud o el ecualizador hacen que algo cruja: es el sonido de los picos más fuertes quedándose sin margen.',
  },

  transitions: {
    missing: 'Esta versión de la app aún no incluye las transiciones.',
    title: 'Fundido',
    about: 'Una pista sigue sonando mientras empieza la siguiente, así que no se oye el corte.',
    betweenTracks: 'Entre pistas',
    overlap: 'Solapamiento',
    overlapNote:
      'Cuánto de la pista que termina se solapa con la siguiente. Con cero, las pistas acaban de la forma normal.',
    albums: {
      title: 'Mantener los álbumes unidos',
      note:
        'Sin fundido entre pistas seguidas de un mismo álbum. Un disco en directo o uno mezclado para sonar sin pausas ya tiene esa unión pensada.',
    },
    others: {
      manualMs: {
        label: 'Al saltar',
        hint:
          'Al pulsar siguiente o anterior. Mejor que sea corto: un botón que responde tarde parece desconectado de lo que haces.',
      },
      pauseMs: {
        label: 'Pausar y reanudar',
        hint: 'Suaviza el corte al parar, y al volver a empezar.',
      },
      seekMs: {
        label: 'Al mover la barra',
        hint: 'Después de arrastrar la barra de progreso, que si no cae en mitad de la onda y hace clic.',
      },
    },
    equalPower: {
      title: 'Curva de potencia constante',
      note:
        'Dos pistas a medio volumen no suenan juntas tan fuerte como una sola a volumen completo. Esta curva mantiene el nivel durante el solapamiento; la recta se hunde en el medio.',
    },
    fewer: 'Menos ajustes',
    more: 'Otras transiciones',
    reset: 'Restablecer valores',
    seconds: (written) => `${written}s`,
  },

  equalizer: {
    missing: 'Esta versión de la app aún no incluye el ecualizador.',
    title: 'Ecualizador',
    attached: 'Ajustando lo que suena ahora.',
    saved: 'Guardado; se aplica en cuanto suene algo.',
    carried:
      'Lo que estaba ajustado en el ecualizador propio del teléfono se ha traído aquí y se guarda en Preajustes como «Ecualizador del teléfono». Es la misma curva hecha con las bandas de este ecualizador, y ahora deja margen para lo que realza, así que puede sonar un poco más bajo que antes.',
    lost:
      'No se ha podido traer lo que estaba ajustado en el ecualizador propio del teléfono: sus bandas no se han podido asociar a frecuencias. Este empieza plano.',

    presets: 'Preajustes',
    saveAs: 'Guardar como…',
    rename: 'Renombrar…',
    confirmDelete: (name) => `¿Eliminar «${name}»?`,
    importAutoEq: 'Importar de AutoEQ…',
    keptAs: (name) => `Guardado como «${name}».`,
    renamedTo: (name) => `Renombrado como «${name}».`,

    bands: 'Bandas',
    noBands:
      'Sin bandas, es decir, plano: la música tal como se grabó. Añade una, elige un preajuste o importa una corrección para tus auriculares.',
    addBand: 'Añadir una banda',
    full: (most) => `No caben más de ${most} bandas.`,

    preamp: 'Preamplificador',
    automatic: 'Automático',
    byHand: 'Manual',
    nothingBoosted: 'No se realza nada, así que no se baja nada para dejar margen.',
    turnedDown: (by) =>
      `Todo se baja ${by}, tanto como sube algo el punto más alto de la curva. Ese es el margen que necesita un realce para no saturar.`,
    typeIt: (now) => `Escribirlo · ${now}`,
    typePreamp: (now) => `Escribir el preamplificador, ahora ${now}`,
    clipsAbove: (level) =>
      `Por encima de ${level} los pasajes más fuertes pueden saturar, y se oye como si se rompieran.`,
    lowEnough: 'Lo bastante bajo para que nada de lo que realza esta curva sature.',

    unbuilt:
      'Esta versión de la app aún suena a través del ecualizador propio del teléfono, que esta pantalla ya no ajusta. Las bandas llegan con la próxima versión; los controles de abajo funcionan como antes.',

    tone: 'Tono',
    bassBoost: 'Refuerzo de graves',
    surround: 'Envolvente',
    loudness: 'Realce de volumen',
    toneNote:
      'Estos tres son efectos propios del teléfono y se aplican después de las bandas. El realce de volumen sube una grabación baja sin tocar el tono. Si se fuerza mucho, satura, y se oye como si las partes fuertes se rompieran.',
    resetAll: 'Restablecer todo',

    prompt: {
      keepCurveAs: 'Guardar esta curva como',
      keepCorrectionAs: 'Guardar esta corrección como',
      namePlaceholder: 'Un nombre, como los auriculares a los que corresponde',
      keep: 'Guardar',
      aName: 'Un nombre',
      set: 'Aplicar',
      preampHint: (least, most) => `En decibelios, de ${least} a ${most}.`,
      frequency: (band) => `Frecuencia de la banda ${band}`,
      frequencyHint: (least, most) =>
        `En hercios, de ${least} a ${most}. 1,2k se lee como 1200.`,
      gain: (band) => `Ganancia de la banda ${band}`,
      gainHint: (most) => `En decibelios, de -${most} a ${most}.`,
      q: (band) => `Q de la banda ${band}`,
      qHint: (least, most) => `De ${least} a ${most}.`,
    },
  },

  presets: {
    builtIn: {
      Flat: 'Plano',
      'More bass': 'Más graves',
      'Less boom': 'Menos retumbo',
      Warm: 'Cálido',
      'Voices forward': 'Voces al frente',
      'More air': 'Más aire',
      'Quiet listening': 'Volumen bajo',
    },
    myCurve: 'Mi curva',
  },

  band: {
    types: { peak: 'Pico', lowShelf: 'Estante de graves', highShelf: 'Estante de agudos' },
    said: (band, type, frequency, gain, q) =>
      `Banda ${band}: ${type}, ${frequency}, ${gain}, Q ${q}`,
    closes: 'Cierra esta banda',
    opens: 'Abre esta banda para cambiarla',
    kind: (band, type) => `Tipo de la banda ${band}: ${type}`,
    frequency: 'Frecuencia',
    gain: 'Ganancia',
    widthQ: 'Anchura (Q)',
    cornerQ: 'Pendiente (Q)',
    peakHint: 'Una Q más alta es una banda más estrecha: 1 es algo más de una octava, 10 una sola nota.',
    shelfHint:
      'Un estante sube o baja todo lo que queda a un lado de su frecuencia. La Q indica lo brusco que es el codo; 0,7 es lo habitual.',
    typeIt: 'Escribirlo',
    typeFrequency: (band, now) => `Escribir la frecuencia de la banda ${band}, ahora ${now}`,
    typeGain: (band, now) => `Escribir la ganancia de la banda ${band}, ahora ${now}`,
    typeQ: (band, now) => `Escribir la Q de la banda ${band}, ahora ${now}`,
    remove: (band) => `Quitar la banda ${band}`,
    removeThis: 'Quitar esta banda',
  },

  curve: {
    label: (said) => `Curva de respuesta. ${said}`,
    flat: 'Plana: no se sube ni se baja nada.',
    highest: (level, near) => `Máximo de ${level} cerca de ${near}.`,
    lowest: (level, near) => `Mínimo de ${level} cerca de ${near}.`,
    highestAndLowest: (high, highNear, low, lowNear) =>
      `Máximo de ${high} cerca de ${highNear}, mínimo de ${low} cerca de ${lowNear}.`,
  },

  autoEq: {
    title: 'Importar de AutoEQ',
    about: 'Pega el contenido del ParametricEQ.txt de unos auriculares, o elige el archivo.',
    textLabel: 'El texto del archivo ParametricEQ',
    chooseFile: 'Elegir un archivo…',

    graphic:
      'Ese es el archivo GraphicEQ, que es para otro tipo de ecualizador. El que hay que usar es ParametricEQ.txt.',
    noneSupported: 'Ninguno de los filtros de ese texto es de un tipo que tenga este ecualizador.',
    noneFound:
      'No se han encontrado filtros en ese texto. Una línea debería ser así: «Filter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70».',
    imported: (count) => oneOrMany(count, '1 banda importada.', `${count} bandas importadas.`),
    leftOut: (count, room) =>
      oneOrMany(
        count,
        `Se ha dejado fuera 1 más: solo caben ${room}.`,
        `Se han dejado fuera ${count} más: solo caben ${room}.`
      ),
    unsupported: (count) =>
      oneOrMany(
        count,
        '1 filtro era de un tipo que este ecualizador no tiene y se ha omitido.',
        `${count} filtros eran de un tipo que este ecualizador no tiene y se han omitido.`
      ),
    adjusted: (count) =>
      oneOrMany(
        count,
        '1 estaba fuera de los valores que admite una banda y se ha ajustado dentro de ellos.',
        `${count} estaban fuera de los valores que admite una banda y se han ajustado dentro de ellos.`
      ),
  },
};
