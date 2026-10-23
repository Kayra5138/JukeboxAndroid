import { common } from './common.ts';
import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

const tracks = (count: number) => `${format.number(count)} ${one(count, 'titre', 'titres')}`;

export const library: Strings['library'] = {
  views: {
    tracks: 'Titres',
    albums: 'Albums',
    artists: 'Artistes',
    folders: 'Dossiers',
  },

  nothingMatches: (query) => `Aucun résultat pour « ${query} ».`,
  noAlbums:
    'Pas encore d’albums. Un disque n’apparaît qu’une fois les infos de ses titres recherchées : le dossier où se trouve un fichier n’est pas un album.',
  back: '‹ Retour',
  trackMenu: 'Options du titre',
  albumMenu: 'Options de l’album',

  screen: {
    viewSwitch: 'Vue de la bibliothèque',
    searchHints: {
      tracks: 'Titres, artistes et tags',
      albums: 'Titres, artistes et tags',
      artists: 'Rechercher des artistes',
      folders: 'Rechercher des dossiers',
    },
    sort: 'Tri',
    sortShort: { name: 'A–Z', added: 'Ajout', played: 'Écoute' },
    sortedBy: {
      name: 'Trié par nom',
      added: 'Trié par date d’ajout',
      played: 'Trié par date de dernière écoute',
    },
    sortHint: 'Change l’ordre de la bibliothèque',
    groupSortShort: { name: 'A–Z', tracks: 'Titres', played: 'Écoutes', added: 'Récents' },
    groupSortedBy: {
      name: 'Trié par nom',
      tracks: 'Trié par nombre de titres',
      played: 'Trié par nombre d’écoutes',
      added: 'Trié par ajout le plus récent',
    },

    selectTracks: 'Sélectionner des titres',
    stopSelecting: 'Arrêter la sélection',
    selected: (count) =>
      `${format.number(count)} ${one(count, 'titre sélectionné', 'titres sélectionnés')}`,
    addToList: 'Ajouter à une liste',
    addTag: 'Ajouter un tag',
    writeToFiles: 'Écrire dans les fichiers',
    writeToFilesSpoken: 'Écrire les infos des titres sélectionnés dans leurs fichiers',

    swipePlayNext: 'Lire ensuite',
    swipeQueue: 'À la file',
    queuedAll: (count) =>
      `${format.number(count)} ${one(count, 'titre ajouté', 'titres ajoutés')} à la file d’attente`,

    needsAccess: 'Jukebox a besoin d’accéder aux fichiers audio de cet appareil.',
    nothingIn: (folder) => `Rien dans ${folder}.`,
    shuffleAll: 'Tout mélanger',
    playsEverythingBelow: 'Jukebox lit tout ce qui se trouve dans ce dossier, sous-dossiers compris.',
    chooseFolderInSettings: 'Choisis le dossier de ta bibliothèque dans Paramètres.',

    folders: (count) => `${format.number(count)} ${one(count, 'dossier', 'dossiers')}`,
    noFolders: 'Aucun de ces titres n’indique dans quel dossier il se trouve.',
    shuffleTag: (tag) => `Mélanger « ${tag} »`,
  },

  row: {
    opensTracks: 'Ouvre ses titres',
    selectsTracks: 'Sélectionne tous ses titres',
    select: 'Sélectionner ses titres',
  },

  rack: {
    open: (album) => `Ouvrir ${album}`,
    openHint: 'Affiche les titres de l’album',
    bringForward: 'Amène ce disque au premier plan',
  },

  albumActions: {
    select: { label: 'Sélectionner', hint: 'Ses titres, puis tout ce que tu touches ensuite' },
    rest: {
      label: 'Trouver le reste de cet album',
      hint: 'Les titres que tu n’as pas encore',
    },
    lookUp: {
      label: 'Rechercher cet album',
      hint: 'Ses infos et sa pochette, en cherchant l’album entier d’un coup',
    },
    cover: {
      label: 'Choisir la pochette de l’album',
      hint: 'Une image de ta galerie, pour chacun de ses titres',
    },
  },

  albumTools: {
    lookingUp: (done, total) =>
      `Recherche de l’album… ${format.number(done)} sur ${format.number(total)}`,
    stop: 'Arrêter la recherche',
    lookedUp: (found, covers) =>
      found === 0 && covers === 0
        ? 'Rien de nouveau n’a été trouvé pour cet album.'
        : covers === 0
          ? `Infos trouvées pour ${tracks(found)}.`
          : found === 0
            ? `Pochette trouvée pour ${tracks(covers)}.`
            : `Infos trouvées pour ${tracks(found)}, pochette pour ${tracks(covers)}.`,
    offline: 'Aucune réponse. Vérifie la connexion et réessaie.',
    failed: 'La recherche s’est arrêtée de façon inattendue.',
    coverChosen: (count) => `La pochette est maintenant appliquée à ${tracks(count)}.`,
  },

  rest: {
    looking: 'Recherche de l’album…',
    release: (count, year) => (year ? `${common.tracks(count)}, ${year}` : common.tracks(count)),
    have: (have, total) => `Tu en as ${format.number(have)} sur ${format.number(total)}.`,
    complete: 'Tu as l’album complet.',
    rivals: 'Plusieurs albums portent ce nom. Voici celui qui correspond le mieux à tes titres.',
    unsure:
      'Aucun de tes titres n’y a été reconnu, donc rien n’est coché. Vérifie d’abord que c’est le bon album.',
    disc: (disc) => `Disque ${format.number(disc)}`,
    ordered: (count) =>
      `${format.number(count)} ${one(count, 'titre remis', 'titres remis')} dans l’ordre de l’album.`,
    undoOrder: 'Annuler',

    lookingTube: 'Recherche sur YouTube…',
    readingTube: 'Lecture de l’album…',
    source: {
      musicbrainz: 'Liste des titres issue de MusicBrainz',
      youtube: (playlist, channel) =>
        `Liste des titres issue de YouTube : ${[playlist, channel].filter(Boolean).join(' · ')}`,
    },
    other: { youtube: 'Chercher plutôt sur YouTube', musicbrainz: 'Utiliser plutôt MusicBrainz' },
    onTrust:
      'Tiré de l’album YouTube qui porte ce nom. Tu as trop peu de ses titres pour le vérifier, alors jette un œil avant de télécharger.',
    tubeNotFound: 'Aucune playlist YouTube n’a pu être confirmée comme étant cet album.',

    ticks: 'Coché pour le téléchargement',
    waiting: 'En attente de son tour',
    searching: 'Recherche sur YouTube…',
    noMatch: 'Aucun enregistrement correspondant trouvé',
    searchFailed: 'La recherche n’a pas abouti',
    byHand: 'Chercher à la main',
    byHandLabel: (title) => `Chercher ${title} à la main`,

    download: (count) => `Télécharger ${tracks(count)}`,
    nothingTicked: 'Coche les titres à télécharger',
    stop: 'Arrêter la recherche',

    failed: {
      unnamed:
        'Impossible de rechercher cet album. Il lui faut un nom, et un artiste commun à la plupart de ses titres.',
      notFound: 'MusicBrainz n’a aucun album de ce nom pour cet artiste.',
      offline: 'Impossible de joindre MusicBrainz. Vérifie ta connexion et réessaie.',
      throttled: 'MusicBrainz a demandé de ralentir. Attends une minute et réessaie.',
      failed: 'Impossible de rechercher l’album.',
      gone: 'Cet album n’est plus dans la bibliothèque.',
      neither:
        'Album introuvable. MusicBrainz ne le répertorie pas, et aucune playlist YouTube n’a pu être confirmée comme étant cet album.',
      tube: 'Impossible d’interroger YouTube pour cet album.',
      tooOld: 'Cette version de Jukebox ne peut pas rechercher d’albums sur YouTube. Installe une version Android plus récente.',
    },
  },

  menu: {
    playNext: { label: 'Lire ensuite', hint: 'Juste après le titre en cours' },
    addToQueue: { label: common.addToQueue, hint: 'À la fin' },
    playSimilar: { label: 'Écouter avec des titres proches', hint: 'Celui-ci, puis une série de titres proches' },
    playOnly: { label: 'Écouter seulement celui-ci', hint: 'La file ne contient que ce titre' },
    album: { label: 'Aller à l’album', hint: 'Le reste du disque, dans l’ordre' },
    addToPlaylist: { label: 'Ajouter à une liste', hint: 'Une de tes listes, ou une nouvelle' },
    tiles: { label: 'Jouer aux piano tiles', hint: 'Des touches qui tombent en rythme avec ce morceau' },
    details: {
      label: 'Voir et modifier les infos',
      hint: 'Noms, pochette, tags et paroles, avec une recherche pour chacun',
    },
    delete: { label: 'Supprimer du téléphone', hint: 'Efface le fichier lui-même, pas seulement cette ligne' },
  },

  folders: {
    needsAccess:
      'Jukebox a besoin d’accéder aux fichiers audio de cet appareil pour afficher des dossiers.',
    note: 'Jukebox lit tout ce qui se trouve dans le dossier choisi, sous-dossiers compris. Choisir un sous-dossier permet de laisser de côté les sonneries et les sons de jeux.',
    everything: (path) => `${path}  (tout)`,
  },

  leftOut: {
    title: 'Dossiers écartés',
    none: 'Aucun. Désactive les dossiers de messages vocaux, d’enregistrements ou de sonneries.',
    some: (count) =>
      `${format.number(count)} ${one(count, 'dossier écarté', 'dossiers écartés')} de la bibliothèque`,
    note: 'Un dossier désactivé est écarté de la bibliothèque, avec tous les dossiers qu’il contient. Rien n’est supprimé : ses écoutes, ses tags et ses places dans tes listes sont conservés, et reviennent quand tu le réactives.',
    within: 'Écarté avec le dossier qui le contient',
    spoken: (path, count) => `${path}, ${tracks(count)}`,
    hint: 'Activé, le dossier est dans la bibliothèque ; désactivé, il en est écarté',
    empty: (root) => `Aucun dossier contenant de la musique dans ${root}.`,
  },

  shortFiles: {
    title: 'Masquer les fichiers courts',
    note: 'Écarte les messages vocaux, les sonneries et les sons de notification d’après leur durée. Rien n’est supprimé.',
    under: (seconds) => `Moins de ${format.number(seconds)} s`,
    shorterThan: (seconds) => `Moins de ${format.number(seconds)} secondes`,
  },

  copies: {
    title: 'Copies d’un même morceau',
    some: (count) =>
      `${format.number(count)} ${one(count, 'morceau est', 'morceaux sont')} en plusieurs exemplaires dans ta bibliothèque`,
    review: 'Voir',
    reviewHint: 'Ouvre les copies pour choisir laquelle garder',
    note: 'Ces fichiers ressemblent à un même enregistrement sauvegardé plusieurs fois : le même nom, ou le même artiste et le même titre, et la même durée à deux secondes près. Une copie de chacun est gardée. Avant que les autres soient supprimées, leurs écoutes, tags, paroles et places dans les listes lui sont transférés.',
    empty: 'Aucun morceau n’est en plusieurs exemplaires dans ta bibliothèque.',
    cleanAll: (count) => `Tout nettoyer (${format.number(count)})`,
    confirmAll: (files, songs) =>
      `Supprimer ${format.number(files)} ${one(files, 'fichier', 'fichiers')} ? Une copie ${one(songs, 'du morceau', `de chacun des ${format.number(songs)} morceaux`)} est gardée, et les écoutes, tags, paroles et places dans les listes de chaque fichier supprimé lui sont d’abord transférés. Android redemande avant toute suppression.`,
    confirm: (files) => `Supprimer ${format.number(files)} ${one(files, 'fichier', 'fichiers')}`,
    deleteOthers: (count) =>
      one(count, 'Supprimer l’autre copie', `Supprimer les ${format.number(count)} autres copies`),
    different: 'Ce sont des morceaux différents',
    choose: 'Quelle copie garder',
    keepHint: 'Garde cette copie et supprime les autres',
    keeps: 'Gardée',
    goes: 'Supprimée',
    why: {
      listens: 'Suggérée car c’est celle qui a le plus d’écoutes.',
      described: 'Suggérée car elle a des infos ou une pochette.',
      folder: 'Suggérée car elle est dans le dossier de la bibliothèque.',
      larger: 'Suggérée car c’est le fichier le plus gros.',
      older: 'Suggérée car c’est le fichier le plus ancien.',
      alike: 'Les copies sont identiques : n’importe laquelle convient.',
    },
    yourChoice: 'La copie que tu as choisie est gardée.',
    holds: (copy) => {
      const parts = [
        copy.listens > 0 ? `${format.number(copy.listens)} ${one(copy.listens, 'écoute', 'écoutes')}` : 'aucune écoute',
      ];
      if (copy.described) parts.push('infos');
      if (copy.cover) parts.push('pochette');
      if (copy.outside) parts.push('hors du dossier de la bibliothèque');
      return parts.join(' · ');
    },
    deleted: (count) => `${format.number(count)} ${one(count, 'fichier supprimé', 'fichiers supprimés')}.`,
    notDeleted: 'Les fichiers n’ont pas été supprimés. Leurs écoutes et le reste sont désormais sur la copie gardée.',
    failed: (error) => `Une partie de l’historique n’a pas pu être transférée ; ces fichiers n’ont pas été touchés. ${error}`,
  },

  wrong: {
    title: 'Téléchargements peut-être erronés',
    some: (count) =>
      `${format.number(count)} ${one(count, 'téléchargement est peut-être un autre morceau que celui qu’indique son nom', 'téléchargements sont peut-être d’autres morceaux que ceux qu’indiquent leurs noms')}`,
    review: 'Voir',
    reviewHint: 'Ouvre ces téléchargements pour corriger chacun',
    note: 'Chacun a été téléchargé comme un morceau et a reçu son nom, mais la vidéo dont il vient s’appelle autrement : c’est peut-être un autre morceau. Écoute-le pour savoir lequel, puis donne-lui le nom de la vidéo, supprime-le ou indique qu’il est correct. Rien ne change avant que tu choisisses.',
    empty: 'Aucun téléchargement ne semble être un autre morceau.',
    filedAs: 'Enregistré sous',
    videoWas: 'La vidéo était',
    facts: (length, listens) =>
      `${length} · ${listens > 0 ? `${format.number(listens)} ${one(listens, 'écoute', 'écoutes')}` : 'aucune écoute'}`,
    playHint: 'Lit ce fichier',
    rename: 'Lui donner son vrai nom',
    delete: 'Supprimer',
    right: 'C’est correct',
    sheetNote: 'Repris du titre de la vidéo. Modifie-le s’il n’est pas tout à fait juste. Il est enregistré comme ta propre modification, qu’aucune recherche ne remplace.',
    titleField: 'Titre',
    artistField: 'Artiste',
    renamed: (title) => `Renommé en « ${title} ».`,
    deleted: 'Supprimé.',
    notDeleted: 'Le fichier n’a pas été supprimé.',
    keptRight: 'Gardé tel quel. La question ne sera plus posée.',
    failed: (error) => `Impossible de le faire. ${error}`,
  },
};
