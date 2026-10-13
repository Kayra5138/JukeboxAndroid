import { strings, type Strings } from '../i18n/languages.ts';

/**
 * The stretches of time a listening history is read in, and the columns a chart
 * of one is drawn from.
 *
 * All of it is calendar arithmetic done through `Date` rather than by adding
 * milliseconds. A day is not always 86,400 seconds where daylight saving is
 * observed, and a month never is; stepping with the constructor asks the
 * calendar instead of assuming, which is also what lets a month of 28, 30 or 31
 * columns fall out without a special case for any of them.
 *
 * Deliberately knows nothing about SQLite, so every boundary here can be tested
 * against a fixed clock rather than against whatever today happens to be.
 */

export type PeriodId = 'day' | 'week' | 'month' | 'year' | 'all';

/**
 * Which reading of a period: the one being lived through, the one before it,
 * or as much time as it holds counted back from now.
 *
 * A day is `today`, `yesterday`, or the last twenty-four hours, and they are
 * three different questions. Today at nine in the morning is an hour of
 * listening and says nothing yet; yesterday is the last whole day there is;
 * and the last twenty-four hours is the only one of the three that is always
 * a day long. All time has one reading, and is read the same whichever is
 * asked for.
 */
export type Which = 'this' | 'last' | 'rolling';

/** In the order they are offered: what was, what is, and the stretch that runs up to now. */
export const WHICH: Which[] = ['last', 'this', 'rolling'];

/** How many days a rolling month is. A calendar month is not a length; this is. */
const ROLLING_MONTH_DAYS = 30;

/** Half open: a play at `since` is in, a play at `until` belongs to the next one. */
export type Range = { since: number; until: number };

export type Bucket = {
  start: number;
  end: number;
  label: string;
  /** Whether the label is worth the room. Thirty-one of them will not fit. */
  major: boolean;
};

/** In the order they are offered. What each is called is `stats.period.labels`, by id. */
export const PERIODS: { id: PeriodId }[] = [
  { id: 'day' },
  { id: 'week' },
  { id: 'month' },
  { id: 'year' },
  { id: 'all' },
];

export const ALL_TIME: Range = { since: 0, until: Number.MAX_SAFE_INTEGER };

/*
  The names of days and months are written out in each language's `format`
  rather than asked of `toLocaleString`, for the same reason the date format
  is: Intl on React Native's engine has never been something to lean on, and
  the app choosing its own names is one less thing that changes underfoot when
  the phone's locale does.

  Wherever something here is worded, [t] is the language to word it in. A
  screen passes the table `useT()` gave it; left out, it is whatever the app
  is speaking at the moment of asking, which is English in a test.
*/

/** Past this many columns a monthly chart is redrawn a year at a time. */
const MAX_COLUMNS = 36;

function startOfDay(at: number): Date {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * The Monday on or before [at].
 *
 * `getDay` calls Sunday zero. Here the week ends on Sunday rather than
 * beginning with it, so it is shifted to six and everything else down by one.
 */
function startOfWeek(at: number): Date {
  const date = startOfDay(at);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function startOfMonth(at: number): Date {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(at: number): Date {
  return new Date(new Date(at).getFullYear(), 0, 1);
}

/**
 * The last moment of the period before the one [now] is in.
 *
 * Everything asked about a period that is over is asked as of this moment:
 * its range, its columns and its name are those of whatever period a clock
 * stopped here would call the present one.
 */
function lastOf(id: PeriodId, now: number): number {
  return rangeOf(id, now).since - 1;
}

/** [at] moved by whole hours, days or months on the calendar, the time of day kept. */
function moved(at: number, by: { hours?: number; days?: number; months?: number }): number {
  const date = new Date(at);
  if (by.months) date.setMonth(date.getMonth() + by.months);
  if (by.days) date.setDate(date.getDate() + by.days);
  if (by.hours) date.setHours(date.getHours() + by.hours);
  return +date;
}

/**
 * A stretch counted back from [now].
 *
 * Twenty-four hours is to the minute, and ends now. The others are in whole
 * days and whole months and end with the present one, which is what "the
 * last seven days" means to anybody who says it on a Tuesday afternoon:
 * today and the six before, and not from Tuesday afternoon a week ago.
 */
function rolling(id: PeriodId, now: number): Range {
  switch (id) {
    case 'day':
      // A play at this very moment is in, so the end is the moment after.
      return { since: moved(now, { hours: -24 }), until: now + 1 };
    case 'week': {
      const today = +startOfDay(now);
      return { since: moved(today, { days: -6 }), until: moved(today, { days: 1 }) };
    }
    case 'month': {
      const today = +startOfDay(now);
      return { since: moved(today, { days: 1 - ROLLING_MONTH_DAYS }), until: moved(today, { days: 1 }) };
    }
    case 'year': {
      const month = +startOfMonth(now);
      return { since: moved(month, { months: -11 }), until: moved(month, { months: 1 }) };
    }
    case 'all':
      return ALL_TIME;
  }
}

/** What [id] covers around [now], read as [which]. */
export function rangeOf(id: PeriodId, now: number, which: Which = 'this'): Range {
  if (id !== 'all' && which === 'last') return rangeOf(id, lastOf(id, now));
  if (id !== 'all' && which === 'rolling') return rolling(id, now);
  switch (id) {
    case 'day': {
      const start = startOfDay(now);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { since: +start, until: +end };
    }
    case 'week': {
      const start = startOfWeek(now);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { since: +start, until: +end };
    }
    case 'month': {
      const start = startOfMonth(now);
      return { since: +start, until: +new Date(start.getFullYear(), start.getMonth() + 1, 1) };
    }
    case 'year': {
      const start = startOfYear(now);
      return { since: +start, until: +new Date(start.getFullYear() + 1, 0, 1) };
    }
    case 'all':
      return ALL_TIME;
  }
}

/**
 * The same period one step back, for the figure a total is compared against.
 *
 * Found by asking what period the last millisecond before this one belonged to,
 * so the awkward cases answer themselves: the month before a 31-day month is
 * however long February is, and the day before the first of January is in the
 * previous year.
 *
 * Null for all time, which has nothing before it.
 */
export function previousRange(id: PeriodId, now: number, which: Which = 'this'): Range | null {
  if (id === 'all') return null;
  if (which === 'last') return previousRange(id, lastOf(id, now));
  if (which === 'rolling') {
    // As long a stretch again, ending where this one begins.
    const { since } = rolling(id, now);
    switch (id) {
      case 'day':
        return { since: moved(since, { hours: -24 }), until: since };
      case 'week':
        return { since: moved(since, { days: -7 }), until: since };
      case 'month':
        return { since: moved(since, { days: -ROLLING_MONTH_DAYS }), until: since };
      case 'year':
        return { since: moved(since, { months: -12 }), until: since };
    }
  }
  return rangeOf(id, rangeOf(id, now).since - 1);
}

/**
 * How the period is named on screen: `Today`, `Yesterday`, `Last 7 days`,
 * `Sep 2026`, `2025`.
 *
 * A month or a year that is on the calendar is named by what it is and not
 * by where it stands from here: last month is `Sep 2026`.
 */
export function titleOf(id: PeriodId, now: number, t: Strings = strings(), which: Which = 'this'): string {
  if (id === 'all') return t.stats.period.allTime;
  if (which === 'rolling') return t.stats.period.which[id].rolling;
  const date = new Date(which === 'last' ? lastOf(id, now) : now);
  switch (id) {
    case 'day':
    case 'week':
      return t.stats.period.which[id][which];
    case 'month':
      return t.stats.period.monthOf(date);
    case 'year':
      return String(date.getFullYear());
  }
}

/**
 * What a total is being compared against, said in words: `vs yesterday`.
 *
 * The whole phrase and not only the day, because where the "against" goes is
 * the language's business: Turkish hangs it on the end, `düne göre`.
 */
export function comparisonOf(id: PeriodId, t: Strings = strings(), which: Which = 'this'): string {
  return t.stats.period.versus(id, which);
}

/**
 * The columns of a chart of [id].
 *
 * A period still running is given its whole width — the rest of this week is
 * drawn empty rather than left off — because a bar chart that grows a column a
 * day says less about the week than one that fills in.
 *
 * [firstAt] is when the history starts, and only all time needs it: the others
 * know their own width. Without it all time falls back to the year to now.
 */
export function bucketsOf(
  id: PeriodId,
  now: number,
  firstAt?: number | null,
  t: Strings = strings(),
  which: Which = 'this'
): Bucket[] {
  const DAY_NAMES = t.format.weekdaysShort;
  const MONTH_NAMES = t.format.monthsShort;
  if (id !== 'all' && which === 'last') return bucketsOf(id, lastOf(id, now), firstAt, t);
  if (id !== 'all' && which === 'rolling') return rollingBuckets(id, now, t);
  switch (id) {
    case 'day': {
      const start = startOfDay(now);
      return steps(24, (index) => {
        const from = new Date(start);
        from.setHours(index);
        const to = new Date(start);
        to.setHours(index + 1);
        return {
          start: +from,
          end: +to,
          label: String(index).padStart(2, '0'),
          major: index % 6 === 0,
        };
      });
    }
    case 'week': {
      const start = startOfWeek(now);
      return steps(7, (index) => {
        const from = new Date(start);
        from.setDate(from.getDate() + index);
        const to = new Date(start);
        to.setDate(to.getDate() + index + 1);
        return { start: +from, end: +to, label: DAY_NAMES[index], major: true };
      });
    }
    case 'month': {
      const start = startOfMonth(now);
      const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      return steps(days, (index) => {
        const from = new Date(start.getFullYear(), start.getMonth(), index + 1);
        const to = new Date(start.getFullYear(), start.getMonth(), index + 2);
        // The 1st, 8th, 15th, 22nd and 29th: a marker a week apart, which is
        // enough to read a date off without the labels running together.
        return { start: +from, end: +to, label: String(index + 1), major: index % 7 === 0 };
      });
    }
    case 'year': {
      const year = new Date(now).getFullYear();
      return steps(12, (index) => ({
        start: +new Date(year, index, 1),
        end: +new Date(year, index + 1, 1),
        // One letter, because twelve three-letter labels do not fit across a
        // phone. Three of them are J, and a chart read left to right from
        // January is not ambiguous for it.
        label: MONTH_NAMES[index][0],
        major: true,
      }));
    }
    case 'all': {
      const from = startOfMonth(firstAt ?? now);
      const to = startOfMonth(now);
      const months =
        (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;

      // Beyond a few years of months the columns are thinner than the gaps
      // between them, so the whole thing is redrawn a year at a time.
      if (months > MAX_COLUMNS) {
        const years = to.getFullYear() - from.getFullYear() + 1;
        return steps(years, (index) => {
          const year = from.getFullYear() + index;
          return {
            start: +new Date(year, 0, 1),
            end: +new Date(year + 1, 0, 1),
            label: String(year),
            major: true,
          };
        });
      }

      return steps(Math.max(months, 1), (index) => {
        const start = new Date(from.getFullYear(), from.getMonth() + index, 1);
        const end = new Date(from.getFullYear(), from.getMonth() + index + 1, 1);
        return {
          start: +start,
          end: +end,
          label: start.getMonth() === 0 ? String(start.getFullYear()) : MONTH_NAMES[start.getMonth()],
          // Januaries carry the year and are always worth showing; the rest
          // are thinned out so the labels have room.
          major: start.getMonth() === 0 || index % 3 === 0,
        };
      });
    }
  }
}

/**
 * The columns of a stretch counted back from now: the same hours, days and
 * months a period on the calendar is drawn in, ending with the present one.
 *
 * Twenty-four hours is the one that does not fall on its columns. It is
 * drawn in hours of the clock all the same, since an hour named `14` that
 * ran from 14:37 would not be the hour anybody means; so its first column
 * and its last are the part of an hour the stretch reaches into, and there
 * are twenty-five of them wherever now is not on the hour.
 */
function rollingBuckets(id: PeriodId, now: number, t: Strings): Bucket[] {
  const range = rolling(id, now);
  switch (id) {
    case 'day': {
      const buckets: Bucket[] = [];
      let from = range.since;
      while (from < range.until) {
        const hour = new Date(from);
        hour.setMinutes(0, 0, 0);
        const next = new Date(hour);
        next.setHours(next.getHours() + 1);
        const to = Math.min(+next, range.until);
        buckets.push({ start: from, end: to, label: String(hour.getHours()).padStart(2, '0'), major: hour.getHours() % 6 === 0 });
        from = to;
      }
      // On the hour, the moment kept past now would be a column of its own
      // with nothing in it but that moment. It belongs to the hour before.
      const last = buckets[buckets.length - 1];
      if (buckets.length > 1 && last.end - last.start <= 1) {
        buckets.pop();
        buckets[buckets.length - 1].end = last.end;
      }
      return buckets;
    }
    case 'week':
      return steps(7, (index) => {
        const from = moved(range.since, { days: index });
        return {
          start: from,
          end: moved(range.since, { days: index + 1 }),
          label: t.format.weekdaysShort[(new Date(from).getDay() + 6) % 7],
          major: true,
        };
      });
    case 'month':
      return steps(ROLLING_MONTH_DAYS, (index) => {
        const from = moved(range.since, { days: index });
        return {
          start: from,
          end: moved(range.since, { days: index + 1 }),
          label: String(new Date(from).getDate()),
          // A week apart counting back from today, so that today is one of those named.
          major: (ROLLING_MONTH_DAYS - 1 - index) % 7 === 0,
        };
      });
    case 'year':
      return steps(12, (index) => {
        const from = moved(range.since, { months: index });
        return {
          start: from,
          end: moved(range.since, { months: index + 1 }),
          label: t.format.monthsShort[new Date(from).getMonth()][0],
          major: true,
        };
      });
    case 'all':
      return [];
  }
}

function steps(count: number, make: (index: number) => Bucket): Bucket[] {
  return Array.from({ length: count }, (_, index) => make(index));
}

/** What the chart is drawn from, and what the raw history is reduced to. */
export type Listen = { at: number; seconds: number; completed: number };
export type Tally = { plays: number; seconds: number };

/**
 * Adds every listen into the column it falls in.
 *
 * Found by search rather than by dividing, because the columns are not all the
 * same width: February is shorter than March and an hour is not always an hour.
 */
export function tally(listens: Listen[], buckets: Bucket[]): Tally[] {
  const totals: Tally[] = buckets.map(() => ({ plays: 0, seconds: 0 }));
  if (buckets.length === 0) return totals;

  for (const listen of listens) {
    const index = bucketIndex(listen.at, buckets);
    if (index < 0) continue;
    totals[index].plays += 1;
    totals[index].seconds += listen.seconds;
  }
  return totals;
}

/**
 * Which column a pinned moment belongs to, or null when none of them hold it.
 *
 * A column picked on the chart is remembered as the moment it covers rather
 * than as the place it sat in, because a place means nothing once the columns
 * are redrawn: the 25th is one of thirty-one columns in a month and a year has
 * only twelve, so the index alone is a reference to a column that has stopped
 * existing. Asking which column holds the moment answers both halves of that
 * at once — the September column when a day in September is carried over into
 * a year, and nothing at all when today's hours are asked to hold last
 * January.
 */
export function columnHolding(at: number | null, buckets: Bucket[]): number | null {
  if (at == null) return null;
  const index = bucketIndex(at, buckets);
  return index < 0 ? null : index;
}

function bucketIndex(at: number, buckets: Bucket[]): number {
  let low = 0;
  let high = buckets.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (at < buckets[middle].start) high = middle - 1;
    else if (at >= buckets[middle].end) low = middle + 1;
    else return middle;
  }
  return -1;
}

/** Seconds listened in each hour of the day, whichever day they fell on. */
export function byHour(listens: Listen[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const listen of listens) hours[new Date(listen.at).getHours()] += listen.seconds;
  return hours;
}

/** The hour the most was listened in, or null when nothing was. */
export function busiestHour(listens: Listen[]): number | null {
  const hours = byHour(listens);
  let best = -1;
  for (let hour = 0; hour < 24; hour += 1) {
    if (hours[hour] > 0 && (best < 0 || hours[hour] > hours[best])) best = hour;
  }
  return best < 0 ? null : best;
}

/**
 * The longest run of consecutive days with something listened to, ending on or
 * before [now].
 *
 * Counted in local days rather than in 24-hour spans: two listens seven hours
 * apart either side of midnight are two days, and a Saturday afternoon
 * followed by a Sunday morning is a streak of two however few hours separate
 * them.
 */
export function longestStreak(listens: Listen[]): number {
  if (listens.length === 0) return 0;

  const days = new Set<number>();
  for (const listen of listens) days.add(+startOfDay(listen.at));

  const ordered = [...days].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let index = 1; index < ordered.length; index += 1) {
    const expected = new Date(ordered[index - 1]);
    expected.setDate(expected.getDate() + 1);
    run = +expected === ordered[index] ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return longest;
}

/** `4h 12m`, `38m`, `45s`. Long enough to read, short enough for a headline. */
export function formatDuration(seconds: number, t: Strings = strings()): string {
  const said = t.stats.duration;
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return said.seconds(whole);

  const minutes = Math.round(whole / 60);
  if (minutes < 60) return said.minutes(minutes);

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? said.hours(hours) : said.hoursMinutes(hours, rest);
}

/** `07:00`, for an hour of the day. */
export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * How this period compares with the one before, as a percentage.
 *
 * Null when there is nothing to compare against — no previous period, or a
 * previous period of zero, where every answer is either infinity or a lie.
 */
export function changeBetween(now: number, before: number): number | null {
  if (before <= 0) return null;
  return Math.round(((now - before) / before) * 100);
}
