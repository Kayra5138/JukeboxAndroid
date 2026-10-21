import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const discover: Strings['discover'] = {
  panel: {
    heading: 'Para você ouvir a seguir',
    refresh: 'Atualizar',
    updated: (date) => `Atualizado em ${date}`,

    familiar: (because) => `Mais dos seus artistas · ${because}`,
    fresh: (because) => `Um artista novo · ${because}`,
  },

  header: {
    notYet: 'Nenhuma lista ainda',
    about: 'Sobre o Descobrir',
    settings: 'Ajustes do Descobrir',
    findMore: 'Encontrar mais',
    dismiss: 'Fechar',
  },

  about: {
    heading: 'Sobre o Descobrir',
    what:
      'Músicas que você ainda não tem, escolhidas a partir do que você ouviu nos últimos 30 dias: mais dos seus artistas e artistas próximos deles.',
    source:
      'O que você ouve é lido neste celular. As sugestões vêm do ListenBrainz e do MusicBrainz, e o áudio de uma música é baixado do YouTube quando ela vai tocar.',
    keep: '“Salvar” coloca a música na sua biblioteca. Ela sai da lista, porque já foi encontrada.',
    exclude:
      '“Dispensar” tira a música da lista, e ela não é recomendada de novo. Pelo menu, dá para fazer o mesmo com o artista dela.',
    room: 'Nos dois casos, outra música toma o lugar. Arraste uma linha para o lado para fazer o mesmo, ou mantenha pressionada para ver mais.',
  },

  row: {
    keep: 'Salvar na biblioteca',
    exclude: 'Dispensar esta música',
    swipeKeep: 'Salvar',
    swipeExclude: 'Dispensar',
    willPlay: 'Toca quando pronta',
    preview: 'Prévia · a música está chegando',
    previewStop: 'Para a prévia. A música ainda toca quando estiver pronta',
    willKeep: 'Salva na biblioteca quando pronta',
    keeping: 'Salvando na biblioteca…',
    failed: 'Falha no download · toque para tentar de novo',
    needsBuild: 'Precisa do app atualizado',
    waitingWifi: 'Aguardando Wi-Fi · toque para baixar',
    percent: (percent) => `${format.number(percent)}%`,
    gettingReady: 'Baixando',
    hint: 'Toca a música, baixando antes se for preciso',
    nowPlaying: (title) => `Tocando ${title}`,
    menu: 'Opções da música',
  },

  menu: {
    play: { label: 'Tocar', hint: 'Baixada antes, se for preciso' },
    keep: { label: 'Salvar na biblioteca', hint: 'Fica com você e sai desta lista' },
    exclude: { label: 'Dispensar esta música', hint: 'Sai da lista e não é recomendada de novo' },
    neverArtist: {
      label: (artist) => `Nunca mais ${artist}`,
      hint: 'Nada deste artista é recomendado de novo',
    },
    why: 'Por que esta música',
    seeds: (artists) => `Pelo que você ouve de ${artists}`,
    tags: (tags) => `Tags: ${tags}`,
    freshArtist: 'Um artista novo na sua biblioteca',
  },

  empty: {
    building: 'Montando sua lista…',
    none: 'Ainda não há lista. Toque em Atualizar, e o Descobrir monta uma a partir do que você ouve.',
    findingMore: 'Procurando mais músicas…',
    short: (missing) =>
      oneOrMany(missing, '1 lugar está vazio.', `${format.number(missing)} lugares estão vazios.`),
  },

  player: {
    kept: 'Salva na biblioteca',
  },

  preview: {
    label: 'Prévia',
    note: 'A música inteira começa quando estiver pronta',
    stop: 'Parar a prévia',
  },

  settings: {
    heading: 'Descobrir',
    title: 'Ajustes do Descobrir',
    count: 'Músicas na lista',
    countNote: 'Metade de artistas conhecidos, metade de novos. Músicas salvas e dispensadas são substituídas na hora.',
    refresh: 'Atualizar lista',
    everyDays: (days) => `${format.number(days)}d`,
    manual: 'Manual',
    refreshNote:
      'O Android decide quando tarefas em segundo plano podem rodar. Uma atualização atrasada também roda quando você reabre o Jukebox. Descobertas não salvas são substituídas; músicas na fila são mantidas até a reprodução não precisar mais delas.',
    ready: 'Deixar as próximas músicas prontas',
    readyNone: 'Nenhuma',
    readyNote:
      'Baixadas com antecedência para que um toque já comece a tocar: as primeiras da lista, ou as que vêm depois da que está tocando. Com “Nenhuma”, a música é baixada quando você toca nela.',
    wifi: 'Preparar músicas só no Wi-Fi',
    wifiNote: 'Usa Wi-Fi sem limite de dados. Uma música em que você toca é baixada em qualquer conexão disponível.',
    preview: 'Tocar uma prévia enquanto a música baixa',
    previewNote:
      'Se você tocar em uma música que ainda não está pronta, ela começa na hora como uma prévia de 30 segundos do Deezer, e a música inteira assume do começo quando chegar. Uma prévia não conta como reprodução.',
    nextList: 'Sua lista atual fica como está. A próxima é escolhida deste jeito.',
    excluded: 'Músicas dispensadas',
    noneExcluded: 'Nenhuma música dispensada.',
    allowAgain: 'Permitir de novo',
    allowAgainLabel: (title) => `Permitir ${title} de novo`,
    unblock: 'Desbloquear',
    unblockLabel: (artist) => `Desbloquear ${artist}`,
    failed: 'Não foi possível atualizar os ajustes do Descobrir. Tente de novo.',
  },

  state: {
    idle: 'Toque para baixar e tocar',
    starting: 'Iniciando…',
    waitingFind: 'Aguardando a busca',
    waitingDownload: 'Aguardando o download',
    waitingRetry: 'Tentando de novo em instantes',
    finding: 'Procurando a gravação…',
    preparing: 'Iniciando o download…',
    downloading: (percent) => `Baixando · ${format.number(percent)}%`,
    converting: 'Finalizando…',
    saving: 'Quase pronta…',
    ready: 'Pronta para tocar',
    playing: 'Tocando',
    willPlay: (doing) => `${doing} Toca quando estiver pronta.`,
    preview: (doing) => `Tocando uma prévia. ${doing}`,
    willKeep: (doing) => `${doing} Vai para a biblioteca quando estiver pronta.`,
    keeping: 'Salvando na biblioteca…',
    waitingWifi: 'Aguardando Wi-Fi · toque para baixar agora',
  },

  failure: {
    generic: 'Este download não pôde ser concluído.',
    fileMissing: 'O arquivo não está mais no celular.',
    noRecording: 'Não foi encontrada nenhuma gravação desta música.',
    notASong: 'O vídeo encontrado é uma transmissão ao vivo, ou longo demais para ser a música.',
    stopped: 'O download foi interrompido.',
    needsBuild: 'Instale o APK atualizado para baixar músicas do Descobrir.',
    retry: (reason) => `${reason} Toque para tentar de novo.`,
  },

  status: {
    building: 'Procurando músicas…',
    filling: (known, total) => `Encontrando músicas · ${format.number(known)} de ${format.number(total)}`,
    findingOffline: 'Sem conexão. O resto da lista será procurado quando houver uma.',
    findingPaused: 'Os downloads estão pausados. Retome-os, e o resto da lista será procurado.',
    findingLater: 'Algumas músicas não puderam ser verificadas agora. O Descobrir tenta de novo mais tarde.',
    buildingArtists: (done, total) =>
      `Procurando músicas · ${format.number(done)} de ${format.number(total)} artistas`,
    preparing: (ready, target) =>
      `Uma lista nova está a caminho · ${format.number(ready)} de ${format.number(target)} músicas prontas.${ready > 0 ? ' Atualize de novo para ver agora.' : ''}`,
    offline: 'Sem conexão. Sua lista é mantida; novas músicas serão procuradas quando houver conexão.',
    offlineEmpty: 'Sem conexão. O Descobrir monta sua lista quando houver uma.',
    noLibrary: 'O Descobrir parte das músicas deste celular e ainda não encontrou nenhuma.',
    noTaste:
      'Suas músicas não dizem de quem são, então o Descobrir não tem por onde começar. Busque os detalhes delas em Ajustes → Biblioteca → Tags.',
    unreachable: 'Não foi possível obter as recomendações. Sua lista é mantida; tente de novo mais tarde.',
    unreachableEmpty: 'Não foi possível obter as recomendações. Tente de novo mais tarde.',
    exhausted: 'Ainda não há músicas novas suficientes. Sua lista fica como está.',
    exhaustedEmpty: 'Nada novo para recomendar ainda. Ouça um pouco mais e tente de novo.',
    timedOut: 'A busca por músicas demorou demais e foi interrompida. Tente de novo.',
    throttled: 'O Descobrir acabou de procurar. Tente de novo em um minuto.',
    failed: 'O Descobrir não conseguiu terminar. Tente de novo.',
    waitingWifi: 'As próximas músicas serão baixadas quando houver Wi-Fi. Toque em uma música para baixá-la agora.',
    waitingConnection: 'As próximas músicas serão baixadas quando houver conexão.',
    paused: 'Os downloads estão pausados. Retome-os para baixar músicas.',
  },

  notice: {
    kept: (title) => `${title} foi salva na biblioteca.`,
    excluded: (title) => `${title} não será recomendada de novo.`,
    excludedArtist: (artist) => `Nada de ${artist} será recomendado de novo.`,
    restored: (title) => `${title} voltou para a lista.`,
    refreshed: 'Aqui está sua lista nova.',
    keepFailed: (title) => `Não foi possível salvar ${title} na biblioteca. Tente de novo.`,
    wrongFile: (title) => `O arquivo de ${title} era outra música. Procurando a certa para salvar.`,
    undo: 'Desfazer',
  },

  engine: {
    needsTaste: 'O Descobrir não tem nenhum artista nem tag por onde começar.',
    nothingFetched:
      'Não foi possível obter recomendações. Sua lista atual do Descobrir é mantida; tente de novo mais tarde.',
  },

  taste: {
    popularity: 'Popularidade das músicas',
    popularityKnown: 'Conhecidas',
    popularityAny: 'Sem preferência',
    popularityDeep: 'Menos conhecidas',
    popularityNote:
      'Se o Descobrir puxa para artistas conhecidos e as músicas mais tocadas deles, ou para artistas e músicas que menos gente encontrou. Sem preferência, um artista novo é apresentado por uma das músicas mais conhecidas dele.',

    neverArtistLabel: (artist) => `Nunca mais recomendar ${artist}`,
    blockedArtists: 'Artistas bloqueados',
    noneBlockedArtists: 'Nenhum artista bloqueado.',
    blockedArtistsNote:
      'Dispensar uma música também torna o artista dela menos provável. Com três músicas dispensadas de um mesmo artista, o Descobrir deixa esse artista de fora por seis meses.',
  },

  why: {
    moreFrom: (artist) => `Mais de ${artist}`,
    becauseYouPlay: (artists) => `Porque você ouve ${artists}`,
    both: (first, second) => `${first} e ${second}`,
    like: (artist) => `Parecido com ${artist}`,
    withGenre: (line, genre) => `${line} · ${genre}`,
    fromTags: (tags) => `Porque você ouve ${tags}`,
    unexplained: 'Escolhida para você',
    veryNear: 'Muito perto do que você ouve',
    near: 'Perto do que você ouve',
    farther: 'Um passo mais longe',
  },

  gathering: {
    around: (artist, done, total) =>
      `Explorando artistas próximos de ${artist} · ${format.number(done)} de ${format.number(total)} artistas`,
    artists: (done, total) => `${format.number(done)} de ${format.number(total)} artistas`,
    naming: 'Identificando as músicas…',
    offline: 'Sem conexão. O Descobrir vai procurar músicas novas quando houver uma.',
    throttled: 'O serviço de recomendações pediu ao Descobrir para ir mais devagar. Tente de novo em alguns minutos.',
    nothing: 'Nada novo foi encontrado desta vez. Sua lista atual do Descobrir é mantida; tente de novo mais tarde.',
  },
};
