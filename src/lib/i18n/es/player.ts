import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const player: Strings['player'] = {
  bar: {
    opensPlayer: 'Abre el reproductor',
  },
  sheet: {
    nothingPlaying: 'No suena nada.',
    heart: 'Corazón',
    repeat: { off: 'Repetir', all: 'Repetir todo', one: 'Repetir una' },
    back: (seconds) => oneOrMany(seconds, 'Retroceder 1 segundo', `Retroceder ${seconds} segundos`),
    forward: (seconds) => oneOrMany(seconds, 'Avanzar 1 segundo', `Avanzar ${seconds} segundos`),
    shuffleQueue: 'Mezclar la cola',
    playbackSettings: 'Ajustes de reproducción',
    lyrics: 'Letra',
    translateLyrics: 'Traducir la letra',
    upNext: (count) => `A continuación · ${format.number(count)}`,
    position: 'Posición de reproducción',
    positionValue: (position, duration) => `${position} de ${duration}`,
  },
  queue: {
    remove: (title) => `Quitar ${title}`,
    movedTo: (position, count) => `Ahora en el puesto ${format.number(position)} de ${format.number(count)}`,
    auto: {
      library: 'Canciones parecidas · elegidas para ti',
      fresh: 'Canciones nuevas · de Descubrir',
      mixed: 'Parecidas y nuevas · elegidas para ti',
      remove: 'Quitar',
      removeLabel: 'Quitar las canciones elegidas para ti',
      removeHint: 'No se añaden más a esta cola hasta que pongas otra cosa.',
      notes: {
        offline: 'Sin conexión, así que son de tu biblioteca.',
        wifi: 'Descubrir está esperando al Wi-Fi, así que son de tu biblioteca.',
        unavailable: 'Las canciones nuevas necesitan el descargador de YouTube, así que son de tu biblioteca.',
        waiting: 'Las canciones nuevas aún se están descargando; mientras tanto suena tu biblioteca.',
      },
    },
  },
  settings: {
    playback: 'Reproducción',
    backToNormal: 'Volver a la velocidad y el tono normales',
    normal: 'Normal',
    speed: 'Velocidad',
    pitch: 'Tono',
    pitchHint: 'En semitonos, hacia arriba o hacia abajo, y la grabación sigue sonando a la velocidad de arriba.',
    effects: 'Efectos',
    equalizer: { note: 'Bandas, graves y realce de volumen' },
    crossfade: { note: 'Cómo una pista da paso a la siguiente' },
    allEffects: { title: 'Todos los efectos', note: 'Amplitud, crossfeed, rotación y nivel' },
  },
  sleepTimer: {
    title: 'Temporizador de apagado',
    cancel: 'Cancelar el temporizador',
    unsupported: 'Instala la versión actualizada de la app para usar el temporizador de apagado.',
    about: 'Pausa la música pasado un rato. El último medio minuto suena cada vez más bajo.',
    pauseAfter: (minutes) => oneOrMany(minutes, 'Pausar dentro de 1 minuto', `Pausar dentro de ${minutes} minutos`),
    pauseAfterTyped: 'Pausar dentro de los minutos que escribas',
    custom: 'Otro…',
    pauseAtEnd: 'Pausar al final de esta pista',
    endOfTrack: 'Fin de la pista',
    finish: {
      title: 'Dejar que termine la pista',
      note: 'Cuando se acabe el tiempo, esperar a que acabe la canción en lugar de bajar el volumen hasta cortarla.',
      label: 'Dejar que termine la pista actual cuando se acabe el temporizador',
    },
    refused: (most) => `Un número entero de minutos, de 1 a ${most}`,
    howMany: '¿Pausar dentro de cuántos minutos?',
    minutes: 'Minutos',
    start: 'Iniciar',
  },
  sleep: {
    endOfTrack: 'Se pausa cuando termine esta pista',
    thenToTheEnd: (time) => `Quedan ${time}; después, hasta el final de la pista`,
    fadingOut: (time) => `Bajando el volumen, quedan ${time}`,
    pausesIn: (time) => `Se pausa dentro de ${time}`,
  },
};
