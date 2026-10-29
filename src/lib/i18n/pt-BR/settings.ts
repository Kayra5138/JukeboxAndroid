import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `Compilado em: ${when}`,
  lastBuiltUnknown: 'Compilado em: disponível depois de instalar o novo APK',

  sections: {
    look: 'Aparência e toque',
    sound: 'Som',
    player: 'Player',
    tapes: 'Fitas',
    library: 'Biblioteca',
    downloads: 'Downloads e Descobrir',
    data: 'Seus dados',
    views: 'Modos da biblioteca',
    experimental: 'Experimental',
  },
  categories: {
    look: 'O tema, álbuns em prateleira, animações, vibração e quais modos a biblioteca oferece.',
    sound: 'Equalizador e efeitos, volume uniforme, crossfade, velocidade e tom.',
    player: 'Quanto os botões de pular avançam, o que toca quando a fila acaba e o idioma para o qual as letras são traduzidas.',
    tapes: 'Retrocesso inteligente, quanto os botões de pular de uma fita avançam e baixar podcasts só no Wi‑Fi.',
    library: 'A pasta das suas músicas, tags e capas, e arquivos que podem ser a mesma música.',
    waiting: (count) => `${format.number(count)} para decidir`,
    downloads: 'A fila de downloads e seu botão flutuante, o Descobrir e a atualização do downloader do YouTube.',
    data: 'Fazer backup de tudo ou importar um backup, aviso de novas versões e o ListenBrainz (experimental).',
  },

  language: {
    title: 'Idioma',
    note: 'O idioma do app. Ele não segue o do celular.',
  },
  theme: {
    title: 'Tema',
    open: 'Cores, vidro ou um tema seu.',
    note: 'O tema Sistema segue o modo claro ou escuro do celular.',
    pair: {
      light: 'No modo claro',
      dark: 'No modo escuro',
      note: 'Os dois temas entre os quais o tema Sistema alterna, como o celular.',
    },
    shuffle: {
      title: 'Um tema diferente a cada vez',
      on: 'Ativado',
      toggle: 'Sortear um tema sempre que o app abrir',
      note: 'Marque os temas para o sorteio. O sorteado fica até a próxima vez que o app abrir, e nesse meio-tempo você ainda pode trocar manualmente.',
      empty: 'Marque pelo menos um tema para isto funcionar.',
    },
  },
  customTheme: {
    open: 'Cores do tema personalizado',
    openNote: 'Escolha um fundo e uma cor de destaque para o tema Personalizado. O resto é calculado a partir deles.',
    preview: 'Prévia',
    background: 'Fundo',
    accent: 'Destaque',
    surface: 'Cartões',
    automatic: 'Automático',
    automaticNote: 'Calculado a partir do fundo',
    presets: 'Cores sugeridas',
    hue: 'Matiz',
    saturation: 'Saturação',
    lightness: 'Luminosidade',
    degrees: (value) => `${value}°`,
    percent: (value) => `${value}%`,
    hex: 'Código da cor',
    nudged: (colour) => `Mostrada como ${colour}, para que tudo em cima dela fique legível.`,
    note:
      'As cores do texto são calculadas a partir destas, para que ele sempre possa ser lido. Pelo mesmo motivo, uma cor que você escolher pode ficar um pouco mais clara ou mais escura.',
    use: 'Usar este tema',
    reset: 'Redefinir',
    sample: {
      title: 'Título da música',
      line: 'Artista · Álbum',
      chip: 'Aleatório',
      button: 'Tocar',
    },
  },

  tags: { note: 'Informações das faixas e capas dos álbuns' },
  rack: {
    title: 'Álbuns em prateleira',
    note:
      'Com o celular na horizontal, passe pelas capas em vez de ler uma lista. Toque na da frente para abri-la.',
  },
  favoritesShown: { title: "Favoritas", note: "Uma lista que está sempre lá, as mais novas no topo, enchida por um coração no player e por Adicionar às Favoritas no menu de uma música. Desligada, os três somem e o conteúdo espera." },
  listButton: {
    title: 'Botão de adicionar à lista',
    note:
      'Um botão no player que adiciona a música que está tocando a uma das suas listas, sem passar pelo menu dela.',
  },
  autoplaySizes: { title: 'Músicas parecidas por vez', library: 'Da sua biblioteca', fresh: 'Novas do Discover', note: 'Quantas são adicionadas cada vez que a fila é completada, para “Continuar com músicas parecidas” e para uma música tocada com parecidas. Cada música nova é um download. Misto usa três quartos de cada.' },
  tap: {
    title: 'Ao tocar numa música',
    note: 'O que toca depois de uma música que você toca em Tracks ou nos resultados da busca.',
    sheetNote: 'Play e Shuffle acima de um álbum ou lista, Shuffle all e Discover não mudam com isso. O menu de cada música tem “Tocar com músicas parecidas” e “Tocar só esta” para uma vez.',
    list: { label: 'O resto da lista', note: 'As músicas seguintes, na ordem mostrada.' },
    shuffled: { label: 'O resto da lista, embaralhado', note: 'Esta primeiro, depois as outras da lista em ordem aleatória.' },
    similar: { label: 'Músicas parecidas', note: 'Esta, depois um grupo de músicas parecidas da sua biblioteca ou do Discover, como você escolher. Depois delas, a fila segue como diz “Continuar com músicas parecidas”.' },
    only: { label: 'Só essa música', note: 'Nada depois, a não ser que “Continuar com músicas parecidas” adicione.' },
    source: { title: 'Músicas parecidas de', note: 'De onde vêm as primeiras músicas depois de uma que você toca. Depois delas, vale “Continuar com músicas parecidas”.' },
    everywhere: { title: 'Também em álbuns e listas', note: 'Também ao tocar numa música na página de um álbum, lista, artista ou pasta. Desligado, eles tocam na própria ordem.' },
  },
  autoplay: {
    title: 'Continuar com músicas parecidas',
    note: 'Quando a fila está para acabar, músicas parecidas com as que você estava ouvindo são adicionadas no fim.',
    sheetNote: 'Elas entram algumas músicas antes do fim, então tocam como o resto da fila, mesmo com a tela bloqueada. Nunca com a repetição ligada.',
    off: {
      label: 'Desativado',
      note: 'Nada é adicionado. A música para no fim da fila.',
    },
    library: {
      label: 'Da sua biblioteca',
      note: 'Escolhidas por tags, artistas e pelo que você costuma ouvir junto. Funciona sem internet.',
    },
    fresh: {
      label: 'Músicas novas',
      note: 'Músicas que você ainda não tem, encontradas pelo Descobrir. Usa a internet e baixa do YouTube como o Descobrir, seguindo o ajuste de Wi-Fi dele.',
    },
    mixed: {
      label: 'Misturado',
      note: 'Duas da sua biblioteca, depois uma nova. As novas usam a internet e os downloads do YouTube como o Descobrir, seguindo o ajuste de Wi-Fi dele.',
    },
  },
  downloads: {
    note: 'O que está sendo baixado, o que está aguardando e o que já terminou.',
    button: {
      title: 'Botão flutuante de downloads',
      note: 'Um botão redondo sobre o app enquanto algo está sendo baixado, e por alguns minutos depois. Toque nele para ver o andamento.',
    },
    check: {
      title: 'Procurar downloader do YouTube mais novo',
      note: 'No máximo uma vez por dia, e só quando você abre Downloads ou baixa algo, o Jukebox pergunta ao GitHub qual é o yt-dlp mais recente. Nada sobre você ou sua biblioteca é enviado, e nada é baixado até você mandar.',
    },
  },
  discover: { note: 'O tamanho da lista, a frequência com que ela é refeita e o que foi dispensado.' },
  still: {
    title: 'Parar as animações decorativas',
    note:
      'Para um celular que perde quadros. O player aparece em vez de subir, e o jogo para de se iluminar quando uma vida é ganha ou perdida. As teclas continuam caindo — isso é o jogo, não decoração.',
  },
  scriptNames: { title: 'Nomes em outras escritas', latin: 'Letras latinas', original: 'Original', note: 'Quando uma busca encontrou o nome de uma música em letras latinas e na sua própria escrita (japonês, chinês, coreano), qual a biblioteca mostra. Músicas buscadas antes se completam quando buscadas de novo.' },
  haptics: {
    title: "Vibração",
    open: "Quanto o app vibra sob o seu dedo, e com que força.",
    mode: "Vibrar",
    modes: { off: "Não", essential: "O essencial", all: "Tudo", custom: "Personalizado" },
    modeNotes: {
      off: "O app não vibra nunca.",
      essential: "Só onde mais diz: um toque longo, se algo funcionou ou não, e o jogo.",
      all: "Toques longos e arrastos, chaves e escolhas, as paradas de um controle, resultados, os botões do player e o jogo.",
      custom: "Escolha abaixo quais momentos vibram.",
    },
    strength: "Intensidade",
    strengthNote: "Sentida ao soltar. Celulares cujo motor não pode ser ajustado mantêm a própria intensidade.",
    groupsHeading: "O que vibra",
    groups: {
      holds: { title: "Segurar e arrastar", note: "Um toque longo, uma linha erguida para mover, o dedo pelas caixas." },
      choices: { title: "Chaves e escolhas", note: "Chaves, as abas de uma escolha, uma opção escolhida." },
      notches: { title: "Paradas e passos", note: "Velocidade normal, 0 dB, o meio de um controle, as colunas de um gráfico." },
      results: { title: "Resultados", note: "O que você pediu funcionou ou não: encontrado, gravado, adicionado, importado." },
      player: { title: "Botões do player", note: "Tocar, pular, repetir, o coração, tocar numa linha da letra." },
      fun: { title: "Jogo e diversão", note: "As teclas do Piano Tiles, e mais." },
    },
    phone: "Se a resposta tátil estiver desligada nas configurações do celular, o app também não vibra.",
  },
  moreButton: {
    title: 'Três pontos em cada linha',
    note:
      'No fim de cada linha de faixas e álbuns, abrem o mesmo menu que um toque longo. Tocar e segurar uma linha também funciona sem eles.',
  },
  tabs: {
    title: 'Abas',
    searchNote: 'O Descobrir e os downloads do YouTube ficam nesta aba e somem com ela.',
    aside: 'Biblioteca e Ajustes estão sempre lá.',
  },

  views: {
    notes: {
      tracks: 'Todas as músicas, uma por linha.',
      albums: 'Álbuns, montados a partir do que as tags dizem.',
      artists: 'Todos a quem alguma música é creditada. Uma música de dois artistas aparece com os dois.',
      folders: 'As pastas onde os arquivos estão, dentro da pasta da biblioteca.',
      tapes: 'Audiolivros, podcasts e gravações longas da pasta Tapes da biblioteca, que continuam de onde você parou.',
    },
    onlyHint: 'O único modo ativado, por isso continua ativado',
    toggleHint: 'Mostra ou oculta este modo na biblioteca',
    asideOne: 'Com um modo ativado, a biblioteca o mostra sem seletor. Um sempre fica ativado.',
    asideMany: 'O seletor da biblioteca oferece os modos ativados. Um sempre fica ativado.',
  },

  sameSong: {
    note: (count) =>
      oneOrMany(
        count,
        'Um arquivo que parece ser uma música que você já tinha em outro arquivo. O histórico dele fica separado até você decidir.',
        `${format.number(count)} arquivos que parecem ser músicas que você já tinha em outros arquivos. O histórico deles fica separado até você decidir.`
      ),
  },
  exportAll: {
    title: 'Exportar tudo',
    note:
      'Seu histórico de reprodução, listas, tags, letras e ajustes, os podcasts que você segue e onde parou em cada fita com o que marcou, em um arquivo salvo onde você escolher. Não inclui as músicas.',
    failed: 'Não foi possível salvar o backup.',
  },
  importBackup: {
    title: 'Importar',
    note: 'Traga um backup. Você vê o que há nele e confirma antes de qualquer mudança.',
    failed: 'A importação falhou.',
    refused: (reason) => `${reason} Nada foi alterado neste celular.`,
  },

  playback: {
    title: 'Reprodução',
    note: (speed) => `Velocidade e tom · ${speed}×`,
  },
  equalizer: { note: 'Bandas, graves, surround e loudness' },
  effects: { note: 'Largura, crossfeed, rotação e nível' },
  /** The tape settings, apart from the music's: see `app/settings-tapes.tsx`. */
  tapes: {
    smartRewind: {
      title: 'Retrocesso inteligente',
      note: 'Uma fita tocada de novo depois de um tempo começa um pouco antes de onde parou, mais para trás quanto mais tempo passou: três segundos após uma pausa curta, meio minuto após um dia. Desligado, continua exatamente de onde parou.',
    },
    skipSilence: { title: 'Pular silêncios', note: 'As pausas no que é dito são puladas e a fita fica um pouco mais curta. A música nunca é tocada.' },
    voiceClarity: { title: 'Voz mais clara', note: 'O ronco sob a voz é reduzido e a parte que distingue as palavras é levemente realçada, por cima do seu equalizador. Só enquanto toca uma fita.' },
    skipSponsors: { title: 'Pular patrocínios', note: 'Nas fitas do YouTube, as partes marcadas pelos ouvintes do SponsorBlock (mensagem de patrocinador, autopromoção, pedido para se inscrever) são puladas.' },
    back: 'Voltar',
    forward: 'Avançar',
    jumpNote: 'Quanto os dois botões ao lado do play pulam numa fita, em segundos. A música tem o seu próprio, em Player.',
    podcasts: 'Podcasts',
    deletePlayed: {
      title: 'Apagar episódios ouvidos',
      off: 'Os episódios dos podcasts que você segue ficam no telefone depois de ouvidos.',
      after: (days) => oneOrMany(days, 'Um episódio de um podcast que você segue é apagado um dia depois de ouvido até o fim, se o app o baixou. Um com marcas fica.', `Um episódio de um podcast que você segue é apagado ${format.number(days)} dias depois de ouvido até o fim, se o app o baixou. Um com marcas fica.`),
    },
    /** The podcasts followed, as an OPML file: see `podcasts/opml.ts`. */
    opml: {
      heading: 'Levar seus podcasts',
      export: 'Salvar os podcasts que você segue',
      exportNote: 'Como arquivo OPML, que outros apps de podcast conseguem ler.',
      import: 'Seguir podcasts de um arquivo',
      importNote: 'Um arquivo OPML de outro app de podcast. Os programas são seguidos sem baixar nada sozinhos; ative isso para cada um na tela dele.',
      importing: (done, total) => `Lendo ${format.number(done)} de ${format.number(total)}…`,
      imported: (followed, already, failed) => [oneOrMany(followed, '1 podcast seguido.', `${format.number(followed)} podcasts seguidos.`), already > 0 ? `${format.number(already)} já eram seguidos.` : '', failed > 0 ? `${format.number(failed)} não puderam ser lidos.` : ''].filter(Boolean).join(' '),
      nothing: 'Esse arquivo não tem podcasts.',
      failed: 'Não foi possível ler nem gravar o arquivo.',
      none: 'Você ainda não segue nenhum podcast.',
      saved: (count) => oneOrMany(count, '1 podcast salvo.', `${format.number(count)} podcasts salvos.`),
    },
  },
  jump: {
    title: 'Saltos de',
    note: 'Quanto os dois botões ao lado do play avançam ou voltam na faixa, em segundos.',
  },
  crossfade: { note: 'Como uma faixa dá lugar à próxima' },
  loudness: {
    title: 'Uniformizar o volume',
    note:
      'Faixas baixas ficam mais altas, e as altas, mais baixas. Um álbum tocado em ordem mantém as próprias partes baixas e altas.',
  },
  lyricsLanguage: {
    title: 'Traduzir letras para',
    note:
      'As letras são traduzidas no celular. Qualquer idioma além do inglês passa pelo inglês e baixa um segundo modelo na primeira vez.',
  },
};
