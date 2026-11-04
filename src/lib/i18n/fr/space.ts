import { common } from './common.ts';
import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';

const NBSP = ' ';
const months = (count: number) => `${format.number(count)}${NBSP}mois`;
const times = (count: number) => (count === 1 ? 'une fois' : `${format.number(count)}${NBSP}fois`);

export const space: Strings['space'] = {
  title: 'Libérer de l’espace',
  rowNote: 'Les morceaux que tu n’écoutes jamais, que tu passes ou que tu as en double, et les plus gros fichiers',
  note: 'Des morceaux qui pourraient partir pour faire de la place sur le téléphone, chacun avec sa raison. Coche ceux à supprimer ; Android demande encore une fois avant de supprimer quoi que ce soit.',
  groups: {
    copy: 'Copies du même morceau',
    skipped: 'Souvent passés',
    neverPlayed: 'Jamais écoutés',
    forgotten: 'Pas écoutés depuis longtemps',
    large: 'Plus gros fichiers',
  },
  groupSize: (count, size) => `${common.songs(count)} · ${size}`,
  megabytes: (mb) => `${format.decimal(mb, 1)}${NBSP}Mo`,
  gigabytes: (gb) => `${format.decimal(gb, 1)}${NBSP}Go`,
  why: {
    copy: 'Une autre copie de ce morceau reste et reçoit ses écoutes',
    skipped: (skips, heard, after) =>
      heard === 0
        ? `Passé ${times(skips)}, en moyenne après ${format.number(after)} s, jamais écouté jusqu’au bout`
        : `Passé ${times(skips)}, en moyenne après ${format.number(after)} s, écouté jusqu’au bout ${times(heard)}`,
    neverPlayed: (added) => `Jamais écouté, sur le téléphone depuis le ${format.date(new Date(added))}`,
    forgotten: (last) => `Écouté pour la dernière fois le ${format.date(new Date(last))}`,
    large: 'Un des plus gros fichiers',
  },
  listSeparator: ', ',
  inLists: (names) => `Dans ${names}`,
  showHint: 'Affiche ou masque les morceaux de ce groupe',
  tickGroup: (group) => `Tout «${NBSP}${group}${NBSP}»`,
  delete: (count, size) => `Supprimer ${common.songs(count)} (${size})`,
  freed: (count, size) => `${common.songs(count)} ${one(count, 'supprimé', 'supprimés')}, ${size} d’espace libéré.`,
  notDeleted: 'Rien n’a été supprimé.',
  empty: 'Rien à libérer : chaque morceau a été écouté récemment, aucun n’est souvent passé et aucun n’est en double.',
  auto: {
    heading: 'Tout seul',
    title: 'Supprimer les téléchargements non écoutés',
    off: 'Désactivé. Les morceaux que Jukebox a téléchargés lui-même peuvent être supprimés tout seuls quand personne ne les a écoutés depuis un moment. Les fichiers arrivés autrement ne sont jamais touchés.',
    after: (count) =>
      `Les morceaux que Jukebox a téléchargés lui-même sont supprimés après ${months(count)} sans écoute, avec une vérification par jour. Jamais le morceau en cours, ni un fichier arrivé autrement.`,
    months: 'Mois sans écoute',
    monthCount: (count) => months(count),
    favorites: 'Aussi les morceaux des Favoris',
    lists: 'Aussi les morceaux des listes',
  },
};
