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
  openPlaylistLabel: (title) => `Ouvrir la playlist ${title}`,
  downloadLabel: (title) => `Télécharger ${title}`,
  download: { mp3: 'Télécharger en MP3', original: 'Télécharger l’audio' },
  adding: 'Ajout…',

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
