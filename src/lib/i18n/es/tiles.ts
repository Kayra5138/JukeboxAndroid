import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const tiles: Strings['tiles'] = {
  speeds: { easy: 'Fácil', normal: 'Normal', hard: 'Difícil', harder: 'Muy difícil' },

  setup: {
    title: 'Toca al ritmo',
    noTrack: 'Pon una pista y las teclas se crean a partir de ella.',
    making: 'Escuchando la grabación…',
    missing: 'No se puede leer esta grabación.',
    record: (title, keys) =>
      `${title ?? 'Esta grabación'} — ${keys} ${oneOrMany(keys, 'tecla', 'teclas')}`,
    latency:
      'El sonido llega con retraso a los auriculares inalámbricos. Si las teclas van por detrás de la música, mueve esto hasta que coincidan.',
    earlier: '−20 ms',
    later: '+20 ms',
    offset: (ms) => `${ms} ms`,
    start: 'Tocar desde el principio',
    starting: 'Empezando…',
    screenReader:
      'Este juego se juega tocando al ritmo de la música, y TalkBack se queda con esos toques. Pausa TalkBack para jugar.',
  },

  hud: {
    score: (points) => `Puntuación: ${points}`,
  },

  pause: {
    title: 'En pausa',
    resume: 'Continuar',
    toMenu: 'Volver al menú',
  },

  ending: {
    clean: '¡Perfecto!',
    won: '¡Superado!',
    over: 'Se acabó',
    lapse: 'Se te ha escapado una tecla.',
    empty: 'Ese toque no ha caído en ninguna tecla.',
    toTheEnd: 'Hasta el final de la grabación.',
    figures: (hit, total, held, best, percent) =>
      `${hit} de ${total} ${oneOrMany(total, 'tecla', 'teclas')}${held > 0 ? ` · ${held} ${oneOrMany(held, 'mantenida', 'mantenidas')}` : ''} · mejor racha: ${best} · ${percent} %`,
    again: 'Otra vez',
  },
};
