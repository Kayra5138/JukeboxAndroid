import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import type { PeriodId, Which } from '../../stats/period.ts';
import { oneOrMany } from '../write.ts';

/*
  A period is not one phrase dropped into every sentence: it is "hoje" in one,
  "de hoje" in another, "vs. ontem" beside a percentage, and the article and
  preposition change with it ("na semana passada", "do mês passado", "das
  últimas 24 horas"). So every sentence is written out for every period.
*/
type Said = Record<Exclude<PeriodId, 'all'>, string>;

/** One wording for each reading of each period, and one for all time, which has a single reading. */
const by = (period: PeriodId, which: Which, said: Record<Which, Said> & { all: string }) =>
  period === 'all' ? said.all : said[which][period];

/** The period as an adverb, ending a sentence: "O que você mais ouviu esta semana". */
const when = (period: PeriodId, which: Which) =>
  by(period, which, {
    this: { day: 'hoje', week: 'esta semana', month: 'este mês', year: 'este ano' },
    last: { day: 'ontem', week: 'na semana passada', month: 'no mês passado', year: 'no ano passado' },
    rolling: {
      day: 'nas últimas 24 horas',
      week: 'nos últimos 7 dias',
      month: 'nos últimos 30 dias',
      year: 'nos últimos 12 meses',
    },
    all: 'até agora',
  });

const arrow = (change: number) => (change >= 0 ? '↑' : '↓');

/* Monday first. Lowercase, as Portuguese writes them inside a date; a label raises the first letter. */
const weekdays = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
const months = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const capitalised = (line: string) => line.charAt(0).toUpperCase() + line.slice(1);

export const stats: Strings['stats'] = {
  percent: (value) => `${value}%`,

  period: {
    labels: { day: 'Dia', week: 'Semana', month: 'Mês', year: 'Ano', all: 'Tudo' },
    which: {
      day: { last: 'Ontem', this: 'Hoje', rolling: 'Últimas 24 horas' },
      week: { last: 'Semana passada', this: 'Esta semana', rolling: 'Últimos 7 dias' },
      month: { last: 'Mês passado', this: 'Este mês', rolling: 'Últimos 30 dias' },
      year: { last: 'Ano passado', this: 'Este ano', rolling: 'Últimos 12 meses' },
    },
    allTime: 'Desde o início',
    monthOf: (date) => `${format.monthsShort[date.getMonth()]} ${date.getFullYear()}`,
    versus: (period, which) =>
      period === 'all'
        ? ''
        : by(period, which, {
            this: { day: 'vs. ontem', week: 'vs. semana passada', month: 'vs. mês passado', year: 'vs. ano passado' },
            last: { day: 'vs. dia anterior', week: 'vs. semana anterior', month: 'vs. mês anterior', year: 'vs. ano anterior' },
            rolling: {
              day: 'vs. 24 horas anteriores',
              week: 'vs. 7 dias anteriores',
              month: 'vs. 30 dias anteriores',
              year: 'vs. 12 meses anteriores',
            },
            all: '',
          }),
  },

  duration: {
    seconds: (seconds) => `${seconds}s`,
    minutes: (minutes) => `${minutes}min`,
    hours: (hours) => `${hours}h`,
    hoursMinutes: (hours, minutes) => `${hours}h ${minutes}min`,
  },

  figures: {
    plays: 'Reproduções',
    tracks: 'Faixas',
    artists: 'Artistas',
    finished: 'Completas',
    aDay: 'Por dia',
    peakHour: 'Hora de pico',
    streak: 'Sequência',
    days: (count) => `${count} ${oneOrMany(count, 'dia', 'dias')}`,
  },

  chart: {
    day: (date) =>
      `${capitalised(weekdays[(date.getDay() + 6) % 7]!)}, ${date.getDate()} de ${months[date.getMonth()]}`,
    month: (date) => `${capitalised(months[date.getMonth()]!)} de ${date.getFullYear()}`,
  },

  screen: {
    emptyTitle: 'Nada ouvido ainda.',
    emptyBody:
      'Uma faixa conta depois que você ouve trinta segundos dela, ou metade, se ela tiver menos de um minuto.',
    recap: 'Retrospectiva',
    openRecap: 'Abrir sua retrospectiva',
    changeFigure: (change) => `${arrow(change)} ${Math.abs(change)}%`,
    against: (comparison, before) => (before ? `${comparison} · ${before}` : comparison),
    nothingYet: 'Nada ainda neste período',
    time: 'Tempo',
    plays: 'Reproduções',
    playsCount: (count) => `${count} ${oneOrMany(count, 'reprodução', 'reproduções')}`,
    was: (before) => `antes: ${before}`,
    lists: { tracks: 'Faixas', artists: 'Artistas', genres: 'Gêneros' },
    lookUpForGenres: 'Consulte as faixas para reunir gêneros.',
    nothingInPeriod: 'Nada neste período.',
  },

  report: {
    tracksHeading: 'Suas faixas mais ouvidas',
    tracksLead: (period, which) => `O que você mais ouviu ${when(period, which)}`,
    artistsHeading: 'Seus artistas mais ouvidos',
    artistsLead: (period, which) => `Quem esteve com você ${when(period, which)}`,
    genresHeading: 'Seu som',
    genresLead: (period, which) =>
      by(period, which, {
        this: { day: 'A cara de hoje', week: 'A cara desta semana', month: 'A cara deste mês', year: 'A cara deste ano' },
        last: {
          day: 'A cara de ontem',
          week: 'A cara da semana passada',
          month: 'A cara do mês passado',
          year: 'A cara do ano passado',
        },
        rolling: {
          day: 'A cara das últimas 24 horas',
          week: 'A cara dos últimos 7 dias',
          month: 'A cara dos últimos 30 dias',
          year: 'A cara dos últimos 12 meses',
        },
        all: 'A cara de tudo até agora',
      }),
    clockHeading: 'Seus horários',
    /* [hour] is `14:00`; one o'clock takes the singular, "da 01:00". */
    clockLead: (hour) => `Você ouviu mais por volta ${hour.startsWith('01:') ? 'da' : 'das'} ${hour}`,
    numbersHeading: 'Em números',
    streakDays: (count) => oneOrMany(count, '1 dia', `${count} dias`),
  },

  cards: {
    listenedFor: 'Você ouviu por',
    change: (change, comparison) => `${arrow(change)} ${Math.abs(change)}% ${comparison}`,
    numberOne: 'NÚMERO UM',
    plays: (count) => oneOrMany(count, '1 reprodução', `${count} reproduções`),
    mostPlayed: 'Mais tocada',
    mostPlayedArtist: 'Artista mais ouvido',
    credit: (photographer, licence) => `Foto: ${photographer} / ${licence}`,
    creditUnnamed: (licence) => `Foto: ${licence}`,
  },

  viewer: {
    share: 'Compartilhar',
    saved: 'Salvo na sua galeria.',
    cannotSave: 'Instale a versão atualizada para Android para salvar imagens.',
    cannotShare: 'Instale a versão atualizada para Android para compartilhar imagens.',
    failed: 'Não deu certo. Tente de novo.',
  },
};
