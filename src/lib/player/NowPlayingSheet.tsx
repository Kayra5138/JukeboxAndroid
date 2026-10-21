import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { PlayerSheet } from '../../components/PlayerSheet';
import { useColours } from '../theme/index';
import { underGlass } from '../theme/Veil';
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
  const glass = underGlass(useColours());
  const [mounted, setMounted] = useState(false);
  const rise = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => setMounted(true), []);
  const close = useCallback(() => setMounted(false), []);

  /*
    The home screen widget's cover opens the player. An app that press
    started asks once, as it comes up, whether that is why it was opened; one
    that was already running is told. The question is optional, because a
    build from before the larger widgets cannot be asked it.
  */
  useEffect(() => {
    if (JukeboxAudio.takeOpenPlayer?.()) open();
    const asked = JukeboxAudio.addListener('onOpenPlayer', open);
    return () => asked.remove();
  }, [open]);

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
      {/*
        Everything the player is opened over. In a theme of glass it goes out
        of focus for as long as the player is up, and shows through it. A
        view of its own at all times, and never folded away: given a filter
        only when it needed one it would be put in then, by taking every
        screen out of the window and handing it over, and a dialog that is
        taken out of its window is dismissed.
      */}
      {/*
        And out of a screen reader's reach while the player is up, for the
        same reason a sheet's screen is (see `Behind`): the player is drawn in
        the same window as the library, and a swipe past its last button
        otherwise walked on through every row of the list it is covering.
      */}
      <View
        collapsable={false}
        style={mounted && !covered ? [styles.under, glass] : styles.under}
        importantForAccessibility={mounted && !covered ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
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

const styles = StyleSheet.create({ hidden: { display: 'none' }, under: { flex: 1 } });
