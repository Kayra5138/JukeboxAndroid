import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const library: Strings['library'] = {
  views: {
    tracks: 'Faixas',
    albums: 'Álbuns',
    artists: 'Artistas',
    folders: 'Pastas',
    tapes: 'Fitas',
  },

  tapes: {
    left: (minutes) => `faltam ${format.number(minutes)} min`,
    played: 'Ouvido',
    heard: (heard, total) => `${format.number(heard)} / ${format.number(total)} min`,
    add: 'Adicionar fitas',
    settings: 'Ajustes das fitas',
    /** A followed show's arrow, which lays its episodes out under it and folds them away. */
    showEpisodes: 'Mostrar episódios',
    hideEpisodes: 'Ocultar episódios',
    /** A tape's own details screen: see `app/tape.tsx`. */
    details: {
      title: 'Detalhes da fita',
      listening: 'Audição',
      heard: 'Ouvido',
      notBegun: 'Ainda não começada',
      lastHeard: 'Última vez ouvida',
      part: 'Parte',
      partOf: (at, of) => `${format.number(at)} de ${format.number(of)}`,
      speed: 'Velocidade',
      marks: 'Marcas',
      source: 'Origem',
      from: 'Procedência',
      kinds: { youtube: 'Um vídeo do YouTube', playlist: 'Uma playlist do YouTube', podcast: 'Um episódio de podcast', book: 'Um livro do LibriVox', byHand: 'Colocada à mão na pasta de fitas' },
      show: 'Programa',
      book: 'Livro',
      channel: 'Canal',
      list: 'Playlist',
      published: 'Lançado',
      fetched: 'Baixada',
      chapters: 'Capítulos',
      skipped: 'Partes puladas',
      skippedUnknown: 'Verificado na próxima vez que tocar',
      skippedOff: 'Desativado nos ajustes de fitas',
      skippedTrouble: 'Não foi possível falar com o SponsorBlock; tenta de novo na próxima vez que tocar',
      skippedNone: 'Nada marcado',
      skippedSome: (count, seconds) => `${oneOrMany(count, '1 parte', `${format.number(count)} partes`)} · ${format.number(seconds)} s`,
      address: 'Endereço',
      listAddress: 'Endereço da playlist',
      openSeries: 'Abrir o programa',
      file: 'Arquivo',
      name: 'Nome',
      folder: 'Pasta',
      format: 'Formato',
      size: 'Tamanho',
      megabytes: (mb) => `${format.number(mb)} MB`,
      added: 'Chegou ao telefone',
      missing: 'Esta fita não está mais na biblioteca.',
    },
    seriesHeading: 'Seguindo',
    singlesHeading: 'Fitas',
    booksHeading: 'Livros',
    /** The tapes view's filter: all of it, or one of its parts. */
    filter: { all: 'Tudo', series: 'Seguindo', books: 'Livros', tapes: 'Fitas' },
    seriesLine: (count, fresh) => `${format.number(count)} ${oneOrMany(count, 'episódio', 'episódios')}${fresh > 0 ? ` · ${format.number(fresh)} ${oneOrMany(fresh, 'novo', 'novos')}` : ''}`,
    seriesNone: 'Nenhum episódio baixado ainda',
    /** A folder of several tapes as one row: how many parts, and how many of them not begun. */
    bookLine: (count, fresh) => `${format.number(count)} partes${fresh > 0 ? ` · ${format.number(fresh)} não começadas` : ''}`,
    count: (count) => `${format.number(count)} ${oneOrMany(count, 'fita', 'fitas')}`,
    /** Over the tapes view while tapes are being chosen. */
    selected: (count) => `${format.number(count)} ${oneOrMany(count, 'fita selecionada', 'fitas selecionadas')}`,
    empty: (folder) => `Coloque audiolivros, podcasts e gravações longas numa pasta chamada Tapes dentro da pasta da biblioteca (${folder}). Eles aparecem aqui, continuam de onde você parou e ficam fora das suas músicas.`,
    markPlayed: 'Marcar como ouvido',
    markUnplayed: 'Marcar como não ouvido',
  },

  nothingMatches: (query) => `Nada corresponde a “${query}”.`,
  noAlbums:
    'Nenhum álbum ainda. Um álbum só aparece depois que as faixas dele são consultadas — a pasta em que um arquivo está não é um álbum.',
  back: '‹ Voltar',
  trackMenu: 'Opções da faixa',
  albumMenu: 'Opções do álbum',

  screen: {
    searchYouTube: (query: string) => `Buscar “${query}” no YouTube`,
    viewSwitch: 'Modo de exibição da biblioteca',
    searchHints: {
      tracks: 'Títulos, artistas e tags',
      albums: 'Títulos, artistas e tags',
      artists: 'Buscar artistas',
      folders: 'Buscar pastas',
      tapes: 'Buscar fitas, programas e autores',
    },
    sort: 'Ordem',
    /*
      The button is 56 points wide and also stands over albums, so the added
      order is "Recentes", which has no gender; "Tocadas" is last played.
    */
    sortShort: { name: 'A–Z', added: 'Recentes', played: 'Tocadas' },
    sortedBy: {
      name: 'Em ordem alfabética',
      added: 'Ordenado por data de adição',
      played: 'Ordenado pela última reprodução',
    },
    sortHint: 'Muda a ordem da biblioteca',
    groupSortShort: { name: 'A–Z', tracks: 'Faixas', played: 'Reprod.', added: 'Recentes' },
    groupSortedBy: {
      name: 'Em ordem alfabética',
      tracks: 'Ordenado por número de faixas',
      played: 'Ordenado pelo número de reproduções',
      added: 'Ordenado pelo que foi adicionado mais recentemente',
    },

    selectTracks: 'Selecionar faixas',
    stopSelecting: 'Parar de selecionar',
    selected: (count) =>
      `${format.number(count)} ${oneOrMany(count, 'faixa selecionada', 'faixas selecionadas')}`,
    addToList: 'Adicionar à lista',
    addTag: 'Adicionar tag',
    writeToFiles: 'Gravar nos arquivos',
    writeToFilesSpoken: 'Gravar os detalhes das faixas selecionadas nos arquivos delas',

    swipePlayNext: 'Tocar a seguir',
    swipeQueue: 'Para a fila',
    queuedAll: (count) =>
      oneOrMany(count, '1 faixa adicionada à fila', `${format.number(count)} faixas adicionadas à fila`),

    needsAccess: 'O Jukebox precisa de acesso ao áudio deste aparelho.',
    nothingIn: (folder) => `Nada em ${folder}.`,
    shuffleAll: 'Embaralhar tudo',
    playsEverythingBelow: 'O Jukebox toca tudo dentro dessa pasta, incluindo as subpastas.',
    chooseFolderInSettings: 'Escolha a pasta da sua biblioteca em Ajustes.',

    folders: (count) => `${format.number(count)} ${oneOrMany(count, 'pasta', 'pastas')}`,
    noFolders: 'Nenhuma destas faixas diz em que pasta está.',
    shuffleTag: (tag) => `Embaralhar “${tag}”`,
  },

  row: {
    opensTracks: 'Abre as faixas',
    selectsTracks: 'Seleciona todas as faixas',
    select: 'Selecionar as faixas',
  },

  rack: {
    open: (album) => `Abrir ${album}`,
    openHint: 'Mostra as faixas do álbum',
    bringForward: 'Traz este álbum para a frente',
  },

  albumActions: {
    select: { label: 'Selecionar', hint: 'As faixas dele e, depois, qualquer outra coisa em que você tocar' },
    rest: {
      label: 'Encontrar o resto deste álbum',
      hint: 'As faixas dele que você ainda não tem',
    },
    lookUp: {
      label: 'Consultar este álbum',
      hint: 'Os detalhes e a capa, consultando o álbum inteiro de uma vez',
    },
    cover: {
      label: 'Escolher a capa do álbum',
      hint: 'Uma imagem da sua galeria, para todas as faixas dele',
    },
  },

  albumTools: {
    lookingUp: (done, total) =>
      `Consultando o álbum… ${format.number(done)} de ${format.number(total)}`,
    stop: 'Parar a consulta',
    lookedUp: (found, covers) =>
      found === 0 && covers === 0
        ? 'Nada de novo foi encontrado para este álbum.'
        : covers === 0
          ? `Detalhes encontrados para ${common.tracks(found)}.`
          : found === 0
            ? `Capa encontrada para ${common.tracks(covers)}.`
            : `Detalhes encontrados para ${common.tracks(found)} e capa para ${common.tracks(covers)}.`,
    offline: 'Nada respondeu. Confira a conexão e tente de novo.',
    failed: 'A consulta parou inesperadamente.',
    coverChosen: (count) => `A capa agora está em ${common.tracks(count)}.`,
  },

  rest: {
    looking: 'Consultando o álbum…',
    release: (count, year) => (year ? `${common.tracks(count)}, ${year}` : common.tracks(count)),
    have: (have, total) => `Você tem ${format.number(have)} de ${format.number(total)}.`,
    complete: 'Você tem o álbum inteiro.',
    rivals: 'Há mais de um álbum com esse nome. Este é o que melhor corresponde às suas faixas.',
    unsure:
      'Nenhuma das suas faixas foi reconhecida nele, então nada foi marcado. Confira primeiro se este é o álbum certo.',
    disc: (disc) => `Disco ${format.number(disc)}`,
    ordered: (count) =>
      oneOrMany(
        count,
        '1 faixa foi colocada na ordem do álbum.',
        `${format.number(count)} faixas foram colocadas na ordem do álbum.`
      ),
    undoOrder: 'Desfazer',

    lookingTube: 'Procurando no YouTube…',
    readingTube: 'Lendo o álbum…',
    source: {
      musicbrainz: 'Lista de faixas do MusicBrainz',
      youtube: (playlist, channel) =>
        `Lista de faixas do YouTube: ${[playlist, channel].filter(Boolean).join(' · ')}`,
    },
    other: { youtube: 'Procurar no YouTube', musicbrainz: 'Usar o MusicBrainz' },
    onTrust:
      'Lista tirada do álbum do YouTube com esse nome. Você tem poucas faixas dele para comparar, então revise a lista antes de baixar.',
    tubeNotFound: 'Nenhuma playlist do YouTube pôde ser confirmada como este álbum.',

    ticks: 'Marcada para baixar',
    waiting: 'Aguardando a vez',
    searching: 'Procurando no YouTube…',
    noMatch: 'Nenhuma gravação correspondente foi encontrada',
    searchFailed: 'A busca não foi concluída',
    byHand: 'Buscar manualmente',
    byHandLabel: (title) => `Buscar ${title} manualmente`,

    download: (count) => `Baixar ${format.number(count)} ${oneOrMany(count, 'faixa', 'faixas')}`,
    nothingTicked: 'Marque as faixas para baixar',
    stop: 'Parar a busca',

    failed: {
      unnamed:
        'Não é possível consultar este álbum. Ele precisa de um nome e de um artista que a maioria das faixas tenha em comum.',
      notFound: 'O MusicBrainz não tem nenhum álbum desse artista com esse nome.',
      offline: 'Não foi possível acessar o MusicBrainz. Verifique sua conexão e tente de novo.',
      throttled: 'O MusicBrainz pediu para ir mais devagar. Espere um minuto e tente de novo.',
      failed: 'Não foi possível consultar o álbum.',
      gone: 'Este álbum não está mais na biblioteca.',
      neither:
        'Este álbum não foi encontrado. O MusicBrainz não o lista, e nenhuma playlist do YouTube pôde ser confirmada como ele.',
      tube: 'Não foi possível consultar o álbum no YouTube.',
      tooOld:
        'Esta versão do Jukebox não consegue consultar álbuns no YouTube. Instale uma versão mais nova para Android.',
    },
  },

  menu: {
    playNext: { label: 'Tocar a seguir', hint: 'Logo depois da faixa atual' },
    addToQueue: { label: common.addToQueue, hint: 'No fim' },
    playSimilar: { label: 'Tocar com músicas parecidas', hint: 'Esta, depois um grupo de músicas parecidas' },
    playOnly: { label: 'Tocar só esta', hint: 'A fila fica só com esta música' },
    playFromStart: { label: 'Tocar do começo', hint: 'Onde parou é esquecido' },
    series: { label: 'Abrir o programa', hint: 'Os episódios e como os novos são baixados' },
    tapeFolder: { label: 'Abrir a pasta', hint: 'Todo o resto da pasta dele' },
    tapeDetails: { label: 'Ver detalhes', hint: 'Até onde você ouviu, de onde veio e o arquivo' },
    album: { label: 'Ir para o álbum', hint: 'O resto do álbum, em ordem' },
    addToPlaylist: { label: 'Adicionar a uma lista', hint: 'Uma das suas listas ou uma nova' },
    favoriteAdd: { label: "Adicionar às Favoritas", hint: "A lista que o coração enche, as mais novas no topo" },
    favoriteRemove: { label: "Tirar das Favoritas", hint: "Fora da lista que o coração enche" },
    tiles: { label: 'Jogar piano tiles', hint: 'Teclas caindo no ritmo desta faixa' },
    details: {
      label: 'Ver e editar detalhes',
      hint: 'Nomes, capa, tags e letra, cada um com sua consulta',
    },
    delete: { label: 'Excluir do celular', hint: 'Apaga o próprio arquivo, não só esta linha' },
  },

  folders: {
    needsAccess:
      'O Jukebox precisa de acesso ao áudio deste aparelho antes de poder listar pastas.',
    note: 'O Jukebox toca tudo dentro da pasta que você escolher, incluindo as subpastas. Escolher uma subpasta é a forma de deixar de fora toques de celular e sons de jogos.',
    everything: (path) => `${path}  (tudo)`,
  },

  leftOut: {
    title: 'Pastas deixadas de fora',
    none: 'Nenhuma. Desative pastas de mensagens de voz, gravações ou toques.',
    some: (count) =>
      `${format.number(count)} ${oneOrMany(count, 'pasta fora', 'pastas fora')} da biblioteca`,
    note: 'Uma pasta desativada fica fora da biblioteca, junto com todas as pastas dentro dela. Nenhum arquivo é excluído: as reproduções, tags e posições nas suas listas são mantidas e voltam quando você a ativar de novo.',
    within: 'Fora junto com a pasta em que está',
    spoken: (path, count) => `${path}, ${format.number(count)} ${oneOrMany(count, 'faixa', 'faixas')}`,
    hint: 'Ativada, a pasta está na biblioteca; desativada, fica de fora',
    empty: (root) => `Não há pastas com música dentro de ${root}.`,
  },

  shortFiles: {
    title: 'Ocultar arquivos curtos',
    note: 'Deixa de fora mensagens de voz, toques e sons de notificação pela duração. Nenhum arquivo é excluído.',
    under: (seconds) => `Menos de ${format.number(seconds)} s`,
    shorterThan: (seconds) => `Menos de ${format.number(seconds)} segundos`,
  },

  autoWrite: {
    heading: "Nos arquivos",
    edits: { title: "Gravar o que eu salvo no arquivo", note: "Ao salvar os detalhes de uma música, sozinha ou várias de uma vez, eles vão também para o arquivo, como faria Gravar no arquivo. O Android pergunta antes nos arquivos que o Jukebox não baixou." },
    lookups: { title: "Gravar o que as buscas encontram", note: "Os detalhes de uma música que uma busca encontrou e que você não editou são gravados no arquivo. Os downloads do Jukebox na hora, mesmo em segundo plano. Os outros arquivos esperam e são perguntados juntos na próxima vez que o app abrir. Uma música tocando espera a próxima vez." },
  },
  copies: {
    title: 'Cópias da mesma música',
    some: (count) =>
      oneOrMany(count, '1 música está mais de uma vez na sua biblioteca', `${format.number(count)} músicas estão mais de uma vez na sua biblioteca`),
    review: 'Revisar',
    reviewHint: 'Abre as cópias para escolher qual manter',
    note: 'Estes arquivos parecem a mesma gravação salva mais de uma vez: o mesmo nome, ou o mesmo artista e título, e a mesma duração com no máximo dois segundos de diferença. Uma cópia de cada é mantida. Antes de as outras serem excluídas, as reproduções, tags, letras e posições em listas delas passam para essa cópia.',
    empty: 'Nenhuma música está mais de uma vez na sua biblioteca.',
    cleanAll: (count) => `Limpar todas (${format.number(count)})`,
    confirmAll: (files, songs) =>
      `Excluir ${oneOrMany(files, '1 arquivo', `${format.number(files)} arquivos`)}? Uma cópia de ${oneOrMany(songs, 'a música', `cada uma das ${format.number(songs)} músicas`)} é mantida, e as reproduções, tags, letras e posições em listas de cada arquivo excluído passam antes para ela. O Android pergunta mais uma vez antes de excluir qualquer coisa.`,
    confirm: (files) => `Excluir ${oneOrMany(files, '1 arquivo', `${format.number(files)} arquivos`)}`,
    deleteOthers: (count) =>
      oneOrMany(count, 'Excluir a outra cópia', `Excluir as outras ${format.number(count)} cópias`),
    different: 'São músicas diferentes',
    choose: 'Qual cópia manter',
    keepHint: 'Mantém esta cópia e exclui as outras',
    keeps: 'Fica',
    goes: 'Sai',
    why: {
      listens: 'Sugerida porque tem mais reproduções.',
      described: 'Sugerida porque tem detalhes ou capa.',
      folder: 'Sugerida porque está na pasta da biblioteca.',
      larger: 'Sugerida porque é o arquivo maior.',
      older: 'Sugerida porque é o arquivo mais antigo.',
      alike: 'As cópias são iguais; qualquer uma serve.',
    },
    yourChoice: 'Fica a cópia que você escolheu.',
    holds: (copy) => {
      const parts = [
        copy.listens > 0
          ? oneOrMany(copy.listens, '1 reprodução', `${format.number(copy.listens)} reproduções`)
          : 'nenhuma reprodução',
      ];
      if (copy.described) parts.push('detalhes');
      if (copy.cover) parts.push('capa');
      if (copy.outside) parts.push('fora da pasta da biblioteca');
      return parts.join(' · ');
    },
    deleted: (count) => oneOrMany(count, '1 arquivo excluído.', `${format.number(count)} arquivos excluídos.`),
    notDeleted: 'Os arquivos não foram excluídos. As reproduções e o resto agora estão na cópia que fica.',
    failed: (error) => `Parte do histórico não pôde ser movida, e esses arquivos não foram tocados. ${error}`,
  },

  wrong: {
    title: 'Downloads que podem ser a música errada',
    some: (count) =>
      oneOrMany(count, '1 download pode ser outra música, diferente do que diz o nome', `${format.number(count)} downloads podem ser outras músicas, diferentes do que dizem os nomes`),
    review: 'Revisar',
    reviewHint: 'Abre esses downloads para corrigir cada um',
    note: 'Cada um foi baixado como uma música e recebeu o nome dela, mas o vídeo de onde veio tem outro nome, então pode ser outra música. Toque para ouvir qual é e depois dê a ele o nome do vídeo, exclua ou diga que está certo. Nada muda até você escolher.',
    empty: 'Nenhum download parece ser a música errada.',
    filedAs: 'Salvo como',
    videoWas: 'O vídeo era',
    facts: (length, listens) =>
      `${length} · ${listens > 0 ? oneOrMany(listens, '1 reprodução', `${format.number(listens)} reproduções`) : 'nenhuma reprodução'}`,
    playHint: 'Toca este arquivo',
    rename: 'Dar o nome certo',
    delete: 'Excluir',
    right: 'Está certo',
    sheetNote: 'Tirado do título do vídeo. Mude se não estiver bem certo. É salvo como uma edição sua, que nenhuma consulta substitui.',
    titleField: 'Título',
    artistField: 'Artista',
    renamed: (title) => `Renomeado para “${title}”.`,
    deleted: 'Excluído.',
    notDeleted: 'O arquivo não foi excluído.',
    keptRight: 'Fica como está. Não vamos perguntar de novo.',
    failed: (error) => `Não foi possível. ${error}`,
  },
};
