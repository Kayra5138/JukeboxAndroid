import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `Dernière compilation : ${when}`,
  lastBuiltUnknown: 'Dernière compilation : disponible après l’installation du nouvel APK',

  sections: {
    look: 'Apparence',
    sound: 'Son',
    player: 'Lecteur',
    library: 'Bibliothèque',
    downloads: 'Téléchargements et Découvrir',
    data: 'Tes données',
    views: 'Vues de la bibliothèque',
    experimental: 'Expérimental',
  },
  categories: {
    look: 'Le thème, les albums en bac à disques, les animations et les vues que propose la bibliothèque.',
    sound: 'L’égaliseur et les effets, le volume harmonisé, le fondu enchaîné, la vitesse et la tonalité.',
    player: 'La portée des boutons de saut, ce qui joue quand la file d’attente se termine et la langue dans laquelle les paroles sont traduites.',
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
  heart: { title: 'Cœur', note: 'Un cœur sur le lecteur. Il n’enregistre rien.' },
  listButton: {
    title: 'Bouton Ajouter à une liste',
    note:
      'Un bouton sur le lecteur qui ajoute le morceau en cours à une de tes listes, sans passer par son menu.',
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
  moreButton: {
    title: 'Trois points sur chaque ligne',
    note:
      'Au bout de chaque ligne de morceau, ils ouvrent le même menu qu’un appui long. L’appui long fonctionne aussi sans eux.',
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
      'Ton historique d’écoute, tes listes, tes tags, tes paroles et tes réglages, dans un seul fichier dont tu choisis l’emplacement. Pas la musique elle-même.',
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
