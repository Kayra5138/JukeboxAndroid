import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet, useWindowDimensions } from 'react-native';

import { PlayerSheet } from '../../components/PlayerSheet';
import { useCoveredByRoute } from './overlayRoutes';
import { motionReduced } from '../ui/motion';

/**
 * Hosts the now-playing screen as a layer over whatever is on screen.
 *
 * Deliberately not a route. Navigating to it meant the library stopped being
 * rendered, so dragging the player down showed black and the list only came
 * back once the transition completed. Keeping it in the same tree means the
 * library is simply behind it.
 */
const OpenContext = createContext<(() => void) | null>(null);

export function useOpenPlayer(): () => void {
  const open = use(OpenContext);
  if (!open) throw new Error('useOpenPlayer must be used inside <NowPlayingHost>');
  return open;
}

export function NowPlayingHost({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  const covered = useCoveredByRoute();
  const [mounted, setMounted] = useState(false);
  const rise = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => setMounted(true), []);
  const close = useCallback(() => setMounted(false), []);

  /*
    Read through a ref so that only opening the player triggers the entrance.
    As a dependency the height dragged the whole animation along with it: a
    rotation, or the keyboard resizing the window under `adjustResize`, sent the
    open player back below the bottom edge to slide up again.
  */
  const heightRef = useRef(height);
  heightRef.current = height;

  useEffect(() => {
    if (!mounted) return;
    /*
      Read as the player opens rather than held in state: the switch is on a
      screen this one covers, so it cannot change while this is up.
    */
    if (motionReduced()) {
      rise.setValue(0);
      return;
    }
    // Start below the screen and rise, so opening from the mini bar reads as
    // the same object growing rather than a new screen appearing.
    rise.setValue(heightRef.current);
    Animated.timing(rise, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [mounted, rise]);

  return (
    <OpenContext value={open}>
      {children}
      {mounted ? (
        <Animated.View
          /*
            `display: none` rather than opacity or moving it off screen: it has
            to stop taking touches as well as stop being seen, and it must not
            animate on the way out -- the route sliding in over it is the
            transition, and a second one underneath reads as a glitch.
          */
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateY: rise }] },
            covered && styles.hidden,
          ]}>
          <PlayerSheet onClose={close} />
        </Animated.View>
      ) : null}
    </OpenContext>
  );
}

const styles = StyleSheet.create({ hidden: { display: 'none' } });
