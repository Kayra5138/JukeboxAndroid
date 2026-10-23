import { BlurTargetView, BlurView } from 'expo-blur';
import { createContext, use, useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { luminance } from '../lib/theme/colour';
import { frostedWashOf } from '../lib/theme/effects';
import { outlineWidth, useColours } from '../lib/theme/index';
import type { Palette } from '../lib/theme/tokens';
import { createStore } from '../lib/ui/store';
import { barsLaidOver } from './UnderBars';

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
 * without drawing the list a second time. `expo-blur` does it with two
 * views: a target, which is the list, and a blur, which is laid under the
 * bar and draws the part of the target behind it. So:
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
const CAN_FROST = Platform.OS === 'android' && Number(Platform.Version) >= 31;

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
      <BlurTargetView ref={ref} style={style}>
        {children}
      </BlurTargetView>
    </InsideContext>
  );
}

/** The area of the scene a bar is in, or null where there is none to blur. */
export function useSceneTarget(): Target | null {
  return use(SceneContext)?.target ?? null;
}

/**
 * How far behind a bar is blurred: `expo-blur` takes an intensity, divides it
 * by its reduction for the radius, and lays a tint over the blur as dense as
 * the intensity is high. The tint is wanted thin and the radius wide, since
 * the bar's own wash goes over the blur and is what keeps its writing
 * readable; so the intensity is small and the reduction smaller. Five
 * pixels: at twenty-four what passed under was a smear nobody could make
 * out, and at eight still too little of it, where the point of glass is
 * seeing what does.
 */
const INTENSITY = 4;
const REDUCTION = 0.8;

/**
 * Whether a bar over [target] is drawn blurred, which is whether it should
 * leave its own fill off and draw {@link Frost} instead.
 */
export function useFrosted(target: Target | null): boolean {
  const c = useColours();
  const inside = use(InsideContext);
  return CAN_FROST && barsLaidOver(c) && target != null && !inside.includes(target);
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
 */
export function Frost({ target, edge }: { target: Target; edge?: 'top' | 'bottom' }) {
  const c = useColours();
  const line = Math.max(StyleSheet.hairlineWidth, outlineWidth(c));
  const reach = edge === 'top' ? { top: -line } : edge === 'bottom' ? { bottom: -line } : null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, reach]}>
      {/* Made only once the target is there: it looks for it when it is made, and not again. */}
      <BlurView
        blurTarget={target}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={INTENSITY}
        blurReductionFactor={REDUCTION}
        tint={tintOf(c)}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: frostedWashOf(c) }]} />
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
const tabTargets = createStore<Readonly<Record<string, Target>>>({});

/**
 * A tab's screen, as an area the tab bar can blur. For the tab navigator's
 * `screenLayout`, around each tab.
 */
export function TabArea({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const onTarget = useCallback(
    (target: Target | null) => {
      const next = { ...tabTargets.get() };
      if (target) next[routeKey] = target;
      else delete next[routeKey];
      tabTargets.set(next);
    },
    [routeKey]
  );
  return (
    <BlurArea style={styles.fill} onTarget={onTarget}>
      {children}
    </BlurArea>
  );
}

/** The area of the tab open now, for the tab bar. */
export function useTabTarget(routeKey: string | undefined): Target | null {
  const targets = useSyncExternalStore(tabTargets.subscribe, tabTargets.get);
  return routeKey ? (targets[routeKey] ?? null) : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  edge: { position: 'absolute', left: 0, right: 0 },
  atTop: { top: 0 },
  atBottom: { bottom: 0 },
});
