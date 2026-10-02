import type { ListeningSummary, TopEntry } from '../db/history.ts';
import {
  busiestHour,
  changeBetween,
  comparisonOf,
  formatDuration,
  formatHour,
  longestStreak,
  titleOf,
  type Listen,
  type PeriodId,
} from './period.ts';

/**
 * How many entries a chart of the period's best gets.
 *
 * Five, which is what every recap of this kind settles on. Enough that the
 * order says something, few enough that the card can be read rather than
 * studied — the whole list is already a scroll away on the screen behind this.
 */
export const RANKED = 5;

/** Nothing worth calling a report, so the button has nothing to offer. */
const ENOUGH_PLAYS = 3;

export type RankedEntry = {
  key: string;
  label: string;
  detail: string | null;
  plays: number;
  seconds: number;
  /** Share of the leader, 0..1, for however the card chooses to draw it. */
  share: number;
  /** A track to take a cover from, where the row has one to borrow. */
  sample: string | null;
};

/**
 * One card of the report.
 *
 * Each says one thing. That is the whole convention these recaps are built on
 * and the reason they are read at all: a card carrying two ideas is a slide,
 * and nobody shares a slide.
 */
/**
 * The cover a card takes its colours from, where it has one.
 *
 * Named here rather than worked out while drawing, so the reader can see at a
 * glance which picture each card is dressed in: the charts wear their own
 * leader, and the two cards about the whole period wear the track that led it.
 */
export type ReportCard = { tint?: string | null } & (
  | {
      kind: 'opening';
      title: string;
      seconds: number;
      /** Per cent against the period before, where there was one. */
      change: number | null;
      comparison: string;
      /** Covers to tile behind the number, most played first. */
      wall: string[];
    }
  | {
      kind: 'ranking';
      of: 'tracks' | 'artists' | 'genres';
      heading: string;
      lead: string;
      entries: RankedEntry[];
    }
  | {
      kind: 'clock';
      heading: string;
      lead: string;
      /** Seconds listened in each of the twenty-four hours. */
      hours: number[];
      peak: number | null;
    }
  | {
      kind: 'numbers';
      heading: string;
      items: { label: string; value: string }[];
      /** Covers to tile behind the figures, as on the opening card. */
      wall: string[];
    }
  | {
      kind: 'closing';
      title: string;
      seconds: number;
      track: string | null;
      artist: string | null;
      /** The cover of the most played track. */
      sample: string | null;
      /**
       * And of the most played artist, where it is a different picture. The
       * same one twice is not a pair, so it collapses to one.
       */
      artistSample: string | null;
    }
);

export type ReportInput = {
  period: PeriodId;
  at: number;
  summary: ListeningSummary;
  before: ListeningSummary | null;
  listens: Listen[];
  tracks: TopEntry[];
  artists: TopEntry[];
  genres: TopEntry[];
  /** Days the period has actually covered, for the daily average. */
  days: number;
};

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

function rank(entries: TopEntry[]): RankedEntry[] {
  const top = entries.slice(0, RANKED);
  const leader = top[0]?.playCount ?? 0;
  return top.map((entry) => ({
    key: entry.key,
    label: entry.label,
    detail: entry.detail ?? null,
    plays: entry.playCount,
    seconds: entry.totalSeconds,
    share: leader > 0 ? entry.playCount / leader : 0,
    sample: entry.sample ?? null,
  }));
}

/** Seconds listened in each hour of the day, summed across the period. */
export function hoursOf(listens: Listen[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const listen of listens) {
    hours[new Date(listen.at).getHours()] += listen.seconds;
  }
  return hours;
}

/**
 * Whether there is a report worth offering at all.
 *
 * A single play makes a set of cards that all say the same thing, which is a
 * worse answer than not offering them.
 */
export function worthReporting(summary: ListeningSummary): boolean {
  return summary.playCount >= ENOUGH_PLAYS;
}

/**
 * The cards for a period, in the order they are read.
 *
 * Cards with nothing behind them are left out rather than shown empty: a genre
 * card reading "nothing yet" is worse than a report that does not mention
 * genres, and only tracks that have been looked up carry one at all.
 */
export function buildReport(input: ReportInput): ReportCard[] {
  const { summary, period, at } = input;
  const cards: ReportCard[] = [];
  const when = saidAs(period);

  const tracks = rank(input.tracks);

  cards.push({
    kind: 'opening',
    title: titleOf(period, at),
    seconds: summary.totalSeconds,
    change: input.before ? changeBetween(summary.totalSeconds, input.before.totalSeconds) : null,
    comparison: comparisonOf(period),
    tint: input.tracks[0]?.sample ?? null,
    // Nine fills a three by three wall; fewer tiles are repeated to fill it.
    wall: input.tracks
      .map((entry) => entry.sample ?? null)
      .filter((id): id is string => id != null)
      .slice(0, 9),
  });
  if (tracks.length > 0) {
    cards.push({
      kind: 'ranking',
      of: 'tracks',
      heading: 'Your top tracks',
      lead: `What you reached for ${when}`,
      entries: tracks,
      tint: tracks[0].sample,
    });
  }

  const artists = rank(input.artists);
  if (artists.length > 0) {
    cards.push({
      kind: 'ranking',
      of: 'artists',
      heading: 'Your top artists',
      lead: `Who you spent ${when} with`,
      entries: artists,
      tint: artists[0].sample,
    });
  }

  const genres = rank(input.genres);
  if (genres.length > 0) {
    cards.push({
      kind: 'ranking',
      of: 'genres',
      heading: 'Your sound',
      lead: `The shape of ${when}`,
      entries: genres,
      tint: genres[0].sample,
    });
  }

  const hours = hoursOf(input.listens);
  const peak = busiestHour(input.listens);
  /*
    Only where the day has some shape to it. Every hour alike is a flat row of
    columns saying nothing, which is most of what a single day's listening
    looks like.
  */
  if (hours.some((seconds) => seconds > 0) && peak != null) {
    cards.push({
      kind: 'clock',
      heading: 'Your hours',
      lead: `You listened most around ${formatHour(peak)}`,
      hours,
      peak,
      // The runner-up, so two cards in a row are not the same colour.
      tint: input.tracks[1]?.sample ?? input.tracks[0]?.sample ?? null,
    });
  }

  const streak = longestStreak(input.listens);
  const items: { label: string; value: string }[] = [
    { label: 'Plays', value: String(summary.playCount) },
    { label: 'Tracks', value: String(summary.distinctTracks) },
    { label: 'Artists', value: String(summary.distinctArtists) },
  ];
  if (summary.playCount > 0) {
    items.push({
      label: 'Finished',
      value: `${Math.round((summary.completedCount / summary.playCount) * 100)}%`,
    });
  }
  if (input.days > 0) {
    items.push({ label: 'A day', value: formatDuration(summary.totalSeconds / input.days) });
  }
  // A streak is only a fact worth printing once it is longer than the one day
  // any listening at all produces.
  if (streak > 1) {
    items.push({ label: 'Streak', value: `${streak} days` });
  }
  cards.push({
    kind: 'numbers',
    heading: 'By the numbers',
    items,
    tint: input.tracks[2]?.sample ?? input.tracks[0]?.sample ?? null,
    // The same wall the opening card uses, for something to look at behind
    // a card that is otherwise all figures.
    wall: input.tracks
      .map((entry) => entry.sample ?? null)
      .filter((id): id is string => id != null)
      .slice(0, 9),
  });

  cards.push({
    kind: 'closing',
    title: titleOf(period, at),
    seconds: summary.totalSeconds,
    track: tracks[0]?.label ?? null,
    artist: artists[0]?.label ?? null,
    sample: tracks[0]?.sample ?? null,
    artistSample:
      artists[0]?.sample && artists[0].sample !== tracks[0]?.sample ? artists[0].sample : null,
    tint: input.tracks[0]?.sample ?? null,
  });

  return cards;
}
