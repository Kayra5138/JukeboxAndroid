import { TabTitle, usePageRoom } from '../components/Page';
import { CARD_GAP, RADIUS, SPACE, TOUCH, TYPE } from '../lib/theme/measures';
import { WithNowPlaying } from '../components/NowPlayingBar';
import { FittedText } from '../components/FittedText';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurArea, ClockGlass, GlassScene } from '../components/Frosted';
import { Pressable } from '../components/Pressable';
import { Segmented } from '../components/Segmented';

import { BarChart } from '../components/BarChart';
import { ReportViewer } from '../components/report/ReportViewer';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { useT, type Strings } from '../lib/i18n/index';
import { haptic } from '../lib/ui/haptics';
import {
  firstPlayAt,
  listens,
  playsMark,
  summarize,
  topArtists,
  topTracks,
  type ListeningSummary,
  type TopEntry,
} from '../lib/db/history';
import { topGenres } from '../lib/db/metadata';
import {
  bucketsOf,
  busiestHour,
  changeBetween,
  comparisonOf,
  formatDuration,
  formatHour,
  longestStreak,
  PERIODS,
  previousRange,
  rangeOf,
  tally,
  titleOf,
  type Bucket,
  type Listen,
  type PeriodId,
  // Named apart from the DOM's `Range`, which is otherwise in scope here and
  // silently wins: the two have nothing in common and the error it gives is
  // about missing `cloneContents`, which explains nothing.
  type Range as Span,
  type Tally,
  type Which,
  WHICH,
} from '../lib/stats/period';
import { buildReport, worthReporting } from '../lib/stats/report';
import { makeStyles, outlined, scene, useColours } from '../lib/theme/index';
import { useLandscape } from '../lib/ui/layout';
import { useTopOnReselect } from '../lib/ui/tabReselect';
import { ArtistLinks, useOpenArtist } from '../components/NameLinks';
import { Button } from '../components/Button';
import { MediaRow } from '../components/MediaRow';
import { ScreenState } from '../components/ScreenState';
import { SectionLabel } from '../components/settings/rows';

/** What the columns of the chart are measuring. */
type Metric = 'time' | 'plays';

type Data = {
  at: number;
  title: string;
  summary: ListeningSummary;
  before: ListeningSummary | null;
  /**
   * How long the period before this one ran, and what was played in it.
   *
   * Carried separately from `before` because three of the seven figures below
   * — the daily average, the peak hour and the streak — are not in a summary
   * at all. They are worked out from the listens themselves, and comparing
   * them means having the earlier period's listens to work them out from.
   */
  beforeDays: number;
  beforeListens: Listen[];
  buckets: Bucket[];
  totals: Tally[];
  listens: Listen[];
  tracks: TopEntry[];
  artists: TopEntry[];
  genres: TopEntry[];
  /** Whether anything has ever been listened to, as against in this period. */
  everListened: boolean;
  /** When the first listen of all was. */
  first: number | null;
};

/** How long a reading of the history stands for, with nothing played since: the periods are told by the clock as well. */
const STILL_FRESH_MS = 5 * 60 * 1000;

export default function StatsScreen() {
  // As last chosen from the first drawing, and not the week until the choice was read, which showed for a moment each time.
  const [period, setPeriod] = useState<PeriodId>(readPeriod);
  const [which, setWhich] = useState<Which>(readWhich);
  const [metric, setMetric] = useState<Metric>('time');
  const [data, setData] = useState<Data | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const landscape = useLandscape();
  // The skeleton of the page a tab opens on: see `usePageRoom`.
  const room = usePageRoom({ root: true });
  const t = useT();
  const c = useColours();
  const styles = useStyles();

  /*
    Worded as it is read: the title and the names under the columns are made
    here, in the language of the moment. Depending on that language is what
    has the screen read again when it changes, rather than keep a chart whose
    days are still named in the old one.
  */
  /*
    Read on the database's own thread and waited for, all of it at once; a
    reading overtaken by a later one, another period chosen meanwhile, is
    let go of when it comes back rather than drawn over the later one.
  */
  const readings = useRef(0);
  const load = useCallback(async (id: PeriodId, reading: Which) => {
    const mine = ++readings.current;
    /*
      One clock for the whole read. Taken once rather than per query because a
      period asked for at 23:59:59.999 and a chart built a millisecond later
      would be describing two different days, and the columns would not add up
      to the total above them.
    */
    const at = Date.now();
    const range = rangeOf(id, at, reading);
    const earlier = previousRange(id, at, reading);
    const [first, rows, summary, before, beforeListens, tracks, artists, genres] = await Promise.all([
      firstPlayAt(),
      listens(range),
      summarize(range),
      earlier ? summarize(earlier) : Promise.resolve(null),
      earlier ? listens(earlier) : Promise.resolve([]),
      topTracks(8, range),
      topArtists(8, range),
      // Genres come from the metadata table, so they only appear for tracks
      // that have been looked up.
      topGenres(8, range),
    ]);
    if (mine !== readings.current) return;
    const buckets = bucketsOf(id, at, first, t, reading);

    setData({
      at,
      title: titleOf(id, at, t, reading),
      summary,
      before,
      beforeDays: earlier ? daysIn(earlier) : 0,
      beforeListens,
      buckets,
      totals: tally(rows, buckets),
      listens: rows,
      tracks,
      artists,
      genres: genres.map((row) => ({
        key: row.key,
        label: row.genre,
        playCount: row.playCount,
        totalSeconds: row.totalSeconds,
        sample: row.sample ?? null,
      })),
      everListened: first != null,
      first,
    });
  }, [t]);

  /*
    Recomputed on focus so a play recorded moments ago shows up straight away,
    and it is also where the period last chosen is restored. In an effect
    rather than in the first render: opening the database costs a schema check
    and, once, a migration, and none of that belongs on the thread drawing a
    frame.
  */
  const restored = useRef(false);
  /*
    What the last reading was of, and when: come back to with nothing played
    or taken away since, a little while later, the screen is as it was, and
    is not read again. Read again, it is read after the tab is on the screen
    and not before it: the whole history at every visit was most of a fifth
    of a second on a fast phone, with the tab waiting on it.
  */
  const lastRead = useRef<{ mark: string; at: number; of: string; by: typeof load } | null>(null);
  const refresh = useCallback(() => {
    if (!restored.current) {
      restored.current = true;
      const saved = readPeriod();
      const reading = readWhich();
      // Setting them asks again with the right ones, so there is still
      // only ever the one read of the history.
      if (saved !== period || reading !== which) {
        setPeriod(saved);
        setWhich(reading);
        return;
      }
    }
    const mark = playsMark();
    const of = `${period}|${which}`;
    const seen = lastRead.current;
    if (seen && seen.mark === mark && seen.of === of && seen.by === load && Date.now() - seen.at < STILL_FRESH_MS) return;
    void load(period, which);
    lastRead.current = { mark, at: Date.now(), of, by: load };
  }, [load, period, which]);
  /*
    Read as soon as it is put up, which is while nobody is using the app,
    before the tab is first opened (see `TabBar`), and again with another
    period chosen; and looked at again each time the tab is opened.
  */
  useEffect(() => {
    const later = setTimeout(refresh, 0);
    return () => clearTimeout(later);
  }, [refresh]);
  useFocusEffect(
    useCallback(() => {
      const later = setTimeout(refresh, 0);
      return () => clearTimeout(later);
    }, [refresh])
  );

  const choose = useCallback(
    (id: PeriodId) => {
      // Read by `refresh`, as the period changes.
      setPeriod(id);
      writeSetting(SETTINGS.statsPeriod, id);
    },
    []
  );

  /*
    One choice for all four periods and not one each. Somebody who looks at
    last week and then turns to the month is asking the same question of a
    longer stretch, and would have to ask it again if the month had gone back
    to its own.
  */
  const read = useCallback(
    (reading: Which) => {
      setWhich(reading);
      writeSetting(SETTINGS.statsWhich, reading);
    },
    []
  );

  const values = useMemo(
    () => (data ? data.totals.map((total) => (metric === 'time' ? total.seconds : total.plays)) : []),
    [data, metric]
  );

  // Its tab pressed again: back to the top of it.
  const backUp = useTopOnReselect();

  if (!data) return <View style={styles.screen} />;

  if (!data.everListened) {
    return (
      // With the bar of what is playing, as the full screen has it: nothing has been heard yet
      // the first time this is opened, and the first song may well be playing as it is.
      <WithNowPlaying style={styles.screen}>
        <View style={styles.fill}>
          <ScreenState kind="empty" title={t.stats.screen.emptyTitle} text={t.stats.screen.emptyBody} />
        </View>
      </WithNowPlaying>
    );
  }

  const { summary } = data;
  const change = data.before
    ? changeBetween(summary.totalSeconds, data.before.totalSeconds)
    : null;
  const hour = busiestHour(data.listens);
  const days = countedDays(data.buckets, data.at, data.first);

  /*
    The same seven figures for the period before, or nothing at all when there
    is no period before — which is what "All time" is, and also what the first
    week of a library is. Worked out here rather than inside `Card` so that the
    two periods are measured by the same expressions written once.
  */
  const was = data.before
    ? {
        plays: t.format.number(data.before.playCount),
        tracks: t.format.number(data.before.distinctTracks),
        artists: t.format.number(data.before.distinctArtists),
        finished:
          data.before.playCount > 0
            ? t.format.percent(
                Math.round((data.before.completedCount / data.before.playCount) * 100)
              )
            : null,
        daily:
          data.beforeDays > 0
            ? formatDuration(data.before.totalSeconds / data.beforeDays, t)
            : null,
        hour: hourLabel(busiestHour(data.beforeListens)),
        streak: streakLabel(longestStreak(data.beforeListens), t),
      }
    : null;

  const lists = [
    { of: 'tracks', entries: data.tracks },
    { of: 'artists', entries: data.artists },
    { of: 'genres', entries: data.genres },
  ] as const;

  return (
    <WithNowPlaying style={styles.screen}>
    {/* The page an area the glass behind the clock blurs: see `ClockGlass`. */}
    <GlassScene>
    <BlurArea style={styles.fill}>
    <ScrollView
      {...backUp}
      // The skeleton of a tab's own page (`usePageRoom`).
      contentContainerStyle={[styles.content, room]}>
      <TabTitle title={t.nav.stats} />
      {/* Tabs, to a screen reader, and the open one says so: to the eye it is
          only the one the mark is on. */}
      <Segmented
        role="tab"
        hitSlop={2}
        style={[styles.periods, period === 'all' && styles.periodsAlone]}
        options={PERIODS.map((entry) => ({ value: entry.id, label: t.stats.period.labels[entry.id] }))}
        value={period}
        onChange={choose}
      />

      {/* All time is read one way, and has no second row. */}
      {period !== 'all' ? (
        <Segmented
          role="button"
          variant="chips"
          tone="quiet"
          layout="fill"
          wrap={false}
          hitSlop={2}
          style={styles.readings}
          optionStyle={styles.reading}
          options={WHICH.map((entry) => ({ value: entry, label: t.stats.period.which[period][entry] }))}
          value={which}
          onChange={read}
        />
      ) : null}

      {/* Sideways the headline and the chart sit beside each other: the screen
          is half as tall, and stacking them puts the chart below the fold. */}
      <View style={landscape ? styles.wide : undefined}>
        <View style={landscape ? styles.wideSide : undefined}>
          <SectionLabel after={false}>{data.title}</SectionLabel>
          <View style={styles.headlineRow}>
            <Text style={styles.headline}>{formatDuration(summary.totalSeconds, t)}</Text>
            {worthReporting(summary) ? (
              <Button
                kind="secondary"
                shape="pill"
                size="small"
                label={t.stats.screen.recap}
                accessibilityLabel={t.stats.screen.openRecap}
                onPress={() => setRecapOpen(true)}
              />
            ) : null}
          </View>
          {change != null ? (
            <Text style={styles.change}>
              <Text style={{ color: change >= 0 ? c.success : c.danger }}>
                {t.stats.screen.changeFigure(change)}
              </Text>
              {/* The figure as well as the change, because a percentage of
                  something unstated is only half a comparison. */}
              <Text style={styles.muted}>
                {' '}
                {t.stats.screen.against(
                  comparisonOf(period, t, which),
                  data.before ? formatDuration(data.before.totalSeconds, t) : null
                )}
              </Text>
            </Text>
          ) : (
            <Text style={styles.muted}>
              {summary.playCount === 0 ? t.stats.screen.nothingYet : ' '}
            </Text>
          )}

          <View style={styles.metrics} accessibilityRole="radiogroup">
            {(['time', 'plays'] as Metric[]).map((option) => (
              <Pressable
                key={option}
                // One of two, of which one is chosen, which the underline says to the eye.
                accessibilityRole="radio"
                accessibilityState={{ checked: option === metric }}
                hitSlop={METRIC_SLOP}
                style={styles.metricHit}
                onPress={() => {
                  // A choice like a segmented row's, felt as one is.
                  if (option !== metric) haptic('choices', 'tick');
                  setMetric(option);
                }}>
                <Text style={[styles.metric, option === metric && styles.metricOn]}>
                  {t.format.upper(option === 'time' ? t.stats.screen.time : t.stats.screen.plays)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={landscape ? styles.wideSide : styles.chart}>
          <BarChart
            // A change of measure is a different chart, not the same one with
            // new numbers: remounting it grows the bars again from the baseline
            // rather than sliding them between two unrelated scales.
            key={metric}
            buckets={data.buckets}
            values={values}
            accent={c.accent}
            now={data.at}
            label={`${metric === 'time' ? t.stats.screen.time : t.stats.screen.plays} · ${data.title}`}
            format={(value) =>
              metric === 'time' ? formatDuration(value, t) : t.stats.screen.playsCount(value)
            }
          />
        </View>
      </View>

      <View style={styles.cards}>
        <Card
          label={t.stats.figures.plays}
          value={t.format.number(summary.playCount)}
          before={had(was?.plays ?? null)}
        />
        <Card
          label={t.stats.figures.tracks}
          value={t.format.number(summary.distinctTracks)}
          before={had(was?.tracks ?? null)}
        />
        <Card
          label={t.stats.figures.artists}
          value={t.format.number(summary.distinctArtists)}
          before={had(was?.artists ?? null)}
        />
        <Card
          label={t.stats.figures.finished}
          value={
            summary.playCount > 0
              ? t.format.percent(Math.round((summary.completedCount / summary.playCount) * 100))
              : '—'
          }
          before={had(was?.finished ?? null)}
        />
        <Card
          label={t.stats.figures.aDay}
          value={days > 0 ? formatDuration(summary.totalSeconds / days, t) : '—'}
          before={had(was?.daily ?? null)}
        />
        <Card
          label={t.stats.figures.peakHour}
          value={hourLabel(hour)}
          before={had(was?.hour ?? null)}
        />
        <Card
          label={t.stats.figures.streak}
          value={streakLabel(longestStreak(data.listens), t)}
          before={had(was?.streak ?? null)}
        />
      </View>

      <View style={landscape ? styles.wide : undefined}>
        {lists.map((list) => (
          <View key={list.of} style={landscape ? styles.wideSide : undefined}>
            <SectionLabel>{t.stats.screen.lists[list.of]}</SectionLabel>
            {list.entries.length === 0 ? (
              <Text style={styles.muted}>
                {list.of === 'genres'
                  ? t.stats.screen.lookUpForGenres
                  : t.stats.screen.nothingInPeriod}
              </Text>
            ) : (
              list.entries.map((entry, index) => (
                <Row
                  // Keyed on what the row was grouped by, not on its name: two
                  // tracks can share a title, and keying on that collided them.
                  key={`${list.of}:${entry.key}`}
                  rank={index + 1}
                  of={list.of}
                  entry={entry}
                  share={entry.playCount / list.entries[0].playCount}
                />
              ))
            )}
          </View>
        ))}
      </View>


      <ReportViewer
        visible={recapOpen}
        stamp={data.title}
        cards={buildReport(
          {
            period,
            which,
            at: data.at,
            summary,
            before: data.before,
            listens: data.listens,
            tracks: data.tracks,
            artists: data.artists,
            genres: data.genres,
            days,
          },
          t
        )}
        onClose={() => setRecapOpen(false)}
      />
    </ScrollView>
    </BlurArea>
    <ClockGlass />
    </GlassScene>
    </WithNowPlaying>
  );
}

/**
 * One figure, and what the same figure was the period before.
 *
 * The comparison is the whole point of these: twelve hours is a lot or a
 * little depending only on what last week was, and a percentage on the
 * headline answers that for one number out of seven. "Was" rather than an
 * arrow and a percentage, because several of these are counts of things —
 * nineteen artists down from twenty-three says something a −17% does not.
 */
function Card({
  label,
  value,
  before,
}: {
  label: string;
  value: string;
  before?: string | null;
}) {
  const t = useT();
  const styles = useStyles();
  return (
    // Made smaller to fit, and not cut off: two to a row on a narrow phone, a long language's words ran out of the card.
    <View style={styles.card}>
      <FittedText style={styles.cardValue} numberOfLines={1} minimumFontScale={0.6}>
        {value}
      </FittedText>
      <FittedText style={styles.cardLabel} numberOfLines={1} minimumFontScale={0.7}>
        {label}
      </FittedText>
      {before ? (
        <FittedText style={styles.cardBefore} numberOfLines={1} minimumFontScale={0.7}>
          {t.stats.screen.was(before)}
        </FittedText>
      ) : null}
    </View>
  );
}

/**
 * One line of a chart-topper list: a row of the app's (`MediaRow`), its place
 * at its start and how often at its end.
 *
 * The bar behind it is the row's share of the busiest one, which is what turns
 * a column of numbers into something that can be read at a glance: whether the
 * top track is a habit or merely first past the post. An artist's row leads to
 * the artist, and a song's to whoever it is by.
 */
function Row({ rank, entry, share, of }: { rank: number; entry: TopEntry; share: number; of: 'tracks' | 'artists' | 'genres' }) {
  const styles = useStyles();
  const openArtist = useOpenArtist();
  return (
    <MediaRow
      size="compact"
      share={share}
      lead={<Text style={styles.rank}>{rank}</Text>}
      title={entry.label}
      subtitle={entry.detail ? (of === 'tracks' ? <ArtistLinks credit={entry.detail} /> : entry.detail) : undefined}
      meta={`${entry.playCount}×`}
      onPress={of === 'artists' ? () => openArtist(entry.label) : undefined}
    />
  );
}

/**
 * How many days the average is over.
 *
 * A period still running is counted up to today rather than to its end, or the
 * first of the month would report a daily average across thirty days that have
 * not happened.
 */
function countedDays(buckets: Bucket[], now: number, first: number | null): number {
  if (buckets.length === 0) return 0;
  // From the first listen, where the history begins inside the period: all of it began at the start of that month.
  const since = Math.max(buckets[0].start, first ?? -Infinity);
  const until = Math.min(now, buckets[buckets.length - 1].end);
  return Math.max(1, calendarDays(since, until));
}

/**
 * The days of the calendar from [since] to [until], today counted as one
 * however little of it has gone: by the dates, so that a week with the
 * clocks put back, an hour longer, is still seven days.
 */
function calendarDays(since: number, until: number): number {
  const day = new Date(since);
  day.setHours(0, 0, 0, 0);
  let days = 0;
  while (day.getTime() < until && days < 100_000) {
    days += 1;
    day.setDate(day.getDate() + 1);
  }
  return days;
}

/**
 * How many days a finished period covers.
 *
 * Not the same question as `countedDays`, which stops at today because the
 * period it measures is still being lived through. A period that is over has
 * all of its days behind it, and dividing by anything less would flatter it
 * against the one in progress.
 */
function daysIn(range: Span): number {
  return Math.max(1, calendarDays(range.since, range.until));
}

function streakLabel(days: number, t: Strings): string {
  if (days === 0) return '—';
  return t.stats.figures.days(days);
}

function hourLabel(hour: number | null): string {
  return hour == null ? '—' : formatHour(hour);
}

/**
 * A figure worth putting under this period's, or nothing.
 *
 * A dash means the earlier period had nothing to say, and "was —" says less
 * than the blank it would replace.
 */
function had(value: string | null): string | null {
  return value == null || value === '—' ? null : value;
}

/** The period last looked at, so the screen opens where it was left. */
function readWhich(): Which {
  let saved: string | null = null;
  try {
    saved = readSetting(SETTINGS.statsWhich);
  } catch {
    // The usual one, then.
  }
  return WHICH.some((entry) => entry === saved) ? (saved as Which) : 'this';
}

function readPeriod(): PeriodId {
  let saved: string | null = null;
  try {
    saved = readSetting(SETTINGS.statsPeriod);
  } catch {
    // The usual one, then.
  }
  return PERIODS.some((entry) => entry.id === saved) ? (saved as PeriodId) : 'week';
}

/** The two words are short; this reaches as far as half the gap between them each side. */
const METRIC_SLOP = { left: SPACE.s, right: SPACE.s };


/** The one figure a period is summed up by, at the top of it: shown, not read, and so larger than any writing (`TYPE`). */
const HEADLINE = 40;
/** The least a tile of the figures under it is wide, before they go two to a row. */
const TILE_LEAST = 78;

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  content: { gap: SPACE.xs },
  fill: { flex: 1 },

  periods: { marginBottom: SPACE.s },

  // The second question, asked more quietly than the first: which day, which
  // week. Chips and not another tray, so that the two rows are not mistaken
  // for one control with ten choices; a finger's height, as the tray's are.
  readings: { marginBottom: SPACE.l },
  reading: { minHeight: TOUCH.normal },
  // All time has no second row, and keeps the room the row would have left under it.
  periodsAlone: { marginBottom: SPACE.l },

  wide: { flexDirection: 'row', gap: CARD_GAP, alignItems: 'flex-start' },
  wideSide: { flex: 1, minWidth: 0 },

  headlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.m },
  headline: { color: c.text, fontSize: HEADLINE, fontWeight: '600', lineHeight: HEADLINE + SPACE.s, flexShrink: 1 },
  change: { fontSize: TYPE.small },
  muted: { color: c.textMuted, fontSize: TYPE.small },

  // The room that was above the two is now inside them, which makes each a
  // finger's height without moving the words.
  metrics: { flexDirection: 'row', gap: SPACE.l },
  metricHit: { minHeight: TOUCH.normal, justifyContent: 'center' },
  metric: { color: c.textFaint, fontSize: TYPE.hint, letterSpacing: 1 },
  // Underlined as well as coloured, so that which of the two is on can be
  // told without the colour. Not heavier: the other would shift as it changed.
  metricOn: { color: c.accent, textDecorationLine: 'underline' },

  chart: { paddingTop: CARD_GAP },

  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s, paddingTop: CARD_GAP },
  card: {
    // Four to a row on a phone, more where there is room, and the gaps are
    // taken out of the share so they never push the fourth one down.
    minWidth: TILE_LEAST,
    flexGrow: 1,
    flexBasis: '22%',
    backgroundColor: c.surface,
    borderRadius: RADIUS.card,
    paddingVertical: SPACE.m,
    paddingHorizontal: SPACE.m,
    gap: SPACE.xxs,
    ...outlined(c),
  },
  cardValue: { color: c.text, fontSize: TYPE.heading, fontWeight: '600' },
  cardLabel: { color: c.textFaint, fontSize: TYPE.label },
  // Dimmer than the label, which is already dim: it is the least of the three
  // lines and has to be read as the footnote it is rather than as a second
  // figure competing with the one above it.
  cardBefore: { color: c.textDisabled, fontSize: TYPE.label },

  // As wide as two figures, so that the names stand in line whatever the place.
  rank: { color: c.textFaint, fontSize: TYPE.hint, width: SPACE.l, fontVariant: ['tabular-nums'] },
}));
