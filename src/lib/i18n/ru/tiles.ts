import { counted } from './plural.ts';
import type { Strings } from '../en/index.ts';

const NB = ' ';

export const tiles: Strings['tiles'] = {
  speeds: { easy: 'Легко', normal: 'Нормально', hard: 'Сложно', harder: 'Очень сложно' },

  setup: {
    title: 'Играй под музыку',
    noTrack: 'Включи трек, и клавиши будут построены по нему.',
    making: 'Анализ записи…',
    missing: 'Эту запись не удаётся прочитать.',
    record: (title, keys) => `${title ?? 'Эта запись'} — ${counted(keys, 'клавиша', 'клавиши', 'клавиш')}`,
    latency:
      'В беспроводные наушники звук приходит с опозданием. Если клавиши отстают от музыки, двигай эту настройку, пока они не совпадут.',
    earlier: `−20${NB}мс`,
    later: `+20${NB}мс`,
    offset: (ms) => `${ms}${NB}мс`,
    start: 'Играть с начала',
    starting: 'Запуск…',
    screenReader:
      'В этой игре нужно нажимать в такт музыке, а TalkBack перехватывает эти нажатия. Чтобы играть, приостанови TalkBack.',
  },

  hud: {
    score: (points) => `Счёт: ${points}`,
  },

  pause: {
    title: 'Пауза',
    resume: 'Продолжить',
    toMenu: 'В меню',
  },

  ending: {
    clean: 'Без единой ошибки',
    won: 'Получилось!',
    over: 'Игра окончена',
    lapse: 'Клавиша проскочила мимо.',
    empty: 'Нажатие пришлось мимо клавиш.',
    toTheEnd: 'До самого конца записи.',
    /* «из» takes the genitive: «из 1 клавиши», «из 5 клавиш». */
    figures: (hit, total, held, best, percent) =>
      `${hit} из ${counted(total, 'клавиши', 'клавиш', 'клавиш')}${held > 0 ? ` · удержано: ${held}` : ''} · лучшая серия: ${best} · ${percent}%`,
    again: 'Ещё раз',
  },
};
