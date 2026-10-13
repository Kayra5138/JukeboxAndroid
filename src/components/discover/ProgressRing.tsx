import { StyleSheet, View } from 'react-native';

/**
 * A small ring that fills clockwise from the top, with room in the middle
 * for a mark.
 *
 * The ring the floating downloads button wears, at any size: two half-rings,
 * each turning behind a window the shape of the other half of the circle.
 * The first swings into the right-hand window over the first half of the way
 * and the second into the left-hand one over the rest. It is turned when the
 * download is read, once a second, so the turning is a style and nothing
 * here runs between one reading and the next.
 *
 * At nought it is the track alone, which is how a row says a song is waiting
 * its turn.
 */
export function ProgressRing({
  size,
  width,
  progress,
  colour,
  track,
  children,
}: {
  size: number;
  width: number;
  /** Nought to a hundred. */
  progress: number;
  colour: string;
  track: string;
  children?: React.ReactNode;
}) {
  const angle = Math.min(Math.max(progress, 0), 100) * 3.6;
  const half = size / 2;
  const ring = { width: size, height: size, borderRadius: half, borderWidth: width };
  const window = { width: half, height: size };
  const whole = { width: size, height: size };
  return (
    <View style={[styles.frame, whole]}>
      <View style={[styles.layer, ring, { borderColor: track }]} />
      {/* Not drawn at all at nought: an edge exactly on the window's own is a hairline of colour. */}
      {angle > 0 ? (
        <View style={[styles.layer, styles.clip, window, { left: half }]}>
          <View style={[styles.layer, whole, { left: -half, transform: [{ rotate: `${Math.min(angle, 180)}deg` }] }]}>
            <View style={[styles.clip, window]}>
              <View style={[ring, { borderColor: colour }]} />
            </View>
          </View>
        </View>
      ) : null}
      {angle > 180 ? (
        <View style={[styles.layer, styles.clip, window]}>
          <View style={[styles.layer, whole, { transform: [{ rotate: `${angle - 180}deg` }] }]}>
            <View style={[styles.clip, window, { marginLeft: half }]}>
              <View style={[ring, { borderColor: colour, marginLeft: -half }]} />
            </View>
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute', top: 0, left: 0 },
  clip: { overflow: 'hidden' },
});
