import { useCallback, useEffect, useRef } from 'react';
import { Dimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useNavigation } from 'expo-router';

import { haptic } from './haptics';
import { motionReduced } from './motion';

/**
 * A tab pressed again while it is the one open: the way back to the start of
 * it, as in most apps. Each tab says what that is, a step at a time, from the
 * nearest thing (a mode left on, a list scrolled down) to the furthest (the
 * search box). The bar sends the press (`components/TabBar.tsx`) and does
 * nothing else with it.
 */
export function useTabReselect(onReselect: () => void): void {
  const navigation = useNavigation();
  const latest = useRef(onReselect);
  useEffect(() => {
    latest.current = onReselect;
  });
  useEffect(() => {
    /*
      Heard from the tabs, which tell only the tab that was pressed: the page
      a tab opens on is in that tab's own stack, a step down from them. With a
      page open over it the press is the stack's, which goes back to this page
      (see `(tabs)/(library,lists,search,stats,settings)/_layout.tsx`), and this
      is not open to hear it.
    */
    let tab: Listened | undefined = navigation as unknown as Listened;
    while (tab && tab.getState()?.type !== 'tab') tab = tab.getParent();
    if (!tab) return;
    return tab.addListener('tabPress', () => {
      // Told of every press of this tab: only one made while this page is open is a press again.
      if (navigation.isFocused()) latest.current();
    });
  }, [navigation]);
}

/** As much of a navigator as finding the tabs above a page, and hearing them, needs. */
type Listened = {
  getState: () => { type?: string } | undefined;
  getParent: () => Listened | undefined;
  addListener: (event: 'tabPress', listener: () => void) => () => void;
};

/** What can be moved back to its top. */
type Scrollable = { scrollToOffset: (to: { offset: number; animated: boolean }) => void };

/** Further down than this many screens, the way up is jumped most of rather than run all of. */
const FAR_SCREENS = 3;

/**
 * [list], [at] pixels down a screen [tall] high, back to its top: run there if
 * it is near, and if it is far jumped to a screen from the top and run the
 * rest, so that coming back from the foot of a long library takes no longer
 * than from near the top. False when it is at the top already.
 */
export function backToTop(list: Scrollable | null | undefined, at: number, tall: number): boolean {
  if (!list || at <= 1) return false;
  haptic('choices', 'tick');
  const still = motionReduced();
  if (!still && at > tall * FAR_SCREENS) list.scrollToOffset({ offset: tall, animated: false });
  list.scrollToOffset({ offset: 0, animated: !still });
  return true;
}

/** A list or a plain scroller, either of which can be taken back to its top. */
type Scroller = Scrollable | { scrollTo: (to: { y: number; animated: boolean }) => void };

/**
 * For a tab whose page is one scroller: pressed again, back to its top, and
 * if it is there already [atTop], for a further step of the tab's own. What is
 * returned is spread on the scroller, which says where it comes to rest.
 */
export function useTopOnReselect(atTop?: () => void) {
  const scroller = useRef<Scroller | null>(null);
  const restedAt = useRef(0);
  useTabReselect(() => {
    const view = scroller.current;
    const list: Scrollable | null =
      view == null ? null : 'scrollToOffset' in view ? view : { scrollToOffset: ({ offset, animated }) => view.scrollTo({ y: offset, animated }) };
    if (backToTop(list, restedAt.current, Dimensions.get('window').height)) {
      restedAt.current = 0;
      return;
    }
    atTop?.();
  });
  const ref = useCallback((view: Scroller | null) => {
    scroller.current = view;
  }, []);
  const rest = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    restedAt.current = event.nativeEvent.contentOffset.y;
  }, []);
  return { ref, onScrollEndDrag: rest, onMomentumScrollEnd: rest };
}
