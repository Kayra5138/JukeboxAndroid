import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

/*
  Portuguese tells one from many, and zero counts as many in the app's
  Brazilian usage: "1 faixa", "0 faixas", "2 faixas". `oneOrMany` is exactly
  that rule.
*/
export const common: Strings['common'] = {
  cancel: 'Cancelar',
  save: 'Salvar',
  done: 'Concluído',
  ok: 'OK',
  close: 'Fechar',
  back: 'Voltar',
  delete: 'Excluir',
  remove: 'Remover',
  add: 'Adicionar',
  edit: 'Editar',
  rename: 'Renomear',
  yes: 'Sim',
  no: 'Não',
  tryAgain: 'Tentar de novo',
  retry: 'Tentar de novo',
  import: 'Importar',
  clear: 'Limpar',
  selectAll: 'Selecionar tudo',
  off: 'Desativado',
  saved: 'Salvo.',
  loading: 'Carregando…',

  search: 'Buscar',
  clearSearch: 'Limpar a busca',

  play: 'Tocar',
  pause: 'Pausar',
  nextTrack: 'Próxima faixa',
  previousTrack: 'Faixa anterior',
  shuffle: 'Aleatório',
  addToQueue: 'Adicionar à fila',
  moveUp: 'Mover para cima',
  moveDown: 'Mover para baixo',

  unknownArtist: 'Artista desconhecido',
  unknownAlbum: 'Álbum desconhecido',

  tracks: (count) => `${format.number(count)} ${oneOrMany(count, 'faixa', 'faixas')}`,
  songs: (count) => `${format.number(count)} ${oneOrMany(count, 'música', 'músicas')}`,
  albums: (count) => `${format.number(count)} ${oneOrMany(count, 'álbum', 'álbuns')}`,
  artists: (count) => `${format.number(count)} ${oneOrMany(count, 'artista', 'artistas')}`,
  lists: (count) => `${format.number(count)} ${oneOrMany(count, 'lista', 'listas')}`,
  files: (count) => `${format.number(count)} ${oneOrMany(count, 'arquivo', 'arquivos')}`,
  minutes: (count) => `${format.number(count)} min`,
  hours: (count) => `${format.number(count)} h`,

  fileUnreadable: 'Não foi possível ler esse arquivo.',
  pictureFailed: 'Não foi possível carregar essa imagem.',

  drawFailed: 'Algo deu errado ao exibir esta tela.',
};
