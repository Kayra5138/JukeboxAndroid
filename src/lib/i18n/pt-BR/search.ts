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

  tapes: {
    intro:
      'Audiolivros, podcasts, palestras e gravações longas do YouTube, baixados na pasta Tapes da sua biblioteca e que continuam de onde você parou. Pesquise ou cole o link de um vídeo ou de uma playlist, ou o de um canal para segui-lo.',
    placeholder: { videos: 'Título, programa ou link do YouTube', playlist: 'Livro, série ou link da playlist' },
    empty: { videos: 'Pesquise um livro, um programa, uma palestra ou uma aula.', playlist: 'Pesquise uma playlist para baixar como uma fita só: um livro em partes ou uma temporada de um programa.' },
    download: 'Baixar como fita',
    downloadBook: (count) => `Baixar todos os ${format.number(count)} como uma fita só`,
    bookHint: 'Eles vão para uma pasta com o nome da lista, numerados na ordem dela, e tocam um depois do outro.',
    added: (name) => `A caminho de Tapes/${name}`,
    sources: { youtube: 'YouTube', podcasts: 'Seguir', books: 'Livros', files: 'Telefone' },
    /** Books from the Internet Archive: see `books/archive.ts`, `BooksPane` and the book screen. */
    /** Files on the phone brought into the Tapes folder: see `FilesPane`. */
    files: {
      intro: 'Livros, gravações e palestras que já estão no seu telefone, copiados para uma pasta das suas fitas. Os arquivos escolhidos ficam onde estão.',
      choose: 'Escolher arquivos',
      chooseOther: 'Escolher outros arquivos',
      folder: 'Nome da pasta',
      folderPlaceholder: 'Como se chama o livro ou a gravação',
      folderNote: 'Vão para a pasta de fitas da sua biblioteca com este nome, na ordem dos números.',
      copy: (count) => oneOrMany(count, 'Copiar para as fitas', `Copiar ${format.number(count)} arquivos para as fitas`),
      chosen: (count) => oneOrMany(count, '1 arquivo escolhido', `${format.number(count)} arquivos escolhidos`),
      copied: (done, of) => done === of ? oneOrMany(done, 'Copiado para as suas fitas.', `${format.number(done)} arquivos copiados para as suas fitas.`) : `Copiados ${format.number(done)} de ${format.number(of)} arquivos; o resto não pôde ser lido.`,
      failed: 'Nenhum arquivo pôde ser copiado.',
      pickFailed: 'Não foi possível escolher os arquivos.',
      toTapes: 'Ir para as fitas',
    },
    books: {
      intro: 'Livros em domínio público lidos em voz alta por voluntários do LibriVox e guardados de graça no Internet Archive. Busque por título ou autor, ou cole o endereço de algo para ouvir no archive.org.',
      placeholder: 'Título, autor ou link do archive.org',
      nothingFound: 'Nenhum livro encontrado.',
      searchFailed: 'Não foi possível buscar no Internet Archive.',
      anyLanguage: 'Todos os idiomas',
      popular: 'Os mais ouvidos',
      bookFailed: 'Não foi possível ler esse livro do Internet Archive.',
      stats: (parts, minutes, here) => `${oneOrMany(parts, '1 parte', `${format.number(parts)} partes`)} · ${minutes >= 60 ? `${format.number(Math.floor(minutes / 60))} h ${format.number(minutes % 60)} min` : `${format.number(minutes)} min`}${here > 0 ? ` · ${format.number(here)} no telefone` : ''}`,
      fetchAll: 'Baixar o livro inteiro',
      fetchRest: (count) => oneOrMany(count, 'Baixar a última parte', `Baixar as outras ${format.number(count)} partes`),
      size: (mb) => `Cerca de ${format.number(mb)} MB no total`,
      parts: (count) => oneOrMany(count, '1 parte', `${format.number(count)} partes`),
    },
    podcasts: {
      intro: 'Siga um podcast ou um canal do YouTube e os episódios novos chegam sozinhos às suas fitas, ou abra-o e baixe só os episódios que quiser. Busque, ou cole o endereço de um feed ou de um canal.',
      /** Under the button on a show not followed: that its episodes can be had without following it. */
      withoutFollowing: 'Não precisa seguir para ouvir: baixe abaixo o episódio que quiser. Seguindo, os novos chegam sozinhos.',
      /** Where podcasts can be had from: said under the intro. */
      /** The title of a followed or followable show's own screen, a podcast or a YouTube channel. */
      showTitle: 'Programa',
      sources: 'De onde: qualquer programa do diretório de podcasts da Apple, que tem quase todo podcast com feed público, inclusive a maioria dos do Spotify; qualquer endereço de feed, do Anchor, Buzzsprout, Libsyn, Podbean, SoundCloud e outros; e canais do YouTube.',
      placeholder: 'Nome do podcast ou canal, ou um link',
      searchFailed: 'Não foi possível pesquisar podcasts. Verifique sua conexão.',
      feedFailed: 'Não foi possível ler o feed deste podcast.',
      notChannel: 'Esse não é o endereço de um canal do YouTube, ou o canal não foi encontrado.',
      channelsHeading: 'Canais do YouTube',
      podcastsHeading: 'Podcasts',
      subscribers: (count) => oneOrMany(count, '1 inscrito', `${format.number(count)} inscritos`),
      channelsFailed: 'Não foi possível buscar canais no YouTube.',
      nothingFound: 'Nenhum podcast encontrado.',
      yours: 'Seus podcasts',
      noneYet: 'Você ainda não segue nenhum podcast.',
      wifiOnly: 'Episódios novos só no Wi‑Fi',
      wifiOnlyNote: 'Os episódios dos podcasts que você segue só baixam sozinhos no Wi‑Fi. Você ainda pode baixar qualquer episódio na mão.',
      follow: 'Seguir',
      following: 'Seguindo',
      unfollow: 'Deixar de seguir',
      autoDownload: 'Baixar os episódios mais recentes',
      autoDownloadNote: (keep) => oneOrMany(keep, 'O episódio mais recente fica baixado.', `Os ${format.number(keep)} episódios mais recentes ficam baixados.`),
      keep: (count) => format.number(count),
      episodes: (count) => `Episódios · ${format.number(count)}`,
      noEpisodes: 'Este feed não tem episódios com arquivo.',
      download: 'Baixar',
      continue: 'Continuar',
      start: 'Começar',
      more: 'Mais',
      less: 'Menos',
      stats: (total, here) => `${format.number(total)} ${oneOrMany(total, 'episódio', 'episódios')} · ${format.number(here)} no celular`,
      play: 'Tocar',
      /** The episodes shown by when they came out: see `podcasts/when.ts`. */
      when: { label: 'Quando', all: 'Todos', week: 'Última semana', month: 'Último mês', quarter: 'Últimos 3 meses' },
      newest: 'Mais recentes primeiro',
      oldest: 'Mais antigos primeiro',
      noneThen: 'Nenhum episódio desse período.',
      fetchNext: 'Baixar os próximos episódios',
      fetchNextNote: (count) =>
        oneOrMany(count, 'Enquanto você ouve um episódio antigo, o seguinte é baixado para estar pronto quando este acabar.', `Enquanto você ouve um episódio antigo, os ${format.number(count)} seguintes são baixados para que o próximo esteja pronto ao fim de cada um.`),
      line: (date, length) => [date, length].filter(Boolean).join(' · '),
    },
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
  backToResults: 'Voltar aos resultados',
  openPlaylistLabel: (title) => `Abrir a playlist ${title}`,
  downloadLabel: (title) => `Baixar ${title}`,
  download: { mp3: 'Baixar MP3', original: 'Baixar áudio' },
  adding: 'Adicionando…',
  listen: 'Ouvir',
  listenLabel: (title) => `Ouvir ${title} sem guardar`,
  readying: 'Preparando…',
  listenDrop: 'Não guardar',

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
    listened: 'Pronta, não guardada',
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
