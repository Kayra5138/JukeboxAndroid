import { format } from './format.ts';
import { oneOrMany } from '../write.ts';
import type { PeriodId } from '../../stats/period.ts';

/*
  The periods are said three ways and each is its own line, because the next
  language inflects them differently in each place: `this week` as the end of
  a sentence, `vs last week` beside a percentage, `This week` as a title.
*/

/** What the period is called in the second person, on the cards themselves. */
function saidAs(period: PeriodId): string {
  switch (period) {
    case 'day':
      return 'today';
    case 'week':
      return 'this week';
    case 'month':
      return 'this month';
    case 'year':
      return 'this year';
    case 'all':
      return 'so far';
  }
}

const arrow = (change: number) => (change >= 0 ? '↑' : '↓');

/** Monday first. */
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** The stats tab, its charts, and the recap cards. */
export const stats = {
  /** `12%`, which is not where every language puts the sign. */
  percent: (value: number) => `${value}%`,

  period: {
    labels: { day: 'Day', week: 'Week', month: 'Month', year: 'Year', all: 'All' },
    today: 'Today',
    thisWeek: 'This week',
    allTime: 'All time',
    /** A month as a title: `Sep 2026`. */
    monthOf: (date: Date) => `${format.monthsShort[date.getMonth()]} ${date.getFullYear()}`,
    /** What a total is being compared against. Nothing for all time, which has nothing before it. */
    versus: (period: PeriodId): string => {
      switch (period) {
        case 'day':
          return 'vs yesterday';
        case 'week':
          return 'vs last week';
        case 'month':
          return 'vs last month';
        case 'year':
          return 'vs last year';
        case 'all':
          return '';
      }
    },
  },

  /** `4h 12m`, `38m`, `45s`. */
  duration: {
    seconds: (seconds: number) => `${seconds}s`,
    minutes: (minutes: number) => `${minutes}m`,
    hours: (hours: number) => `${hours}h`,
    hoursMinutes: (hours: number, minutes: number) => `${hours}h ${minutes}m`,
  },

  /** The figures, named the same on the screen and on the card of them. */
  figures: {
    plays: 'Plays',
    tracks: 'Tracks',
    artists: 'Artists',
    finished: 'Finished',
    aDay: 'A day',
    peakHour: 'Peak hour',
    streak: 'Streak',
    days: (count: number) => `${count} ${oneOrMany(count, 'day', 'days')}`,
  },

  chart: {
    /** A column that is a day, said in full: `Thursday 24 September`. */
    day: (date: Date) =>
      `${weekdays[(date.getDay() + 6) % 7]} ${date.getDate()} ${months[date.getMonth()]}`,
    /** A column that is a month: `September 2026`. */
    month: (date: Date) => `${months[date.getMonth()]} ${date.getFullYear()}`,
  },

  screen: {
    emptyTitle: 'Nothing listened to yet.',
    emptyBody:
      'A track counts once you have heard thirty seconds of it, or half of it for anything under a minute.',
    recap: 'Recap',
    openRecap: 'Open your recap',
    /** `↑ 12%`, the half of the comparison that is coloured. */
    changeFigure: (change: number) => `${arrow(change)} ${Math.abs(change)}%`,
    /** The half that is not: [comparison] is `period.versus`, [before] the earlier figure. */
    against: (comparison: string, before: string | null) =>
      before ? `${comparison} · ${before}` : comparison,
    nothingYet: 'Nothing yet in this period',
    time: 'Time',
    plays: 'Plays',
    playsCount: (count: number) => `${count} ${oneOrMany(count, 'play', 'plays')}`,
    was: (before: string) => `was ${before}`,
    /** The headings of the three lists of what was played most. */
    lists: { tracks: 'Tracks', artists: 'Artists', genres: 'Genres' },
    lookUpForGenres: 'Look tracks up to collect genres.',
    nothingInPeriod: 'Nothing in this period.',
  },

  /** What the recap's cards are headed with; see `stats/report.ts`. */
  report: {
    tracksHeading: 'Your top tracks',
    tracksLead: (period: PeriodId) => `What you reached for ${saidAs(period)}`,
    artistsHeading: 'Your top artists',
    artistsLead: (period: PeriodId) => `Who you spent ${saidAs(period)} with`,
    genresHeading: 'Your sound',
    genresLead: (period: PeriodId) => `The shape of ${saidAs(period)}`,
    clockHeading: 'Your hours',
    clockLead: (hour: string) => `You listened most around ${hour}`,
    numbersHeading: 'By the numbers',
    streakDays: (count: number) => oneOrMany(count, '1 day', `${count} days`),
  },

  /** What is drawn on the cards themselves. */
  cards: {
    listenedFor: 'You listened for',
    /** `↑ 12% vs yesterday`; [comparison] is `period.versus`. */
    change: (change: number, comparison: string) =>
      `${arrow(change)} ${Math.abs(change)}% ${comparison}`,
    numberOne: 'NUMBER ONE',
    plays: (count: number) => oneOrMany(count, '1 play', `${count} plays`),
    mostPlayed: 'Most played',
    mostPlayedArtist: 'Most played artist',
    /**
     * How a photograph is credited. The photographer's name and the licence
     * are theirs and go in as they are; only the word in front is ours.
     */
    credit: (photographer: string, licence: string) => `Photo: ${photographer} / ${licence}`,
    creditUnnamed: (licence: string) => `Photo: ${licence}`,
  },

  viewer: {
    share: 'Share',
    saved: 'Saved to your gallery.',
    cannotSave: 'Install the updated Android build to save pictures.',
    cannotShare: 'Install the updated Android build to share pictures.',
    failed: 'That did not work. Please try again.',
  },
};
