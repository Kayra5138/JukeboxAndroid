import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const player: Strings['player'] = {
  bar: {
    opensPlayer: 'Abre o player',
  },
  sheet: {
    nothingPlaying: 'Nada tocando.',
    heart: 'Curtir',
    repeat: { off: 'Repetir', all: 'Repetir tudo', one: 'Repetir faixa' },
    back: (seconds) => oneOrMany(seconds, 'Voltar 1 segundo', `Voltar ${seconds} segundos`),
    forward: (seconds) =>
      oneOrMany(seconds, 'Avançar 1 segundo', `Avançar ${seconds} segundos`),
    shuffleQueue: 'Embaralhar a fila',
    playbackSettings: 'Ajustes de reprodução',
    lyrics: 'Letra',
    translateLyrics: 'Traduzir a letra',
    upNext: (count) => `A seguir · ${format.number(count)}`,
    position: 'Posição da reprodução',
    positionValue: (position, duration) => `${position} de ${duration}`,
  },
  queue: {
    remove: (title) => `Remover ${title}`,
    movedTo: (position, count) => `Agora na posição ${format.number(position)} de ${format.number(count)}`,
    auto: {
      library: 'Músicas parecidas · escolhidas para você',
      fresh: 'Músicas novas · do Descobrir',
      mixed: 'Parecidas e novas · escolhidas para você',
      remove: 'Remover',
      removeLabel: 'Remover as músicas escolhidas para você',
      removeHint: 'Nenhuma outra é adicionada a esta fila até você tocar outra coisa.',
      notes: {
        offline: 'Sem conexão, então estas são da sua biblioteca.',
        wifi: 'O Descobrir está esperando o Wi-Fi, então estas são da sua biblioteca.',
        unavailable: 'As músicas novas precisam do downloader do YouTube, então estas são da sua biblioteca.',
        waiting: 'As músicas novas ainda estão sendo baixadas; enquanto isso, toca a sua biblioteca.',
      },
    },
  },
  settings: {
    playback: 'Reprodução',
    backToNormal: 'Voltar à velocidade e ao tom normais',
    normal: 'Normal',
    speed: 'Velocidade',
    pitch: 'Tom',
    pitchHint: 'Em semitons, para cima ou para baixo, com a gravação seguindo na velocidade acima.',
    effects: 'Efeitos',
    equalizer: { note: 'Bandas, graves e loudness' },
    crossfade: { note: 'Como uma faixa dá lugar à próxima' },
    allEffects: { title: 'Todos os efeitos', note: 'Largura, crossfeed, rotação e nível' },
  },
  sleepTimer: {
    title: 'Timer para dormir',
    cancel: 'Cancelar o timer',
    unsupported: 'Instale a versão atualizada para Android para usar o timer.',
    about: 'Pausa a música depois de um tempo. O último meio minuto fica mais baixo.',
    pauseAfter: (minutes) => `Pausar depois de ${minutes} ${oneOrMany(minutes, 'minuto', 'minutos')}`,
    pauseAfterTyped: 'Pausar depois de um número de minutos que você digitar',
    custom: 'Outro…',
    pauseAtEnd: 'Pausar no fim desta faixa',
    endOfTrack: 'Fim da faixa',
    finish: {
      title: 'Deixar a faixa atual terminar',
      note: 'Quando o tempo acabar, espera a música terminar em vez de abaixar o volume até sumir.',
      label: 'Deixar a faixa atual terminar quando o timer acabar',
    },
    refused: (most) => `Um número inteiro de minutos, de 1 a ${most}`,
    howMany: 'Pausar depois de quantos minutos?',
    minutes: 'Minutos',
    start: 'Iniciar',
  },
  sleep: {
    endOfTrack: 'Pausa quando esta faixa terminar',
    thenToTheEnd: (time) => `Faltam ${time}, depois até o fim da faixa`,
    fadingOut: (time) => `Abaixando o volume, faltam ${time}`,
    pausesIn: (time) => `Pausa em ${time}`,
  },
};
