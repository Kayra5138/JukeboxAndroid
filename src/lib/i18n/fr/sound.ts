import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

/*
  « Tonalité » is the player's pitch, in semitones, so the equalizer's section
  of the phone's own effects is « Timbre ». Crossfeed, surround and loudness
  keep the names French hi-fi gives them, which are the English ones.
*/
export const sound: Strings['sound'] = {
  percent: (value) => `${format.number(value)} %`,

  effects: {
    failures: {
      unsupported: 'Installe la version Android à jour pour utiliser les effets.',
      unreadable: 'Impossible de lire les effets. Ils restent désactivés jusqu’à une nouvelle tentative.',
      unsent: 'Ce réglage n’est pas parvenu au lecteur.',
    },
    title: 'Effets',
    presets: {
      off: { name: 'Désactivé', hint: 'L’enregistrement tel quel' },
      mono: { name: 'Mono', hint: 'Pareil dans les deux oreilles, pour un seul écouteur' },
      wide: { name: 'Large', hint: 'Les côtés repoussés vers l’extérieur' },
      headphones: { name: 'Casque', hint: 'Sort de ton crâne les mixages très latéralisés' },
      '8d': { name: '8D', hint: 'Le son tourne lentement autour de toi' },
      karaoke: { name: 'Façon karaoké', hint: 'Repousse le centre au loin' },
    },
    voices: {
      off: { name: 'Désactivé', hint: 'Le morceau tel quel' },
      robot: { name: 'Robot', hint: 'Modulé par un son grave : métallique, comme une cloche' },
      vintage: { name: 'Vintage', hint: 'Moins de bits, un échantillonnage plus grossier et les aigus coupés' },
      swirl: { name: 'Tourbillon', hint: 'Un balayage lent, comme un avion qui passe' },
      chipmunk: { name: 'Écureuil', hint: 'Une quinte plus haut, sans rien changer au tempo' },
      squeak: { name: 'Super écureuil', hint: 'Une octave entière, au point de ne plus être une voix' },
    },
    ownSettings: 'Tes propres réglages',
    howMuch: 'Intensité',
    voiceNote:
      'Chaque voix garde les harmoniques du morceau et les transforme, pour que la chanson reste reconnaissable en dessous. Baisse l’intensité pour entendre davantage l’enregistrement d’origine.',

    stereo: 'Stéréo',
    width: 'Largeur',
    mono: 'Mono',
    asRecorded: 'Tel quel',
    balance: 'Balance',
    centre: 'Centre',
    left: (percent) => `${percent} % à gauche`,
    right: (percent) => `${percent} % à droite`,
    swap: { title: 'Inverser les canaux', note: 'La gauche devient la droite. Pour un câble mal branché.' },

    headphones: 'Casque',
    crossfeed: 'Crossfeed',
    crossfeedNote:
      'Un peu de chaque canal parvient à l’oreille opposée, en retard et adouci, comme avec des enceintes. Ça rend plus reposants les vieux mixages très latéralisés. Sur des enceintes, ça n’apporte rien d’utile.',

    rotation: 'Rotation',
    depth: 'Profondeur',
    turnTakes: 'Durée d’un tour',
    seconds: (count) => `${count} s`,
    rotationNote:
      'Ce qu’on appelle le 8D : le son tourne lentement autour de toi. Prévu pour le casque ; sur une enceinte, c’est juste le volume qui se balade.',

    level: 'Niveau',
    preamp: 'Préampli',
    decibels: (value) => `${value > 0 ? '+' : ''}${format.decimal(value, 1)} dB`,
    levelNote:
      'Baisse ce réglage si l’élargissement ou l’égaliseur font grésiller quelque chose : ce sont les crêtes les plus fortes qui manquent de place.',
  },

  transitions: {
    missing: 'Cette version de l’app n’a pas encore les transitions.',
    title: 'Fondu enchaîné',
    about: 'Un titre continue de jouer pendant que le suivant démarre, sans raccord audible.',
    betweenTracks: 'Entre les titres',
    overlap: 'Chevauchement',
    overlapNote:
      'La part du titre sortant sur laquelle le suivant se superpose. Zéro laisse les titres se terminer normalement.',
    albums: {
      title: 'Albums sans fondu',
      note:
        'Pas de fondu entre les titres consécutifs d’un même album. Un live, ou tout disque mixé pour s’enchaîner, est fait pour avoir cette jonction.',
    },
    others: {
      manualMs: {
        label: 'Saut',
        hint:
          'Suivant ou précédent, sur appui. Garde-le court : un bouton qui répond en retard ne donne plus l’impression d’agir.',
      },
      pauseMs: {
        label: 'Pause et reprise',
        hint: 'Adoucit l’arrêt, et le redémarrage.',
      },
      seekMs: {
        label: 'Déplacement dans le titre',
        hint: 'Après avoir fait glisser la barre de progression, qui sinon tombe en pleine forme d’onde et produit un clic.',
      },
    },
    equalPower: {
      title: 'Courbe à puissance constante',
      note:
        'Deux titres à mi-volume ne sonnent pas deux fois moins fort ensemble. Cette courbe maintient le niveau pendant le chevauchement ; la courbe linéaire faiblit au milieu.',
    },
    fewer: 'Moins de réglages',
    more: 'Autres transitions',
    reset: 'Valeurs par défaut',
    seconds: (written) => `${written} s`,
  },

  equalizer: {
    missing: 'Cette version de l’app n’a pas encore l’égaliseur.',
    title: 'Égaliseur',
    attached: 'Agit sur ce qui joue en ce moment.',
    saved: 'Enregistré, et appliqué dès que quelque chose joue.',
    carried:
      'Les réglages de l’égaliseur du téléphone ont été repris et sont conservés dans Préréglages sous le nom « Égaliseur du téléphone ». C’est la même courbe, refaite avec les bandes de cet égaliseur ; elle se laisse désormais de la marge pour ce qu’elle amplifie, et peut donc sonner un peu moins fort qu’avant.',
    lost:
      'Les réglages de l’égaliseur du téléphone n’ont pas pu être repris : ses bandes n’ont pas pu être associées à des fréquences. Celui-ci démarre à plat.',

    presets: 'Préréglages',
    saveAs: 'Enregistrer sous…',
    rename: 'Renommer…',
    confirmDelete: (name) => `Supprimer « ${name} » ?`,
    importAutoEq: 'Importer AutoEQ…',
    keptAs: (name) => `Enregistré sous « ${name} ».`,
    renamedTo: (name) => `Renommé en « ${name} ».`,

    bands: 'Bandes',
    noBands:
      'Aucune bande, donc à plat : la musique telle qu’elle a été enregistrée. Ajoutes-en une, choisis un préréglage ou importe une correction pour ton casque.',
    addBand: 'Ajouter une bande',
    full: (most) => `${most} bandes, c’est le maximum.`,

    preamp: 'Préampli',
    automatic: 'Automatique',
    byHand: 'Manuel',
    nothingBoosted: 'Rien n’est amplifié, donc rien n’est baissé pour faire de la place.',
    turnedDown: (by) =>
      `Tout est baissé de ${by}, soit autant que le point le plus haut de la courbe amplifie. C’est la marge dont une amplification a besoin pour ne pas saturer.`,
    typeIt: (now) => `Saisir · ${now}`,
    typePreamp: (now) => `Saisir le préampli, actuellement ${now}`,
    clipsAbove: (level) =>
      `Au-delà de ${level}, les passages les plus forts peuvent saturer, ce qui s’entend comme une distorsion.`,
    lowEnough: 'Assez bas pour que rien de ce que cette courbe amplifie ne sature.',

    unbuilt:
      'Cette version de l’app passe encore par l’égaliseur du téléphone, que cet écran ne règle plus. Les bandes arrivent avec la prochaine version ; les réglages ci-dessous fonctionnent comme avant.',

    tone: 'Timbre',
    bassBoost: 'Renfort des basses',
    surround: 'Surround',
    loudness: 'Loudness',
    toneNote:
      'Ces trois effets sont ceux du téléphone, appliqués après les bandes. Le loudness relève un enregistrement trop faible sans toucher au timbre. Poussé trop loin, il sature, ce qui s’entend comme une distorsion des passages forts.',
    resetAll: 'Tout réinitialiser',

    prompt: {
      keepCurveAs: 'Enregistrer cette courbe sous',
      keepCorrectionAs: 'Enregistrer cette correction sous',
      namePlaceholder: 'Un nom, par ex. celui du casque concerné',
      keep: 'Enregistrer',
      aName: 'Un nom',
      set: 'Valider',
      preampHint: (least, most) => `En décibels, de ${least} à ${most}.`,
      frequency: (band) => `Fréquence de la bande ${band}`,
      frequencyHint: (least, most) => `En hertz, de ${least} à ${most}. 1,2k vaut 1200.`,
      gain: (band) => `Gain de la bande ${band}`,
      gainHint: (most) => `En décibels, de -${most} à ${most}.`,
      q: (band) => `Q de la bande ${band}`,
      qHint: (least, most) => `De ${least} à ${most}.`,
    },
  },

  presets: {
    builtIn: {
      Flat: 'Plat',
      'More bass': 'Plus de basses',
      'Less boom': 'Moins de boum',
      Warm: 'Chaud',
      'Voices forward': 'Voix en avant',
      'More air': 'Plus d’air',
      'Quiet listening': 'Écoute à bas volume',
    },
    myCurve: 'Ma courbe',
  },

  band: {
    types: { peak: 'Cloche', lowShelf: 'Plateau grave', highShelf: 'Plateau aigu' },
    said: (band, type, frequency, gain, q) => `Bande ${band} : ${type}, ${frequency}, ${gain}, Q ${q}`,
    closes: 'Ferme cette bande',
    opens: 'Ouvre cette bande pour la modifier',
    kind: (band, type) => `Type de la bande ${band} : ${type}`,
    frequency: 'Fréquence',
    gain: 'Gain',
    widthQ: 'Largeur (Q)',
    cornerQ: 'Pente (Q)',
    peakHint: 'Plus le Q est élevé, plus la bande est étroite : 1 couvre un peu plus d’une octave, 10 une seule note.',
    shelfHint:
      'Un plateau monte ou baisse tout ce qui se trouve d’un côté de sa fréquence. Le Q règle la netteté de la transition ; 0,7 est la valeur habituelle.',
    typeIt: 'Saisir',
    typeFrequency: (band, now) => `Saisir la fréquence de la bande ${band}, actuellement ${now}`,
    typeGain: (band, now) => `Saisir le gain de la bande ${band}, actuellement ${now}`,
    typeQ: (band, now) => `Saisir le Q de la bande ${band}, actuellement ${now}`,
    remove: (band) => `Retirer la bande ${band}`,
    removeThis: 'Retirer cette bande',
  },

  curve: {
    label: (said) => `Courbe de réponse. ${said}`,
    flat: 'À plat : rien n’est monté ni baissé.',
    highest: (level, near) => `Maximum ${level} vers ${near}.`,
    lowest: (level, near) => `Minimum ${level} vers ${near}.`,
    highestAndLowest: (high, highNear, low, lowNear) =>
      `Maximum ${high} vers ${highNear}, minimum ${low} vers ${lowNear}.`,
  },

  autoEq: {
    title: 'Importer depuis AutoEQ',
    about: 'Colle le contenu du fichier ParametricEQ.txt d’un casque, ou choisis le fichier.',
    textLabel: 'Le texte du fichier ParametricEQ',
    chooseFile: 'Choisir un fichier…',

    graphic:
      'C’est le fichier GraphicEQ, destiné à un autre type d’égaliseur. Celui qu’il faut est ParametricEQ.txt.',
    noneSupported: 'Aucun des filtres de ce texte n’est d’un type que cet égaliseur possède.',
    noneFound:
      'Aucun filtre trouvé dans ce texte. Une ligne doit ressembler à « Filter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70 ».',
    imported: (count) => `${count} ${one(count, 'bande importée', 'bandes importées')}.`,
    leftOut: (count, room) =>
      `${count} ${one(count, 'autre a été laissée', 'autres ont été laissées')} de côté : il n’y a de la place que pour ${room}.`,
    unsupported: (count) =>
      `${count} ${one(count, 'filtre était', 'filtres étaient')} d’un type que cet égaliseur ne possède pas et ${one(count, 'a été ignoré', 'ont été ignorés')}.`,
    adjusted: (count) =>
      `${count} ${one(count, 'bande dépassait', 'bandes dépassaient')} les limites possibles et ${one(count, 'a été ramenée', 'ont été ramenées')} dedans.`,
  },
};
