import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const sound: Strings['sound'] = {
  percent: (value) => `${format.number(value)}%`,

  effects: {
    failures: {
      unsupported: 'Instale a versão atualizada para Android para usar os efeitos.',
      unreadable: 'Não foi possível ler os efeitos. Eles ficam desativados até uma nova tentativa.',
      unsent: 'Esse ajuste não chegou ao player.',
    },
    title: 'Efeitos',
    presets: {
      off: { name: 'Desativado', hint: 'A gravação como ela é' },
      mono: { name: 'Mono', hint: 'Igual nos dois ouvidos — para um fone só' },
      wide: { name: 'Amplo', hint: 'Os lados empurrados para fora' },
      headphones: { name: 'Fones', hint: 'Tira de dentro da sua cabeça as mixagens de canais bem separados' },
      '8d': { name: '8D', hint: 'O som gira devagar à sua volta' },
      karaoke: { name: 'Quase karaokê', hint: 'Afasta o centro' },
    },
    voices: {
      off: { name: 'Desativado', hint: 'A gravação como ela é' },
      robot: { name: 'Robô', hint: 'Modulação em anel com um tom grave — metálico, como um sino' },
      vintage: { name: 'Vintage', hint: 'Menos bits, taxa de amostragem menor e sem os agudos' },
      swirl: { name: 'Redemoinho', hint: 'Uma varredura lenta, como um jato passando no alto' },
      chipmunk: { name: 'Esquilo', hint: 'Uma quinta acima, sem mudar o andamento' },
      squeak: { name: 'Mais esquilo', hint: 'Uma oitava inteira, a ponto de não parecer mais voz' },
    },
    ownSettings: 'Seus próprios ajustes',
    howMuch: 'Intensidade',
    voiceNote:
      'Cada voz mantém os harmônicos da própria gravação e os altera, então a música continua sendo a música por baixo. Diminua a intensidade para ouvir mais da gravação original.',

    stereo: 'Estéreo',
    width: 'Largura',
    mono: 'Mono',
    asRecorded: 'Como gravado',
    balance: 'Balanço',
    centre: 'Centro',
    left: (percent) => `${percent}% à esquerda`,
    right: (percent) => `${percent}% à direita`,
    swap: { title: 'Inverter canais', note: 'A esquerda vira a direita. Para um cabo ligado ao contrário.' },

    headphones: 'Fones de ouvido',
    crossfeed: 'Crossfeed',
    crossfeedNote:
      'Um pouco de cada canal chega ao ouvido oposto, atrasado e abafado, como chegaria de caixas de som. Alivia o cansaço de mixagens antigas com os canais muito separados. Em caixas de som, não faz nada que valha a pena.',

    rotation: 'Rotação',
    depth: 'Profundidade',
    turnTakes: 'Uma volta leva',
    seconds: (count) => `${count}s`,
    rotationNote:
      'O que chamam de 8D: o som gira devagar à sua volta. Feito para fones de ouvido — numa caixa de som é só o volume indo e vindo.',

    level: 'Nível',
    preamp: 'Pré-amplificador',
    decibels: (value) => `${value > 0 ? '+' : ''}${format.decimal(value, 1)} dB`,
    levelNote:
      'Abaixe isto se a largura ou o equalizador fizer algo estalar: é o som dos picos mais altos ficando sem espaço.',
  },

  transitions: {
    missing: 'Esta versão do app ainda não tem transições.',
    title: 'Crossfade',
    about: 'Uma faixa continua tocando enquanto a próxima começa, então não se ouve a emenda.',
    betweenTracks: 'Entre faixas',
    overlap: 'Sobreposição',
    overlapNote:
      'Por quanto tempo a próxima faixa toca por cima do fim da que está saindo. Zero deixa as faixas terminarem do jeito normal.',
    albums: {
      title: 'Manter álbuns juntos',
      note:
        'Sem crossfade entre faixas seguidas de um mesmo álbum. Um disco ao vivo, ou qualquer coisa mixada para tocar sem pausa, já foi feito para ter essa emenda.',
    },
    others: {
      manualMs: {
        label: 'Ao pular',
        hint:
          'Ao tocar em próxima ou anterior. Mantenha curto — um botão que responde tarde deixa de parecer conectado.',
      },
      pauseMs: {
        label: 'Ao pausar e retomar',
        hint: 'Suaviza a parada e a volta.',
      },
      seekMs: {
        label: 'Ao mudar a posição',
        hint: 'Depois de arrastar a barra de progresso, que de outro modo cai no meio da onda e estala.',
      },
    },
    equalPower: {
      title: 'Curva de potência constante',
      note:
        'Duas faixas a meio volume, juntas, não soam como uma a volume cheio. Esta curva mantém o nível durante a sobreposição; a linear afunda no meio.',
    },
    fewer: 'Menos ajustes',
    more: 'Outras transições',
    reset: 'Restaurar padrões',
    seconds: (written) => `${written}s`,
  },

  equalizer: {
    missing: 'Esta versão do app ainda não tem o equalizador.',
    title: 'Equalizador',
    attached: 'Moldando o que está tocando agora.',
    saved: 'Salvo, e aplicado assim que algo tocar.',
    carried:
      'O que estava configurado no equalizador do próprio celular foi trazido para cá e está guardado em Predefinições como “Equalizador do celular”. É a mesma curva feita com as bandas deste equalizador, e agora ela deixa espaço para o que reforça, então pode soar um pouco mais baixa do que antes.',
    lost:
      'Não foi possível trazer o que estava configurado no equalizador do próprio celular: as bandas dele não puderam ser associadas a frequências. Este começa plano.',

    presets: 'Predefinições',
    saveAs: 'Salvar como…',
    rename: 'Renomear…',
    confirmDelete: (name) => `Excluir “${name}”?`,
    importAutoEq: 'Importar do AutoEQ…',
    keptAs: (name) => `Salvo como “${name}”.`,
    renamedTo: (name) => `Renomeado para “${name}”.`,

    bands: 'Bandas',
    noBands:
      'Nenhuma banda, ou seja, plano: a música como foi gravada. Adicione uma, escolha uma predefinição ou importe uma correção para os seus fones.',
    addBand: 'Adicionar banda',
    full: (most) => `Só há espaço para ${most} bandas.`,

    preamp: 'Pré-amplificador',
    automatic: 'Automático',
    byHand: 'Manual',
    nothingBoosted: 'Nada é reforçado, então nada é abaixado para abrir espaço.',
    turnedDown: (by) =>
      `Tudo é abaixado em ${by}, o mesmo tanto que o ponto mais alto da curva aumenta. É o espaço de que um reforço precisa para não distorcer.`,
    typeIt: (now) => `Digitar · ${now}`,
    typePreamp: (now) => `Digitar o pré-amplificador, agora ${now}`,
    clipsAbove: (level) =>
      `Acima de ${level}, os trechos mais altos podem distorcer, o que se ouve como o som se quebrando.`,
    lowEnough: 'Baixo o bastante para que nada do que esta curva reforça chegue a distorcer.',

    unbuilt:
      'Esta versão do app ainda toca pelo equalizador do próprio celular, que esta tela já não configura. As bandas chegam na próxima versão; os controles abaixo funcionam como antes.',

    tone: 'Timbre',
    bassBoost: 'Reforço de graves',
    surround: 'Surround',
    loudness: 'Loudness',
    toneNote:
      'Estes três são efeitos do próprio celular, aplicados depois das bandas. O loudness levanta uma gravação baixa sem mexer no timbre. Se exagerado, distorce, o que se ouve como as partes altas se quebrando.',
    resetAll: 'Redefinir tudo',

    prompt: {
      keepCurveAs: 'Salvar esta curva como',
      keepCorrectionAs: 'Salvar esta correção como',
      namePlaceholder: 'Um nome, como o dos fones a que se destina',
      keep: 'Salvar',
      aName: 'Um nome',
      set: 'Definir',
      preampHint: (least, most) => `Em decibéis, de ${least} a ${most}.`,
      frequency: (band) => `Frequência da banda ${band}`,
      frequencyHint: (least, most) =>
        `Em hertz, de ${least} a ${most}. 1,2k é entendido como 1200.`,
      gain: (band) => `Ganho da banda ${band}`,
      gainHint: (most) => `Em decibéis, de -${most} a ${most}.`,
      q: (band) => `Q da banda ${band}`,
      qHint: (least, most) => `De ${least} a ${most}.`,
    },
  },

  presets: {
    builtIn: {
      Flat: 'Plano',
      'More bass': 'Mais graves',
      'Less boom': 'Graves mais limpos',
      Warm: 'Quente',
      'Voices forward': 'Vozes à frente',
      'More air': 'Mais brilho',
      'Quiet listening': 'Volume baixo',
    },
    myCurve: 'Minha curva',
  },

  band: {
    types: { peak: 'Pico', lowShelf: 'Shelf de graves', highShelf: 'Shelf de agudos' },
    said: (band, type, frequency, gain, q) =>
      `Banda ${band}: ${type}, ${frequency}, ${gain}, Q ${q}`,
    closes: 'Fecha esta banda',
    opens: 'Abre esta banda para alterá-la',
    kind: (band, type) => `Tipo da banda ${band}: ${type}`,
    frequency: 'Frequência',
    gain: 'Ganho',
    widthQ: 'Largura (Q)',
    cornerQ: 'Inclinação (Q)',
    peakHint: 'Um Q maior é uma banda mais estreita: 1 é pouco mais de uma oitava, 10 é uma única nota.',
    shelfHint:
      'Um shelf aumenta ou diminui tudo de um lado da sua frequência. O Q é o quanto a curva é acentuada; 0,7 é o comum.',
    typeIt: 'Digitar',
    typeFrequency: (band, now) => `Digitar a frequência da banda ${band}, agora ${now}`,
    typeGain: (band, now) => `Digitar o ganho da banda ${band}, agora ${now}`,
    typeQ: (band, now) => `Digitar o Q da banda ${band}, agora ${now}`,
    remove: (band) => `Remover a banda ${band}`,
    removeThis: 'Remover esta banda',
  },

  curve: {
    label: (said) => `Curva de resposta. ${said}`,
    flat: 'Plana: nada é aumentado ou diminuído.',
    highest: (level, near) => `Máximo de ${level} perto de ${near}.`,
    lowest: (level, near) => `Mínimo de ${level} perto de ${near}.`,
    highestAndLowest: (high, highNear, low, lowNear) =>
      `Máximo de ${high} perto de ${highNear}, mínimo de ${low} perto de ${lowNear}.`,
  },

  autoEq: {
    title: 'Importar do AutoEQ',
    about: 'Cole o conteúdo do ParametricEQ.txt de um fone de ouvido ou escolha o arquivo.',
    textLabel: 'O texto do arquivo ParametricEQ',
    chooseFile: 'Escolher um arquivo…',

    graphic:
      'Esse é o arquivo GraphicEQ, que é para outro tipo de equalizador. O que deve ser usado é o ParametricEQ.txt.',
    noneSupported: 'Nenhum dos filtros desse texto é de um tipo que este equalizador tem.',
    noneFound:
      'Nenhum filtro foi encontrado nesse texto. Uma linha deve ser parecida com “Filter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70”.',
    imported: (count) => oneOrMany(count, '1 banda importada.', `${count} bandas importadas.`),
    leftOut: (count, room) =>
      oneOrMany(
        count,
        `Mais 1 ficou de fora: só há espaço para ${room}.`,
        `Mais ${count} ficaram de fora: só há espaço para ${room}.`
      ),
    unsupported: (count) =>
      oneOrMany(
        count,
        '1 filtro era de um tipo que este equalizador não tem e foi ignorado.',
        `${count} filtros eram de um tipo que este equalizador não tem e foram ignorados.`
      ),
    adjusted: (count) =>
      oneOrMany(
        count,
        '1 estava fora dos limites de uma banda e foi trazido para dentro deles.',
        `${count} estavam fora dos limites de uma banda e foram trazidos para dentro deles.`
      ),
  },
};
