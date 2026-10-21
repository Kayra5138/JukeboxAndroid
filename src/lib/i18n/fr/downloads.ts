import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

/* « En attente » and « en cours » do not change with the number, which keeps the short forms short. */
export const downloads: Strings['downloads'] = {
  short: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `En pause · ${format.number(waiting)} en attente` : 'En pause';
    if (underWay > 0 && waiting > 0) return `${format.number(underWay)} en cours, ${format.number(waiting)} en attente`;
    if (underWay > 0) return `${format.number(underWay)} en cours`;
    return waiting > 0 ? `${format.number(waiting)} en attente` : '';
  },
  state: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `En pause, ${format.number(waiting)} en attente` : 'En pause';
    const going = `${format.number(underWay)} ${one(underWay, 'téléchargement', 'téléchargements')} en cours`;
    if (underWay > 0 && waiting > 0) return `${going}, ${format.number(waiting)} en attente`;
    if (underWay > 0) return going;
    return waiting > 0 ? `${format.number(waiting)} en attente` : 'Aucun téléchargement en cours';
  },
  pausedNote: 'Rien de nouveau ne démarre tant que tu ne reprends pas. Ce qui est déjà en cours se termine.',
  automaticNote: (count) =>
    count === 1
      ? 'Un téléchargement est automatique : Découvrir l’a demandé. Il attend que plus rien d’autre ne se télécharge.'
      : `${format.number(count)} téléchargements sont automatiques : Découvrir les a demandés. Ils attendent que plus rien d’autre ne se télécharge.`,

  pause: 'Pause',
  resume: 'Reprendre',
  cancelAll: 'Tout annuler',
  cancelAllQuestion: 'Annuler tous les téléchargements ?',
  cancelAllHint:
    'Tout ce qui attend et tout ce qui se télécharge est annulé. Ce qui est déjà dans ta bibliothèque y reste.',
  keep: 'Les garder',

  sections: { now: 'En cours', next: 'À suivre', history: 'Historique' },
  clear: 'Effacer',
  clearLabel: 'Effacer l’historique des téléchargements',

  source: {
    discover: 'Découvrir',
    search: 'Recherche',
    album: (name) => `Album : ${name}`,
    playlist: (name) => `Playlist : ${name}`,
  },
  automatic: 'Automatique · attend les autres',
  retrying: (why) => (why ? `Nouvel essai · ${why}` : 'Nouvel essai'),

  doNext: 'Télécharger ensuite',
  doNextLabel: (title) => `Télécharger ${title} juste après`,
  cancelLabel: (title) => `Annuler ${title}`,
  retryLabel: (title) => `Réessayer ${title}`,
  moveUp: 'Monter',
  moveDown: 'Descendre',

  empty: {
    heading: 'Aucun téléchargement pour l’instant',
    body: 'Ce que tu télécharges depuis Recherche, depuis Découvrir ou pour compléter un album s’affiche ici, avec ce qui attend encore son tour.',
  },
  unavailable: 'Installe une nouvelle version Android pour télécharger de la musique.',
  readFailed: 'Impossible de lire les téléchargements.',

  extractor: {
    heading: 'Téléchargeur YouTube',
    version: (version) => `yt-dlp ${version}`,
    current: 'À jour',
    available: (version) => `${version} est disponible`,
    unchecked: 'Pas encore de recherche de mise à jour',
    checked: (days) =>
      days === 0
        ? 'vérifié aujourd’hui'
        : days === 1
          ? 'vérifié hier'
          : `vérifié il y a ${format.number(days)} jours`,
    check: 'Rechercher une mise à jour',
    checking: 'Vérification…',
    update: 'Mettre à jour',
    waiting: 'En attente de la fin du téléchargement en cours…',
    downloading: (version, percent) => `Téléchargement de ${version} · ${format.number(percent)} %`,
    trying: 'Essai de la nouvelle version…',
    restoring: 'Retour à la version fournie avec Jukebox…',
    updated: (version) => `Version ${version} installée. Les téléchargements qui ont échoué peuvent être relancés.`,
    restore: (version) => `Revenir à ${version}, la version fournie avec Jukebox`,
    checkFailed: 'Impossible de rechercher une mise à jour.',
    trouble: {
      network: 'Impossible de joindre GitHub. Vérifie la connexion et réessaie.',
      answer: 'GitHub n’a renvoyé aucune version. Réessaie plus tard.',
      checksum: 'Le fichier reçu n’est pas celui qu’annonce la version publiée. Rien n’a été modifié.',
      broken: 'La nouvelle version ne fonctionne pas sur ce téléphone. Celle que tu avais est toujours en place.',
      failed: 'Impossible de mettre à jour. La version que tu avais est toujours en place.',
    },
    rowUpdate: 'Mettre à jour',
    rowCheck: 'Vérifier',
    rowUpdateLabel: (title) => `Mettre à jour le téléchargeur YouTube pour réessayer ${title}`,
    rowCheckLabel: (title) => `Chercher une nouvelle version du téléchargeur YouTube pour réessayer ${title}`,
  },

  button: {
    label: (state) => (state ? `Téléchargements : ${state}` : 'Téléchargements'),
    finished: 'terminés',
    heading: 'Téléchargements',
    idle: 'Aucun téléchargement en ce moment',
    paused: 'En pause',
    allDone: 'Tout est terminé',
    waiting: (count) => `${format.number(count)} en attente`,
    done: (count) => `${format.number(count)} ${one(count, 'terminé', 'terminés')}`,
    failed: (count) => `${format.number(count)} en échec`,
    open: 'Ouvrir les téléchargements',
  },
};
