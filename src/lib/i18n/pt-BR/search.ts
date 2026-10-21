import { format } from './format.ts';
import { oneOrMany } from '../write.ts';
import type { Strings } from '../en/index.ts';

export const search: Strings['search'] = {
  modes: {
    discover: 'Descobrir',
    download: 'Baixar',
    videos: 'Vídeos',
    playlists: 'Playlists',
  },

  unavailable: {
    heading: 'Atualize o app para usar o YouTube',
    body: 'Instale a versão atualizada para Android para buscar e baixar músicas. Sua biblioteca continua disponível.',
    downloads: 'Instale uma versão nova para Android para ativar os downloads do YouTube.',
  },

  intro: {
    videos: 'Busque no YouTube ou cole o link de um vídeo. Salve o áudio na sua biblioteca.',
    playlist:
      'Busque uma playlist ou cole o link dela no YouTube. Abra um resultado para ver e baixar as faixas. As primeiras 500 entradas da playlist são verificadas.',
  },
  inputLabel: {
    videos: 'Busque no YouTube ou cole o link de um vídeo',
    playlist: 'Nome da playlist ou link do YouTube',
  },
  placeholder: {
    videos: 'Música, artista ou link do YouTube',
    playlist: 'Nome da playlist ou link do YouTube',
  },

  formats: { mp3: 'MP3', original: 'Áudio original' },
  formatHint: {
    mp3: 'Convertido para MP3 depois de baixar.',
    original: 'Mantém o codec de áudio da fonte quando possível.',
  },

  searching: 'Buscando no YouTube…',
  results: (count) => `Resultados · ${format.number(count)}`,
  empty: {
    none: 'Nenhum resultado. Tente outra busca ou outro link.',
    videos: 'Busque por música e artista para encontrar a gravação que você quer.',
    playlist: 'Busque pelo nome da playlist ou cole o link de uma playlist.',
  },

  playlist: 'Playlist',
  openPlaylist: 'Abrir playlist',
  openPlaylistLabel: (title) => `Abrir a playlist ${title}`,
  downloadLabel: (title) => `Baixar ${title}`,
  download: { mp3: 'Baixar MP3', original: 'Baixar áudio' },
  adding: 'Adicionando…',

  addingPlaylist: 'Adicionando a playlist…',
  downloadListed: {
    mp3: 'Baixar as faixas listadas · MP3',
    original: 'Baixar as faixas listadas · Áudio original',
  },
  listedHint:
    'Faixas já baixadas ou na fila são puladas. Vídeos privados, excluídos e ao vivo podem estar indisponíveis.',
  listCreated: (name) => `Lista criada: ${name}. As faixas baixadas vão aparecer na aba Listas.`,
  inLibrary: 'Na sua biblioteca',
  alreadyHave: (count) =>
    oneOrMany(count, '1 música já estava na sua biblioteca e não foi baixada de novo.', `${format.number(count)} músicas já estavam na sua biblioteca e não foram baixadas de novo.`),
  unnamedPlaylist: 'Playlist do YouTube',

  jobLine: (status, mp3) => `${status} · ${mp3 ? 'MP3' : 'Original'}`,

  status: {
    finding: 'Procurando no YouTube',
    queued: 'Na fila',
    preparing: 'Preparando…',
    downloading: (percent) => `Baixando · ${percent}%`,
    converting: 'Convertendo o áudio…',
    saving: 'Adicionando à biblioteca…',
    cancelling: 'Cancelando…',
    cancelled: 'Cancelado',
    failed: 'Falha no download',
    done: 'Na biblioteca',
    missing: 'Arquivo removido',
  },

  failed: {
    search: 'A busca falhou. Tente de novo.',
    queue: 'Não foi possível colocar o download na fila.',
    queuePlaylist: 'Não foi possível colocar a playlist na fila.',
    cancel: 'Não foi possível cancelar o download.',
    read: 'Não foi possível ler os downloads.',
    readReopen: 'Não foi possível ler os downloads. Abra a aba Buscar de novo.',
  },

  errors: {
    playlistLink: 'Cole o link de uma playlist do YouTube ou busque pelo nome da playlist.',
    videoLink: 'Digite o nome de uma música ou um link válido de vídeo do YouTube.',
    queueFull: 'A fila de downloads está cheia. Espere algumas faixas terminarem e tente de novo.',
    update:
      'O YouTube mudou, e o downloader desta versão ainda não consegue lê-lo. Procure uma versão mais nova em Downloads ou atualize o Jukebox.',
    unavailable: 'Este vídeo ou playlist está indisponível. Tente outra playlist pública ou outra busca.',
    unreachable: 'Não foi possível acessar o YouTube. Verifique sua conexão e tente de novo.',
    refused: 'O YouTube não conseguiu concluir este pedido. Tente mais tarde ou escolha outro resultado.',
  },
};
