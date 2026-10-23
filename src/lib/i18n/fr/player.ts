import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

export const player: Strings['player'] = {
  bar: {
    opensPlayer: 'Ouvre le lecteur',
  },
  sheet: {
    nothingPlaying: 'Aucune lecture en cours.',
    heart: 'Cœur',
    repeat: { off: 'Répéter', all: 'Tout répéter', one: 'Répéter le titre' },
    back: (seconds) => `Reculer de ${seconds} ${one(seconds, 'seconde', 'secondes')}`,
    forward: (seconds) => `Avancer de ${seconds} ${one(seconds, 'seconde', 'secondes')}`,
    shuffleQueue: 'Mélanger la file d’attente',
    playbackSettings: 'Paramètres de lecture',
    lyrics: 'Paroles',
    translateLyrics: 'Traduire les paroles',
    upNext: (count) => `À suivre · ${format.number(count)}`,
    position: 'Position de lecture',
    positionValue: (position, duration) => `${position} sur ${duration}`,
  },
  queue: {
    remove: (title) => `Retirer ${title}`,
    movedTo: (position, count) => `Position ${format.number(position)} sur ${format.number(count)}`,
    auto: {
      library: 'Morceaux similaires · choisis pour toi',
      fresh: 'Nouveaux morceaux · de Découvrir',
      mixed: 'Similaires et nouveaux · choisis pour toi',
      remove: 'Retirer',
      removeLabel: 'Retirer les morceaux choisis pour toi',
      removeHint: 'Aucun autre n’est ajouté à cette file tant que tu ne lances pas autre chose.',
      notes: {
        offline: 'Pas de connexion, ils viennent donc de ta bibliothèque.',
        wifi: 'Découvrir attend le Wi-Fi, ils viennent donc de ta bibliothèque.',
        unavailable: 'Les nouveaux morceaux demandent le téléchargeur YouTube, ils viennent donc de ta bibliothèque.',
        waiting: 'Les nouveaux morceaux se téléchargent encore ; ta bibliothèque prend le relais en attendant.',
        random: 'On sait trop peu de ce morceau, alors certains viennent de ta bibliothèque au hasard.',
      },
    },
  },
  settings: {
    playback: 'Lecture',
    backToNormal: 'Revenir à la vitesse et à la tonalité normales',
    normal: 'Normal',
    speed: 'Vitesse',
    pitch: 'Tonalité',
    pitchHint:
      'En demi-tons, vers le haut ou vers le bas, l’enregistrement gardant la vitesse réglée au-dessus.',
    effects: 'Effets',
    equalizer: { note: 'Bandes, basses et loudness' },
    crossfade: { note: 'Comment un titre laisse place au suivant' },
    allEffects: { title: 'Tous les effets', note: 'Largeur, crossfeed, rotation et niveau' },
  },
  sleepTimer: {
    title: 'Minuteur de veille',
    cancel: 'Annuler le minuteur de veille',
    unsupported: 'Installe la version Android à jour pour utiliser le minuteur de veille.',
    about:
      'Met la musique en pause au bout d’un moment. Pendant la dernière demi-minute, le son baisse peu à peu.',
    pauseAfter: (minutes) => `Pause dans ${minutes} ${one(minutes, 'minute', 'minutes')}`,
    pauseAfterTyped: 'Pause dans un nombre de minutes à saisir',
    custom: 'Autre…',
    pauseAtEnd: 'Pause à la fin de ce titre',
    endOfTrack: 'Fin du titre',
    finish: {
      title: 'Laisser finir le titre en cours',
      note: 'Quand le temps est écoulé, attendre la fin du morceau au lieu de baisser le son.',
      label: 'Laisser finir le titre en cours quand le minuteur de veille arrive à zéro',
    },
    refused: (most) => `Un nombre entier de minutes, de 1 à ${most}`,
    howMany: 'Pause dans combien de minutes ?',
    minutes: 'Minutes',
    start: 'Démarrer',
  },
  sleep: {
    endOfTrack: 'Pause à la fin de ce titre',
    thenToTheEnd: (time) => `Encore ${time}, puis jusqu’à la fin du titre`,
    fadingOut: (time) => `Le son baisse, encore ${time}`,
    pausesIn: (time) => `Pause dans ${time}`,
  },
};
