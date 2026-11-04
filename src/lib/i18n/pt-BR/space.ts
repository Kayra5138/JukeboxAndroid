import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

const months = (count: number) => `${format.number(count)} ${oneOrMany(count, 'mês', 'meses')}`;
const times = (count: number) => oneOrMany(count, 'uma vez', `${format.number(count)} vezes`);

export const space: Strings['space'] = {
  title: 'Liberar espaço',
  rowNote: 'Músicas que você nunca ouve, pula ou tem duas vezes, e os arquivos maiores',
  note: 'Músicas que poderiam sair para abrir espaço no celular, cada uma com o motivo. Marque as que você quer apagar; o Android pergunta mais uma vez antes de excluir qualquer coisa.',
  groups: {
    copy: 'Cópias da mesma música',
    skipped: 'Puladas com frequência',
    neverPlayed: 'Nunca tocadas',
    forgotten: 'Sem tocar há muito tempo',
    large: 'Arquivos maiores',
  },
  groupSize: (count, size) => `${common.songs(count)} · ${size}`,
  megabytes: (mb) => `${format.decimal(mb, 1)} MB`,
  gigabytes: (gb) => `${format.decimal(gb, 1)} GB`,
  why: {
    copy: 'Outra cópia desta música fica e recebe as reproduções dela',
    skipped: (skips, heard, after) =>
      heard === 0
        ? `Pulada ${times(skips)}, em média aos ${format.number(after)} s, nunca ouvida até o fim`
        : `Pulada ${times(skips)}, em média aos ${format.number(after)} s, ouvida até o fim ${times(heard)}`,
    neverPlayed: (added) => `Nunca tocada, no celular desde ${format.date(new Date(added))}`,
    forgotten: (last) => `Tocada pela última vez em ${format.date(new Date(last))}`,
    large: 'Um dos arquivos maiores',
  },
  listSeparator: ', ',
  inLists: (names) => `Em ${names}`,
  showHint: 'Mostra ou oculta as músicas deste grupo',
  tickGroup: (group) => `Tudo de ${group}`,
  delete: (count, size) => `Excluir ${common.songs(count)} (${size})`,
  freed: (count, size) => `${common.songs(count)} ${oneOrMany(count, 'excluída', 'excluídas')}, ${size} liberados.`,
  notDeleted: 'Nada foi excluído.',
  empty: 'Nada para liberar: todas as músicas foram ouvidas recentemente, nenhuma é pulada com frequência e nenhuma está duas vezes.',
  auto: {
    heading: 'Automaticamente',
    title: 'Excluir downloads não ouvidos',
    off: 'Desativado. As músicas que o Jukebox baixou sozinho podem ser excluídas automaticamente quando ninguém as ouve há um tempo. Arquivos que chegaram de outro jeito nunca são tocados.',
    after: (count) =>
      `As músicas que o Jukebox baixou sozinho são excluídas depois de ${months(count)} sem serem ouvidas; a verificação é feita uma vez por dia. Nunca a música que está tocando, nem um arquivo que chegou de outro jeito.`,
    months: 'Meses sem ouvir',
    monthCount: (count) => months(count),
    favorites: 'Também músicas em Favoritas',
    lists: 'Também músicas em listas',
  },
};
