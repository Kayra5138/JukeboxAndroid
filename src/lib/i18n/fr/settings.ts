import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `Dernière compilation : ${when}`,
  lastBuiltUnknown: 'Dernière compilation : disponible après l’installation du nouvel APK',

  sections: {
    look: 'Apparence et toucher',
    sound: 'Son',
    player: 'Lecteur',
    tapes: 'Cassettes',
    library: 'Bibliothèque',
    downloads: 'Téléchargements et Découvrir',
    data: 'Tes données',
    views: 'Vues de la bibliothèque',
    experimental: 'Expérimental',
  },
  categories: {
    look: 'Le thème, les albums en bac à disques, les animations, la vibration et les vues que propose la bibliothèque.',
    sound: 'L’égaliseur et les effets, le volume harmonisé, le fondu enchaîné, la vitesse et la tonalité.',
    player: 'La portée des boutons de saut, ce qui joue quand la file d’attente se termine et la langue dans laquelle les paroles sont traduites.',
    tapes: 'Retour en arrière intelligent, la portée des boutons de saut d’une cassette et le téléchargement des podcasts en Wi‑Fi seulement.',
    library: 'Le dossier de ta musique, les tags et les pochettes, et les fichiers qui sont peut-être le même morceau.',
    waiting: (count) => `${format.number(count)} à trancher`,
    downloads: 'La file de téléchargement et son bouton flottant, Découvrir, et la mise à jour du téléchargeur YouTube.',
    data: 'Tout sauvegarder ou importer une sauvegarde, la recherche de nouvelles versions et ListenBrainz (expérimental).',
  },

  language: {
    title: 'Langue',
    note: 'La langue de l’app. Elle ne suit pas celle du téléphone.',
  },
  theme: {
    title: 'Thème',
    open: 'Des couleurs, du verre, ou un thème à toi.',
    note: 'Système suit le réglage clair ou sombre du téléphone.',
    pair: {
      light: 'En mode clair',
      dark: 'En mode sombre',
      note: 'Les deux thèmes entre lesquels Système alterne, comme le fait le téléphone.',
    },
    shuffle: {
      title: 'Un thème différent à chaque fois',
      on: 'Activé',
      toggle: 'En choisir un au hasard à chaque ouverture de l’app',
      note: 'Coche les thèmes parmi lesquels choisir. Le thème tiré reste en place jusqu’à la prochaine ouverture de l’app, et tu peux toujours le changer à la main entre-temps.',
      empty: 'Coche au moins un thème pour que ce réglage serve à quelque chose.',
    },
  },
  customTheme: {
    open: 'Couleurs du thème personnalisé',
    openNote: 'Choisis un fond et une couleur d’accent pour le thème Personnalisé. Tout le reste en découle.',
    preview: 'Aperçu',
    background: 'Fond',
    accent: 'Accent',
    surface: 'Cartes',
    automatic: 'Automatique',
    automaticNote: 'Déduite du fond',
    presets: 'Couleurs suggérées',
    hue: 'Teinte',
    saturation: 'Saturation',
    lightness: 'Luminosité',
    degrees: (value) => `${value}°`,
    percent: (value) => `${value} %`,
    hex: 'Code couleur',
    nudged: (colour) => `Affichée en ${colour} pour que tout ce qui est dessus reste lisible.`,
    note:
      'Les couleurs du texte en sont déduites, pour qu’il reste toujours lisible. Pour la même raison, une couleur que tu choisis peut être légèrement éclaircie ou assombrie.',
    use: 'Utiliser ce thème',
    reset: 'Réinitialiser',
    sample: {
      title: 'Titre du morceau',
      line: 'Artiste · Album',
      chip: 'Aléatoire',
      button: 'Lire',
    },
  },

  tags: { note: 'Infos des titres et pochettes d’albums' },
  rack: {
    title: 'Albums en bac à disques',
    note:
      'Téléphone à l’horizontale, feuillette les pochettes au lieu de lire une liste. Touche celle de devant pour l’ouvrir.',
  },
  favoritesShown: { title: "Favoris", note: "Une liste toujours là, les plus récents en haut, que remplissent un cœur sur le lecteur et Ajouter aux Favoris dans le menu d’un morceau. Désactivés, les trois sont masqués et leur contenu attend." },
  listButton: {
    title: 'Bouton Ajouter à une liste',
    note:
      'Un bouton sur le lecteur qui ajoute le morceau en cours à une de tes listes, sans passer par son menu.',
  },
  autoplaySizes: { title: 'Titres proches à la fois', library: 'De ta bibliothèque', fresh: 'Nouveaux de Discover', note: 'Combien sont ajoutés à chaque remplissage de la file, pour « Continuer avec des morceaux similaires » et pour un titre écouté avec des titres proches. Chaque nouveau titre est un téléchargement. Le mélange prend les trois quarts de chacun.' },
  tap: {
    title: 'Quand on touche un titre',
    note: 'Ce qui joue après un titre touché dans Tracks ou dans les résultats de recherche.',
    sheetNote: 'Play et Shuffle au-dessus d’un album ou d’une liste, Shuffle all et Discover ne changent pas. Le menu de chaque titre propose « Écouter avec des titres proches » et « Écouter seulement celui-ci » pour une fois.',
    list: { label: 'La suite de la liste', note: 'Les titres suivants, dans l’ordre affiché.' },
    shuffled: { label: 'La suite de la liste, mélangée', note: 'Celui-ci d’abord, puis les autres de la liste au hasard.' },
    similar: { label: 'Titres proches', note: 'Celui-ci, puis une série de titres proches, de ta bibliothèque ou de Discover selon ton choix. Ensuite, la file continue selon « Continuer avec des morceaux similaires ».' },
    only: { label: 'Seulement ce titre', note: 'Rien après, sauf si « Continuer avec des morceaux similaires » en ajoute.' },
    source: { title: 'Titres proches depuis', note: 'D’où viennent les premiers titres après celui touché. Ensuite, « Continuer avec des morceaux similaires » prend le relais.' },
    everywhere: { title: 'Aussi dans les albums et listes', note: 'Aussi quand on touche un titre sur la page d’un album, d’une liste, d’un artiste ou d’un dossier. Désactivé, ils jouent dans leur ordre.' },
  },
  autoplay: {
    title: 'Continuer avec des morceaux similaires',
    note: 'Quand la file d’attente touche à sa fin, des morceaux proches de ceux que tu écoutais sont ajoutés à la suite.',
    sheetNote: 'Ajoutés quelques morceaux avant la fin, ils s’enchaînent comme le reste de la file, même écran verrouillé. Jamais quand la répétition est activée.',
    off: {
      label: 'Désactivé',
      note: 'Rien n’est ajouté. La musique s’arrête à la fin de la file d’attente.',
    },
    library: {
      label: 'Depuis ta bibliothèque',
      note: 'Choisis selon les tags, les artistes et ce que tu écoutes ensemble. Fonctionne hors connexion.',
    },
    fresh: {
      label: 'Nouveaux morceaux',
      note: 'Des morceaux que tu n’as pas encore, trouvés par Découvrir. Utilise le réseau et télécharge depuis YouTube comme Découvrir, en suivant son réglage Wi-Fi.',
    },
    mixed: {
      label: 'Mélange',
      note: 'Deux de ta bibliothèque, puis un nouveau. Les nouveaux utilisent le réseau et les téléchargements YouTube comme Découvrir, en suivant son réglage Wi-Fi.',
    },
  },
  downloads: {
    note: 'Ce qui se télécharge, ce qui attend et ce qui est terminé.',
    button: {
      title: 'Bouton flottant des téléchargements',
      note: 'Un bouton rond au-dessus de l’app pendant un téléchargement, et quelques minutes après. Touche-le pour voir où il en est.',
    },
    check: {
      title: 'Chercher une nouvelle version du téléchargeur YouTube',
      note: 'Au plus une fois par jour, et seulement quand tu ouvres Téléchargements ou que tu télécharges quelque chose, Jukebox demande à GitHub quelle est la dernière version de yt-dlp. Rien sur toi ni sur ta bibliothèque n’est envoyé, et rien n’est téléchargé sans ton accord.',
    },
  },
  discover: { note: 'La longueur de la liste, la fréquence à laquelle elle est renouvelée et ce qui a été écarté.' },
  still: {
    title: 'Figer la décoration',
    note:
      'Pour les téléphones qui saccadent. Le lecteur apparaît au lieu de glisser vers le haut, et le jeu ne s’illumine plus quand une vie est gagnée ou perdue. Les touches, elles, tombent toujours : c’est le jeu, pas de la décoration.',
  },
  scriptNames: { title: 'Noms dans d’autres écritures', latin: 'Lettres latines', original: 'Original', note: 'Quand une recherche a trouvé le nom d’un titre en lettres latines et dans sa propre écriture (japonais, chinois, coréen), lequel la bibliothèque affiche. Les titres cherchés avant se complètent à la prochaine recherche.' },
  haptics: {
    title: "Vibration",
    open: "Combien l’app vibre sous ton doigt, et avec quelle force.",
    mode: "Vibrer",
    modes: { off: "Non", essential: "L’essentiel", all: "Tout", custom: "Sur mesure" },
    modeNotes: {
      off: "L’app ne vibre jamais.",
      essential: "Seulement là où ça dit le plus : un appui long, si quelque chose a marché ou non, et le jeu.",
      all: "Appuis longs et glissements, interrupteurs et choix, les crans d’un curseur, les résultats, les boutons du lecteur et le jeu.",
      custom: "Choisis ci-dessous quels moments vibrent.",
    },
    strength: "Intensité",
    strengthNote: "Ressentie au relâchement. Les téléphones dont le moteur ne se règle pas gardent leur propre intensité.",
    groupsHeading: "Ce qui vibre",
    groups: {
      holds: { title: "Appuyer et glisser", note: "Un appui long, une ligne soulevée pour la déplacer, le doigt sur les cases." },
      choices: { title: "Interrupteurs et choix", note: "Interrupteurs, les onglets d’un choix, une option choisie." },
      notches: { title: "Crans et pas", note: "Vitesse normale, 0 dB, le milieu d’un curseur, les colonnes d’un graphique." },
      results: { title: "Résultats", note: "Ce que tu as demandé a marché ou non : trouvé, écrit, ajouté, importé." },
      player: { title: "Boutons du lecteur", note: "Lecture, saut, répétition, le cœur, toucher une ligne des paroles." },
      fun: { title: "Jeu et amusement", note: "Les touches de Piano Tiles, et plus." },
    },
    phone: "Si le retour tactile est désactivé dans les réglages du téléphone, l’app ne vibre pas non plus.",
  },
  moreButton: {
    title: 'Trois points sur chaque ligne',
    note:
      'Au bout de chaque ligne de morceau ou d’album, ils ouvrent le même menu qu’un appui long. L’appui long fonctionne aussi sans eux.',
  },
  tabs: {
    title: 'Onglets',
    searchNote: 'Découvrir et les téléchargements YouTube sont dans cet onglet et disparaissent avec lui.',
    aside: 'Bibliothèque et Paramètres sont toujours là.',
  },

  views: {
    notes: {
      tracks: 'Tous les morceaux, un par ligne.',
      albums: 'Les disques, reconstitués d’après les tags.',
      artists: 'Toutes les personnes créditées sur un morceau. Un morceau de deux artistes figure chez les deux.',
      folders: 'Les dossiers où sont rangés les fichiers, sous le dossier de la bibliothèque.',
      tapes: 'Livres audio, podcasts et longs enregistrements du dossier Tapes de la bibliothèque, qui reprennent là où tu t’es arrêté.',
    },
    onlyHint: 'Seule vue encore active, elle reste donc activée',
    toggleHint: 'Affiche ou masque cette vue dans la bibliothèque',
    asideOne: 'Avec une seule vue active, la bibliothèque l’affiche sans sélecteur. Une vue reste toujours active.',
    asideMany: 'Le sélecteur de la bibliothèque propose les vues actives. Une vue reste toujours active.',
  },

  sameSong: {
    note: (count) =>
      count === 1
        ? 'Un fichier qui ressemble à un morceau que tu avais déjà sous un autre fichier. Son historique reste à part jusqu’à ta décision.'
        : `${format.number(count)} fichiers qui ressemblent à des morceaux que tu avais déjà sous d’autres fichiers. Leur historique reste à part jusqu’à ta décision.`,
  },
  exportAll: {
    title: 'Tout exporter',
    note:
      'Ton historique d’écoute, tes listes, tes tags, tes paroles et tes réglages, les podcasts que tu suis, et où tu en es dans chaque cassette avec ce que tu y as marqué, dans un seul fichier dont tu choisis l’emplacement. Pas la musique elle-même.',
    failed: 'Impossible d’enregistrer la sauvegarde.',
  },
  importBackup: {
    title: 'Importer',
    note: 'Importe une sauvegarde. Tu vois ce qu’elle contient, et ta confirmation est demandée avant tout changement.',
    failed: 'L’importation a échoué.',
    refused: (reason) => `${reason} Rien n’a été modifié sur ce téléphone.`,
  },

  playback: {
    title: 'Lecture',
    note: (speed) => `Vitesse et tonalité · ${speed}×`,
  },
  equalizer: { note: 'Bandes, basses, surround et loudness' },
  effects: { note: 'Largeur, crossfeed, rotation et niveau' },
  /** The tape settings, apart from the music's: see `app/settings-tapes.tsx`. */
  tapes: {
    smartRewind: {
      title: 'Retour en arrière intelligent',
      note: 'Une cassette relancée après un moment reprend un peu avant l’endroit où elle s’était arrêtée, d’autant plus loin que la pause a été longue : trois secondes après une courte pause, une demi-minute après un jour. Désactivé, elle reprend exactement là où elle s’est arrêtée.',
    },
    skipSilence: { title: 'Sauter les silences', note: 'Les pauses dans ce qui est dit sont sautées, la cassette dure un peu moins. La musique n’est jamais touchée.' },
    voiceClarity: { title: 'Voix plus claire', note: 'Le grondement sous la voix est atténué et la partie qui distingue les mots est un peu relevée, par-dessus votre égaliseur. Seulement pendant une cassette.' },
    skipSponsors: { title: 'Sauter les sponsors', note: 'Dans les cassettes venues de YouTube, les passages signalés par les auditeurs de SponsorBlock (messages de sponsors, autopromotion, appels à s’abonner) sont sautés.' },
    back: 'Reculer de',
    forward: 'Avancer de',
    jumpNote: 'La portée des deux boutons de part et d’autre de lecture pour une cassette, en secondes. La musique garde la sienne, dans Lecteur.',
    podcasts: 'Podcasts',
    deletePlayed: {
      title: 'Supprimer les épisodes écoutés',
      off: 'Les épisodes des podcasts suivis restent sur le téléphone après l’écoute.',
      after: (days) => one(days, 'Un épisode d’un podcast suivi est supprimé un jour après avoir été écouté en entier, si l’app l’a téléchargé. Un épisode marqué reste.', `Un épisode d’un podcast suivi est supprimé ${format.number(days)} jours après avoir été écouté en entier, si l’app l’a téléchargé. Un épisode marqué reste.`),
    },
    /** The podcasts followed, as an OPML file: see `podcasts/opml.ts`. */
    opml: {
      heading: 'Emporter vos podcasts',
      export: 'Enregistrer les podcasts suivis',
      exportNote: 'Dans un fichier OPML, que les autres apps de podcasts savent lire.',
      import: 'Suivre des podcasts depuis un fichier',
      importNote: 'Un fichier OPML d’une autre app de podcasts. Les émissions sont suivies sans rien télécharger d’elles-mêmes. Activez-le pour chacune sur sa propre page.',
      importing: (done, total) => `Lecture de ${format.number(done)} sur ${format.number(total)}…`,
      imported: (followed, already, failed) => [one(followed, '1 podcast suivi.', `${format.number(followed)} podcasts suivis.`), already > 0 ? `${format.number(already)} déjà suivis.` : '', failed > 0 ? `${format.number(failed)} illisibles.` : ''].filter(Boolean).join(' '),
      nothing: 'Ce fichier ne contient aucun podcast.',
      failed: 'Impossible de lire ou d’écrire ce fichier.',
      none: 'Vous ne suivez encore aucun podcast.',
      saved: (count) => one(count, '1 podcast enregistré.', `${format.number(count)} podcasts enregistrés.`),
    },
  },
  jump: {
    title: 'Durée des sauts',
    note: 'De combien les deux boutons de part et d’autre de Lecture avancent ou reculent dans un titre, en secondes.',
  },
  crossfade: { note: 'Comment un titre laisse place au suivant' },
  loudness: {
    title: 'Harmoniser le volume',
    note:
      'Les titres trop faibles montent, les trop forts baissent. Un album écouté dans l’ordre garde ses propres nuances.',
  },
  lyricsLanguage: {
    title: 'Traduire les paroles en',
    note:
      'Les paroles sont traduites sur le téléphone. Toute autre langue que l’anglais passe par l’anglais, et un second modèle est téléchargé la première fois.',
  },
};
