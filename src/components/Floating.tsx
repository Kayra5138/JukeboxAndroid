import { createContext, use, useEffect, useId, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { useWindowVeil } from '../lib/theme/Veil';
import { useBack } from '../lib/ui/back';
import { createStore, type Store } from '../lib/ui/store';
import { Modal } from './Modal';
import { useTabBarRoom } from './UnderBars';

/**
 * The two kinds of thing the app asks with, and where each goes.
 *
 * A small question — Delete?, a name to type, one of a few — is a card
 * floating over the page it was asked on ([Floating]). Anything more is a page
 * of its own in the tab (`OnAPage`). Neither covers the tab bar or the bar of
 * what is playing, nor puts them out of focus: those are always there.
 *
 * So a card is not a window of its own, which is laid over the whole screen
 * bars and all, but is drawn in the tab's own layer ([FloatLayer]), over its
 * pages and short of the bars. Where there is no tab — the player, which is
 * over the bars itself, or a page outside the tabs — it is a window, as it was.
 */

type Layer = Store<ReadonlyMap<string, ReactNode>>;

const LayerOf = createContext<Layer | null>(null);

type Target = RefObject<View | null>;
const TargetOf = createContext<Target | null>(null);

/** The pages under the card drawn here, for its back to blur; none in a window. */
export function useCardTarget(): Target | null {
  return use(TargetOf);
}

/**
 * The layer of the tab in front, for what is drawn outside every tab and
 * asks all the same: the bar of what is playing, which is in the tab bar.
 */
const inFront = createStore<Layer | null>(null);

/**
 * Round what is drawn over the bars itself, the player: what it asks is a
 * window of its own, over it, and not a card in the tab under it.
 */
export const InWindow = createContext(false);

/** The layer what is drawn here asks in: its tab's, or the tab in front's; none in a window. */
function useLayer(): Layer | null {
  const own = use(LayerOf);
  const windowed = use(InWindow);
  const front = useSyncExternalStore(inFront.subscribe, inFront.get);
  if (windowed) return null;
  return own ?? front;
}

/** Whether what is drawn here asks in a tab, where cards and pages go as above. */
export function useInTab(): boolean {
  return useLayer() != null;
}

/**
 * The layer a tab's cards are drawn in, over its pages: round the whole of
 * a tab, by `TabArea`. The pages under a card are out of a screen reader's
 * reach while it is up, as under a window.
 */
export function FloatLayer({
  active,
  target,
  foot = true,
  children,
}: {
  active: boolean;
  target: Target | null;
  /** Short of the tab bar, as a tab's are; a card that is a place of its own (`TabbedCard`) has its cards over the whole of it. */
  foot?: boolean;
  children: ReactNode;
}) {
  const [layer] = useState<Layer>(() => createStore<ReadonlyMap<string, ReactNode>>(new Map()));
  // The layer of the tab in front, for the bars (see `inFront`).
  useEffect(() => {
    if (!active) return;
    inFront.set(layer);
    return () => {
      if (inFront.get() === layer) inFront.set(null);
    };
  }, [active, layer]);
  return (
    <LayerOf value={layer}>
      <Under layer={layer}>{children}</Under>
      {/* What a card's back blurs: the tab's pages, under it (`CardGlass`). */}
      <TargetOf value={target}>
        <Cards layer={layer} foot={foot} />
      </TargetOf>
    </LayerOf>
  );
}

function Under({ layer, children }: { layer: Layer; children: ReactNode }) {
  const up = useSyncExternalStore(layer.subscribe, () => layer.get().size > 0);
  return (
    <View style={styles.fill} importantForAccessibility={up ? 'no-hide-descendants' : 'auto'}>
      {children}
    </View>
  );
}

function Cards({ layer, foot }: { layer: Layer; foot: boolean }) {
  const cards = useSyncExternalStore(layer.subscribe, layer.get);
  // Short of the tab bar, which in a theme of glass is laid over the foot of the tab.
  const tabBar = useTabBarRoom();
  const bar = foot ? tabBar : 0;
  if (cards.size === 0) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { bottom: bar }]}>
      {[...cards].map(([key, card]) => (
        <View key={key} style={StyleSheet.absoluteFill}>
          {card}
        </View>
      ))}
    </View>
  );
}

/**
 * A small card over the page, while [visible]: [children] are the card and
 * what is round it (the scrim to touch for never mind), filling the room
 * given. Back closes it, as [onClose].
 */
export function Floating({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const layer = useLayer();
  const key = useId();
  // Only where it is a window: in the tab, the bars are not put out of focus.
  useWindowVeil(visible && layer == null);
  useBack(visible && layer != null, onClose);
  // As it is now, every time it is drawn, for the layer to draw it the same.
  useEffect(() => {
    if (!layer) return;
    const now = new Map(layer.get());
    if (visible) now.set(key, children);
    else if (!now.has(key)) return;
    else now.delete(key);
    layer.set(now);
  });
  // Taken out of a layer it is no longer drawn in, another tab come to the front, and as it goes.
  useEffect(
    () => () => {
      if (!layer || !layer.get().has(key)) return;
      const now = new Map(layer.get());
      now.delete(key);
      layer.set(now);
    },
    [key, layer]
  );
  if (layer) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {children}
    </Modal>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
