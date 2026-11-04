import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image } from './Picture';
import { laid, makeStyles, useColours } from '../lib/theme/index';
import { scrimOf } from '../lib/theme/Veil';
import { haptic } from '../lib/ui/haptics';
import { motionReduced } from '../lib/ui/motion';
import {
  placeAt,
  PRESS_MS,
  pressMenu,
  RESTING_WITHIN,
  RING_ICONS,
  RING_RADIUS,
  ringMiddle,
  sliceAngle,
  SLICES,
  type PressChoice,
  type PressMenu,
} from '../lib/ui/pressMenu';

/** What a choice draws for itself, in the colour it is told, for how it stands now. */
export type PressIcon = (colour: string) => ReactNode;

/** What a kind of row offers in its ring, and what is done with it. One for every row of the kind, made once by the screen. */
export type PressRingFor<Item> = {
  title: (item: Item) => string;
  /** On offer for it, each in its own place. */
  choices: (item: Item) => readonly PressChoice<PressIcon>[];
  /** Let go of on a choice. */
  chose: (place: number, item: Item) => void;
  /** Let go of without having moved: the whole of the menu, for what the ring has no place for. */
  stayed: (item: Item) => void;
};

/**
 * A row that opens the ring when it is held: see `pressMenu.ts`. Around the
 * row, and its own: a row that is not drawn has nothing listening, and one of
 * any height is found without working out where the finger is in the list.
 *
 * Done on the screen's own thread, since all it does between one choice and
 * the next is compare two numbers, and draws nothing until the choice changes.
 *
 * It takes the touch from the list only once the finger has been held still.
 * Moved before that, it lets go, and the list scrolls or the row is pulled
 * aside as if this were not here. A tap is the row's, as it always was.
 *
 * [clearOfRight] leaves that much of the row's right-hand end to what is
 * there: a handle that lifts the row to move it, which a hold means there.
 */
export function PressRing<Item>({
  ring,
  item,
  enabled = true,
  clearOfRight = 0,
  children,
}: {
  ring: PressRingFor<Item> | undefined;
  item: Item;
  enabled?: boolean;
  clearOfRight?: number;
  children: ReactNode;
}) {
  const latest = useRef({ ring, item });
  latest.current = { ring, item };
  const window = useWindowDimensions();
  const size = useRef(window);
  size.current = window;
  const insets = useSafeAreaInsets();
  const top = useRef(insets.top);
  top.current = insets.top;
  const open = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const on = enabled && ring != null;

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(on)
        .maxPointers(1)
        .hitSlop(clearOfRight > 0 ? { right: -clearOfRight } : undefined)
        .activateAfterLongPress(PRESS_MS)
        .onStart((event) => {
          const { ring: now, item: held } = latest.current;
          if (!now) return;
          // On the window, the gestures' root being round the whole app.
          open.current = { x: event.absoluteX, y: event.absoluteY, moved: false };
          haptic('holds', 'hold');
          const middle = ringMiddle(event.absoluteX, event.absoluteY, size.current.width, size.current.height, top.current);
          pressMenu.set({ ...middle, title: now.title(held), choices: now.choices(held), chosen: null });
        })
        .onUpdate((event) => {
          const up = open.current;
          const menu = pressMenu.get();
          if (!up || !menu) return;
          if (Math.hypot(event.absoluteX - up.x, event.absoluteY - up.y) >= RESTING_WITHIN) up.moved = true;
          // From the ring's middle, which near an edge is not where the finger came down: see `pressMenu.ts`.
          const place = up.moved ? placeAt(event.absoluteX - menu.x, event.absoluteY - menu.y) : null;
          const chosen = menu.choices.some((choice) => choice.place === place) ? place : null;
          if (chosen === menu.chosen) return;
          if (chosen != null) haptic('choices', 'tick');
          pressMenu.set({ ...menu, chosen });
        })
        .onEnd(() => {
          const up = open.current;
          const chosen = pressMenu.get()?.chosen ?? null;
          const { ring: now, item: held } = latest.current;
          if (!up || !now) return;
          if (chosen != null) now.chose(chosen, held);
          else if (!up.moved) now.stayed(held);
        })
        .onFinalize(() => {
          open.current = null;
          pressMenu.set(null);
        }),
    [on, clearOfRight]
  );

  if (!ring) return <>{children}</>;
  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  );
}

/** One slice, of one drawing turned to its place, and what is in it. A slice with nothing on offer stands empty, and the ring whole. */
function Slice({ place, choice, chosen }: { place: number; choice: PressChoice<PressIcon> | undefined; chosen: boolean }) {
  const c = useColours();
  const styles = useStyles();
  const size = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(size, { toValue: chosen ? 1.05 : 1, speed: 50, bounciness: 10, useNativeDriver: true }).start();
  }, [chosen, size]);
  const angle = (sliceAngle(place) * Math.PI) / 180;
  return (
    <Animated.View style={[styles.slice, { transform: [{ scale: size }] }]}>
      <Image
        source={require('../../assets/icons/pie-slice.svg')}
        style={[styles.sliceShape, { transform: [{ rotate: `${place * (360 / SLICES)}deg` }] }]}
        // Flat, whatever the theme: in one of glass what is under the ring would read through it.
        tintColor={chosen ? c.primary : laid(c.surfaceRaised, c.bg)}
        contentFit="contain"
        transition={0}
        accessible={false}
      />
      {choice ? (
        <View style={[styles.icon, { left: RING_RADIUS + Math.cos(angle) * RING_ICONS - 14, top: RING_RADIUS + Math.sin(angle) * RING_ICONS - 14 }]}>
          {choice.icon(chosen ? c.onPrimary : c.text)}
        </View>
      ) : null}
    </Animated.View>
  );
}

/**
 * The ring, over everything: the tab bar and the bar of what is playing are
 * no part of any screen. A layer and not a window of its own, which a finger
 * already down could not be handed over to; and nothing here takes a touch.
 */
export function PressMenuHost() {
  const menu = useSyncExternalStore(pressMenu.subscribe, pressMenu.get) as PressMenu<PressIcon> | null;
  const c = useColours();
  const styles = useStyles();
  const opened = useRef(new Animated.Value(0)).current;
  const up = menu != null;
  useEffect(() => {
    if (!up) {
      opened.setValue(0);
      return;
    }
    if (motionReduced()) opened.setValue(1);
    else Animated.spring(opened, { toValue: 1, speed: 32, bounciness: 7, useNativeDriver: true }).start();
  }, [opened, up]);
  const grown = opened.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  if (!menu) return null;
  const words = menu.choices.find((choice) => choice.place === menu.chosen)?.label ?? menu.title;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrimOf(c), opacity: opened }]} />
      <Animated.View style={[styles.ring, { left: menu.x - RING_RADIUS, top: menu.y - RING_RADIUS, opacity: opened, transform: [{ scale: grown }] }]}>
        <View style={styles.wordsAt}>
          <Text style={[styles.words, { backgroundColor: laid(c.surfaceRaised, c.bg) }]} numberOfLines={1}>
            {words}
          </Text>
        </View>
        {Array.from({ length: SLICES }, (_, place) => (
          <Slice key={place} place={place} choice={menu.choices.find((choice) => choice.place === place)} chosen={place === menu.chosen} />
        ))}
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    ring: { position: 'absolute', width: RING_RADIUS * 2, height: RING_RADIUS * 2 },
    slice: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    sliceShape: { width: RING_RADIUS * 2, height: RING_RADIUS * 2 },
    icon: { position: 'absolute', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    // No wider than the ring, which is kept on the screen, so that a long name is too.
    wordsAt: { position: 'absolute', left: 0, right: 0, top: -40, alignItems: 'center' },
    words: {
      maxWidth: RING_RADIUS * 2,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      overflow: 'hidden',
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
    },
  })
);
