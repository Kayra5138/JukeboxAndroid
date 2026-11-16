import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

/*
  « Une sauvegarde » is feminine, and the sentences about it say « elle ».
  How many of its songs are here is spelled out case by case, because French
  agrees the verb with the number found and words « none » and « the only
  one » differently.
*/
export const backup: Strings['backup'] = {
  imported: 'Importation terminée',
  importedBody:
    'Tout est là. Jukebox doit redémarrer pour l’afficher : ce qui est à l’écran a été lu avant l’importation.',
  restart: 'Redémarrer Jukebox',

  question: 'Importer cette sauvegarde ?',
  made: (when, app) => {
    if (when && app) return `Créée le ${when} par Jukebox ${app}.`;
    if (when) return `Créée le ${when}.`;
    if (app) return `Créée par Jukebox ${app}.`;
    return 'Sauvegarde sans date ni version.';
  },
  listens: (count) => `${format.number(count)} ${one(count, 'écoute', 'écoutes')}`,
  tagged: (count) => `${format.number(count)} ${one(count, 'morceau tagué', 'morceaux tagués')}`,
  followed: (count) => `${format.number(count)} ${one(count, 'émission suivie', 'émissions suivies')}`,
  withLyrics: (count) =>
    `${format.number(count)} ${one(count, 'morceau avec paroles', 'morceaux avec paroles')}`,

  songs: (found, total) => {
    if (total === 0) return 'Elle ne contient aucun morceau.';
    const missing = total - found;
    let here: string;
    if (total === 1) {
      here =
        found === 1
          ? 'Le morceau qu’elle contient est dans ta bibliothèque.'
          : 'Le morceau qu’elle contient n’est pas dans ta bibliothèque.';
    } else if (found === 0) {
      here = `Aucun des ${format.number(total)} morceaux qu’elle contient n’est dans ta bibliothèque.`;
    } else if (found === total) {
      here = `Les ${format.number(total)} morceaux qu’elle contient sont tous dans ta bibliothèque.`;
    } else {
      here = `${format.number(found)} des ${format.number(total)} morceaux qu’elle contient ${one(found, 'est', 'sont')} dans ta bibliothèque.`;
    }
    if (missing <= 0) return here;
    const elsewhere =
      found === 0
        ? ''
        : missing === 1
          ? ' L’autre n’est pas sur ce téléphone.'
          : ` Les ${format.number(missing)} autres ne sont pas sur ce téléphone.`;
    const kept =
      missing === 1
        ? ' Ses écoutes sont conservées, mais ses tags, ses paroles et sa place dans les listes ne sont pas importés, faute de morceau auquel les rattacher.'
        : ' Leurs écoutes sont conservées, mais leurs tags, leurs paroles et leur place dans les listes ne sont pas importés, faute de morceau auquel les rattacher.';
    return `${here}${elsewhere}${kept}`;
  },

  importing: 'Importation…',
  merge: 'Fusionner',
  mergeHint: 'L’ajouter à ce qui est déjà là. Rien n’est supprimé de ce téléphone.',
  replace: 'Remplacer',
  replaceHint:
    'Supprimer ce qui est sur ce téléphone et utiliser la sauvegarde à la place. Cette action est irréversible.',

  notABackup: 'Ce fichier n’est pas une sauvegarde Jukebox.',
  newer: 'Cette sauvegarde vient d’une version plus récente de Jukebox. Mets l’app à jour pour la lire.',
  needsBuildToExport: 'Installe la version Android à jour pour exporter.',
  needsBuildToImport: 'Installe la version Android à jour pour importer.',

  history: {
    title: 'Importer l’historique d’écoute',
    note: 'Tes écoutes sur Last.fm, Spotify, Apple Music ou ListenBrainz, depuis les fichiers qu’ils te laissent télécharger. Tu vois ce qui a été trouvé, et ta confirmation est demandée avant tout changement.',
    question: 'Importer ces écoutes ?',
    range: (from, to) => (from === to ? `Toutes le ${from}.` : `Du ${from} au ${to}.`),
    matched: (matched, total) =>
      `${format.number(matched)} sur ${format.number(total)} ${one(matched, 'concerne un morceau', 'concernent des morceaux')} de ta bibliothèque. Les autres sont gardées sous leur propre nom et comptent quand même dans tes statistiques.`,
    short: (count) =>
      `${format.number(count)} ${one(count, 'écoute dure', 'écoutes durent')} moins d’une demi-minute et ${one(count, 'est écartée', 'sont écartées')}.`,
    already: (count) =>
      `${format.number(count)} ${one(count, 'écoute est', 'écoutes sont')} déjà dans ton historique et ${one(count, 'est écartée', 'sont écartées')}.`,
    nothing: 'Toutes leurs écoutes sont déjà dans ton historique, ou trop courtes pour compter.',
    added: (count) => `${format.number(count)} ${one(count, 'écoute ajoutée', 'écoutes ajoutées')} à ton historique.`,
    notHistory:
      'Ce n’est pas un historique d’écoute que Jukebox sait lire. Choisis les fichiers que Last.fm, Spotify, Apple Music ou ListenBrainz t’ont donnés : CSV ou JSON, ou le zip dans lequel ils sont arrivés.',
    tooBig: 'Ce fichier est trop volumineux pour être lu.',
    failed: 'Les écoutes n’ont pas pu être importées. Rien n’a été modifié.',
  },
};
