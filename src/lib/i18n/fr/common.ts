import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

export const common: Strings['common'] = {
  cancel: 'Annuler',
  save: 'Enregistrer',
  done: 'Terminé',
  ok: 'OK',
  close: 'Fermer',
  back: 'Retour',
  delete: 'Supprimer',
  remove: 'Retirer',
  add: 'Ajouter',
  edit: 'Modifier',
  rename: 'Renommer',
  yes: 'Oui',
  no: 'Non',
  tryAgain: 'Réessayer',
  retry: 'Réessayer',
  import: 'Importer',
  /* Its one use is the button that undoes « Tout sélectionner ». */
  clear: 'Tout désélectionner',
  selectAll: 'Tout sélectionner',
  off: 'Désactivé',
  saved: 'Enregistré.',
  loading: 'Chargement…',

  search: 'Rechercher',
  clearSearch: 'Effacer la recherche',

  play: 'Lire',
  pause: 'Pause',
  nextTrack: 'Titre suivant',
  previousTrack: 'Titre précédent',
  shuffle: 'Aléatoire',
  addToQueue: 'Ajouter à la file d’attente',
  moveUp: 'Monter',
  moveDown: 'Descendre',

  unknownArtist: 'Artiste inconnu',
  unknownAlbum: 'Album inconnu',

  tracks: (count) => `${format.number(count)} ${one(count, 'titre', 'titres')}`,
  songs: (count) => `${format.number(count)} ${one(count, 'morceau', 'morceaux')}`,
  albums: (count) => `${format.number(count)} ${one(count, 'album', 'albums')}`,
  artists: (count) => `${format.number(count)} ${one(count, 'artiste', 'artistes')}`,
  lists: (count) => `${format.number(count)} ${one(count, 'liste', 'listes')}`,
  files: (count) => `${format.number(count)} ${one(count, 'fichier', 'fichiers')}`,
  minutes: (count) => `${format.number(count)} min`,
  hours: (count) => `${format.number(count)} h`,

  fileUnreadable: 'Impossible de lire ce fichier.',
  pictureFailed: 'Impossible de charger cette image.',

  drawFailed: 'Un problème est survenu à l’affichage de cet écran.',
};
