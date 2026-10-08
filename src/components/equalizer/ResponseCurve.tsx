import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  curveSpan,
  describeCurve,
  gainDb,
  positionOfHz,
  responseCurve,
  type Band,
} from '../../lib/equalizer/bands';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlinedClip, withAlpha } from '../../lib/theme/index';

/**
 * How many points the curve is worked out at.
 *
 * Enough that the narrowest band there is still has a top to it -- a tenth
 * of an octave is most of a step -- and few enough to be worked out and laid
 * out again twenty-five times a second while a slider is being dragged.
 */
const POINTS = 81;

/** The frequencies that get a line down the chart, and the ones that get a name. */
const MARKS = [50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000];
const NAMED: Record<number, string> = { 100: '100', 1_000: '1k', 10_000: '10k' };

const LINE = 2;
const DOT = 8;

/**
 * What the bands add up to, drawn from 20 Hz to 20 kHz.
 *
 * Drawn from plain views, as the bar chart is: there is no drawing library
 * in the app. A curve is harder to make from rectangles than bars are, and
 * it is made of two kinds here. Under the line, one thin column per point
 * from the nought line to the curve, which is the shaded area. And the line
 * itself, a short bar between each point and the next, turned to the slope
 * between them -- seventy of those end to end are a curve to any eye.
 *
 * The frequency axis is logarithmic, because hearing is: an octave is the
 * same width wherever it is, and the bass is not squeezed into the first
 * sliver of the chart. The preamp is not in the picture. It moves the whole
 * line up or down without changing its shape, and the shape is what this is
 * for; the level is said in words underneath.
 */
export function ResponseCurve({
  bands,
  height,
  accent,
}: {
  bands: Band[];
  height: number;
  /** `#rrggbb`; the shading is the same colour carrying an alpha. */
  accent: string;
}) {
  const t = useT();
  const styles = useStyles();
  const [width, setWidth] = useState(0);

  const points = responseCurve(bands, POINTS);
  // Twelve decibels either way unless the curve goes further, so that an
  // ordinary curve is always seen at the same scale and can be compared with
  // the last one by eye.
  const span = curveSpan(points);
  const middle = height / 2;
  const y = (db: number) => middle - (db / span) * middle;
  const x = (index: number) => (index / (POINTS - 1)) * width;

  const lines: number[] = [];
  for (let db = -span; db <= span; db += 6) lines.push(db);

  return (
    <View
      style={[styles.chart, { height }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t.sound.curve.label(describeCurve(points, t))}>
      {width > 0 ? (
        <>
          {lines.map((db) => (
            <View
              key={`h${db}`}
              style={[styles.across, db === 0 && styles.nought, { top: y(db) }]}
            />
          ))}
          {MARKS.map((hz) => (
            <View
              key={`v${hz}`}
              style={[styles.down, NAMED[hz] ? styles.downNamed : null, { left: positionOfHz(hz) * width }]}
            />
          ))}

          {points.slice(0, -1).map((db, index) => {
            // One column per gap between two points, as tall as the curve is
            // from nought half way across it.
            const level = y((db + points[index + 1]) / 2);
            return (
              <View
                key={`a${index}`}
                style={[
                  styles.area,
                  {
                    left: x(index),
                    // A hair over, so that rounding to whole pixels never
                    // leaves a slit of background between two columns.
                    width: width / (POINTS - 1) + 0.5,
                    top: Math.min(level, middle),
                    height: Math.abs(level - middle),
                    backgroundColor: withAlpha(accent, 0.18),
                  },
                ]}
              />
            );
          })}

          {points.slice(0, -1).map((db, index) => {
            const fromX = x(index);
            const toX = x(index + 1);
            const fromY = y(db);
            const toY = y(points[index + 1]);
            const length = Math.hypot(toX - fromX, toY - fromY);
            return (
              <View
                key={`l${index}`}
                style={[
                  styles.stroke,
                  {
                    // Placed by its middle and turned about it, which is
                    // where a view turns: the two ends then land on the two
                    // points. A little longer than the gap, so that
                    // neighbours overlap at the corners instead of leaving
                    // a notch on the outside of each bend.
                    left: (fromX + toX) / 2 - (length + LINE) / 2,
                    top: (fromY + toY) / 2 - LINE / 2,
                    width: length + LINE,
                    backgroundColor: accent,
                    transform: [{ rotate: `${Math.atan2(toY - fromY, toX - fromX)}rad` }],
                  },
                ]}
              />
            );
          })}

          {bands.map((band, index) =>
            // A band doing nothing has no place on the curve to be shown at.
            band.gainDb === 0 ? null : (
              <View
                key={`d${index}`}
                style={[
                  styles.dot,
                  {
                    left: positionOfHz(band.frequencyHz) * width - DOT / 2,
                    // On the curve at the band's frequency, which is where
                    // all the bands together have put it, not at its own gain.
                    top: y(gainDb(bands, band.frequencyHz)) - DOT / 2,
                    borderColor: accent,
                  },
                ]}
              />
            )
          )}

          <Text style={[styles.label, styles.labelTop]}>+{span} dB</Text>
          <Text style={[styles.label, styles.labelBottom]}>−{span}</Text>
          {MARKS.filter((hz) => NAMED[hz]).map((hz) => (
            <Text
              key={`n${hz}`}
              style={[styles.label, styles.labelHz, { left: positionOfHz(hz) * width + 4 }]}>
              {NAMED[hz]}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  chart: {
    borderRadius: 10,
    backgroundColor: c.surface,
    // The line of a curve past the top of the scale stops at the edge rather
    // than running out over whatever is above the chart.
    overflow: 'hidden',
    ...outlinedClip(c),
  },
  across: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
  },
  nought: { height: 1, backgroundColor: c.borderStrong },
  down: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
  },
  downNamed: { backgroundColor: c.borderStrong },
  area: { position: 'absolute' },
  stroke: { position: 'absolute', height: LINE, borderRadius: LINE / 2 },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    backgroundColor: c.bg,
  },
  label: { position: 'absolute', color: c.textFaint, fontSize: 9.5 },
  labelTop: { top: 4, left: 6 },
  labelBottom: { bottom: 4, left: 6 },
  labelHz: { bottom: 4 },
}));
