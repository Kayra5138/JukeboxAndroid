import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const lists: Strings['lists'] = {
  naming: {
    heading: 'Dê um nome à lista',
    placeholder: 'Nome da lista',
    create: 'Criar',
  },

  screen: {
    newList: 'Nova lista',
    fromTag: 'De uma tag',
    empty: 'Nada ainda. Uma lista é uma ordem que você escolheu — a única coisa que as tags não guardam.',
    followingTag: (count, tag) =>
      `${format.number(count)} ${oneOrMany(count, 'faixa', 'faixas')} · segue ${tag}`,
    fromListening: 'Do que você ouve',
    discover: 'Descobrir',
    discoverHint: 'Músicas que você não tem, a partir do que você ouve',

    tagSheet: {
      heading: 'Criar uma lista a partir de uma tag',
      follows: 'Segue a tag',
      copy: 'Uma cópia',
      followsHint:
        'Sempre tudo o que tiver a tag. Coloque a tag em algo depois e isso aparece aqui; nada nela pode ser reordenado ou removido.',
      copyHint:
        'Pega o que tem a tag agora. Depois, lista e tag seguem caminhos separados, e a lista fica para você organizar.',
      noTags: 'Nenhuma tag ainda. Consulte algumas faixas primeiro.',
    },
  },

  auto: {
    mostPlayed: { name: 'Mais tocadas', hint: 'O que você sempre volta a ouvir' },
    recentlyFound: { name: 'Novas neste mês', hint: 'Ouvidas pela primeira vez desde o início do mês' },
    forgotten: { name: 'Esquecidas', hint: 'Muito tocadas antes, mas não nos últimos seis meses' },
    skipped: { name: 'Mais puladas', hint: 'O que você sempre pula' },
  },

  picker: {
    heading: (count) =>
      oneOrMany(count, 'Adicionar 1 faixa a', `Adicionar ${format.number(count)} faixas a`),
    noLists: 'Nenhuma lista ainda.',
    newList: 'Nova lista…',
    already: (list) => `Já está em ${list}`,
    added: (count, list) =>
      oneOrMany(
        count,
        `1 faixa adicionada a ${list}`,
        `${format.number(count)} faixas adicionadas a ${list}`
      ),
  },

  trackPicker: {
    heading: 'Adicionar faixas',
    search: 'Buscar na biblioteca',
    alreadyHere: 'Já está nesta lista',
    add: (count) => `Adicionar ${format.number(count)} ${oneOrMany(count, 'faixa', 'faixas')}`,
  },

  list: {
    album: 'Álbum',
    artist: 'Artista',
    folder: 'Pasta',
    list: 'Lista',

    everythingTagged: (tag) => `Tudo com a tag ${tag}, como está agora`,
    away: (count) =>
      oneOrMany(
        count,
        'Mais 1 não está na biblioteca agora',
        `Mais ${format.number(count)} não estão na biblioteca agora`
      ),

    addTracks: 'Adicionar faixas',
    cover: 'Capa',
    deleteList: 'Excluir lista',

    albums: 'Álbuns',
    tracks: 'Faixas',
    opensAlbum: 'Abre o álbum',

    empty: {
      editable: 'Nada aqui ainda. Adicione faixas acima ou mande-as para cá a partir da biblioteca.',
      tag: 'Nada tem essa tag ainda. Adicione-a a algumas faixas e elas aparecerão aqui.',
      album: 'Esse álbum não está mais na biblioteca.',
      artist: 'Não há mais nada na biblioteca creditado a esse artista.',
      folder: 'Não há mais nada nessa pasta.',
      auto: 'Nada se encaixa ainda. Ouça algumas coisas primeiro.',
    },

    mightBelong: 'Talvez caiba aqui',
    mightBelongHint:
      'Com base nas tags em que a lista já se apoia, com peso maior para uma tag rara do que para uma que metade da biblioteca tem.',

    choosePicture: 'Escolher uma imagem…',
    firstFour: 'Usar as quatro primeiras',

    renameHeading: 'Renomear a lista',
    deleteQuestion: (name) => `Excluir “${name}”?`,
    deleteHint: 'A lista é excluída. As faixas continuam no celular.',
  },

  files: {
    importFiles: 'Importar listas M3U…',
    exportAll: 'Exportar todas as listas…',
    export: 'Exportar…',
    untitled: 'Lista importada',
    reading: 'Lendo as listas…',

    conflict: {
      heading: (name) => `Já existe uma lista chamada “${name}”`,
      hint: 'O arquivo pode tomar o lugar dela, mantendo a capa, ou entrar como uma lista separada.',
      replace: 'Substituir',
      keepBoth: (name) => `Adicionar como “${name}”`,
      skip: 'Pular este arquivo',
    },

    result: {
      heading: 'Importado',
      imported: (name, found, total) =>
        `Lista ${name} importada: ${format.number(found)} de ${format.number(total)} ${oneOrMany(found, 'encontrada', 'encontradas')}`,
      repeated: (count) =>
        oneOrMany(
          count,
          'Uma faixa aparecia duas vezes no arquivo; na lista, ela entra uma vez só.',
          `${format.number(count)} faixas apareciam mais de uma vez no arquivo; na lista, cada uma entra uma vez só.`
        ),
      showMissing: (count) => oneOrMany(count, 'Ver a faixa não encontrada', `Ver as ${format.number(count)} não encontradas`),
      hideMissing: 'Ocultar',
      reasons: {
        notFound: 'Nada na biblioteca corresponde',
        ambiguous: 'Mais de uma faixa corresponde',
        web: 'Um endereço da web, não um arquivo',
      },
      tooBig: (file) => `${file} é grande demais para ser uma lista.`,
      unreadable: (file) => `Não foi possível ler ${file} como lista.`,
      empty: (file) => `${file} está vazio.`,
      skipped: (file) => `${file} foi pulado.`,
      encoding: (encoding) => `Lido como ${encoding}`,
      open: 'Abrir',
    },

    exportSheet: {
      heading: 'Exportar como lista M3U',
      headingAll: 'Exportar todas as listas',
      phone: 'Caminhos do celular',
      phoneHint:
        'Caminhos completos como /storage/emulated/0/Music/…, que os outros players deste celular entendem onde quer que o arquivo esteja.',
      library: 'A partir da pasta da biblioteca',
      libraryHint:
        'Caminhos que começam dentro da pasta da biblioteca, para um computador com as mesmas músicas. Coloque o arquivo no topo dessa pasta.',
      save: 'Salvar…',
      chooseFolder: 'Escolher uma pasta…',
      allHint:
        'Um arquivo .m3u8 para cada uma das suas listas, na pasta que você escolher. Um arquivo com o mesmo nome que já esteja lá é substituído.',
    },

    saved: (name) => `Lista ${name} salva como M3U`,
    savedAll: (count, folder) =>
      oneOrMany(count, `1 lista salva em ${folder}`, `${format.number(count)} listas salvas em ${folder}`),
    notSaved: (names) => `Falha ao salvar: ${names}`,
    leftOut: (count) =>
      oneOrMany(
        count,
        '1 faixa ficou de fora: ela não está na pasta da biblioteca agora.',
        `${format.number(count)} faixas ficaram de fora: elas não estão na pasta da biblioteca agora.`
      ),
    failed: (reason) => `Não deu certo: ${reason}`,
  },
};
