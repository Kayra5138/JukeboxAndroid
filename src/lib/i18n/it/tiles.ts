import type { Strings } from '../en/index.ts';

export const tiles: Strings['tiles'] = {
  speeds: { easy: 'Facile', normal: 'Normale', hard: 'Difficile', harder: 'Più difficile' },

  setup: {
    title: 'Suona insieme',
    noTrack: 'Avvia un brano e i tasti verranno creati da quello.',
    making: 'Ascolto del brano…',
    missing: 'Questo brano non può essere letto.',
    record: (title, keys) => `${title ?? 'Questo brano'} — ${keys} ${keys === 1 ? 'tasto' : 'tasti'}`,
    latency:
      'Il suono arriva in ritardo alle cuffie wireless. Se i tasti sembrano indietro rispetto alla musica, regola questo valore finché non coincidono.',
    earlier: '−20 ms',
    later: '+20 ms',
    offset: (ms) => `${ms} ms`,
    start: 'Suona dall’inizio',
    starting: 'Avvio…',
    screenReader:
      'Questo gioco si gioca toccando a tempo con la musica, e TalkBack intercetta quei tocchi. Metti in pausa TalkBack per giocare.',
  },

  hud: {
    score: (points) => `Punteggio ${points}`,
  },

  pause: {
    title: 'In pausa',
    resume: 'Continua',
    toMenu: 'Torna al menu',
  },

  ending: {
    clean: 'Partita perfetta',
    won: 'Ce l’hai fatta',
    over: 'Partita finita',
    lapse: 'Ti è sfuggito un tasto.',
    empty: 'Quel tocco è finito nel vuoto.',
    toTheEnd: 'Fino alla fine del brano.',
    figures: (hit, total, held, best, percent) =>
      `${hit} su ${total} ${total === 1 ? 'tasto' : 'tasti'}${held > 0 ? ` · ${held} ${held === 1 ? 'tenuto' : 'tenuti'}` : ''} · serie migliore: ${best} · ${percent}%`,
    again: 'Ancora',
  },
};
