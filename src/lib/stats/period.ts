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

/** Half open: a play at `since` is in, a play at `until` belongs to the next one. */
export type Range = { since: number; until: number };

export type Bucket = {
  start: number;
  end: number;
  label: string;
  /** Whether the label is worth the room. Thirty-one of them will not fit. */
  major: boolean;
};

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All' },
];

export const ALL_TIME: Range = { since: 0, until: Number.MAX_SAFE_INTEGER };

/*
  Written out rather than asked of `toLocaleString`, for the same reason the
  date format is: Intl on React Native's engine has never been something to
  lean on, and the app choosing its own names is one less thing that changes
  underfoot when the phone's locale does.
*/
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

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

/** What [id] covers around [now]. */
export function rangeOf(id: PeriodId, now: number): Range {
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
export function previousRange(id: PeriodId, now: number): Range | null {
  if (id === 'all') return null;
  return rangeOf(id, rangeOf(id, now).since - 1);
}

/** How the period is named on screen: `Today`, `September`, `2026`. */
export function titleOf(id: PeriodId, now: number): string {
  const date = new Date(now);
  switch (id) {
    case 'day':
      return 'Today';
    case 'week':
      return 'This week';
    case 'month':
      return MONTH_NAMES[date.getMonth()] + ' ' + date.getFullYear();
    case 'year':
      return String(date.getFullYear());
    case 'all':
      return 'All time';
  }
}

/** What a total is being compared against, said in words. */
export function comparisonOf(id: PeriodId): string {
  switch (id) {
    case 'day':
      return 'yesterday';
    case 'week':
      return 'last week';
    case 'month':
      return 'last month';
    case 'year':
      return 'last year';
    case 'all':
      return '';
  }
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
export function bucketsOf(id: PeriodId, now: number, firstAt?: number | null): Bucket[] {
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
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return `${whole}s`;

  const minutes = Math.round(whole / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
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
