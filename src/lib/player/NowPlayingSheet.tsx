import {
  Component,
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { InWindow } from '../../components/Floating';
import { PlayerSheet } from '../../components/PlayerSheet';
import { useColours } from '../theme/index';
import { underGlass, Veiled } from '../theme/Veil';
import { motionReduced, useMotionReduced } from '../ui/motion';
import { createStore } from '../ui/store';
import { askPlayerOpening, type PlayerOpening } from './playerOpening';
import { noteError } from '../support/errorLogStore';
import { BackAsleep } from '../ui/back';
import { Curtain } from '../../components/Curtain';
import { CoverWatch, leaveOverPlayer, onComingBack, putAway, forgetOverPlayer, OverPlayer, useCoveredPlayer } from './overPlayer';

/**
 * Hosts the now-playing screen as a layer over whatever is on screen.
 *
 * Deliberately not a route. Navigating to it meant the library stopped being
 * rendered, so dragging the player down showed black and the list only came
 * back once the transition completed. Keeping it in the same tree means the
 * library is simply behind it.
 */
/** How long the player takes to go down as a page it opened comes: a little quicker than it rises. */
const LEAVE_MS = 220;

const OpenContext = createContext<(() => void) | null>(null);

/** Whether the player is up and in sight, for what is drawn under it to stop moving meanwhile. */
const up = createStore(false);

export function usePlayerUp(): boolean {
  return useSyncExternalStore(up.subscribe, up.get);
}

export function useOpenPlayer(): () => void {
  const open = use(OpenContext);
  if (!open) throw new Error('useOpenPlayer must be used inside <NowPlayingHost>');
  return open;
}


/** The player opened with its queue up, or its words in place of the cover: for the bar held (`ui/miniPlayer.ts`). */
export function useOpenPlayerWith(): (what: PlayerOpening) => void {
  const open = useOpenPlayer();
  return useCallback(
    (what: PlayerOpening) => {
      askPlayerOpening(what);
      open();
    },
    [open]
  );
}

export function NowPlayingHost({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  const glass = underGlass(useColours());
  const still = useMotionReduced();
  const [mounted, setMounted] = useState(false);
  const [rise] = useState(() => new Animated.Value(0));
  // Hidden under a page it opened, and there again when back comes down to the page under that: see `overPlayer.ts`.
  const covered = useCoveredPlayer() && mounted;

  // From its bar while hidden under a page, it is shown over that page, and the page is left as it is.
  const open = useCallback(() => {
    forgetOverPlayer();
    setMounted(true);
  }, []);
  useEffect(() => {
    up.set(mounted && !covered);
  }, [mounted, covered]);
  const close = useCallback(() => {
    forgetOverPlayer();
    setMounted(false);
  }, []);

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
  useEffect(() => {
    heightRef.current = height;
  }, [height]);

  /*
    A page opened from it: the page comes, and the player goes down as it
    does when it is put away, and is put away under the page once it is
    down. Back down to the page it was over, it comes up again as it was.
    See `overPlayer.ts`.
  */
  const overPlayer = useCallback(
    (go: () => void) => {
      leaveOverPlayer(go);
      if (motionReduced()) {
        putAway();
        return;
      }
      Animated.timing(rise, { toValue: heightRef.current, duration: LEAVE_MS, useNativeDriver: true }).start(({ finished }) => {
        if (finished) putAway();
      });
    },
    [rise]
  );
  useEffect(
    () =>
      onComingBack(() => {
        if (motionReduced()) {
          rise.setValue(0);
          return;
        }
        Animated.timing(rise, { toValue: 0, duration: 260, useNativeDriver: true }).start();
      }),
    [rise]
  );

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
      <Veiled
        // Held still, the player's page is not glass but the page itself (`PlayerSheet`), and nothing need be blurred.
        blur={mounted && !covered && !still ? glass : 0}
        style={styles.under}
        importantForAccessibility={mounted && !covered ? 'no-hide-descendants' : 'auto'}>
        {children}
      </Veiled>
      <CoverWatch />
      {mounted ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateY: rise }] }]}
          pointerEvents={covered ? 'none' : 'auto'}
          importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>
          {/* Hidden, it is not drawn at all, and back is the page's. */}
          <Curtain shut={covered} style={StyleSheet.absoluteFill}>
            <BackAsleep value={covered}>
              <OverPlayer value={overPlayer}>
                <PlayerFault onFault={close}>
                  {/* Over the bars itself: what it asks is a window over it, not a card in the tab under it (`Floating`). */}
                  <InWindow value>
                    <PlayerSheet onClose={close} />
                  </InWindow>
                </PlayerFault>
              </OverPlayer>
            </BackAsleep>
          </Curtain>
        </Animated.View>
      ) : null}
    </OpenContext>
  );
}

/**
 * The player, caught where it throws while drawing: it closes, with what was
 * thrown written down for the report, and the library under it goes on as
 * it was. Under only the app's own boundary, a fault in the player put the
 * whole app away behind the page that says something went wrong.
 */
class PlayerFault extends Component<{ children: ReactNode; onFault: () => void }, { fallen: boolean }> {
  state = { fallen: false };

  static getDerivedStateFromError() {
    return { fallen: true };
  }

  componentDidCatch(error: Error) {
    console.error('The player could not be drawn', error);
    noteError('render', error);
    this.props.onFault();
  }

  render() {
    return this.state.fallen ? null : this.props.children;
  }
}

const styles = StyleSheet.create({ under: { flex: 1 } });
