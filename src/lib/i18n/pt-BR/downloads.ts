import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

/* "baixando" and "aguardando" do not change with the count, so the short lines need no chooser. */
export const downloads: Strings['downloads'] = {
  short: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `Pausado · ${format.number(waiting)} aguardando` : 'Pausado';
    if (underWay > 0 && waiting > 0) return `${format.number(underWay)} baixando, ${format.number(waiting)} aguardando`;
    if (underWay > 0) return `${format.number(underWay)} baixando`;
    return waiting > 0 ? `${format.number(waiting)} aguardando` : '';
  },
  state: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `Pausado, ${format.number(waiting)} aguardando` : 'Pausado';
    if (underWay > 0 && waiting > 0) return `Baixando ${format.number(underWay)}, ${format.number(waiting)} aguardando`;
    if (underWay > 0) return `Baixando ${format.number(underWay)}`;
    return waiting > 0 ? `${format.number(waiting)} aguardando` : 'Nada está sendo baixado';
  },
  pausedNote: 'Nada novo começa até você retomar. O que já está sendo baixado termina.',
  automaticNote: (count) =>
    count === 1
      ? 'Um download é automático: foi pedido pelo Descobrir. Ele espera até que nada mais esteja sendo baixado.'
      : `${format.number(count)} downloads são automáticos: foram pedidos pelo Descobrir. Eles esperam até que nada mais esteja sendo baixado.`,

  pause: 'Pausar',
  resume: 'Retomar',
  cancelAll: 'Cancelar tudo',
  cancelAllQuestion: 'Cancelar todos os downloads?',
  cancelAllHint: 'Tudo o que está aguardando e tudo o que está sendo baixado é cancelado. O que já está na sua biblioteca fica.',
  keep: 'Manter',

  sections: { now: 'Agora', next: 'A seguir', history: 'Histórico' },
  clear: 'Limpar',
  clearLabel: 'Limpar o histórico de downloads',

  source: {
    discover: 'Descobrir',
    search: 'Buscar',
    album: (name) => `Álbum: ${name}`,
    playlist: (name) => `Playlist: ${name}`,
  },
  automatic: 'Automático · espera os outros',
  retrying: (why) => (why ? `Tentando de novo · ${why}` : 'Tentando de novo'),

  doNext: 'Passar à frente',
  doNextLabel: (title) => `Baixar ${title} em seguida`,
  cancelLabel: (title) => `Cancelar ${title}`,
  retryLabel: (title) => `Tentar baixar ${title} de novo`,
  moveUp: 'Mover para cima',
  moveDown: 'Mover para baixo',

  empty: {
    heading: 'Nenhum download ainda',
    body: 'O que você baixar pela aba Buscar, pelo Descobrir ou para completar um álbum aparece aqui, com o que ainda está aguardando a vez.',
  },
  unavailable: 'Instale uma versão nova para Android para baixar músicas.',
  readFailed: 'Não foi possível ler os downloads.',

  extractor: {
    heading: 'Downloader do YouTube',
    version: (version) => `yt-dlp ${version}`,
    current: 'Atualizado',
    available: (version) => `${version} disponível`,
    unchecked: 'Ainda não foi verificado se há uma versão mais nova',
    checked: (days) =>
      days === 0 ? 'verificado hoje' : days === 1 ? 'verificado ontem' : `verificado há ${format.number(days)} dias`,
    check: 'Verificar atualização',
    checking: 'Verificando…',
    update: 'Atualizar',
    waiting: 'Aguardando o download atual terminar…',
    downloading: (version, percent) => `Baixando ${version} · ${format.number(percent)}%`,
    trying: 'Testando a nova versão…',
    restoring: 'Restaurando a versão que veio com o Jukebox…',
    updated: (version) => `Agora na versão ${version}. Os downloads que falharam podem ser tentados de novo.`,
    restore: (version) => `Voltar para a versão ${version}, que veio com o Jukebox`,
    checkFailed: 'Não foi possível verificar se há atualização.',
    trouble: {
      network: 'Não foi possível acessar o GitHub. Verifique a conexão e tente de novo.',
      answer: 'O GitHub não respondeu com uma versão publicada. Tente mais tarde.',
      checksum: 'O arquivo recebido não corresponde ao indicado na versão publicada. Nada foi alterado.',
      broken: 'A nova versão não funciona neste celular. A que você tinha continua no lugar.',
      failed: 'Não foi possível atualizar. A versão que você tinha continua no lugar.',
    },
    rowUpdate: 'Atualizar',
    rowCheck: 'Verificar',
    rowUpdateLabel: (title) => `Atualizar o downloader do YouTube para tentar ${title} de novo`,
    rowCheckLabel: (title) => `Procurar um downloader do YouTube mais novo para tentar ${title} de novo`,
  },

  button: {
    label: (state) => (state ? `Downloads: ${state}` : 'Downloads'),
    finished: 'concluídos',
    heading: 'Downloads',
    idle: 'Nada está sendo baixado agora',
    paused: 'Pausado',
    allDone: 'Tudo concluído',
    waiting: (count) => `${format.number(count)} aguardando`,
    done: (count) => `${format.number(count)} ${oneOrMany(count, 'concluído', 'concluídos')}`,
    failed: (count) => `${format.number(count)} com falha`,
    open: 'Abrir downloads',
  },
};
