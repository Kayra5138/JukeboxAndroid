import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useColours } from '../lib/theme/index';

/**
 * Transport icons drawn from plain views rather than written as characters.
 *
 * `⏸` and `▶` are emoji as far as the system font is concerned, so Android
 * renders them in full colour and ignores any tint — which is why the pause
 * button came out orange. Shapes made of views take the colour they are given.
 */

/**
 * The colour an icon is drawn in: the one it was asked for, or else the
 * colour of words in the theme it finds itself in.
 *
 * So an icon given no colour is right on a page of either theme, and right
 * again inside a `ThemeScope` — on a surface coloured from a cover, which is
 * held dark, it comes out light without the player having to say so.
 */
function useInk(asked: string | undefined): string {
  const c = useColours();
  return asked ?? c.text;
}

/**
 * Play and pause take up exactly the same room, whatever is drawn inside.
 *
 * These two swap places on one button, so their footprints have to match or
 * the row they are in re-lays out every time the button is pressed and the
 * skip buttons either side visibly jump. Left to their natural sizes they do
 * not match: a triangle and a pair of bars asked for the same `size` came out
 * near a fifth different in width.
 *
 * Inside that box they are sized to carry the same amount of ink rather than to
 * share a bounding box, which is not the same thing and is what decides whether
 * they look like a pair. A triangle covers half of what it spans, so matched
 * width for width it comes out much the lighter of the two; it is given the
 * full height of the box and the bars a little less, which brings them within a
 * few percent of each other.
 */
function Transport({ size, children }: { size: number; children: React.ReactNode }) {
  return <View style={[styles.centre, { width: size, height: size }]}>{children}</View>;
}

export function PlayIcon({ size = 28, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  return (
    <Transport size={size}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.5,
          borderBottomWidth: size * 0.5,
          borderLeftWidth: size * 0.86,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
          // A triangle hangs to the left of the middle of its own box, so
          // centring it by the numbers leaves it looking off to one side.
          marginLeft: size * 0.05,
        }}
      />
    </Transport>
  );
}

export function PauseIcon({ size = 28, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  const bar = { width: size * 0.26, height: size * 0.86, backgroundColor: color, borderRadius: 1 };
  return (
    <Transport size={size}>
      <View style={[styles.row, { gap: size * 0.2 }]}>
        <View style={bar} />
        <View style={bar} />
      </View>
    </Transport>
  );
}

function Triangle({ size, color, pointsLeft }: { size: number; color: string; pointsLeft: boolean }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: size / 2,
        borderBottomWidth: size / 2,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        ...(pointsLeft
          ? { borderRightWidth: size * 0.72, borderRightColor: color }
          : { borderLeftWidth: size * 0.72, borderLeftColor: color }),
      }}
    />
  );
}

/**
 * An arrow pointing back the way you came.
 *
 * Drawn from three bars for the same reason the transport is: `←` is a
 * character, and what a character looks like is up to whichever font the phone
 * falls back to. The head is two bars turned about the tip, so the point is a
 * point at every size rather than whatever a glyph was hinted to.
 */
export function BackIcon({ size = 22, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  const stroke = Math.max(2, size * 0.11);
  const head = size * 0.5;
  const tip = size * 0.08;
  const middle = size / 2;
  // Half the head's length along each axis once it is turned an eighth.
  const reach = head * 0.3536;
  const bar = { position: 'absolute' as const, height: stroke, borderRadius: stroke, backgroundColor: color };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[bar, { left: tip, width: size - tip * 2, top: middle - stroke / 2 }]} />
      <View
        style={[
          bar,
          { width: head, left: tip + reach - head / 2, top: middle - reach - stroke / 2 },
          { transform: [{ rotate: '-45deg' }] },
        ]}
      />
      <View
        style={[
          bar,
          { width: head, left: tip + reach - head / 2, top: middle + reach - stroke / 2 },
          { transform: [{ rotate: '45deg' }] },
        ]}
      />
    </View>
  );
}

export function PreviousIcon({ size = 22, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  return (
    <View style={styles.row}>
      <View style={{ width: size * 0.16, height: size, backgroundColor: color, borderRadius: 1 }} />
      <Triangle size={size} color={color} pointsLeft />
    </View>
  );
}

export function NextIcon({ size = 22, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  return (
    <View style={styles.row}>
      <Triangle size={size} color={color} pointsLeft={false} />
      <View style={{ width: size * 0.16, height: size, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

/** Bundled vectors keep arrowheads and rounded strokes sharp at small sizes. */
function VectorIcon({ source, size, color }: { source: number; size: number; color: string }) {
  return <Image source={source} style={{ width: size, height: size }} tintColor={color}
    contentFit="contain" transition={0} accessible={false} />;
}

export function SettingsIcon({ size = 20, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  return <VectorIcon source={require('../../assets/icons/settings.svg')} size={size} color={color} />;
}

/** How wide the double chevron is against its height, from its own viewBox. */
const CHEVRON_ASPECT = 17 / 24;

/**
 * A step through the record: a double chevron, and how far it goes beside it.
 *
 * The number is drawn here rather than cut into the file because it is a
 * setting — there would otherwise have to be one icon per step, and a sixth
 * drawn before a sixth step could be offered.
 *
 * Beside the chevrons rather than inside a ring, which is what this was first.
 * A ring with digits in it is a different kind of object from the solid
 * triangles and bars it sits between: it reads as a dial or a badge that has
 * wandered into the transport. Chevrons are the same family as the triangles
 * on either side, the figure is as legible as the row's own labels, and the
 * pair says which way it goes without anybody having to work out which end of
 * a circle an arrow is at.
 */
export function JumpIcon({
  size = 22,
  color: asked,
  seconds,
  back = false,
}: {
  size?: number;
  color?: string;
  seconds: number;
  back?: boolean;
}) {
  const color = useInk(asked);
  const chevrons = (
    <Image
      source={back ? require('../../assets/icons/jump-back.svg') : require('../../assets/icons/jump-forward.svg')}
      style={{ width: size * CHEVRON_ASPECT, height: size }}
      tintColor={color}
      contentFit="contain"
      transition={0}
      accessible={false}
    />
  );
  const figure = (
    <Text
      allowFontScaling={false}
      style={{
        color,
        fontSize: size * 0.56,
        fontWeight: '700',
        // So that a five and a ten sit at the same place on the line, and the
        // row does not shift by a digit's width when the setting changes.
        fontVariant: ['tabular-nums'],
      }}>
      {seconds}
    </Text>
  );

  // The chevrons lead on the way back and follow on the way forward, so each
  // button reads outward from the middle of the row in the direction it moves.
  return (
    <View style={[styles.row, { gap: size * 0.1 }]}>
      {back ? chevrons : figure}
      {back ? figure : chevrons}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  centre: { alignItems: 'center', justifyContent: 'center' },
});

/**
 * A bar rotated about its centre, which is most of what the icons below are
 * made of. Rotation happens around the middle, so a line through a point is a
 * bar centred there and turned.
 */
function Bar({
  length,
  thickness,
  color,
  angle = 0,
  x = 0,
  y = 0,
}: {
  length: number;
  thickness: number;
  color: string;
  angle?: number;
  x?: number;
  y?: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        width: length,
        height: thickness,
        borderRadius: thickness / 2,
        backgroundColor: color,
        transform: [{ translateX: x }, { translateY: y }, { rotate: `${angle}deg` }],
      }}
    />
  );
}

export function ShuffleIcon({ size = 20, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  return <VectorIcon source={require('../../assets/icons/shuffle.svg')} size={size} color={color} />;
}

export function RepeatIcon({ size = 20, color: asked, once = false }: {
  size?: number; color?: string; once?: boolean;
}) {
  const color = useInk(asked);
  return <VectorIcon source={once ? require('../../assets/icons/repeat-one.svg') : require('../../assets/icons/repeat.svg')}
    size={size} color={color} />;
}

/** Lines of writing, shortening the way a verse does. */
export function LyricsIcon({ size = 20, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  const stroke = Math.max(1.6, size * 0.1);
  const widths = [0.86, 0.62, 0.78, 0.5];
  return (
    <View style={[styles.centre, { width: size, height: size }]}>
      {widths.map((width, index) => (
        <Bar
          key={width}
          length={size * width}
          thickness={stroke}
          color={color}
          // Left-aligned rather than centred, so it reads as writing.
          x={-(size * (0.86 - width)) / 2}
          y={(index - (widths.length - 1) / 2) * size * 0.24}
        />
      ))}
    </View>
  );
}

/** Two writing systems: language translation, rather than a web/globe symbol. */
export function TranslateIcon({ size = 20, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  return <VectorIcon source={require('../../assets/icons/translate.svg')} size={size} color={color} />;
}

/** A ticked box: the sign for turning a list into something to choose from. */
export function SelectIcon({ size = 20, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  const stroke = Math.max(1.6, size * 0.09);
  return (
    <View style={[styles.centre, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.82,
          height: size * 0.82,
          borderRadius: size * 0.16,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      {/* Two strokes meeting at an angle, which is all a tick is. */}
      <Bar length={size * 0.28} thickness={stroke} color={color} angle={45} x={-size * 0.12} y={size * 0.06} />
      <Bar length={size * 0.46} thickness={stroke} color={color} angle={-45} x={size * 0.06} y={-size * 0.02} />
    </View>
  );
}

/** Stacked music cards represent the library. */
export function LibraryIcon({ size = 22, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  return <VectorIcon source={require('../../assets/icons/library.svg')} size={size} color={color} />;
}

export function ListsIcon({ size = 22, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  return <VectorIcon source={require('../../assets/icons/lists.svg')} size={size} color={color} />;
}

export function SearchIcon({ size = 22, color: asked }: { size?: number; color?: string }) {
  const color = useInk(asked);
  return <VectorIcon source={require('../../assets/icons/search.svg')} size={size} color={color} />;
}
