import { format } from './format.ts';
import { plural } from './plural.ts';
import type { Strings } from '../en/index.ts';
import type { PeriodId, Which } from '../../stats/period.ts';

/*
  A period is said differently in each place it goes: «на этой неделе» at the
  end of a sentence, «к прошлой неделе» beside a percentage, «Эта неделя» as a
  title. Each sentence is written out for every period.

  The cards speak to the listener as «ты» but never in the past tense with
  «ты» as the subject, which in Russian would have to say whether the listener
  is a man or a woman («ты слушал» / «ты слушала»). The music is the subject
  instead: «что звучало», «кто звучал».
*/
type Said = Record<Exclude<PeriodId, 'all'>, string>;

const by = (period: PeriodId, which: Which, said: Record<Which, Said> & { all: string }) =>
  period === 'all' ? said.all : said[which][period];

/** When, as the end of a sentence: «…сегодня», «…на прошлой неделе», «…за последние 7 дней». */
const when = (period: PeriodId, which: Which) =>
  by(period, which, {
    this: { day: 'сегодня', week: 'на этой неделе', month: 'в этом месяце', year: 'в этом году' },
    last: { day: 'вчера', week: 'на прошлой неделе', month: 'в прошлом месяце', year: 'в прошлом году' },
    rolling: {
      day: 'за последние 24 часа',
      week: 'за последние 7 дней',
      month: 'за последние 30 дней',
      year: 'за последние 12 месяцев',
    },
    all: 'за всё время',
  });

const arrow = (change: number) => (change >= 0 ? '↑' : '↓');

/** Monday first. In the nominative, as the start of a date. */
const weekdays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
/** In the genitive, after the day of the month: «24 сентября». */
const monthsOf = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
/** In the nominative, standing alone before a year: «Сентябрь 2026». */
const months = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** A no-break space between a figure and its unit, so that «4 ч» is never split. */
const NB = ' ';

export const stats: Strings['stats'] = {
  percent: (value) => `${value}%`,

  period: {
    labels: { day: 'День', week: 'Неделя', month: 'Месяц', year: 'Год', all: 'Всё' },
    which: {
      day: { last: 'Вчера', this: 'Сегодня', rolling: 'Последние 24 часа' },
      week: { last: 'Прошлая неделя', this: 'Эта неделя', rolling: 'Последние 7 дней' },
      month: { last: 'Прошлый месяц', this: 'Этот месяц', rolling: 'Последние 30 дней' },
      year: { last: 'Прошлый год', this: 'Этот год', rolling: 'Последние 12 месяцев' },
    },
    allTime: 'За всё время',
    monthOf: (date) => `${format.monthsShort[date.getMonth()]} ${date.getFullYear()}`,
    /* «+12% к прошлой неделе», the way Russian sets one figure against another. */
    versus: (period, which) =>
      period === 'all'
        ? ''
        : by(period, which, {
            this: {
              day: 'к вчерашнему дню',
              week: 'к прошлой неделе',
              month: 'к прошлому месяцу',
              year: 'к прошлому году',
            },
            last: {
              day: 'к предыдущему дню',
              week: 'к предыдущей неделе',
              month: 'к предыдущему месяцу',
              year: 'к предыдущему году',
            },
            rolling: {
              day: 'к предыдущим 24 часам',
              week: 'к предыдущим 7 дням',
              month: 'к предыдущим 30 дням',
              year: 'к предыдущим 12 месяцам',
            },
            all: '',
          }),
  },

  duration: {
    seconds: (seconds) => `${seconds}${NB}с`,
    minutes: (minutes) => `${minutes}${NB}мин`,
    hours: (hours) => `${hours}${NB}ч`,
    hoursMinutes: (hours, minutes) => `${hours}${NB}ч ${minutes}${NB}мин`,
  },

  figures: {
    plays: 'Прослушивания',
    tracks: 'Треки',
    artists: 'Исполнители',
    finished: 'Дослушано',
    aDay: 'В день',
    peakHour: 'Пиковый час',
    streak: 'Серия',
    days: (count) => `${count} ${plural(count, 'день', 'дня', 'дней')}`,
  },

  chart: {
    day: (date) =>
      `${weekdays[(date.getDay() + 6) % 7]}, ${date.getDate()} ${monthsOf[date.getMonth()]}`,
    month: (date) => `${months[date.getMonth()]} ${date.getFullYear()}`,
  },

  screen: {
    emptyTitle: 'Прослушиваний пока нет.',
    emptyBody:
      'Трек засчитывается, когда прозвучало 30 секунд, а если он короче минуты — половина.',
    recap: 'Итоги',
    openRecap: 'Открыть итоги',
    changeFigure: (change) => `${arrow(change)} ${Math.abs(change)}%`,
    against: (comparison, before) => (before ? `${comparison} · ${before}` : comparison),
    nothingYet: 'За этот период пока ничего',
    time: 'Время',
    plays: 'Прослушивания',
    playsCount: (count) =>
      `${count} ${plural(count, 'прослушивание', 'прослушивания', 'прослушиваний')}`,
    was: (before) => `было ${before}`,
    lists: { tracks: 'Треки', artists: 'Исполнители', genres: 'Жанры' },
    lookUpForGenres: 'Найди сведения о треках, чтобы собрать жанры.',
    nothingInPeriod: 'За этот период ничего нет.',
  },

  report: {
    tracksHeading: 'Твои главные треки',
    tracksLead: (period, which) => `Что звучало чаще всего ${when(period, which)}`,
    artistsHeading: 'Твои главные исполнители',
    artistsLead: (period, which) => `Кто звучал чаще всего ${when(period, which)}`,
    genresHeading: 'Твой звук',
    genresLead: (period, which) => `Твоя музыка ${when(period, which)}`,
    clockHeading: 'Твои часы',
    clockLead: (hour) => `Чаще всего музыка звучала около ${hour}`,
    numbersHeading: 'В цифрах',
    streakDays: (count) => `${count} ${plural(count, 'день', 'дня', 'дней')}`,
  },

  cards: {
    listenedFor: 'Время с музыкой',
    change: (change, comparison) => `${arrow(change)} ${Math.abs(change)}% ${comparison}`,
    numberOne: 'НОМЕР ОДИН',
    plays: (count) => `${count} ${plural(count, 'прослушивание', 'прослушивания', 'прослушиваний')}`,
    mostPlayed: 'Главный трек',
    mostPlayedArtist: 'Главный исполнитель',
    credit: (photographer, licence) => `Фото: ${photographer} / ${licence}`,
    creditUnnamed: (licence) => `Фото: ${licence}`,
  },

  viewer: {
    share: 'Поделиться',
    saved: 'Сохранено в галерею.',
    cannotSave: 'Чтобы сохранять изображения, установи обновлённую сборку для Android.',
    cannotShare: 'Чтобы делиться изображениями, установи обновлённую сборку для Android.',
    failed: 'Не получилось. Попробуй ещё раз.',
  },
};
