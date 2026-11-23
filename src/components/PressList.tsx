import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { SPACE, TYPE, RADIUS } from '../lib/theme/measures';
import { Animated, BackHandler, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from './Pressable';
import { laid, makeStyles, outlinedClip, useColours, usePressed } from '../lib/theme/index';
import { scrimOf } from '../lib/theme/Veil';
import { haptic } from '../lib/ui/haptics';
import { motionReduced } from '../lib/ui/motion';
import { PRESS_MS, RESTING_WITHIN } from '../lib/ui/pressMenu';
import {
  footOf,
  LIST_HEADER,
  LIST_ROW,
  listPlace,
  pressList,
  rowAt,
  scrollStep,
  type PressListRow,
} from '../lib/ui/pressList';

/** What a button offers when it is held, made when it is held: the rows are what is true at that moment. */
export type PressListFor = {
  title: () => string;
  rows: () => readonly PressListRow[];
  /** Let go of on a row, or a row tapped once it has stayed. */
  choose: (key: string) => void;
};

/**
 * A button that opens the list under the finger when it is held: see
 * `pressList.ts`. A tap is still the button's own. Moved before the hold
 * comes to anything, it lets go, as a row that opens the ring does.
 */
export function PressList({ menu, enabled = true, children }: { menu: PressListFor; enabled?: boolean; children: ReactNode }) {
  const latest = useRef(menu);
  latest.current = menu;
  const window = useWindowDimensions();
  const screen = useRef({ width: window.width, height: window.height, top: 0, bottom: 0 });
  const insets = useSafeAreaInsets();
  screen.current = { width: window.width, height: window.height, top: insets.top, bottom: insets.bottom };
  const held = useRef<{ x: number; y: number; atX: number; atY: number; moved: boolean; frame: number | null } | null>(null);

  const gesture = useMemo(() => {
    // The finger where it was last, the rows moved under it while it is held near an end.
    const follow = () => {
      const now = held.current;
      const shown = pressList.get();
      if (!now || !shown || shown.staying) return;
      const step = now.moved ? scrollStep(now.atY, shown) : 0;
      const moved = step !== 0 ? { ...shown, scroll: shown.scroll + step } : shown;
      const chosen = now.moved ? rowAt(now.atX, now.atY, moved) : null;
      if (chosen !== shown.chosen && chosen != null) haptic('choices', 'tick');
      if (moved !== shown || chosen !== shown.chosen) pressList.set({ ...moved, chosen });
      now.frame = step !== 0 ? requestAnimationFrame(follow) : null;
    };
    return Gesture.Pan()
      .runOnJS(true)
      .enabled(enabled)
      .maxPointers(1)
      .activateAfterLongPress(PRESS_MS)
      .onStart((event) => {
        const rows = latest.current.rows();
        if (rows.length === 0) return;
        held.current = { x: event.absoluteX, y: event.absoluteY, atX: event.absoluteX, atY: event.absoluteY, moved: false, frame: null };
        haptic('holds', 'hold');
        const place = listPlace(event.absoluteX, event.absoluteY, rows.length, screen.current);
        pressList.set({ ...place, title: latest.current.title(), rows, chosen: null, scroll: 0, staying: false, choose: latest.current.choose });
      })
      .onUpdate((event) => {
        const now = held.current;
        if (!now) return;
        now.atX = event.absoluteX;
        now.atY = event.absoluteY;
        if (Math.hypot(event.absoluteX - now.x, event.absoluteY - now.y) >= RESTING_WITHIN) now.moved = true;
        if (now.frame == null) follow();
      })
      .onEnd(() => {
        const now = held.current;
        const shown = pressList.get();
        if (!now || !shown) return;
        const row = shown.chosen != null ? shown.rows[shown.chosen] : null;
        if (row) {
          pressList.set(null);
          shown.choose(row.key);
        } else if (!now.moved) pressList.set({ ...shown, staying: true });
      })
      .onFinalize(() => {
        const now = held.current;
        if (now?.frame != null) cancelAnimationFrame(now.frame);
        held.current = null;
        if (!pressList.get()?.staying) pressList.set(null);
      });
  }, [enabled]);

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  );
}

function Row({ row, chosen, onPress }: { row: PressListRow; chosen: boolean; onPress?: () => void }) {
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const body = (
    <>
      <View style={styles.rowText}>
        <Text style={[styles.label, row.apart && styles.apartLabel, chosen && styles.chosenText, row.checked && styles.checkedLabel]} numberOfLines={1}>
          {row.label}
        </Text>
        {row.detail ? (
          <Text style={[styles.detail, chosen && styles.chosenDetail]} numberOfLines={1}>
            {row.detail}
          </Text>
        ) : null}
      </View>
      {row.checked ? <Text style={[styles.check, { color: chosen ? c.onPrimary : c.accent }]}>✓</Text> : null}
    </>
  );
  const style = [styles.row, row.apart && styles.apart, chosen && { backgroundColor: c.primary }];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: row.checked === true }}
      android_ripple={pressed}
      style={style}
      onPress={onPress}>
      {body}
    </Pressable>
  );
}

/**
 * The list, over everything, as the ring is (`PressMenuHost`): a layer and
 * not a window of its own, which a finger already down could not be handed
 * over to. Nothing in it takes a touch until it has been let go of without a
 * move, and stays.
 */
export function PressListHost() {
  const menu = useSyncExternalStore(pressList.subscribe, pressList.get);
  const c = useColours();
  const styles = useStyles();
  const opened = useRef(new Animated.Value(0)).current;
  const up = menu != null;
  const staying = menu?.staying === true;

  useEffect(() => {
    if (!up) {
      opened.setValue(0);
      return;
    }
    if (motionReduced()) opened.setValue(1);
    else Animated.spring(opened, { toValue: 1, speed: 32, bounciness: 6, useNativeDriver: true }).start();
  }, [opened, up]);

  // Back puts away one that stayed, as it would a sheet.
  useEffect(() => {
    if (!staying) return;
    const handled = BackHandler.addEventListener('hardwareBackPress', () => {
      pressList.set(null);
      return true;
    });
    return () => handled.remove();
  }, [staying]);

  if (!menu) return null;
  const grown = opened.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const card = { left: menu.x, top: menu.y, width: menu.width, height: menu.height, opacity: opened, transform: [{ scale: grown }] };
  const tap = (key: string) => {
    pressList.set(null);
    menu.choose(key);
  };
  // The rows that move, and those kept under them at the foot.
  const moving = menu.rows.length - footOf(menu.rows);

  return (
    <View pointerEvents={staying ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => pressList.set(null)} accessible={false}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrimOf(c), opacity: opened }]} />
      </Pressable>
      <Animated.View style={[styles.card, { backgroundColor: laid(c.surfaceRaised, c.bg) }, card]}>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {menu.title}
        </Text>
        {staying ? (
          <ScrollView style={styles.rows} contentOffset={{ x: 0, y: menu.scroll }}>
            {menu.rows.slice(0, moving).map((row) => (
              <Row key={row.key} row={row} chosen={false} onPress={() => tap(row.key)} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.rows}>
            <View style={{ transform: [{ translateY: -menu.scroll }] }}>
              {menu.rows.slice(0, moving).map((row, place) => (
                <Row key={row.key} row={row} chosen={place === menu.chosen} />
              ))}
            </View>
          </View>
        )}
        {menu.rows.slice(moving).map((row, place) => (
          <Row
            key={row.key}
            row={row}
            chosen={!staying && moving + place === menu.chosen}
            onPress={staying ? () => tap(row.key) : undefined}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    // Flat, whatever the theme, as the ring is: in one of glass what is under it would read through.
    card: { position: 'absolute', borderRadius: RADIUS.card, overflow: 'hidden', ...outlinedClip(c) },
    title: { height: LIST_HEADER, paddingHorizontal: SPACE.l, paddingTop: SPACE.m, color: c.textMuted, fontSize: TYPE.small, fontWeight: '600' },
    rows: { flex: 1, overflow: 'hidden' },
    row: { height: LIST_ROW, paddingHorizontal: SPACE.l, flexDirection: 'row', alignItems: 'center', gap: SPACE.m },
    apart: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
    label: { color: c.text, fontSize: TYPE.body },
    apartLabel: { color: c.accent },
    checkedLabel: { fontWeight: '600' },
    chosenText: { color: c.onPrimary },
    detail: { color: c.textFaint, fontSize: TYPE.hint },
    chosenDetail: { color: c.onPrimary, opacity: 0.8 },
    check: { fontSize: TYPE.heading, fontWeight: '700' },
  })
);
