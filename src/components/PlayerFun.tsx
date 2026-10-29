import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type TextStyle } from 'react-native';

import type { Flying } from '../lib/ui/playerFun';

/**
 * What the player draws for its repeat and lyrics buttons pressed again and
 * again: the cover turned into a record, the name of the song waving, and
 * words of the song in the air. Shown only for a run of presses, and drawn
 * from what is on the screen already wherever it can be, so that a long run
 * costs little; see `ui/playerFun.ts` for what is let go when.
 */

/** The record a cover becomes: grooves round it and the hole in the middle, laid over the picture as it turns. */
export function VinylFace({ size, hole }: { size: number; hole: string }) {
  const rings = [0.92, 0.78, 0.64, 0.5];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centre]}>
      {rings.map((share) => (
        <View
          key={share}
          style={[styles.ring, { width: size * share, height: size * share, borderRadius: (size * share) / 2 }]}
        />
      ))}
      <View style={[styles.label, { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15 }]} />
      <View style={{ width: size * 0.06, height: size * 0.06, borderRadius: size * 0.03, backgroundColor: hole }} />
    </View>
  );
}

/**
 * The song's name with each letter riding [wave], a step behind the one
 * before it, for as long as a run of presses keeps it going. Laid out as
 * the name is, on one line, and cut off at the edge rather than ended
 * with a stop, for the few seconds it waves.
 */
export function WaveTitle({ text, wave, style }: { text: string; wave: Animated.Value; style: StyleProp<TextStyle> }) {
  // As much of the name as a line holds, as the still name shows it: its beginning, and a stop where it is cut.
  const all = Array.from(text);
  const letters = all.length > LONGEST_WAVE ? [...all.slice(0, LONGEST_WAVE - 1), '…'] : all;
  const steps = [0, -7, 0, 7, 0];
  return (
    <View style={styles.waveLine} accessible={false} importantForAccessibility="no-hide-descendants">
      {letters.map((letter, at) => {
        // Each letter's own place in the swell: the same wave, started a little later along the name.
        const shift = at % 4;
        const output = [...steps.slice(shift), ...steps.slice(1, shift + 1)];
        return (
          <Animated.Text
            key={`${at}-${letter}`}
            style={[style, { transform: [{ translateY: wave.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: output }) }] }]}>
            {letter}
          </Animated.Text>
        );
      })}
    </View>
  );
}

/**
 * Words in the air, over the whole player: rising from [origin], the middle
 * of the lyrics button on the screen, or falling from the top as lines of
 * the song. Each goes once and is let go of when it has landed.
 */
export function FlyingWords({
  items,
  origin,
  ink,
  accent,
  onLanded,
}: {
  items: readonly Flying[];
  origin: { x: number; y: number };
  ink: string;
  accent: string;
  onLanded: (key: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      {items.map((item) => (
        <Word key={item.key} item={item} origin={origin} width={width} height={height} ink={ink} accent={accent} onLanded={onLanded} />
      ))}
    </View>
  );
}

function Word({
  item,
  origin,
  width,
  height,
  ink,
  accent,
  onLanded,
}: {
  item: Flying;
  origin: { x: number; y: number };
  width: number;
  height: number;
  ink: string;
  accent: string;
  onLanded: (key: string) => void;
}) {
  const [along] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const going = Animated.timing(along, {
      toValue: 1,
      duration: item.ms,
      delay: item.wait,
      easing: item.kind === 'rise' ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    going.start(({ finished }) => {
      if (finished) onLanded(item.key);
    });
    return () => going.stop();
    // One word, sent once: sending it again whenever the list around it is redrawn would send every word back.
  }, []);

  const style =
    item.kind === 'rise'
      ? {
          left: (item.from ?? origin).x,
          top: (item.from ?? origin).y,
          opacity: along.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: along.interpolate({ inputRange: [0, 1], outputRange: [0, item.x * 130] }) },
            { translateY: along.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.32] }) },
            { rotate: along.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${item.turn}deg`] }) },
            { scale: along.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.1, 0.9] }) },
          ],
        }
      : {
          left: item.x * width * 0.8,
          top: 0,
          opacity: along.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.95, 0.95, 0] }),
          transform: [
            { translateY: along.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] }) },
            { rotate: `${item.turn}deg` },
          ],
        };

  return (
    <Animated.View style={[styles.word, style]}>
      <Text allowFontScaling={false} numberOfLines={1} style={{ color: item.kind === 'fall' && item.size > 20 ? accent : ink, fontSize: item.size, fontWeight: '700' }}>
        {item.text}
      </Text>
    </Animated.View>
  );
}

/** The most letters the waving name shows on one line of a phone, about as many as the still one does. */
const LONGEST_WAVE = 30;

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(0,0,0,0.35)' },
  label: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  waveLine: { flexDirection: 'row', overflow: 'hidden', justifyContent: 'center' },
  word: { position: 'absolute' },
});
