import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const backup: Strings['backup'] = {
  imported: 'Importado',
  importedBody:
    'Tudo foi importado. O Jukebox precisa reiniciar para mostrar tudo: o que está na tela agora foi lido antes da importação.',
  restart: 'Reiniciar o Jukebox',

  question: 'Importar este backup?',
  /* [when] is a date already written out, so it follows "em": "Feito em 23/09/2026". */
  made: (when, app) =>
    `${when ? `Feito em ${when}` : 'Um backup'}${app ? ` pelo Jukebox ${app}` : ''}.`,
  listens: (count) => `${format.number(count)} ${oneOrMany(count, 'reprodução', 'reproduções')}`,
  tagged: (count) =>
    `${format.number(count)} ${oneOrMany(count, 'música com tags', 'músicas com tags')}`,
  withLyrics: (count) =>
    `${format.number(count)} ${oneOrMany(count, 'música com letra', 'músicas com letra')}`,

  songs: (found, total) => {
    if (total === 0) return 'O backup não menciona nenhuma música.';
    const missing = total - found;
    const kept = (one: boolean) =>
      one
        ? 'As reproduções dela são mantidas, mas as tags, a letra e as posições em listas ficam de fora, pois não há música à qual associá-las.'
        : 'As reproduções delas são mantidas, mas as tags, as letras e as posições em listas ficam de fora, pois não há música à qual associá-las.';
    if (total === 1) {
      return found === 1
        ? 'A única música do backup está na sua biblioteca.'
        : `A única música do backup não está neste celular. ${kept(true)}`;
    }
    const here =
      found === 0
        ? `Nenhuma das ${format.number(total)} músicas do backup está na sua biblioteca.`
        : `${format.number(found)} das ${format.number(total)} músicas do backup ${oneOrMany(found, 'está', 'estão')} na sua biblioteca.`;
    if (missing <= 0) return here;
    return missing === 1
      ? `${here} A outra não está neste celular. ${kept(true)}`
      : `${here} As outras ${format.number(missing)} não estão neste celular. ${kept(false)}`;
  },

  importing: 'Importando…',
  merge: 'Mesclar',
  mergeHint: 'Junta ao que já está aqui. Nada é removido deste celular.',
  replace: 'Substituir',
  replaceHint: 'Apaga o que está aqui e usa o backup no lugar. Isso não pode ser desfeito.',

  notABackup: 'Esse arquivo não é um backup do Jukebox.',
  newer: 'Esse backup foi feito por uma versão mais nova do Jukebox. Atualize o app para lê-lo.',
  needsBuildToExport: 'Instale a versão atualizada para Android para exportar.',
  needsBuildToImport: 'Instale a versão atualizada para Android para importar.',
};
