import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useT, type Strings } from '../lib/i18n/index';
import { columnHolding, type Bucket } from '../lib/stats/period';
import { makeStyles, withAlpha } from '../lib/theme/index';

/** How tall the bars are, before the labels underneath. */
const PLOT_HEIGHT = 132;

/** A column with something in it is never invisible, however small its share. */
const MIN_VISIBLE = 0.025;

/**
 * How much room a label is given, and how far apart two of them must be.
 *
 * Labels are laid out over the columns rather than inside them. A column of a
 * thirty-one day month is about eight points wide and "15" needs eleven, so
 * inside its own column every two-digit day was being ellipsised to a single
 * character — and the year labels of a long history had no chance at all.
 */
const LABEL_WIDTH = 32;

/** The space between columns, which the label positions have to allow for. */
const COLUMN_GAP = 2;

/**
 * A period's listening, a column at a time.
 *
 * Drawn from plain views. There is no drawing library in the app and a bar
 * chart does not justify adding one — a bar is a rectangle, and the only part
 * that needs any care is how it grows.
 *
 * Which is a transform rather than a height, so the growing runs on the native
 * driver. Animating a height cannot: every frame is a layout pass marshalled
 * out of JavaScript, and thirty-one of those at once is exactly the sort of
 * thing that stutters while a song is being decoded.
 */
export function BarChart({
  buckets,
  values,
  accent,
  format,
  now,
}: {
  buckets: Bucket[];
  /** One per bucket, in the same order. */
  values: number[];
  /** The unlit columns are the same colour seen through. */
  accent: string;
  /** How a column's value is said in the readout above the chart. */
  format: (value: number) => string;
  /** The moment being lived through, so its column can be marked. */
  now: number;
}) {
  const t = useT();
  const styles = useStyles();
  /**
   * The moment the column under the finger covers, not the column's position.
   *
   * The chart is not remounted when the period changes — only a change of
   * measure does that — so whatever is pinned here outlives the columns it was
   * pinned on. Held as a position it was a reference into the old chart: a day
   * picked in a month and then read against a year pointed past the end of
   * twelve columns, and the labels went looking for a column that was not
   * there. A moment survives the redraw because every chart can be asked which
   * of its columns holds it, or whether none of them do.
   */
  const [pinned, setPinned] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  /**
   * Where the plot starts across the window.
   *
   * A gesture reports `pageX`, which is the only coordinate that means the same
   * thing wherever the finger is. `locationX` is relative to the view actually
   * under it — and that is a column, not the plot, so it came back as a number
   * between zero and eight and every reading landed on the first column or two.
   * The same mistake the queue's drag made, for the same reason.
   */
  const plot = useRef<View | null>(null);
  const plotLeft = useRef(0);

  // Resolved against the columns as they are now, so it is either a column
  // that exists or nothing at all. Everything below may index with it freely.
  const touched = useMemo(() => columnHolding(pinned, buckets), [pinned, buckets]);

  const max = useMemo(() => Math.max(0, ...values), [values]);
  const current = useMemo(
    () => buckets.findIndex((bucket) => now >= bucket.start && now < bucket.end),
    [buckets, now]
  );

  /*
    Read from inside the responder, which is built once and would otherwise
    close over the first render's width and columns for good.
  */
  const widthRef = useRef(width);
  const bucketsRef = useRef(buckets);
  widthRef.current = width;
  bucketsRef.current = buckets;

  /*
    Kept across renders and rebuilt only when the number of columns changes,
    which is what makes a change of period grow from nothing while a refresh
    within one moves from where it already was.
  */
  const grown = useRef<Animated.Value[]>([]);
  if (grown.current.length !== buckets.length) {
    grown.current = buckets.map(() => new Animated.Value(0));
  }

  useEffect(() => {
    Animated.parallel(
      grown.current.map((value, index) =>
        Animated.timing(value, {
          toValue: share(values[index] ?? 0, max),
          duration: 320,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [values, max]);

  /*
    Dragging across the chart reads it out column by column. Claimed only once
    the finger has committed to going sideways, so a scroll that happens to
    start on the chart still scrolls the page. Taps are left to the columns
    themselves, which do not have that problem.
  */
  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (event) => {
        const columns = bucketsRef.current;
        const span = widthRef.current;
        if (columns.length === 0 || span <= 0) return;
        const x = event.nativeEvent.pageX - plotLeft.current;
        const index = Math.min(
          columns.length - 1,
          Math.max(0, Math.floor((x / span) * columns.length))
        );
        setPinned(columns[index].start);
      },
      onPanResponderRelease: () => setPinned(null),
      onPanResponderTerminate: () => setPinned(null),
    })
  ).current;

  // With nothing under the finger the readout describes the column being lived
  // through, which is the one a glance is usually after.
  const shown = touched ?? (current >= 0 ? current : buckets.length - 1);
  const readout = buckets[shown];

  /*
    Which columns get a label.

    Thinned by what actually fits rather than by a fixed every-nth rule: the
    same chart is drawn on a phone and on a tablet, sideways and upright, with
    anything from seven columns to thirty-six, and the number that fits is not
    a property of the period. The column under the finger is placed first and
    keeps its place, since that is the one being asked about.
  */
  const centreOf = useMemo(() => {
    // The gaps are real width. Dividing the plot evenly would drift by a
    // column's own width across a month, which is enough to sit a label over
    // its neighbour.
    const count = buckets.length;
    const columnWidth = count > 0 ? (width - COLUMN_GAP * (count - 1)) / count : 0;
    return (index: number) => index * (columnWidth + COLUMN_GAP) + columnWidth / 2;
  }, [buckets.length, width]);

  const labelled = useMemo(() => {
    if (width <= 0 || buckets.length === 0) return [];

    const placed: number[] = [];
    const fits = (index: number) =>
      placed.every((taken) => Math.abs(centreOf(index) - centreOf(taken)) >= LABEL_WIDTH);

    if (touched != null) placed.push(touched);
    buckets.forEach((bucket, index) => {
      if (bucket.major && fits(index)) placed.push(index);
    });
    return placed.sort((left, right) => left - right);
  }, [buckets, width, touched, centreOf]);

  return (
    <View>
      <View style={styles.readout}>
        <Text style={styles.readoutValue}>{format(values[shown] ?? 0)}</Text>
        <Text style={styles.readoutLabel} numberOfLines={1}>
          {readout ? longLabel(readout, t) : ''}
        </Text>
      </View>

      <View
        ref={plot}
        style={styles.plot}
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
          // Where it sits in the window, which its own layout does not say:
          // that is measured against its parent, and the parent moves with the
          // page as it scrolls.
          plot.current?.measureInWindow((x) => {
            plotLeft.current = x;
          });
        }}
        {...drag.panHandlers}>
        {buckets.map((bucket, index) => (
          <Pressable
            key={bucket.start}
            style={styles.column}
            // The bars are thin; without this a tap has to land inside a strip
            // a few pixels wide and as short as the bar happens to be.
            hitSlop={{ top: 14, bottom: 14 }}
            onPress={() => setPinned(index === touched ? null : bucket.start)}>
            <Animated.View
              style={[
                styles.bar,
                {
                  backgroundColor: index === shown ? accent : withAlpha(accent, UNLIT_ALPHA),
                  /*
                    A bar scales about its middle, which would sink its base as
                    it shrank. Sliding it back down by half of what the scaling
                    took off pins the baseline where it belongs, and both halves
                    come off the one value so they stay in step on the native
                    driver.
                  */
                  transform: [
                    {
                      translateY: grown.current[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [PLOT_HEIGHT / 2, 0],
                      }),
                    },
                    { scaleY: grown.current[index] },
                  ],
                },
              ]}
            />
          </Pressable>
        ))}
      </View>

      <View style={styles.labels} pointerEvents="none">
        {labelled.map((index) => (
          <Text
            key={buckets[index].start}
            style={[
              styles.label,
              {
                // Centred on its column and free to be wider than one, since
                // the columns either side of a labelled one are blank.
                left: centreOf(index) - LABEL_WIDTH / 2,
              },
              index === shown && { color: accent },
            ]}
            numberOfLines={1}>
            {buckets[index].label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** How much of the plot a value fills, never quite nothing when it is not. */
function share(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(value / max, MIN_VISIBLE);
}

/** The columns not being read, at a little over a third of full strength. */
const UNLIT_ALPHA = 0.36;

/** `Thursday 24 September`, `September 2026` — the column said in full. */
function longLabel(bucket: Bucket, t: Strings): string {
  const start = new Date(bucket.start);
  const span = bucket.end - bucket.start;

  // An hour, a day, a month or a year, told apart by how much each covers
  // rather than by being passed the period: the chart then needs nothing but
  // the columns it was already given.
  if (span <= 60 * 60 * 1000 + 1) {
    return `${String(start.getHours()).padStart(2, '0')}:00`;
  }
  if (span <= 25 * 60 * 60 * 1000) {
    return t.stats.chart.day(start);
  }
  if (span <= 32 * 24 * 60 * 60 * 1000) {
    return t.stats.chart.month(start);
  }
  return String(start.getFullYear());
}

const useStyles = makeStyles((c) => StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingBottom: 10 },
  readoutValue: { color: c.text, fontSize: 19, fontWeight: '600' },
  readoutLabel: { color: c.textMuted, fontSize: 13, flex: 1 },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: PLOT_HEIGHT,
    gap: COLUMN_GAP,
  },
  column: { flex: 1, minWidth: 0, height: '100%', justifyContent: 'flex-end' },
  bar: { height: '100%', borderRadius: 3 },
  // A bare strip the labels are positioned over, tall enough to hold one.
  labels: { height: 14, paddingTop: 7 },
  label: {
    position: 'absolute',
    top: 7,
    width: LABEL_WIDTH,
    color: c.textFaint,
    fontSize: 10,
    textAlign: 'center',
  },
}));
