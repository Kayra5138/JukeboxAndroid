import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

export const tiles: Strings['tiles'] = {
  speeds: { easy: 'Facile', normal: 'Normal', hard: 'Difficile', harder: 'Expert' },

  setup: {
    title: 'À toi de jouer',
    noTrack: 'Lance un titre, et les touches en seront tirées.',
    making: 'Écoute du morceau…',
    missing: 'Impossible de lire celui-ci.',
    record: (title, keys) => `${title ?? 'Ce morceau'} — ${keys} ${one(keys, 'touche', 'touches')}`,
    latency:
      'Le son arrive en retard dans un casque sans fil. Si les touches semblent en retard sur la musique, ajuste ce réglage jusqu’à ce qu’elles soient en phase.',
    earlier: '−20 ms',
    later: '+20 ms',
    offset: (ms) => `${ms} ms`,
    start: 'Jouer depuis le début',
    starting: 'Démarrage…',
    screenReader:
      'Ce jeu se joue en touchant l’écran en rythme avec la musique, et TalkBack intercepte ces appuis. Mets TalkBack en pause pour jouer.',
  },

  hud: {
    score: (points) => `Score : ${points}`,
  },

  pause: {
    title: 'En pause',
    resume: 'Continuer',
    toMenu: 'Retour au menu',
  },

  ending: {
    clean: 'Sans faute',
    won: 'Réussi !',
    over: 'Partie terminée',
    lapse: 'Une touche t’a échappé.',
    empty: 'Ton appui est tombé dans le vide.',
    toTheEnd: 'Jusqu’au bout du morceau.',
    figures: (hit, total, held, best, percent) =>
      `${hit} ${one(hit, 'touche', 'touches')} sur ${total}${held > 0 ? ` · ${held} ${one(held, 'appui long', 'appuis longs')}` : ''} · meilleure série : ${best} · ${percent} %`,
    again: 'Rejouer',
  },
};
