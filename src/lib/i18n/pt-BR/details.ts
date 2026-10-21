import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

const files = (count: number) => `${format.number(count)} ${oneOrMany(count, 'arquivo', 'arquivos')}`;

/** What a file's fields are called in a line that says which were written. */
const FIELD_NAMES: Record<string, string> = {
  title: 'título',
  artist: 'artista',
  album: 'álbum',
  albumArtist: 'artista do álbum',
  genre: 'gênero',
  year: 'ano',
  track: 'número da faixa',
  disc: 'número do disco',
  cover: 'capa',
};

function listed(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export const details: Strings['details'] = {
  screen: {
    tabs: { general: 'Geral', tags: 'Tags', lyrics: 'Letra' },
    missing:
      'Essa faixa não está mais na biblioteca. Ela pode ter sido excluída, movida ou ficado fora da pasta que o Jukebox lê.',
    goBack: 'Voltar',
  },

  lookUp: 'Consultar',
  searchFailed: 'A busca não foi concluída.',

  general: {
    fields: {
      title: 'Título',
      artist: 'Artista',
      album: 'Álbum',
      albumArtist: 'Artista do álbum',
      year: 'Ano de lançamento',
      trackNumber: 'Número da faixa',
      discNumber: 'Número do disco',
    },
    notAYear: 'Isso não é um ano.',
    notAPlace: 'Um número inteiro, a partir de 1.',

    chooseCoverLabel: 'Escolher uma capa da galeria',
    noCover: 'Sem capa',
    chooseFromGallery: 'Escolher da galeria',
    removeCover: 'Remover capa',
    keepCover: 'Manter a que já tinha',
    coverChosen: 'Capa escolhida. Salve para mantê-la.',

    lookUpHint:
      'Busca o título e o artista como estão escritos abaixo e preenche o que encontrar: nomes, álbum, ano, posição no disco e capa.',
    nothingFound: 'Nada foi encontrado para esse título e artista.',
    found: (sources, withCover) =>
      `Encontrado via ${listed(sources)}${withCover ? ', com capa' : ''}. Confira e salve para manter.`,

    discard: 'Descartar minha edição',
    saveHint:
      'O que for salvo aqui fica como seu: consultar a biblioteca de novo vai deixar esta faixa como está, em vez de sobrescrevê-la.',
    editGone: 'Sua edição foi descartada. Uma consulta pode preencher isto de novo.',

    inFile: 'No arquivo',
    writeLabel: 'Gravar estes detalhes no arquivo',
    writeToFile: 'Gravar no arquivo',
    saveFirst: 'Salve primeiro. Só o que foi salvo é gravado no arquivo.',
    writeHint:
      'Grava no próprio arquivo o título, o artista, o álbum, o ano e os números da faixa e do disco ' +
      'como a biblioteca os mostra, a primeira tag como gênero e uma capa salva aqui, ' +
      'para que outros players e outros aparelhos os encontrem. O Android pede permissão ' +
      'antes de qualquer mudança. O resto do conteúdo do arquivo fica como está, ' +
      'e a letra não é gravada.',
    cannotWrite: 'Só é possível gravar em arquivos MP3 e FLAC. Os detalhes deste ficam no app.',
    nothingWritten: 'Nada foi gravado.',
    couldNotWrite: 'Não foi possível gravar.',

    listening: 'Histórico',
    timesPlayed: 'Reproduções',
    playedToEnd: 'Ouvida até o fim',
    timeSpent: 'Tempo ouvido',
    firstPlayed: 'Primeira reprodução',
    lastPlayed: 'Última reprodução',
    never: 'nunca',
    listenedSeconds: (seconds) =>
      oneOrMany(seconds, '1 segundo', `${format.number(seconds)} segundos`),
    listenedMinutes: (minutes) =>
      oneOrMany(minutes, '1 minuto', `${format.number(minutes)} minutos`),
    listenedHours: (hours, minutes) => `${format.number(hours)}h ${minutes}min`,

    file: 'Arquivo',
    name: 'Nome',
    folder: 'Pasta',
    length: 'Duração',
    detailsFrom: 'Origem dos detalhes',
    unknown: 'desconhecido',
    from: {
      notLookedUp: 'não consultado',
      yourEdit: 'sua edição',
      notFound: 'não encontrado',
      lookup: 'consulta',
    },
  },

  tags: {
    lookUpHint:
      'Busca as tags desta faixa. As que você digitou ficam; as que uma consulta anterior trouxe são substituídas pelo que for encontrado agora.',
    noneFound: 'Nenhuma tag foi encontrada para esta faixa.',
    found: (count, source) =>
      `${format.number(count)} ${oneOrMany(count, 'tag', 'tags')} via ${source}. Organize e salve para manter.`,
    saveHint:
      'A primeira tag é a que conta como gênero. Uma tag que você digitou fica como sua: nenhuma consulta posterior vai removê-la.',
  },

  editor: {
    label: 'Tags',
    add: 'Adicionar uma tag',
    moveUp: (tag) => `Mover ${tag} para cima`,
    moveDown: (tag) => `Mover ${tag} para baixo`,
    remove: (tag) => `Remover ${tag}`,
  },

  tagPrompt: {
    heading: (count) =>
      oneOrMany(count, 'Adicionar uma tag a 1 faixa', `Adicionar uma tag a ${format.number(count)} faixas`),
    placeholder: 'Tag',
  },

  lyrics: {
    lookUpHint:
      'Busca a letra desta faixa do mesmo jeito que é feito ao tocá-la, e substitui a que está guardada se encontrar.',
    nothingMatched: 'Nada correspondeu a esta faixa. A busca abaixo não descarta nada.',
    foundAndSaved: 'Encontrada e salva.',
    nothingCameBack: 'Nada foi encontrado para isso.',
    cleared: 'Apagada. A próxima consulta vai buscar de novo.',
    notSeconds: 'Isso não é um número de segundos.',

    stored: 'O que está guardado',
    none: 'Nada ainda',
    kept: (timed, byHand, lines) =>
      `${timed ? 'Sincronizada' : 'Texto simples'}, ${byHand ? 'escolhida manualmente' : 'do LRCLIB'}` +
      (lines > 0 ? ` · ${oneOrMany(lines, '1 linha', `${format.number(lines)} linhas`)}` : ''),
    forget: 'Esquecer esta e buscar de novo',
    saveChanges: 'Salvar alterações',
    timedHint:
      'Cada linha tem a marcação de tempo no início. Mude as palavras e mantenha os colchetes, ou a linha perde o lugar.',
    plainHint: 'Mude o que quiser. A letra salva fica como sua, e nenhuma consulta a substitui.',

    timing: 'Sincronia',
    timingHint:
      'Desloca todas as linhas de uma vez. Use quando a letra estiver certa mas chegar adiantada ou atrasada — abra o player e ajuste até coincidir, ou toque no número e digite. Um deslocamento positivo faz a letra chegar mais tarde.',
    /* [seconds] is a step such as 0.25, written with a decimal comma. */
    earlier: (seconds) => `−${format.decimal(seconds, 2)}s`,
    later: (seconds) => `+${format.decimal(seconds, 2)}s`,
    shiftedEarlier: (written) => `−${written}s`,
    shiftedLater: (written) => `+${written}s`,
    noShift: 'sem deslocamento',
    reset: 'Redefinir',
    offsetHeading: 'Quanto a letra está fora de sincronia?',
    offsetPlaceholder: 'Segundos, por ex. 1,5 ou -0,75',
    typeOffset: 'Digitar um deslocamento exato',
    wordsField: 'Letra',

    byHand: 'Buscar manualmente',
    byHandHint:
      'Aqui nada é descartado, ao contrário da busca automática — que recusa qualquer resultado com duração diferente, e é por isso que algumas faixas nunca encontram a letra.',
    queryPlaceholder: 'Artista e título',
    candidateTimed: 'sincronizada',
    candidatePlain: 'simples',

    paste: 'Colar',
    pasteHint: 'Aceita um arquivo LRC ou texto simples. Com marcações de tempo, vira uma letra sincronizada.',
    savePasted: 'Salvar o texto colado',
  },

  library: {
    coversSaved: (count) =>
      oneOrMany(count, '1 capa de álbum adicionada.', `${format.number(count)} capas de álbum adicionadas.`),
    stoppedOffline: (matched) =>
      `Nada respondeu, então a consulta parou depois de ${format.number(matched)} ${oneOrMany(matched, 'faixa encontrada', 'faixas encontradas')}. Nada foi gravado para o resto — essas faixas continuam aguardando.`,
    serviceUnreachable: (service) =>
      `Não foi possível acessar o serviço ${service}, então a consulta continuou sem ele. O que dependia dele ficou como estava e será tentado na próxima vez.`,
    stoppedUnexpectedly: 'A consulta parou inesperadamente.',

    nothingAnswered: 'Nada respondeu. Parando.',
    rateLimited: 'Um dos serviços pediu uma pausa. Ele será consultado de novo em um minuto.',
    lookingUp: 'Consultando…',
    lookingUpProgress: (done, total) =>
      `Consultando… ${format.number(done)} de ${format.number(total)} faixas prontas`,
    lookingUpAlbum: (album, done, total) =>
      `Consultando “${album}”… ${format.number(done)} de ${format.number(total)} faixas prontas`,
    soFar: (matched, covers) =>
      `${format.number(matched)} ${oneOrMany(matched, 'encontrada', 'encontradas')}, ${format.number(covers)} ${oneOrMany(covers, 'capa', 'capas')} até agora`,
    stop: 'Parar',
    lookupChannel: 'Buscas de dados',

    selected: (count) =>
      `${format.number(count)} ${oneOrMany(count, 'selecionada', 'selecionadas')}`,
    summary: (matched, edited, notFound, untried) =>
      [
        `${format.number(matched)} ${oneOrMany(matched, 'encontrada', 'encontradas')}`,
        edited > 0 ? `${format.number(edited)} ${oneOrMany(edited, 'editada', 'editadas')}` : null,
        `${format.number(notFound)} não ${oneOrMany(notFound, 'encontrada', 'encontradas')}`,
        `${format.number(untried)} não ${oneOrMany(untried, 'consultada', 'consultadas')}`,
      ]
        .filter(Boolean)
        .join(' · '),
    reset: 'Redefinir',
    lookUpMissing: 'Consultar as que faltam',
    hint: 'Toque em uma faixa para corrigi-la manualmente. Arraste para baixo pelas caixas de seleção para selecionar várias seguidas.',
    searchPlaceholder: 'Buscar nestas faixas',

    noGenre: 'sem gênero',
    noMatch: 'nada encontrado',
    notLookedUp: 'ainda não consultada',
    matchedSpoken: (artist, title) => `Encontrada: ${artist} — ${title}`,
    manualSpoken: (artist, title) => `Definida manualmente: ${artist} — ${title}`,
  },

  selection: {
    more: 'Mais…',
    moreHint: 'Tudo o que dá para fazer com as faixas selecionadas',
    heading: (count) =>
      oneOrMany(count, '1 faixa selecionada', `${format.number(count)} faixas selecionadas`),
    sections: { find: 'Consultar', change: 'Alterar', other: 'Outros' },
    actions: {
      lookUp: {
        label: 'Consultar detalhes',
        hint: 'Esquece o que foi encontrado antes para elas e consulta de novo, capas incluídas. Suas próprias edições ficam.',
      },
      covers: {
        label: 'Consultar capas',
        hint: 'Só capas, para as que não têm. Nada mais é consultado de novo, e uma capa que você escolheu ou removeu fica como está.',
      },
      lyrics: {
        label: 'Consultar letras',
        hint: 'Primeiro nos arquivos e nos .lrc, depois no LRCLIB. As letras que você escolheu ficam.',
      },
      edit: {
        label: 'Editar detalhes juntos',
        hint: 'Artista, artista do álbum, álbum ou ano, em todas de uma vez',
      },
      addTag: { label: 'Adicionar uma tag', hint: 'Uma tag, adicionada a todas' },
      removeTag: { label: 'Remover uma tag', hint: 'Uma das tags delas, removida de todas' },
      cover: { label: 'Escolher uma capa', hint: 'Uma imagem da sua galeria, para todas' },
      write: {
        label: 'Gravar nos arquivos',
        hint: 'Grava nos próprios arquivos os detalhes que a biblioteca mostra. O Android pergunta antes.',
      },
      addToList: { label: 'Adicionar à lista', hint: 'Coloca as faixas em uma das suas listas' },
      reset: {
        label: 'Redefinir',
        hint: 'Esquece o que as consultas encontraram para elas. Suas próprias edições ficam.',
      },
      delete: { label: 'Excluir do celular', hint: 'Apaga os arquivos. O Android pergunta antes.' },
    },
    busy: 'Já há uma consulta em andamento. Espere terminar ou pare a consulta.',

    editHeading: (count) => oneOrMany(count, 'Editar 1 faixa', `Editar ${format.number(count)} faixas`),
    editHint:
      'Preencha só o que deve ser igual em todas. Um campo vazio deixa cada faixa como está; para esvaziar um campo em todas, marque a opção abaixo dele. Títulos e números de faixa e de disco não são alterados.',
    keepEach: 'Cada uma mantém o seu',
    empty: 'Vazio',
    clearOn: { remove: 'Remover de todas', own: 'Usar o artista de cada arquivo' },
    cleared: { remove: 'Será removido de todas', own: 'O artista de cada arquivo' },
    edited: (count) =>
      oneOrMany(
        count,
        'Salvo. Agora é uma edição sua, e as consultas não mexem nela.',
        `Salvo em ${format.number(count)} faixas. Agora são edições suas, e as consultas não mexem nelas.`
      ),

    tagAdded: (tag, count) =>
      `“${tag}” agora está em ${format.number(count)} ${oneOrMany(count, 'faixa', 'faixas')}.`,
    removeTagHeading: (count) =>
      `Remover uma tag de ${format.number(count)} ${oneOrMany(count, 'faixa', 'faixas')}`,
    tagOption: (tag, count) => `${tag} · ${format.number(count)}`,
    noTags: 'Nenhuma destas faixas tem tags.',
    tagRemoved: (tag, count) =>
      `“${tag}” foi removida de ${format.number(count)} ${oneOrMany(count, 'faixa', 'faixas')}.`,

    resetQuestion: (count) =>
      oneOrMany(count, 'Redefinir 1 faixa?', `Redefinir ${format.number(count)} faixas?`),
    resetBody:
      'O que as consultas encontraram para elas é esquecido, e elas contam como não consultadas. Suas próprias edições ficam. Não dá para desfazer.',

    coversProgress: (done, total) =>
      `Buscando capas… ${format.number(done)} de ${format.number(total)} faixas prontas`,
    coversNone: 'Nenhuma capa nova foi encontrada.',
    lyricsProgress: (done, total) =>
      `Buscando letras… ${format.number(done)} de ${format.number(total)} faixas prontas`,
    lyricsSoFar: (found) => `${format.number(found)} encontradas até agora`,
    lyricsFound: (found, wanted, had) =>
      [
        wanted > 0 ? `Letra encontrada para ${format.number(found)} de ${format.number(wanted)}.` : null,
        had > 0 ? oneOrMany(had, '1 já tinha.', `${format.number(had)} já tinham.`) : null,
      ]
        .filter(Boolean)
        .join(' ') || 'Nada para procurar: as letras destas faixas foram escolhidas por você.',
    lyricsOffline:
      'Não foi possível acessar o LRCLIB, então a consulta parou. O resto pode ser tentado de novo mais tarde.',
  },

  write: {
    heading: (count) => `Gravar os detalhes em ${files(count)}?`,
    body: (count) =>
      `${oneOrMany(count, `${files(count)} será alterado`, `${files(count)} serão alterados`)}: o título, o artista, o álbum, o ano, os números ` +
      'da faixa e do disco, a primeira tag como gênero e a capa salva que a biblioteca mostra para cada um ' +
      'vão para o próprio arquivo. O Android vai pedir sua permissão. O resto do conteúdo de cada ' +
      'arquivo fica como está.',
    noneHeading: 'Não é possível gravar em nenhum destes',
    noneBody: 'Só é possível gravar em arquivos MP3 e FLAC, e não na faixa que está tocando.',
    skipping: (otherKind, playing) =>
      otherKind > 0 && playing
        ? `${files(otherKind)} de outro tipo ${oneOrMany(otherKind, 'será pulado', 'serão pulados')}, e a faixa que está tocando também.`
        : otherKind > 0
          ? `${files(otherKind)} de outro tipo ${oneOrMany(otherKind, 'será pulado', 'serão pulados')}.`
          : 'A faixa que está tocando será pulada.',
    confirmLabel: (count) => `Gravar os detalhes em ${files(count)}`,
    confirm: 'Gravar',
    nothingWritten: 'Nada foi gravado.',
    couldNotStart: 'Não foi possível começar.',

    writing: 'Gravando nos arquivos',
    progressLabel: (done, total) => `${format.number(done)} de ${files(total)} ${oneOrMany(total, 'gravado', 'gravados')}`,
    progress: (done, total) => `${format.number(done)} de ${format.number(total)}`,
    stopping: 'Parando assim que este arquivo terminar.',
    keepOpen: 'Cada arquivo é verificado antes de o original ser alterado. Mantenha o app aberto.',
    stopLabel: 'Parar depois do arquivo que está sendo gravado',
    stop: 'Parar',
    stoppedShort: (count) =>
      `Interrompido: ${files(count)} ${oneOrMany(count, 'ficou', 'ficaram')} de fora.`,

    written: (changed) =>
      changed.length > 0
        ? `Gravado: ${listed(changed.map((name) => FIELD_NAMES[name] ?? name))}.`
        : 'Gravado.',
    unchanged: 'O arquivo já tinha tudo isso. Ficou como estava.',
    skippedPlaying: 'Pulado: está tocando. Tente de novo quando não estiver.',
    skippedFormat: 'Pulado: só é possível gravar em arquivos MP3 e FLAC.',
    failed: (reason) => `Falhou: ${reason}`,
    noReason: 'Não foi possível gravar. O arquivo não foi alterado.',

    summary: (counts) => {
      const parts: string[] = [];
      if (counts.written > 0) {
        parts.push(`${files(counts.written)} ${oneOrMany(counts.written, 'gravado', 'gravados')}.`);
      }
      if (counts.unchanged > 0) {
        parts.push(`${files(counts.unchanged)} já ${oneOrMany(counts.unchanged, 'estava', 'estavam')} em dia.`);
      }
      if (counts.skipped > 0) {
        parts.push(`${files(counts.skipped)} ${oneOrMany(counts.skipped, 'pulado', 'pulados')}.`);
      }
      if (counts.failed > 0) {
        parts.push(`${files(counts.failed)} com falha.`);
      }
      return parts.length > 0 ? parts.join(' ') : 'Nada para gravar.';
    },
  },

  same: {
    note:
      'Parecem ser uma música só em dois arquivos. Mesclar passa tudo o que o primeiro arquivo tem para o segundo: reproduções, tags, letra e posições em listas. Manter separados deixa os dois como estão, e o app não pergunta mais sobre esse par.',
    failed: (error) => `Não foi possível fazer isso, e nada foi alterado. ${error}`,
    empty: 'Nada mais para decidir.',
    from: 'De',
    into: 'Para',
    keepApart: 'Manter separados',
    merge: 'Mesclar',
    bulk: {
      mergeDelete: 'Mesclar e excluir o primeiro arquivo',
      deleteToo: 'Excluir também o primeiro arquivo de cada par',
      deleteNote: 'O Android pergunta antes de excluir qualquer coisa.',
      notDeleted: 'Os arquivos não foram excluídos.',
      deleted: (count) => oneOrMany(count, '1 arquivo excluído.', `${format.number(count)} arquivos excluídos.`),
      choose: 'Escolher este par',
      chosen: (count) => oneOrMany(count, '1 par escolhido', `${format.number(count)} pares escolhidos`),
      merge: (count) => `Mesclar ${format.number(count)}`,
      keepApart: (count) => oneOrMany(count, 'Manter 1 separado', `Manter ${format.number(count)} separados`),
      confirm: (count) =>
        oneOrMany(
          count,
          'Mesclar 1 par? As reproduções, as tags, a letra e as posições em listas do primeiro arquivo passam para o segundo, e não dá para separar de novo.',
          `Mesclar ${format.number(count)} pares? Em cada um, as reproduções, as tags, a letra e as posições em listas do primeiro arquivo passam para o segundo, e não dá para separar de novo.`
        ),
      done: (done, skipped) =>
        skipped > 0
          ? `${oneOrMany(done, '1 par resolvido', `${format.number(done)} pares resolvidos`)}; ${oneOrMany(skipped, '1 já estava resolvido', `${format.number(skipped)} já estavam resolvidos`)} por outra resposta.`
          : oneOrMany(done, '1 par resolvido.', `${format.number(done)} pares resolvidos.`),
    },
    unknown: 'Desconhecido',
    noFileName: 'Nome do arquivo desconhecido',
    holds: (side) => {
      const parts: string[] = [];
      if (side.listens > 0) {
        parts.push(oneOrMany(side.listens, '1 reprodução', `${format.number(side.listens)} reproduções`));
      }
      if (side.tags > 0) parts.push(oneOrMany(side.tags, '1 tag', `${format.number(side.tags)} tags`));
      if (side.lyrics) parts.push('letra');
      if (side.lists > 0) {
        parts.push(oneOrMany(side.lists, 'em 1 lista', `em ${format.number(side.lists)} listas`));
      }
      return parts.length > 0 ? parts.join(' · ') : 'Nada ainda';
    },
  },
};
