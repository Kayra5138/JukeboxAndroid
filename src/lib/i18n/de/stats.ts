import { format, NNBSP } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';
import type { PeriodId, Which } from '../../stats/period.ts';

/*
  In the recap's sentences a period is an adverbial — "heute", "letzte Woche",
  "in den letzten 7 Tagen", "bisher" — and every sentence below is built so
  that this one form fits it. The comparison beside a percentage is its own
  table, because there it is "zum Vortag", "zur Vorwoche" and so on.
*/
function saidAs(period: PeriodId, which: Which): string {
  if (period === 'all') return 'bisher';
  if (which === 'last') {
    return { day: 'gestern', week: 'letzte Woche', month: 'letzten Monat', year: 'letztes Jahr' }[period];
  }
  if (which === 'rolling') {
    return {
      day: 'in den letzten 24 Stunden',
      week: 'in den letzten 7 Tagen',
      month: 'in den letzten 30 Tagen',
      year: 'in den letzten 12 Monaten',
    }[period];
  }
  return { day: 'heute', week: 'diese Woche', month: 'diesen Monat', year: 'dieses Jahr' }[period];
}

const arrow = (change: number) => (change >= 0 ? '↑' : '↓');

const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const months = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export const stats: Strings['stats'] = {
  percent: (value) => `${value}${NNBSP}%`,

  period: {
    labels: { day: 'Tag', week: 'Woche', month: 'Monat', year: 'Jahr', all: 'Gesamt' },
    which: {
      day: { last: 'Gestern', this: 'Heute', rolling: 'Letzte 24 Stunden' },
      week: { last: 'Letzte Woche', this: 'Diese Woche', rolling: 'Letzte 7 Tage' },
      month: { last: 'Letzter Monat', this: 'Dieser Monat', rolling: 'Letzte 30 Tage' },
      year: { last: 'Letztes Jahr', this: 'Dieses Jahr', rolling: 'Letzte 12 Monate' },
    },
    allTime: 'Gesamtzeitraum',
    monthOf: (date) => `${format.monthsShort[date.getMonth()]} ${date.getFullYear()}`,
    /*
      Today is set against yesterday, this week against the one before it:
      the day, week, month or year before the one shown is what "Vortag",
      "Vorwoche", "Vormonat" and "Vorjahr" mean, whichever of the two
      readings is on screen.
    */
    versus: (period, which) => {
      if (period === 'all') return '';
      if (which === 'rolling') {
        return {
          day: 'zu den vorherigen 24 Stunden',
          week: 'zu den vorherigen 7 Tagen',
          month: 'zu den vorherigen 30 Tagen',
          year: 'zu den vorherigen 12 Monaten',
        }[period];
      }
      return { day: 'zum Vortag', week: 'zur Vorwoche', month: 'zum Vormonat', year: 'zum Vorjahr' }[period];
    },
  },

  /* `4 h 12 min`, with narrow spaces that keep it nearly as tight as the English. */
  duration: {
    seconds: (seconds) => `${seconds}${NNBSP}s`,
    minutes: (minutes) => `${minutes}${NNBSP}min`,
    hours: (hours) => `${hours}${NNBSP}h`,
    hoursMinutes: (hours, minutes) => `${hours}${NNBSP}h ${minutes}${NNBSP}min`,
  },

  figures: {
    plays: 'Wiedergaben',
    tracks: 'Titel',
    artists: 'Künstler',
    finished: 'Ganz gehört',
    aDay: 'Pro Tag',
    peakHour: 'Top-Stunde',
    streak: 'Serie',
    days: (count) => `${format.number(count)} ${oneOrMany(count, 'Tag', 'Tage')}`,
  },

  chart: {
    /** `Donnerstag, 24. September`. */
    day: (date) =>
      `${weekdays[(date.getDay() + 6) % 7]}, ${date.getDate()}. ${months[date.getMonth()]}`,
    month: (date) => `${months[date.getMonth()]} ${date.getFullYear()}`,
  },

  screen: {
    emptyTitle: 'Noch nichts gehört.',
    emptyBody:
      'Ein Titel zählt, sobald du dreißig Sekunden davon gehört hast – bei allem unter einer Minute die Hälfte.',
    recap: 'Rückblick',
    openRecap: 'Deinen Rückblick öffnen',
    changeFigure: (change) => `${arrow(change)} ${Math.abs(change)}${NNBSP}%`,
    against: (comparison, before) => (before ? `${comparison} · ${before}` : comparison),
    nothingYet: 'In diesem Zeitraum noch nichts',
    time: 'Zeit',
    plays: 'Wiedergaben',
    playsCount: (count) => `${format.number(count)} ${oneOrMany(count, 'Wiedergabe', 'Wiedergaben')}`,
    was: (before) => `vorher ${before}`,
    lists: { tracks: 'Titel', artists: 'Künstler', genres: 'Genres' },
    lookUpForGenres: 'Schlag Titel nach, um Genres zu sammeln.',
    nothingInPeriod: 'Nichts in diesem Zeitraum.',
  },

  report: {
    tracksHeading: 'Deine Top-Titel',
    tracksLead: (period, which) => `Was du ${saidAs(period, which)} am liebsten gehört hast`,
    artistsHeading: 'Deine Top-Künstler',
    artistsLead: (period, which) => `Mit wem du ${saidAs(period, which)} Zeit verbracht hast`,
    genresHeading: 'Dein Sound',
    genresLead: (period, which) => `Was ${saidAs(period, which)} den Ton angab`,
    clockHeading: 'Deine Hörzeiten',
    clockLead: (hour) => `Am meisten hast du gegen ${hour} Uhr gehört`,
    numbersHeading: 'In Zahlen',
    streakDays: (count) => oneOrMany(count, '1 Tag', `${format.number(count)} Tage`),
  },

  cards: {
    listenedFor: 'Deine Hörzeit',
    change: (change, comparison) => `${arrow(change)} ${Math.abs(change)}${NNBSP}% ${comparison}`,
    numberOne: 'NUMMER EINS',
    plays: (count) => oneOrMany(count, '1 Wiedergabe', `${format.number(count)} Wiedergaben`),
    mostPlayed: 'Meistgehört',
    mostPlayedArtist: 'Meistgehörter Künstler',
    credit: (photographer, licence) => `Foto: ${photographer} / ${licence}`,
    creditUnnamed: (licence) => `Foto: ${licence}`,
  },

  viewer: {
    share: 'Teilen',
    saved: 'In deiner Galerie gespeichert.',
    cannotSave: 'Installiere die aktualisierte Android-Version, um Bilder zu speichern.',
    cannotShare: 'Installiere die aktualisierte Android-Version, um Bilder zu teilen.',
    failed: 'Das hat nicht geklappt. Bitte versuch es erneut.',
  },
};
