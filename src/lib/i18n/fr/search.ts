import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

/* YouTube's own word is kept for its playlists; the app's own are « listes ». */
export const search: Strings['search'] = {
  modes: {
    discover: 'Découvrir',
    download: 'Télécharger',
    videos: 'Vidéos',
    playlists: 'Playlists',
  },

  tapes: {
    intro:
      'Livres audio, podcasts, conférences et longs enregistrements de YouTube, téléchargés dans le dossier Tapes de ta bibliothèque et repris là où tu t’es arrêté. Cherche, ou colle le lien d’une vidéo ou d’une playlist, ou celui d’une chaîne pour la suivre.',
    placeholder: { videos: 'Titre, émission ou lien YouTube', playlist: 'Livre, série ou lien de playlist' },
    empty: { videos: 'Cherche un livre, une émission, une conférence ou un cours.', playlist: 'Cherche une playlist à télécharger comme une seule cassette : un livre en plusieurs parties ou une saison d’une émission.' },
    download: 'Télécharger comme cassette',
    downloadBook: (count) => `Tout télécharger (${format.number(count)}) comme une seule cassette`,
    bookHint: 'Ils vont dans un dossier au nom de la liste, numérotés dans son ordre, et s’enchaînent.',
    added: (name) => `En route vers Tapes/${name}`,
    sources: { youtube: 'YouTube', podcasts: 'S’abonner', books: 'Livres', files: 'Téléphone' },
    /** Books from the Internet Archive: see `books/archive.ts`, `BooksPane` and the book screen. */
    /** Files on the phone brought into the Tapes folder: see `FilesPane`. */
    files: {
      intro: 'Les livres, enregistrements et conférences déjà sur votre téléphone, copiés dans un dossier de vos cassettes. Les fichiers choisis restent où ils sont.',
      choose: 'Choisir des fichiers',
      chooseOther: 'Choisir d’autres fichiers',
      folder: 'Nom du dossier',
      folderPlaceholder: 'Le nom du livre ou de l’enregistrement',
      folderNote: 'Ils vont dans le dossier Cassettes de votre bibliothèque sous ce nom, dans l’ordre de leurs numéros.',
      copy: (count) => one(count, 'Copier dans les cassettes', `Copier ${format.number(count)} fichiers dans les cassettes`),
      chosen: (count) => `${format.number(count)} ${one(count, 'fichier choisi', 'fichiers choisis')}`,
      copied: (done, of) => done === of ? `${format.number(done)} ${one(done, 'fichier copié', 'fichiers copiés')} dans vos cassettes.` : `${format.number(done)} fichiers sur ${format.number(of)} copiés, les autres étaient illisibles.`,
      failed: 'Aucun fichier n’a pu être copié.',
      pickFailed: 'Impossible de choisir les fichiers.',
      toTapes: 'Aller aux cassettes',
    },
    books: {
      intro: 'Des livres du domaine public lus à voix haute par les bénévoles de LibriVox et conservés gratuitement sur l’Internet Archive. Cherchez par titre ou par auteur, ou collez l’adresse de quelque chose à écouter sur archive.org.',
      placeholder: 'Titre, auteur ou lien archive.org',
      nothingFound: 'Aucun livre trouvé.',
      searchFailed: 'Impossible de chercher sur l’Internet Archive.',
      anyLanguage: 'Toutes les langues',
      popular: 'Les plus écoutés',
      bookFailed: 'Impossible de lire ce livre depuis l’Internet Archive.',
      stats: (parts, minutes, here) => `${format.number(parts)} ${one(parts, 'partie', 'parties')} · ${minutes >= 60 ? `${format.number(Math.floor(minutes / 60))} h ${format.number(minutes % 60)} min` : `${format.number(minutes)} min`}${here > 0 ? ` · ${format.number(here)} sur le téléphone` : ''}`,
      fetchAll: 'Télécharger le livre entier',
      fetchRest: (count) => one(count, 'Télécharger la dernière partie', `Télécharger les ${format.number(count)} autres parties`),
      size: (mb) => `Environ ${format.number(mb)} Mo en tout`,
      parts: (count) => `${format.number(count)} ${one(count, 'partie', 'parties')}`,
    },
    podcasts: {
      intro: 'Suivez un podcast ou une chaîne YouTube et ses nouveaux épisodes arrivent d’eux-mêmes dans vos cassettes, ou ouvrez-le et téléchargez seulement les épisodes voulus. Cherchez, ou collez l’adresse d’un flux ou d’une chaîne.',
      /** Under the button on a show not followed: that its episodes can be had without following it. */
      withoutFollowing: 'Pas besoin de suivre pour écouter, téléchargez ci-dessous l’épisode voulu. En suivant, les nouveaux arrivent d’eux-mêmes.',
      /** Where podcasts can be had from: said under the intro. */
      /** The title of a followed or followable show's own screen, a podcast or a YouTube channel. */
      showTitle: 'Émission',
      sources: 'D’où : toute émission de l’annuaire de podcasts d’Apple, qui recense presque tous les podcasts au flux public, y compris la plupart de ceux de Spotify ; toute adresse de flux, d’Anchor, Buzzsprout, Libsyn, Podbean, SoundCloud et autres ; et les chaînes YouTube.',
      placeholder: 'Nom du podcast ou de la chaîne, ou un lien',
      searchFailed: 'Impossible de chercher des podcasts. Vérifie ta connexion.',
      feedFailed: 'Impossible de lire le flux de ce podcast.',
      notChannel: 'Ce n’est pas l’adresse d’une chaîne YouTube, ou la chaîne est introuvable.',
      channelsHeading: 'Chaînes YouTube',
      podcastsHeading: 'Podcasts',
      subscribers: (count) => `${format.number(count)} ${one(count, 'abonné', 'abonnés')}`,
      channelsFailed: 'Impossible de chercher des chaînes sur YouTube.',
      nothingFound: 'Aucun podcast trouvé.',
      yours: 'Tes podcasts',
      noneYet: 'Tu ne suis encore aucun podcast.',
      wifiOnly: 'Nouveaux épisodes en Wi‑Fi seulement',
      wifiOnlyNote: 'Les épisodes des podcasts que tu suis ne se téléchargent tout seuls qu’en Wi‑Fi. Tu peux toujours télécharger un épisode à la main.',
      follow: 'Suivre',
      following: 'Suivi',
      unfollow: 'Ne plus suivre',
      autoDownload: 'Télécharger les épisodes les plus récents',
      autoDownloadNote: (keep) => one(keep, 'Le dernier épisode reste téléchargé.', `Les ${format.number(keep)} derniers épisodes restent téléchargés.`),
      keep: (count) => format.number(count),
      episodes: (count) => `Épisodes · ${format.number(count)}`,
      noEpisodes: 'Ce flux n’a aucun épisode avec un fichier.',
      download: 'Télécharger',
      continue: 'Reprendre',
      start: 'Commencer',
      more: 'Plus',
      less: 'Moins',
      stats: (total, here) => `${format.number(total)} ${one(total, 'épisode', 'épisodes')} · ${format.number(here)} sur le téléphone`,
      play: 'Lire',
      /** The episodes shown by when they came out: see `podcasts/when.ts`. */
      when: { label: 'Période', all: 'Tous', week: 'Semaine passée', month: 'Mois passé', quarter: '3 derniers mois' },
      newest: 'Plus récents d’abord',
      oldest: 'Plus anciens d’abord',
      noneThen: 'Aucun épisode de cette période.',
      fetchNext: 'Télécharger les épisodes suivants',
      fetchNextNote: (count) =>
        one(count, 'Pendant que vous écoutez un ancien épisode, le suivant est téléchargé pour être prêt à la fin de celui-ci.', `Pendant que vous écoutez un ancien épisode, les ${format.number(count)} suivants sont téléchargés pour que le prochain soit prêt à la fin de chacun.`),
      line: (date, length) => [date, length].filter(Boolean).join(' · '),
    },
  },
  unavailable: {
    heading: 'YouTube nécessite une nouvelle version de l’app',
    body: 'Installe la version Android à jour pour rechercher et télécharger de la musique. Ta bibliothèque reste disponible.',
    downloads: 'Installe une nouvelle version Android pour activer les téléchargements YouTube.',
  },

  intro: {
    videos: 'Recherche sur YouTube ou colle le lien d’une vidéo. Enregistre l’audio dans ta bibliothèque.',
    playlist:
      'Recherche une playlist ou colle son lien YouTube. Ouvre un résultat pour prévisualiser et télécharger ses titres. Les 500 premières entrées de la playlist sont vérifiées.',
  },
  inputLabel: {
    videos: 'Rechercher sur YouTube ou coller le lien d’une vidéo',
    playlist: 'Nom de playlist ou lien YouTube',
  },
  placeholder: {
    videos: 'Titre, artiste ou lien YouTube',
    playlist: 'Nom de playlist ou lien YouTube',
  },

  formats: { mp3: 'MP3', original: 'Audio d’origine' },
  formatHint: {
    mp3: 'Converti en MP3 après le téléchargement.',
    original: 'Garde le codec audio d’origine si possible.',
  },

  searching: 'Recherche sur YouTube…',
  results: (count) => `Résultats · ${format.number(count)}`,
  empty: {
    none: 'Aucun résultat. Essaie une autre recherche ou un autre lien.',
    videos: 'Cherche par titre et par artiste pour trouver l’enregistrement que tu veux.',
    playlist: 'Cherche par nom de playlist ou colle le lien d’une playlist.',
  },

  playlist: 'Playlist',
  openPlaylist: 'Ouvrir la playlist',
  backToResults: 'Retour aux résultats',
  openPlaylistLabel: (title) => `Ouvrir la playlist ${title}`,
  downloadLabel: (title) => `Télécharger ${title}`,
  download: { mp3: 'Télécharger en MP3', original: 'Télécharger l’audio' },
  adding: 'Ajout…',
  listen: 'Écouter',
  listenLabel: (title) => `Écouter ${title} sans le garder`,
  readying: 'Préparation…',
  listenDrop: 'Ne pas garder',

  addingPlaylist: 'Ajout de la playlist…',
  downloadListed: {
    mp3: 'Télécharger les titres listés · MP3',
    original: 'Télécharger les titres listés · Audio d’origine',
  },
  listedHint:
    'Les titres déjà téléchargés ou en file d’attente sont ignorés. Les vidéos privées, supprimées ou en direct peuvent être indisponibles.',
  listCreated: (name) => `Liste créée : ${name}. Les titres téléchargés apparaîtront dans Listes.`,
  inLibrary: 'Dans ta bibliothèque',
  alreadyHave: (count) =>
    one(count, `${format.number(count)} morceau était déjà dans ta bibliothèque et n’a pas été retéléchargé.`, `${format.number(count)} morceaux étaient déjà dans ta bibliothèque et n’ont pas été retéléchargés.`),
  unnamedPlaylist: 'Playlist YouTube',

  jobLine: (status, mp3) => `${status} · ${mp3 ? 'MP3' : 'Original'}`,

  status: {
    finding: 'Recherche sur YouTube',
    queued: 'En attente',
    preparing: 'Préparation…',
    downloading: (percent) => `Téléchargement · ${percent} %`,
    converting: 'Conversion de l’audio…',
    saving: 'Ajout à la bibliothèque…',
    cancelling: 'Annulation…',
    cancelled: 'Annulé',
    failed: 'Échec du téléchargement',
    done: 'Dans la bibliothèque',
    listened: 'Prêt, non gardé',
    missing: 'Fichier supprimé',
  },

  failed: {
    search: 'La recherche a échoué. Réessaie.',
    queue: 'Impossible de mettre le téléchargement en file d’attente.',
    queuePlaylist: 'Impossible de mettre la playlist en file d’attente.',
    cancel: 'Impossible d’annuler le téléchargement.',
    read: 'Impossible de lire les téléchargements.',
    readReopen: 'Impossible de lire les téléchargements. Rouvre Recherche.',
  },

  errors: {
    playlistLink: 'Colle le lien d’une playlist YouTube, ou cherche par nom de playlist.',
    videoLink: 'Saisis le titre d’un morceau ou un lien de vidéo YouTube valide.',
    queueFull: 'La file de téléchargement est pleine. Attends que quelques titres se terminent, puis réessaie.',
    update: 'YouTube a changé et le téléchargeur de cette version ne sait pas encore le lire. Cherche une version plus récente dans Téléchargements, ou mets Jukebox à jour.',
    unavailable: 'Cette vidéo ou cette playlist est indisponible. Essaie une autre playlist publique ou une autre recherche.',
    unreachable: 'Impossible de joindre YouTube. Vérifie ta connexion et réessaie.',
    refused: 'YouTube n’a pas pu traiter cette demande. Réessaie plus tard ou choisis un autre résultat.',
  },
};
