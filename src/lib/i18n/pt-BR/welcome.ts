import type { Strings } from '../en/index.ts';
import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

export const welcome: Strings['welcome'] = {
  language: {
    heading: 'Escolha seu idioma',
    note: 'Você pode mudar quando quiser em Ajustes.',
    go: 'Continuar',
    made:
      'O Jukebox é feito por uma pessoa só. Com exceção do inglês, os idiomas foram traduzidos por IA e ainda não foram revisados por quem fala essas línguas. Se algo parecer errado, avise no GitHub.',
  },

  setup: {
    step: (at: number, of: number) =>
      `Etapa ${format.number(at)} de ${format.number(of)}`,
    skip: 'Pular',
    skipHint: 'Deixa o resto como está e abre o Jukebox',
    back: 'Voltar',
    next: 'Continuar',
    done: 'Pronto',
    update:
      'Alguns ajustes novos nesta versão. Você pode mudá-los quando quiser em Ajustes.',
    folder: {
      heading: "Sua pasta de música",
      note: "A pasta de onde o Jukebox lê suas músicas e onde salva os downloads.",
      jukebox: { label: (folder: string) => `A pasta do Jukebox (${folder})`, note: "Só o que está nesta pasta. Os downloads são salvos aqui, e as músicas que outros apps guardam em Music ficam de fora." },
      music: { label: (folder: string) => `Toda a pasta Music (${folder})`, note: "Tudo o que está na pasta Music e nas pastas dentro dela, como antes." },
      current: "A pasta escolhida antes.",
      songs: (count: number) => `${format.number(count)} ${count === 1 ? 'música' : 'músicas'}`,
      more: "Dá para mudar quando quiser em Ajustes → Biblioteca → Pasta da biblioteca, onde também é possível escolher qualquer outra pasta.",
    },
    look: {
      heading: 'Escolha uma aparência',
      note: 'Toque em um para experimentar.',
      more:
        'Mais temas, e quais dois usar ao seguir o sistema, ficam em Ajustes → Aparência e toque.',
    },
    views: {
      heading: 'O que a biblioteca mostra',
      note: 'Os jeitos de ver sua música, como um seletor acima da biblioteca. Ative os que quiser.',
      more: 'Você pode mudar isso quando quiser em Configurações → Aparência e toque.',
    },
    discover: {
      heading: 'Descobrir',
      note:
        'O Descobrir encontra músicas que você ainda não tem, dos artistas da sua biblioteca e de outros parecidos, e as baixa do YouTube quando você as toca.',
      more:
        'O tamanho da lista, a frequência com que ela é renovada e mais ficam em Ajustes do Descobrir.',
    },
  },

  offer: {
    heading: 'Buscar capas e detalhes?',
    body: (count) =>
      `${oneOrMany(
        count,
        '1 das suas músicas ainda não foi consultada',
        `${format.number(count)} das suas músicas ainda não foram consultadas`
      )}. O Jukebox pode encontrar capas, artistas e álbuns no MusicBrainz e no catálogo do iTunes, da Apple.`,
    privacy:
      'Só os nomes das músicas são enviados a esses dois serviços, e mais nada. A busca roda em segundo plano enquanto você ouve e pode ser feita depois em Ajustes → Biblioteca → Tags.',
    accept: 'Buscar',
    decline: 'Agora não',
  },

  progress: {
    starting: 'Buscando capas e detalhes…',
    counting: (done, total) =>
      `Buscando capas e detalhes · ${format.number(done)} de ${format.number(total)}`,
    album: (album, done, total) =>
      `Consultando “${album}” · ${format.number(done)} de ${format.number(total)}`,
    covers: (done, total) =>
      `Buscando capas · ${format.number(done)} de ${format.number(total)}`,
    lyrics: (done, total) =>
      `Buscando letras · ${format.number(done)} de ${format.number(total)}`,
    hint: 'Abre a tela Tags, onde dá para acompanhar e parar a consulta',
  },

  tips: {
    library:
      'Mantenha uma música pressionada para abrir o menu: adicione a uma lista, edite os detalhes ou jogue com ela no piano tiles. Arraste uma música para a direita para tocá-la a seguir, ou para a esquerda para adicioná-la à fila.',
    player:
      'Abaixo dos controles, o botão de letra mostra a letra enquanto a música toca, e, com ela aberta, o botão que aparece ao lado a traduz. A engrenagem reúne velocidade e tom, efeitos e o timer para dormir.',
    discover:
      'O Descobrir encontra músicas que você ainda não tem. Até você ter ouvido por um tempo, ele parte dos artistas de quem você tem mais músicas, e aprende com o que você ouve.',
    dismiss: 'Entendi',
    dismissHint: 'Não mostra mais esta dica',
  },

  settings: {
    title: 'Primeiro uso',
    note:
      'Mostra o Jukebox como no dia em que foi instalado: os primeiros ajustes, a oferta de buscar capas e as dicas. Suas músicas, listas e ajustes continuam como estão.',
    again: 'Ver de novo',
  },

  discoverEarly:
    'Com pouco ouvido até agora, o Descobrir parte dos artistas de quem você tem mais músicas, e aprende com o que você ouve.',
};
