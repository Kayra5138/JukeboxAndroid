import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

export const smart: Strings['smart'] = {
  newList: 'Nouvelle liste intelligente',
  sign: 'Liste intelligente',
  detail: (count) => `${format.number(count)} ${one(count, 'morceau', 'morceaux')} · intelligente`,
  hint: 'Les morceaux qui remplissent ses règles, en ce moment',
  editRules: 'Modifier les règles',
  empty: 'Aucun morceau ne remplit ces règles pour l’instant. Modifie-les, ou écoute un peu et reviens voir.',

  editor: {
    newTitle: 'Nouvelle liste intelligente',
    editTitle: 'Modifier les règles',
    name: 'Nom',
    namePlaceholder: 'Nom de la liste',
    match: 'Un morceau doit remplir',
    all: 'Toutes les règles',
    any: 'Une des règles',
    rules: 'Règles',
    noRules: 'Pas encore de règle : tous les morceaux y sont.',
    addRule: 'Ajouter une règle',
    removeRule: (at) => `Retirer la règle ${format.number(at)}`,
    chooseField: 'Ce que la règle regarde',
    asksAbout: (field) => `Regarde : ${field}`,
    chooseTag: 'Choisir…',
    tagSheet: 'Choisis un tag',
    noTags: 'Pas encore de tags.',
    textPlaceholder: 'Saisis un nom',
    tagPlaceholder: 'Saisis un tag',
    valueOf: (field, op) => `${field} ${op}`,
    fromOf: (field) => `${field}, de`,
    toOf: (field) => `${field}, à`,
    and: 'et',
    limit: 'Combien',
    limitOff: 'Tous',
    limitOn: 'Au plus',
    order: 'Trier par',
    matching: (count) =>
      one(count, `${format.number(count)} morceau correspond`, `${format.number(count)} morceaux correspondent`),
    matchingKept: (count, kept) =>
      `${format.number(count)} ${one(count, 'morceau correspond', 'morceaux correspondent')} ; la liste en garde ${format.number(kept)}`,
    save: 'Enregistrer',
    create: 'Créer',
    problems: {
      name: 'Donne un nom à la liste.',
      text: 'Saisis ce qu’il faut chercher.',
      value: 'Ce nombre est hors limites.',
      range: 'Le second nombre est plus petit que le premier.',
      rule: (at) => `La règle ${format.number(at)} n’est pas terminée.`,
    },
  },

  fields: {
    tag: 'Tag',
    artist: 'Artiste',
    albumArtist: 'Artiste de l’album',
    album: 'Album',
    genre: 'Genre',
    title: 'Titre',
    year: 'Année',
    added: 'Ajouté',
    plays: 'Nombre d’écoutes',
    lastPlayed: 'Dernière écoute',
    skips: 'Nombre de passages',
    length: 'Durée',
  },

  ops: {
    is: 'est',
    isNot: 'n’est pas',
    contains: 'contient',
    notContains: 'ne contient pas',
    between: 'entre',
    year: { more: 'après', less: 'avant' },
    count: { more: 'plus de', less: 'moins de' },
    length: { more: 'plus long que', less: 'plus court que' },
    within: 'dans les derniers',
    before: 'il y a plus de',
    never: 'jamais',
  },

  units: {
    days: (count) => `${format.number(count)} ${one(count, 'jour', 'jours')}`,
    minutes: (count) => `${format.number(count)} min`,
    times: (count) => `${format.number(count)} fois`,
    songs: (count) => `${format.number(count)} ${one(count, 'morceau', 'morceaux')}`,
  },

  orders: {
    random: 'Aléatoire',
    mostPlayed: 'Les plus écoutés',
    leastPlayed: 'Les moins écoutés',
    newest: 'Ajoutés récemment',
    oldest: 'Ajoutés il y a longtemps',
    title: 'Titre',
  },
};
