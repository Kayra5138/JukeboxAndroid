import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useT } from '../../lib/i18n/index';
import { accuracyOf, pointsOf, type Score } from '../../lib/tiles/game';
import {
  LOST_WAIT_MS,
  RISE_MS,
  VEIL,
  VEIL_OFF_FOOT,
  VEIL_OFF_HEAD,
  WON_WAIT_MS,
  type End,
  type Keep,
} from './constants';
import { styles } from './styles';

/**
 * The page a run ends on, brought up over the board it ended on.
 *
 * A veil rather than a wall: the board is still there behind it, stopped, with
 * the move that ended the run marked on it. It comes up slowly and after a
 * moment, so there is time to see that move before anything covers it.
 *
 * The button is dead until the page has actually arrived. Somebody who has
 * just lost is usually still tapping, and a button that faded in under a
 * finger already on its way down would start the next run by accident.
 *
 * The end of the board that holds the move is kept clear, and the veil thins
 * towards it: that is where the thing worth seeing is, and the figures have
 * the rest of the screen.
 */
export function Ending({
  end,
  score,
  colour,
  still,
  top,
  bottom,
  keep,
  clear,
  shown,
  onAgain,
}: {
  end: End;
  score: Score;
  colour: string;
  still: boolean;
  top: number;
  bottom: number;
  /** Which end of the board to stay off, and how much of it, in points. */
  keep: Keep;
  clear: number;
  /** How far up the page has come, nought to one. Held by the screen, which may have to stop it. */
  shown: SharedValue<number>;
  onAgain: () => void;
}) {
  const t = useT();
  const wait = still || end === 'stopped' ? 0 : end === 'won' ? WON_WAIT_MS : LOST_WAIT_MS;
  const [armed, setArmed] = useState(still);

  useEffect(() => {
    if (still) {
      shown.value = 1;
      return;
    }
    shown.value = 0;
    shown.value = withDelay(wait, withTiming(1, { duration: RISE_MS, easing: Easing.out(Easing.quad) }));
    /*
      Not until the page has finished arriving, and a moment past. Again takes
      this page off the screen, and it must not go while it is still being
      faded in: see `leave` on the screen for what a view removed in the middle
      of an animation does afterwards.
    */
    const timer = setTimeout(() => setArmed(true), wait + RISE_MS + 60);
    return () => clearTimeout(timer);
  }, [shown, still, wait]);

  const veil = useAnimatedStyle(() => ({ opacity: shown.value }));
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - shown.value) * 26 }] }));

  const clean = score.total > 0 && score.hit === score.total;
  const said = t.tiles.ending;
  const heading = end === 'won' ? (clean ? said.clean : said.won) : said.over;
  const why =
    end === 'lapse'
      ? said.lapse
      : end === 'empty'
        ? said.empty
        : end === 'won'
          ? said.toTheEnd
          : null;

  return (
    <Animated.View
      style={[
        styles.ending,
        {
          paddingTop: Math.max(top + 24, keep === 'head' ? clear : 0),
          paddingBottom: Math.max(bottom + 24, keep === 'foot' ? clear : 0),
        },
        veil,
      ]}>
      <LinearGradient
        pointerEvents="none"
        colors={keep === 'foot' ? VEIL_OFF_FOOT : keep === 'head' ? VEIL_OFF_HEAD : VEIL}
        // A key let past fills the bottom third; a tap has a whole half to
        // itself, so the veil lets go of it sooner.
        locations={keep === 'head' ? [0.38, 0.54, 1] : end === 'empty' ? [0, 0.46, 0.62] : [0, 0.58, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.endingBody, rise]}>
        <Text style={styles.title}>{heading}</Text>
        {why ? <Text style={styles.why}>{why}</Text> : null}
        <Text style={styles.big}>{pointsOf(score)}</Text>
        <Text style={styles.note}>
          {said.figures(
            score.hit,
            score.total,
            score.bonus,
            score.best,
            Math.round(accuracyOf(score) * 100)
          )}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!armed}
          style={[styles.go, { backgroundColor: colour }]}
          onPress={onAgain}>
          <Text style={styles.goLabel}>{said.again}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
