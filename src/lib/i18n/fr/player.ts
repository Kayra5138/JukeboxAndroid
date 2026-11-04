import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

export const player: Strings['player'] = {
  bar: {
    opensPlayer: 'Ouvre le lecteur',
  },
  sheet: {
    nothingPlaying: 'Aucune lecture en cours.',
    heart: "Favori",
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
  tape: {
    part: (at, of) => `Partie ${format.number(at)} sur ${format.number(of)}`,
    /** For an episode of a followed show, in place of `part`. */
    episode: (at, of) => `Épisode ${format.number(at)} sur ${format.number(of)}`,
    previousPart: 'Partie précédente',
    nextPart: 'Partie suivante',
    parts: (count) => `Parties · ${format.number(count)}`,
    book: (percent, left) => `${format.number(percent)}\u202f% du tout · encore ${left}`,
    speed: (speed) => `Vitesse ${speed}, touche pour la suivante`,
    sleep: 'Minuteur de sommeil',
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
    jumps: {
      heading: 'Sauts pour ce livre ou cette émission',
      general: 'Général',
      backToGeneral: 'Revenir aux sauts de toutes les cassettes',
      back: 'Reculer de',
      forward: 'Avancer de',
      note: 'En secondes, pour ce livre ou cette émission seulement, y compris depuis un casque, la notification et la voiture. Les autres cassettes gardent les sauts des réglages des cassettes.',
    },
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
    shake: {
      title: 'Secouer pour dix minutes de plus',
      note: 'Pendant les trois dernières minutes, secoue le téléphone pour ajouter dix minutes, même écran éteint. Une courte vibration le confirme.',
      label: 'Secouer le téléphone pendant les trois dernières minutes pour ajouter dix minutes au minuteur de veille',
    },
    refused: (most) => `Un nombre entier de minutes, de 1 à ${most}`,
    howMany: 'Pause dans combien de minutes ?',
    minutes: 'Minutes',
    start: 'Démarrer',
    tape: {
      about: 'Met en pause au bout d’un moment. La dernière demi-minute baisse peu à peu.',
      pauseAtEnd: 'Pause à la fin de cette partie',
      endOfTrack: 'Fin de la partie',
      finish: {
        title: 'Laisser finir la partie en cours',
        note: 'Quand le temps est écoulé, attendre la fin de la partie au lieu de baisser le son.',
        label: 'Laisser finir la partie en cours quand le minuteur de veille arrive à zéro',
      },
    },
  },
  /** Places marked in a tape, each with a note: see `tapes/marks.ts`, `MarksSheet` and the Marks screen. */
  /** A tape's chapters: see `tapes/extras.ts` and `ChaptersSheet`. */
  /** A tape's captions, shown as a song's words are. */
  transcript: {
    heading: 'Transcription',
    show: 'Afficher ce qui est dit',
    none: 'Cette vidéo n’a pas de sous-titres à suivre.',
  },
  chapters: {
    heading: (count) => `Chapitres · ${format.number(count)}`,
    untitled: (at) => `Chapitre ${format.number(at)}`,
    at: (at, of) => `Chapitre ${format.number(at)} sur ${format.number(of)}`,
    sleepAtEnd: 'Arrêter à la fin de ce chapitre',
    listHint: 'Liste les chapitres',
  },
  marks: {
    screen: 'Repères',
    heading: 'Repères de cette cassette',
    add: 'Marquer cet endroit',
    /** The player's button that opens the tape's marks: how many there are. */
    list: (count) => `Repères, ${format.number(count)} pour l’instant`,
    noteAt: (time) => `Repère à ${time}`,
    noteHint: 'Une note sur ce qui se trouve ici, si vous voulez. Vous pouvez la laisser vide.',
    notePlaceholder: 'Ce qu’il y a ici',
    save: 'Marquer',
    none: 'Rien n’est encore marqué dans cette cassette. Marquez un endroit avec le bouton à côté de la minuterie.',
    noneAnywhere: 'Aucun repère pour l’instant. Pendant la lecture d’une cassette, marquez un endroit depuis le lecteur et notez ce qui s’y trouve. Tous les repères apparaissent ici.',
    noNote: 'Pas de note',
    remove: (time) => `Retirer le repère à ${time}`,
    editNote: 'Modifier la note',
    goHint: 'Va à cet endroit',
    playHint: 'Lit la cassette à partir de cet endroit',
    howTo: 'Touchez un repère pour y aller, maintenez-le pour modifier sa note.',
    all: 'Tous les repères',
    count: (count) => `${format.number(count)} ${one(count, 'repère', 'repères')}`,
  },
  sleep: {
    endOfTrack: 'Pause à la fin de ce titre',
    thenToTheEnd: (time) => `Encore ${time}, puis jusqu’à la fin du titre`,
    fadingOut: (time) => `Le son baisse, encore ${time}`,
    pausesIn: (time) => `Pause dans ${time}`,
    endOfChapter: 'Pause à la fin de ce chapitre',
    chapterIn: (time) => `${time} avant la fin du chapitre`,
    tape: {
      endOfTrack: 'Pause à la fin de cette partie',
      thenToTheEnd: (time) => `Encore ${time}, puis jusqu’à la fin de la partie`,
    },
  },
};
