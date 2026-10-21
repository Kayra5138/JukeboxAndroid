import type { Strings } from '../en/index.ts';

export const tiles: Strings['tiles'] = {
  speeds: { easy: 'Fácil', normal: 'Normal', hard: 'Difícil', harder: 'Mais difícil' },

  setup: {
    title: 'Toque junto',
    noTrack: 'Comece a tocar uma faixa, e as teclas são criadas a partir dela.',
    making: 'Ouvindo a faixa…',
    missing: 'Não é possível ler esta faixa.',
    record: (title, keys) => `${title ?? 'Esta faixa'} — ${keys} ${keys === 1 ? 'tecla' : 'teclas'}`,
    latency:
      'O som chega atrasado a fones sem fio. Se as teclas parecerem atrás da música, ajuste isto até as duas coincidirem.',
    earlier: '−20 ms',
    later: '+20 ms',
    offset: (ms) => `${ms} ms`,
    start: 'Tocar do início',
    starting: 'Iniciando…',
    screenReader:
      'Este jogo é jogado tocando na tela no ritmo da música, e o TalkBack fica com esses toques. Pause o TalkBack para jogar.',
  },

  hud: {
    score: (points) => `Pontuação: ${points}`,
  },

  pause: {
    title: 'Pausado',
    resume: 'Continuar',
    toMenu: 'Voltar ao menu',
  },

  ending: {
    clean: 'Sem erros',
    won: 'Você conseguiu',
    over: 'Fim de jogo',
    lapse: 'Uma tecla passou por você.',
    empty: 'Esse toque não acertou nada.',
    toTheEnd: 'Até o fim da faixa.',
    figures: (hit, total, held, best, percent) =>
      `${hit} de ${total} teclas${held > 0 ? ` · ${held} ${held === 1 ? 'segurada' : 'seguradas'}` : ''} · melhor sequência: ${best} · ${percent}%`,
    again: 'De novo',
  },
};
