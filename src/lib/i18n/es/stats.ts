import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';
import type { PeriodId, Which } from '../../stats/period.ts';

/*
  A period is said two ways inside the recap's sentences: as a time on its own
  ("esta semana", "en los últimos 7 días", "hasta ahora") and after "de" as a
  possession ("de esta semana", "de los últimos 7 días", "de siempre"). Each is
  written out in full, because the article and the "de" fuse ("del mes
  pasado") and all time is a different phrase in each.

  The recap's leads are written without a verb in the past ("Lo más escuchado
  esta semana", "Tu compañía de ayer"), which avoids choosing between "has
  escuchado" (Spain) and "escuchaste" (Latin America).
*/
type Said = Record<Exclude<PeriodId, 'all'>, string>;

const by = (period: PeriodId, which: Which, said: Record<Which, Said> & { all: string }) =>
  period === 'all' ? said.all : said[which][period];

/** The period as a time of its own: `esta semana`. */
const when = (period: PeriodId, which: Which) =>
  by(period, which, {
    this: { day: 'hoy', week: 'esta semana', month: 'este mes', year: 'este año' },
    last: { day: 'ayer', week: 'la semana pasada', month: 'el mes pasado', year: 'el año pasado' },
    rolling: {
      day: 'en las últimas 24 horas',
      week: 'en los últimos 7 días',
      month: 'en los últimos 30 días',
      year: 'en los últimos 12 meses',
    },
    all: 'hasta ahora',
  });

/** The period after "de": `de esta semana`. */
const of = (period: PeriodId, which: Which) =>
  by(period, which, {
    this: { day: 'de hoy', week: 'de esta semana', month: 'de este mes', year: 'de este año' },
    last: { day: 'de ayer', week: 'de la semana pasada', month: 'del mes pasado', year: 'del año pasado' },
    rolling: {
      day: 'de las últimas 24 horas',
      week: 'de los últimos 7 días',
      month: 'de los últimos 30 días',
      year: 'de los últimos 12 meses',
    },
    all: 'de siempre',
  });

const arrow = (change: number) => (change >= 0 ? '↑' : '↓');

/* Spanish writes the names of days and months in small letters. */
const weekdays = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const months = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/* The per cent sign is written after a non-breaking space in Spanish: `12 %`. */
const percent = (value: number) => `${value} %`;

export const stats: Strings['stats'] = {
  percent,

  period: {
    labels: { day: 'Día', week: 'Semana', month: 'Mes', year: 'Año', all: 'Todo' },
    which: {
      day: { last: 'Ayer', this: 'Hoy', rolling: 'Últimas 24 horas' },
      week: { last: 'Semana pasada', this: 'Esta semana', rolling: 'Últimos 7 días' },
      month: { last: 'Mes pasado', this: 'Este mes', rolling: 'Últimos 30 días' },
      year: { last: 'Año pasado', this: 'Este año', rolling: 'Últimos 12 meses' },
    },
    allTime: 'Desde siempre',
    monthOf: (date) => `${format.monthsShort[date.getMonth()]} ${date.getFullYear()}`,
    versus: (period, which) =>
      by(period, which, {
        this: {
          day: 'frente a ayer',
          week: 'frente a la semana pasada',
          month: 'frente al mes pasado',
          year: 'frente al año pasado',
        },
        last: {
          day: 'frente al día anterior',
          week: 'frente a la semana anterior',
          month: 'frente al mes anterior',
          year: 'frente al año anterior',
        },
        rolling: {
          day: 'frente a las 24 horas anteriores',
          week: 'frente a los 7 días anteriores',
          month: 'frente a los 30 días anteriores',
          year: 'frente a los 12 meses anteriores',
        },
        all: '',
      }),
  },

  /* Tight, as the English is: these sit in cards a few characters wide. */
  duration: {
    seconds: (seconds) => `${seconds}s`,
    minutes: (minutes) => `${minutes}min`,
    hours: (hours) => `${hours}h`,
    hoursMinutes: (hours, minutes) => `${hours}h ${minutes}min`,
  },

  figures: {
    plays: 'Escuchas',
    tracks: 'Pistas',
    artists: 'Artistas',
    finished: 'Completas',
    aDay: 'Al día',
    peakHour: 'Hora favorita',
    streak: 'Racha',
    days: (count) => `${count} ${oneOrMany(count, 'día', 'días')}`,
  },

  chart: {
    /* `Jueves, 24 de septiembre`. */
    day: (date) =>
      `${capitalised(weekdays[(date.getDay() + 6) % 7]!)}, ${date.getDate()} de ${months[date.getMonth()]}`,
    /* `Septiembre de 2026`. */
    month: (date) => `${capitalised(months[date.getMonth()]!)} de ${date.getFullYear()}`,
  },

  screen: {
    emptyTitle: 'Aún no has escuchado nada.',
    emptyBody:
      'Una pista cuenta cuando has escuchado treinta segundos de ella, o la mitad si dura menos de un minuto.',
    recap: 'Resumen',
    openRecap: 'Abrir tu resumen',
    changeFigure: (change) => `${arrow(change)} ${percent(Math.abs(change))}`,
    against: (comparison, before) => (before ? `${comparison} · ${before}` : comparison),
    nothingYet: 'Aún no hay nada en este periodo',
    time: 'Tiempo',
    plays: 'Escuchas',
    playsCount: (count) => `${count} ${oneOrMany(count, 'escucha', 'escuchas')}`,
    was: (before) => `antes: ${before}`,
    lists: { tracks: 'Pistas', artists: 'Artistas', genres: 'Géneros' },
    lookUpForGenres: 'Busca los datos de las pistas para reunir géneros.',
    nothingInPeriod: 'Nada en este periodo.',
  },

  report: {
    tracksHeading: 'Tus canciones favoritas',
    tracksLead: (period, which) => `Lo más escuchado ${when(period, which)}`,
    artistsHeading: 'Tus artistas favoritos',
    artistsLead: (period, which) => `Tu compañía ${of(period, which)}`,
    genresHeading: 'Tu sonido',
    genresLead: (period, which) => `Los colores ${of(period, which)}`,
    clockHeading: 'Tus horas',
    /* [hour] is `14:00`; one o'clock takes the singular article, `la 01:00`. */
    clockLead: (hour) => `Escuchas sobre todo hacia ${hour.startsWith('01:') ? 'la' : 'las'} ${hour}`,
    numbersHeading: 'En cifras',
    streakDays: (count) => oneOrMany(count, '1 día', `${count} días`),
  },

  cards: {
    listenedFor: 'Tiempo de escucha',
    change: (change, comparison) => `${arrow(change)} ${percent(Math.abs(change))} ${comparison}`,
    numberOne: 'NÚMERO UNO',
    plays: (count) => oneOrMany(count, '1 escucha', `${count} escuchas`),
    mostPlayed: 'Lo más escuchado',
    mostPlayedArtist: 'Artista más escuchado',
    credit: (photographer, licence) => `Foto: ${photographer} / ${licence}`,
    creditUnnamed: (licence) => `Foto: ${licence}`,
  },

  viewer: {
    share: 'Compartir',
    saved: 'Guardado en tu galería.',
    cannotSave: 'Instala la versión actualizada de la app para guardar imágenes.',
    cannotShare: 'Instala la versión actualizada de la app para compartir imágenes.',
    failed: 'No ha funcionado. Inténtalo de nuevo.',
  },
};
