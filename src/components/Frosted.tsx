import { requireNativeViewManager } from 'expo-modules-core';
import { FloatLayer } from './Floating';
import { createContext, use, useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { findNodeHandle, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { luminance } from '../lib/theme/colour';
import { frostedWashOf } from '../lib/theme/effects';
import { outlineWidth, useColours } from '../lib/theme/index';
import type { Palette } from '../lib/theme/tokens';
import { createStore } from '../lib/ui/store';
import { useMotionReduced } from '../lib/ui/motion';
import { useIsFocused } from 'expo-router';
import { Curtain } from './Curtain';
import { TabOpen } from '../lib/ui/tabOpen';
import { barsLaidOver } from './UnderBars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLandscape } from '../lib/ui/layout';

/**
 * What scrolls under a bar of glass, out of focus behind it.
 *
 * A bar a list runs on under (see `UnderBars`) was washed over and nothing
 * more: the rows went under it sharp and dimmed, where everything else that
 * is glass in these themes — a screen under another, a sheet's backdrop —
 * is out of focus. React Native cannot blur what is behind a view, and the
 * veil's way, telling the screen to draw itself blurred, holds a still page
 * and not the strip of a moving list under a bar on every frame of a scroll.
 *
 * Android can, from version 12: a view can be recorded as it draws and that
 * record drawn again elsewhere through a blur, on the graphics processor,
 * without drawing the list a second time. Two views of the app's own do it
 * (`FrostTargetView.kt`, `FrostView.kt`): a target, which is the list, and a
 * blur, which is laid under the bar and draws only the strip of the target
 * behind it, small, through the blur. It was `expo-blur` once, which blurred
 * the whole of the list for every bar on every frame. So:
 *
 *  - a list that runs under bars is a {@link BlurArea};
 *  - a bar over it draws {@link Frost} under its contents, the blur and the
 *    bar's wash on top of it, where it would have drawn the wash alone;
 *  - and the two find each other through a {@link GlassScene} around both,
 *    or, for the tab bar, which is outside every tab, by the tab's route.
 *
 * A blur must never be inside the target it blurs: it would be drawing a
 * record of itself. Each area says so to what is inside it, and a bar inside
 * its own target is washed as before rather than blurred.
 *
 * In a theme that is not glass, or on Android 11 and older, the areas are
 * plain views and the bars draw what they always did.
 */

/** Whether this phone blurs what is behind a view. As the veil decides it. */
const CAN_FROST = Platform.OS === 'android' && Number(Platform.Version) >= 29;

type Target = RefObject<View | null>;

export type Scene = { target: Target | null; claim: (target: Target | null) => void };

const SceneContext = createContext<Scene | null>(null);

/** The areas a view is inside, which it must not blur. */
const InsideContext = createContext<readonly Target[]>([]);

/**
 * Where a list and the bars over it meet: the area the list is in says so
 * here, and the bars read it from here.
 */
export function GlassScene({ children, scene }: { children: ReactNode; scene?: Scene }) {
  const own = useOwnScene();
  return <SceneContext value={scene ?? own}>{children}</SceneContext>;
}

/**
 * A scene kept by the screen itself, for a screen that draws a bar of its own
 * beside the list: it hands this to the {@link GlassScene} around both, and
 * reads the target from it, since it cannot read what it provides.
 */
export function useOwnScene(): Scene {
  const [target, setTarget] = useState<Target | null>(null);
  return { target, claim: setTarget };
}

/**
 * What scrolls under the bars, as something they can blur. Takes [style] as
 * the view it stands in for would have. [onTarget] is told of it instead of
 * the scene around it, for a bar that is in no scene with it.
 */
export function BlurArea({
  children,
  style,
  onTarget,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onTarget?: (target: Target | null) => void;
}) {
  const ref = useRef<View>(null);
  const scene = use(SceneContext);
  const inside = use(InsideContext);
  const claim = onTarget ?? scene?.claim;

  useLayoutEffect(() => {
    if (!CAN_FROST || !claim) return;
    claim(ref);
    return () => claim(null);
  }, [claim]);

  if (!CAN_FROST) return <View collapsable={false} style={style}>{children}</View>;
  return (
    <InsideContext value={[...inside, ref]}>
      <NativeFrostTarget ref={ref} collapsable={false} style={style}>
        {children}
      </NativeFrostTarget>
    </InsideContext>
  );
}

/** The area of the scene a bar is in, or null where there is none to blur. */
export function useSceneTarget(): Target | null {
  return use(SceneContext)?.target ?? null;
}

/**
 * How far behind a bar is blurred, in pixels on the screen, and the tint over
 * it: what `expo-blur` made of an intensity of four, a reduction of 0.8 and
 * its own scale of four, kept as they were when the blur came to be drawn
 * here instead (`FrostView`). The tint is wanted thin and the radius wide,
 * since the bar's own wash goes over the blur and is what keeps its writing
 * readable: at twenty-four what passed under was a smear nobody could make
 * out, and at eight still too little of it, where the point of glass is
 * seeing what does.
 */
const RADIUS = 20;
const TINT_DARK = (7 << 24) + (25 << 16) + (25 << 8) + 25;
const TINT_LIGHT = (7 << 24) + (249 << 16) + (249 << 8) + 249;

/** What scrolls under the bars, kept as a record for them to blur: see `FrostTargetView.kt`. */
const NativeFrostTarget = requireNativeViewManager<{ children?: ReactNode; collapsable?: boolean; style?: StyleProp<ViewStyle>; ref?: Target }>(
  'JukeboxAudio',
  'FrostTargetView'
);

/** A bar's glass, drawn on the phone itself: see `FrostView.kt`. */
const NativeFrost = requireNativeViewManager<{ targetId?: number; radius: number; overlay: number; style?: StyleProp<ViewStyle> }>(
  'JukeboxAudio',
  'FrostView'
);

/**
 * Whether a bar over [target] is drawn blurred, which is whether it should
 * leave its own fill off and draw {@link Frost} instead.
 */
export function useFrosted(target: Target | null): boolean {
  const c = useColours();
  const inside = use(InsideContext);
  /*
    Not while the decoration is held still: each bar blurring what passes
    under it at every frame of a scroll is the dearest thing glass does. The
    bar keeps the fill it has where there is nothing to blur, which is
    worked out to be read over anything, and stays where it is.
  */
  const still = useMotionReduced();
  return CAN_FROST && !still && barsLaidOver(c) && target != null && !inside.includes(target);
}

/**
 * The back of a bar of glass: what is under it, out of focus, and the wash
 * over that. The first thing in the bar, filling it, so that its contents
 * are drawn over both. Draw it only where {@link useFrosted} says to.
 *
 * [edge] is the side the bar has its edge on — the top of the tabs and of
 * the bar of what is playing, the foot of a bar along the top — which the
 * bar leaves off and this draws. A view's children begin inside its
 * border, so a blur filling the bar stopped a hairline short of that side,
 * and the bar, its own fill left off, showed what was behind it through
 * the line: a gap between the bar of what is playing and the tabs. So the
 * blur reaches under where the edge is, and the edge is drawn over it.
 *
 * [bare] leaves the wash off, for glass that is not a bar: over nothing it
 * is the backdrop again, and seen only once something passes under it.
 */
export function Frost({ target, edge, bare = false }: { target: Target; edge?: 'top' | 'bottom'; bare?: boolean }) {
  const c = useColours();
  // The list, by the number the phone knows its view by, once it is there to be found.
  const [targetId, setTargetId] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    setTargetId(findNodeHandle(target.current) ?? undefined);
  }, [target]);
  const line = Math.max(StyleSheet.hairlineWidth, outlineWidth(c));
  const reach = edge === 'top' ? { top: -line } : edge === 'bottom' ? { bottom: -line } : null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, reach]}>
      <NativeFrost targetId={targetId} radius={RADIUS} overlay={tintOf(c) === 'dark' ? TINT_DARK : TINT_LIGHT} style={StyleSheet.absoluteFill} />
      {bare ? null : <View style={[StyleSheet.absoluteFill, { backgroundColor: frostedWashOf(c) }]} />}
      {edge ? <View style={[styles.edge, edge === 'top' ? styles.atTop : styles.atBottom, { height: line, backgroundColor: c.border }]} /> : null}
    </View>
  );
}

/** A tint that leans the way the page does, so the little of it there is does not grey a dark page or darken a light one. */
function tintOf(c: Palette): 'dark' | 'light' {
  return luminance(c.bg) < 0.18 ? 'dark' : 'light';
}

/**
 * The area of each tab, by its route, for the tab bar: it is outside every
 * tab, and blurs whichever is open.
 */
/**
 * Glass behind the phone's clock, over a tab's own page that scrolls up
 * under it: Lists, Stats, Settings. Put inside the page's `GlassScene`,
 * after its `BlurArea`. Bare, with no wash: over the page at rest it is the
 * backdrop, and the words that scroll up under the clock go out of focus
 * there rather than run on under it sharp. Edged along its foot, as every
 * other bar of glass is (23 Nov, Kayra).
 * Upright only, where the clock is over the page; sideways the strip across
 * the top keeps it (see the tabs' `TopStrip`). A screen whose top is a bar
 * reaches up behind the clock itself instead: see `useLaidOver`'s `clock`.
 */
export function ClockGlass() {
  const target = useSceneTarget();
  const frosted = useFrosted(target);
  const landscape = useLandscape();
  const insets = useSafeAreaInsets();
  if (!frosted || !target || landscape || insets.top <= 0) return null;
  return (
    <View pointerEvents="none" style={[styles.clock, { height: insets.top }]}>
      <Frost target={target} edge="bottom" bare />
    </View>
  );
}

const tabTargets = createStore<Readonly<Record<string, Target>>>({});

/**
 * The tab a finger is on in the tab bar, not yet opened: made ready to be
 * shown while the finger is still down (see `Curtain`). Let go of a little
 * after the finger is lifted, by when the tab has been opened or was not.
 */
const warmTab = createStore<string | null>(null);
let coolLater: ReturnType<typeof setTimeout> | null = null;

/** A finger came down on [routeKey]'s tab in the bar; null, it was lifted. */
export function readyTab(routeKey: string | null) {
  if (coolLater) clearTimeout(coolLater);
  coolLater = null;
  if (routeKey) warmTab.set(routeKey);
  else coolLater = setTimeout(() => warmTab.set(null), 600);
}

/**
 * A tab's screen, as an area the tab bar can blur. For the tab navigator's
 * `screenLayout`, around each tab.
 *
 * Every tab once opened is kept standing, laid out and drawn into the
 * phone's records, and only those not open are left out of the drawing (a
 * `Curtain` shut). Left to the navigator, a tab not open was taken off the
 * screen altogether, and opened again everything in it was put back and
 * drawn afresh: some tenths of a second, from the library to Settings, on a
 * fast phone.
 */
export function TabArea({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const open = useIsFocused();
  // Asked as whether it is this tab, so that the others are not drawn again for it.
  const warm = useSyncExternalStore(warmTab.subscribe, () => warmTab.get() === routeKey);
  const onTarget = useCallback(
    (target: Target | null) => {
      const next = { ...tabTargets.get() };
      if (target) next[routeKey] = target;
      else delete next[routeKey];
      tabTargets.set(next);
    },
    [routeKey]
  );
  const target = useTabTarget(routeKey);
  return (
    <Curtain shut={!open} warm={warm && !open} style={styles.fill}>
      {/* And the tab's small questions over its pages, short of the bars: see `Floating`. */}
      <FloatLayer active={open} target={target}>
        <BlurArea style={styles.fill} onTarget={onTarget}>
          <TabOpen value={open}>{children}</TabOpen>
        </BlurArea>
      </FloatLayer>
    </Curtain>
  );
}

/** The area of the tab open now, for the tab bar. */
export function useTabTarget(routeKey: string | undefined): Target | null {
  const targets = useSyncExternalStore(tabTargets.subscribe, tabTargets.get);
  return routeKey ? (targets[routeKey] ?? null) : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  clock: { position: 'absolute', top: 0, left: 0, right: 0 },
  edge: { position: 'absolute', left: 0, right: 0 },
  atTop: { top: 0 },
  atBottom: { bottom: 0 },
});
