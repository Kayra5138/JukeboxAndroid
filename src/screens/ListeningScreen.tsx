import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart } from '../components/BarChart';
import { ReportViewer } from '../components/report/ReportViewer';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { useT, type Strings } from '../lib/i18n/index';
import {
  firstPlayAt,
  listens,
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
} from '../lib/stats/period';
import { buildReport, worthReporting } from '../lib/stats/report';
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { useLandscape } from '../lib/ui/layout';

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
};

export default function StatsScreen() {
  const [period, setPeriod] = useState<PeriodId>('week');
  const [metric, setMetric] = useState<Metric>('time');
  const [data, setData] = useState<Data | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const landscape = useLandscape();
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();

  /*
    Worded as it is read: the title and the names under the columns are made
    here, in the language of the moment. Depending on that language is what
    has the screen read again when it changes, rather than keep a chart whose
    days are still named in the old one.
  */
  const load = useCallback((id: PeriodId) => {
    /*
      One clock for the whole read. Taken once rather than per query because a
      period asked for at 23:59:59.999 and a chart built a millisecond later
      would be describing two different days, and the columns would not add up
      to the total above them.
    */
    const at = Date.now();
    const range = rangeOf(id, at);
    const earlier = previousRange(id, at);
    const first = firstPlayAt();
    const rows = listens(range);
    const buckets = bucketsOf(id, at, first, t);

    setData({
      at,
      title: titleOf(id, at, t),
      summary: summarize(range),
      before: earlier ? summarize(earlier) : null,
      beforeDays: earlier ? daysIn(earlier) : 0,
      beforeListens: earlier ? listens(earlier) : [],
      buckets,
      totals: tally(rows, buckets),
      listens: rows,
      tracks: topTracks(8, range),
      artists: topArtists(8, range),
      // Genres come from the metadata table, so they only appear for tracks
      // that have been looked up.
      genres: topGenres(8, range).map((row) => ({
        key: row.key,
        label: row.genre,
        playCount: row.playCount,
        totalSeconds: row.totalSeconds,
        sample: row.sample ?? null,
      })),
      everListened: first != null,
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
  useFocusEffect(
    useCallback(() => {
      if (!restored.current) {
        restored.current = true;
        const saved = readPeriod();
        // Setting it re-runs this with the right one, so there is still only
        // ever the one read of the history.
        if (saved !== period) {
          setPeriod(saved);
          return;
        }
      }
      load(period);
    }, [load, period])
  );

  const choose = useCallback(
    (id: PeriodId) => {
      setPeriod(id);
      writeSetting(SETTINGS.statsPeriod, id);
      load(id);
    },
    [load]
  );

  const values = useMemo(
    () => (data ? data.totals.map((total) => (metric === 'time' ? total.seconds : total.plays)) : []),
    [data, metric]
  );

  if (!data) return <View style={styles.screen} />;

  if (!data.everListened) {
    return (
      <View style={[styles.screen, styles.empty]}>
        <Text style={styles.emptyTitle}>{t.stats.screen.emptyTitle}</Text>
        <Text style={styles.emptyBody}>{t.stats.screen.emptyBody}</Text>
      </View>
    );
  }

  const { summary } = data;
  const change = data.before
    ? changeBetween(summary.totalSeconds, data.before.totalSeconds)
    : null;
  const hour = busiestHour(data.listens);
  const days = countedDays(data.buckets, data.at);

  /*
    The same seven figures for the period before, or nothing at all when there
    is no period before — which is what "All time" is, and also what the first
    week of a library is. Worked out here rather than inside `Card` so that the
    two periods are measured by the same expressions written once.
  */
  const was = data.before
    ? {
        plays: String(data.before.playCount),
        tracks: String(data.before.distinctTracks),
        artists: String(data.before.distinctArtists),
        finished:
          data.before.playCount > 0
            ? t.stats.percent(
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 12,
          paddingLeft: insets.left + 20,
          paddingRight: insets.right + 20,
        },
      ]}>
      <View style={styles.periods}>
        {PERIODS.map((entry) => (
          <Pressable
            android_ripple={pressed}
            key={entry.id}
            style={[styles.period, entry.id === period && styles.periodOn]}
            onPress={() => choose(entry.id)}>
            <Text style={[styles.periodLabel, entry.id === period && styles.periodLabelOn]}>
              {t.stats.period.labels[entry.id]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Sideways the headline and the chart sit beside each other: the screen
          is half as tall, and stacking them puts the chart below the fold. */}
      <View style={landscape ? styles.wide : undefined}>
        <View style={landscape ? styles.wideSide : undefined}>
          <Text style={styles.periodTitle}>{t.format.upper(data.title)}</Text>
          <View style={styles.headlineRow}>
            <Text style={styles.headline}>{formatDuration(summary.totalSeconds, t)}</Text>
            {worthReporting(summary) ? (
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityLabel={t.stats.screen.openRecap}
                style={styles.recap}
                onPress={() => setRecapOpen(true)}>
                <Text style={styles.recapLabel}>{t.stats.screen.recap}</Text>
              </Pressable>
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
                  comparisonOf(period, t),
                  data.before ? formatDuration(data.before.totalSeconds, t) : null
                )}
              </Text>
            </Text>
          ) : (
            <Text style={styles.muted}>
              {summary.playCount === 0 ? t.stats.screen.nothingYet : ' '}
            </Text>
          )}

          <View style={styles.metrics}>
            {(['time', 'plays'] as Metric[]).map((option) => (
              <Pressable key={option} onPress={() => setMetric(option)}>
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
            format={(value) =>
              metric === 'time' ? formatDuration(value, t) : t.stats.screen.playsCount(value)
            }
          />
        </View>
      </View>

      <View style={styles.cards}>
        <Card
          label={t.stats.figures.plays}
          value={String(summary.playCount)}
          before={had(was?.plays ?? null)}
        />
        <Card
          label={t.stats.figures.tracks}
          value={String(summary.distinctTracks)}
          before={had(was?.tracks ?? null)}
        />
        <Card
          label={t.stats.figures.artists}
          value={String(summary.distinctArtists)}
          before={had(was?.artists ?? null)}
        />
        <Card
          label={t.stats.figures.finished}
          value={
            summary.playCount > 0
              ? t.stats.percent(Math.round((summary.completedCount / summary.playCount) * 100))
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
            <Text style={styles.heading}>{t.format.upper(t.stats.screen.lists[list.of])}</Text>
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
                  entry={entry}
                  share={entry.playCount / list.entries[0].playCount}
                />
              ))
            )}
          </View>
        ))}
      </View>

      <View style={{ height: insets.bottom + 24 }} />

      <ReportViewer
        visible={recapOpen}
        stamp={data.title}
        cards={buildReport(
          {
            period,
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
    <View style={styles.card}>
      <Text style={styles.cardValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.cardLabel} numberOfLines={1}>
        {label}
      </Text>
      {before ? (
        <Text style={styles.cardBefore} numberOfLines={1}>
          {t.stats.screen.was(before)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One line of a chart-topper list.
 *
 * The bar behind it is the row's share of the busiest one, which is what turns
 * a column of numbers into something that can be read at a glance: whether the
 * top track is a habit or merely first past the post.
 */
function Row({ rank, entry, share }: { rank: number; entry: TopEntry; share: number }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={[styles.rowFill, { width: `${Math.max(2, share * 100)}%` }]} />
      <Text style={styles.rank}>{rank}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {entry.label}
        </Text>
        {entry.detail ? (
          <Text style={styles.rowDetail} numberOfLines={1}>
            {entry.detail}
          </Text>
        ) : null}
      </View>
      <Text style={styles.rowCount}>{entry.playCount}×</Text>
    </View>
  );
}

/**
 * How many days the average is over.
 *
 * A period still running is counted up to today rather than to its end, or the
 * first of the month would report a daily average across thirty days that have
 * not happened.
 */
function countedDays(buckets: Bucket[], now: number): number {
  if (buckets.length === 0) return 0;
  const since = buckets[0].start;
  const until = Math.min(now, buckets[buckets.length - 1].end);
  return Math.max(1, Math.ceil((until - since) / (24 * 60 * 60 * 1000)));
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
  return Math.max(1, Math.round((range.until - range.since) / (24 * 60 * 60 * 1000)));
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
function readPeriod(): PeriodId {
  const saved = readSetting(SETTINGS.statsPeriod);
  return PERIODS.some((entry) => entry.id === saved) ? (saved as PeriodId) : 'week';
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { gap: 4 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { color: c.text, fontSize: 16 },
  emptyBody: { color: c.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },

  periods: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: 11,
    padding: 3,
    marginBottom: 20,
    ...outlined(c),
  },
  period: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  periodOn: { backgroundColor: c.selected },
  periodLabel: { color: c.textMuted, fontSize: 13.5 },
  periodLabelOn: { color: c.onSelected, fontWeight: '600' },

  wide: { flexDirection: 'row', gap: 26, alignItems: 'flex-start' },
  wideSide: { flex: 1, minWidth: 0 },

  periodTitle: {
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
  },
  headlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headline: { color: c.text, fontSize: 40, fontWeight: '600', lineHeight: 48, flexShrink: 1 },
  recap: {
    backgroundColor: c.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    ...outlined(c),
  },
  recapLabel: { color: c.text, fontSize: 13.5, fontWeight: '600' },
  change: { fontSize: 13 },
  muted: { color: c.textMuted, fontSize: 13 },

  metrics: { flexDirection: 'row', gap: 16, paddingTop: 14 },
  metric: { color: c.textFaint, fontSize: 12.5, letterSpacing: 1 },
  // Underlined as well as coloured, so that which of the two is on can be
  // told without the colour. Not heavier: the other would shift as it changed.
  metricOn: { color: c.accent, textDecorationLine: 'underline' },

  chart: { paddingTop: 22 },

  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 26 },
  card: {
    // Four to a row on a phone, more where there is room, and the gaps are
    // taken out of the share so they never push the fourth one down.
    minWidth: 78,
    flexGrow: 1,
    flexBasis: '22%',
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    gap: 3,
    ...outlined(c),
  },
  cardValue: { color: c.text, fontSize: 17, fontWeight: '600' },
  cardLabel: { color: c.textFaint, fontSize: 11 },
  // Dimmer than the label, which is already dim: it is the least of the three
  // lines and has to be read as the footnote it is rather than as a second
  // figure competing with the one above it.
  cardBefore: { color: c.textDisabled, fontSize: 10.5, marginTop: 1 },

  heading: {
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
    paddingTop: 30,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 9,
    marginBottom: 3,
    overflow: 'hidden',
  },
  rowFill: {
    // Behind the text rather than beside it, so a long title has the whole
    // width and the proportion is still legible underneath it.
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: c.accentSoft,
    borderRadius: 9,
  },
  rank: { color: c.textFaint, fontSize: 12, width: 16, fontVariant: ['tabular-nums'] },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { color: c.text, fontSize: 14.5 },
  rowDetail: { color: c.textFaint, fontSize: 11.5, paddingTop: 1 },
  rowCount: { color: c.textMuted, fontSize: 12.5, fontVariant: ['tabular-nums'] },
}));
