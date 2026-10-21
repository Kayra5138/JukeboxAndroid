import { format } from './format.ts';
import { de, one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

const artistsOf = (done: number, total: number) =>
  `${format.number(done)} sur ${format.number(total)} ${one(total, 'artiste', 'artistes')}`;

/*
  « Découvrir » is the feature's name and is used like one, without an article:
  « Découvrir crée une liste ». A name that follows « de » goes through `de`,
  so that Adele is « d’Adele ».
*/
export const discover: Strings['discover'] = {
  panel: {
    heading: 'Pour ta prochaine écoute',
    refresh: 'Actualiser',
    updated: (date) => `Mise à jour le ${date}`,

    familiar: (because) => `De tes artistes · ${because}`,
    fresh: (because) => `Nouvel artiste · ${because}`,
  },

  header: {
    notYet: 'Pas encore de liste',
    about: 'À propos de Découvrir',
    settings: 'Paramètres de Découvrir',
    findMore: 'En trouver plus',
    dismiss: 'Ignorer',
  },

  about: {
    heading: 'À propos de Découvrir',
    what:
      'Des morceaux que tu n’as pas encore, choisis d’après ce que tu as écouté ces 30 derniers jours : d’autres titres de tes artistes, et des artistes proches d’eux.',
    source:
      'Ce que tu écoutes est analysé sur ce téléphone. Les suggestions viennent de ListenBrainz et de MusicBrainz, et l’audio d’un morceau est récupéré sur YouTube au moment de le lire.',
    keep: '« Garder » ajoute un morceau à ta bibliothèque. Il quitte la liste, puisqu’il a été trouvé.',
    exclude:
      '« Pas ce morceau » le retire de la liste, et il ne sera plus recommandé. Depuis le menu, tu peux faire de même pour son artiste.',
    room: 'Dans les deux cas, un autre morceau prend sa place. Fais glisser une ligne sur le côté pour faire pareil, ou appuie longuement dessus pour plus d’options.',
  },

  row: {
    keep: 'Garder dans la bibliothèque',
    exclude: 'Pas ce morceau',
    swipeKeep: 'Garder',
    swipeExclude: 'Pas ça',
    willPlay: 'Lecture dès qu’il est prêt',
    preview: 'Extrait · le morceau arrive',
    previewStop: 'Arrête l’extrait. Le morceau sera quand même lu quand il sera prêt',
    willKeep: 'Dans la bibliothèque dès qu’il est prêt',
    keeping: 'Enregistrement dans la bibliothèque…',
    failed: 'Échec du téléchargement · touche pour réessayer',
    needsBuild: 'Nécessite l’app à jour',
    waitingWifi: 'En attente du Wi-Fi · touche pour télécharger',
    percent: (percent) => `${format.number(percent)} %`,
    gettingReady: 'Téléchargement en cours',
    hint: 'Lit le morceau, en le téléchargeant d’abord si nécessaire',
    nowPlaying: (title) => `En cours de lecture : ${title}`,
    menu: 'Options du morceau',
  },

  menu: {
    play: { label: 'Lire', hint: 'Téléchargé d’abord si nécessaire' },
    keep: { label: 'Garder dans la bibliothèque', hint: 'Il est à toi, et quitte cette liste' },
    exclude: { label: 'Pas ce morceau', hint: 'Retiré de la liste et plus jamais recommandé' },
    neverArtist: {
      label: (artist) => `Plus jamais ${artist}`,
      hint: 'Plus rien de cet artiste ne sera recommandé',
    },
    why: 'Pourquoi ce morceau',
    seeds: (artists) => `D’après tes écoutes ${de(artists)}`,
    tags: (tags) => `Tags : ${tags}`,
    freshArtist: 'Un artiste nouveau dans ta bibliothèque',
  },

  empty: {
    building: 'Préparation de ta liste…',
    none: 'Pas encore de liste. Appuie sur Actualiser, et Découvrir en crée une d’après ce que tu écoutes.',
    findingMore: 'Recherche d’autres morceaux…',
    short: (missing) =>
      `${format.number(missing)} ${one(missing, 'emplacement vide', 'emplacements vides')}.`,
  },

  player: {
    kept: 'Enregistré dans la bibliothèque',
  },

  preview: {
    label: 'Extrait',
    note: 'Le morceau entier démarre dès qu’il est prêt',
    stop: 'Arrêter l’extrait',
  },

  settings: {
    heading: 'Découvrir',
    title: 'Paramètres de Découvrir',
    count: 'Morceaux à découvrir',
    countNote: 'Moitié artistes familiers, moitié nouveaux. Les morceaux gardés ou exclus sont remplacés aussitôt.',
    refresh: 'Actualiser la liste',
    everyDays: (days) => `${format.number(days)} j`,
    manual: 'Manuel',
    refreshNote:
      'Android choisit quand les tâches en arrière-plan peuvent s’exécuter. Une actualisation en retard se fait aussi quand tu rouvres Jukebox. Les découvertes non gardées sont remplacées ; les morceaux en file d’attente sont conservés tant que la lecture en a besoin.',
    ready: 'Garder les prochains morceaux prêts',
    readyNone: 'Aucun',
    readyNote:
      'Téléchargés à l’avance pour qu’un appui lance la lecture tout de suite : les premiers de la liste, ou ceux qui suivent le morceau en cours. Avec « Aucun », un morceau est récupéré quand tu le touches.',
    wifi: 'Préparer les morceaux en Wi-Fi uniquement',
    wifiNote: 'Utilise un Wi-Fi non limité. Un morceau que tu touches est téléchargé quelle que soit la connexion.',
    preview: 'Lire un extrait pendant le téléchargement',
    previewNote:
      'Un morceau touché qui n’est pas encore prêt démarre aussitôt avec un extrait de 30 secondes de Deezer, puis le morceau entier prend le relais depuis le début dès qu’il est arrivé. Un extrait ne compte pas comme une écoute.',
    nextList: 'Ta liste actuelle reste telle quelle. La prochaine sera choisie ainsi.',
    excluded: 'Morceaux exclus',
    noneExcluded: 'Aucun morceau exclu.',
    allowAgain: 'Autoriser à nouveau',
    allowAgainLabel: (title) => `Autoriser à nouveau ${title}`,
    unblock: 'Débloquer',
    unblockLabel: (artist) => `Débloquer ${artist}`,
    failed: 'Impossible de mettre à jour les paramètres de Découvrir. Réessaie.',
  },

  state: {
    idle: 'Touche pour télécharger et lire',
    starting: 'Démarrage…',
    waitingFind: 'En attente de recherche',
    waitingDownload: 'En attente de téléchargement',
    waitingRetry: 'Nouvel essai dans un instant',
    finding: 'Recherche de l’enregistrement…',
    preparing: 'Démarrage du téléchargement…',
    downloading: (percent) => `Téléchargement · ${format.number(percent)} %`,
    converting: 'Finalisation…',
    saving: 'Presque prêt…',
    ready: 'Prêt à lire',
    playing: 'En lecture',
    willPlay: (doing) => `${doing} Lecture dès qu’il est prêt.`,
    preview: (doing) => `Extrait en cours. ${doing}`,
    willKeep: (doing) => `${doing} Ajout à la bibliothèque dès qu’il est prêt.`,
    keeping: 'Enregistrement dans la bibliothèque…',
    waitingWifi: 'En attente du Wi-Fi · touche pour télécharger maintenant',
  },

  failure: {
    generic: 'Ce téléchargement n’a pas pu aboutir.',
    fileMissing: 'Le fichier n’est plus sur le téléphone.',
    noRecording: 'Aucun enregistrement de ce morceau n’a été trouvé.',
    notASong: 'La vidéo trouvée est un direct, ou bien trop longue pour être le morceau.',
    stopped: 'Le téléchargement a été arrêté.',
    needsBuild: 'Installe l’APK à jour pour télécharger les morceaux de Découvrir.',
    retry: (reason) => `${reason} Touche pour réessayer.`,
  },

  status: {
    building: 'Recherche de morceaux…',
    filling: (known, total) => `Recherche des morceaux · ${format.number(known)} sur ${format.number(total)}`,
    findingOffline: 'Pas de connexion. Le reste de la liste sera cherché dès qu’il y en aura une.',
    findingPaused: 'Les téléchargements sont en pause. Reprends-les et le reste de la liste sera cherché.',
    findingLater: 'Certains morceaux n’ont pas pu être vérifiés pour l’instant. Découvrir réessaiera plus tard.',
    buildingArtists: (done, total) => `Recherche de morceaux · ${artistsOf(done, total)}`,
    preparing: (ready, target) =>
      `Une nouvelle liste arrive · ${format.number(ready)} sur ${format.number(target)} ${one(target, 'morceau', 'morceaux')} ${one(ready, 'prêt', 'prêts')}.${ready > 0 ? ' Actualise à nouveau pour la voir maintenant.' : ''}`,
    offline: 'Pas de connexion. Ta liste est conservée ; de nouveaux morceaux seront cherchés dès qu’il y en aura une.',
    offlineEmpty: 'Pas de connexion. Découvrir créera ta liste dès qu’il y en aura une.',
    noLibrary: 'Découvrir part de la musique de ce téléphone, et n’en a pas encore trouvé.',
    noTaste:
      'Tes morceaux n’indiquent pas leur artiste, alors Découvrir n’a personne d’où partir. Trouve leurs infos dans Paramètres → Bibliothèque → Tags.',
    unreachable: 'Impossible d’obtenir les recommandations. Ta liste est conservée ; réessaie plus tard.',
    unreachableEmpty: 'Impossible d’obtenir les recommandations. Réessaie plus tard.',
    exhausted: 'Il n’y a pas encore assez de nouveaux morceaux. Ta liste reste telle quelle.',
    exhaustedEmpty: 'Rien de nouveau à recommander pour l’instant. Écoute encore un peu et réessaie.',
    timedOut: 'La recherche de morceaux a pris trop de temps et a été arrêtée. Réessaie.',
    throttled: 'Découvrir vient de chercher. Réessaie dans une minute.',
    failed: 'Découvrir n’a pas pu terminer. Réessaie.',
    waitingWifi: 'Les prochains morceaux seront téléchargés dès qu’il y aura du Wi-Fi. Touche un morceau pour le télécharger maintenant.',
    waitingConnection: 'Les prochains morceaux seront téléchargés dès qu’il y aura une connexion.',
    paused: 'Les téléchargements sont en pause. Reprends-les pour récupérer les morceaux.',
  },

  notice: {
    kept: (title) => `${title} ajouté à la bibliothèque.`,
    excluded: (title) => `${title} ne te sera plus recommandé.`,
    excludedArtist: (artist) => `Plus de recommandations pour ${artist}.`,
    restored: (title) => `${title} est de retour dans la liste.`,
    refreshed: 'Voici ta nouvelle liste.',
    keepFailed: (title) => `Impossible d’ajouter ${title} à la bibliothèque. Réessaie.`,
    wrongFile: (title) => `Le fichier de ${title} était un autre morceau. Recherche du bon pour l’ajouter.`,
    undo: 'Annuler',
  },

  engine: {
    needsTaste: 'Découvrir n’a ni artiste ni tag d’où partir.',
    nothingFetched:
      'Impossible de récupérer des recommandations. Ta liste Découvrir actuelle est conservée ; réessaie plus tard.',
  },

  taste: {
    popularity: 'Popularité des morceaux',
    popularityKnown: 'Connus',
    popularityAny: 'Peu importe',
    popularityDeep: 'Méconnus',
    popularityNote:
      'Découvrir peut pencher vers des artistes connus et leurs morceaux les plus écoutés, ou vers des artistes et des morceaux que moins de gens ont découverts. Avec « Peu importe », un nouvel artiste est présenté par l’un de ses morceaux les plus connus.',

    neverArtistLabel: (artist) => `Ne plus jamais recommander ${artist}`,
    blockedArtists: 'Artistes bloqués',
    noneBlockedArtists: 'Aucun artiste bloqué.',
    blockedArtistsNote:
      'Exclure un morceau rend aussi son artiste moins probable. Trois morceaux exclus du même artiste, et Découvrir le met de côté pendant six mois.',
  },

  why: {
    moreFrom: (artist) => `Plus ${de(artist)}`,
    becauseYouPlay: (artists) => `Parce que tu écoutes ${artists}`,
    both: (first, second) => `${first} et ${second}`,
    like: (artist) => `Proche ${de(artist)}`,
    withGenre: (line, genre) => `${line} · ${genre}`,
    fromTags: (tags) => `D’après tes genres : ${tags}`,
    unexplained: 'Choisi pour toi',
    veryNear: 'Très proche de ce que tu écoutes',
    near: 'Proche de ce que tu écoutes',
    farther: 'Un peu plus loin',
  },

  gathering: {
    around: (artist, done, total) => `Exploration autour ${de(artist)} · ${artistsOf(done, total)}`,
    artists: (done, total) => artistsOf(done, total),
    naming: 'Identification des morceaux…',
    offline: 'Pas de connexion. Découvrir cherchera de nouveaux morceaux dès qu’il y en aura une.',
    throttled: 'Le service de recommandations a demandé à Découvrir de ralentir. Réessaie dans quelques minutes.',
    nothing: 'Rien de nouveau trouvé cette fois. Ta liste Découvrir actuelle est conservée ; réessaie plus tard.',
  },
};
