import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { Animated, BackHandler, Easing, Keyboard, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBatch } from './downloads/useBatch';
import { DownloadIcon } from './Icons';
import { NOW_PLAYING_WIDTH, nowPlayingHeight } from './NowPlayingBar';
import { Pressable } from './Pressable';
import { tabBarHeight } from './TabBar';
import { useT } from '../lib/i18n/index';
import { usePlayerState } from '../lib/player/PlayerProvider';
import { laid, makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { useSheetOpen } from '../lib/theme/Veil';
import { useDownloadsButtonWanted } from '../lib/ui/downloadsButton';
import { useLandscape } from '../lib/ui/layout';
import { motionReduced } from '../lib/ui/motion';
import { useDownloads } from '../lib/youtube/DownloadsProvider';
import { namesOf, type Batch } from '../lib/youtube/queueView';
import { statusLabel } from '../lib/youtube/types';

/** Across the button, which is a finger's width and no more. */
const SIZE = 48;
/** How thick the ring round it is, that fills as the download goes. */
const RING = 3;
/** How far it keeps from an edge of the screen, and from whatever it sits above. */
const MARGIN = 14;

/** The five tabs, which have the bar along the bottom or down the left. */
const TABS = new Set(['/', '/lists', '/search', '/stats', '/settings']);
/** The screens that draw the bar of what is playing at their foot, or down their right. */
const WITH_PLAYER = new Set(['/', '/lists', '/playlist']);
/**
 * Where the button would be in the way: the game, which is the whole screen
 * and played with both thumbs, and the downloads' own screen, which says
 * everything the button does.
 */
const NOT_HERE = new Set(['/tiles', '/downloads']);

/**
 * A round button that floats over the app while something is being
 * downloaded, for somebody who would like to see how it is going without
 * leaving what they are doing.
 *
 * Off unless switched on in Settings, and there at all only while there is
 * something to say: a download under way or waiting, or a run of them that
 * ended in the last few minutes. With nothing to say it is not drawn dimmed
 * or small. It is not drawn.
 *
 * In two parts so that, switched off, it is the first part and nothing
 * else: nothing here then listens to the downloads, the player or the
 * keyboard.
 */
export function DownloadsButton() {
  return useDownloadsButtonWanted() ? <Watching /> : null;
}

function Watching() {
  const batch = useBatch();
  const pathname = usePathname();
  const typing = useKeyboardUp();
  /*
    A sheet a screen lays over itself is under this, which is over the whole
    navigator, and a button floating on a dialog is a button in the wrong
    place. So it steps aside for any sheet at all.
  */
  const sheet = useSheetOpen();
  if (batch.total === 0 || typing || sheet || NOT_HERE.has(pathname)) return null;
  // Made afresh for each screen, so that a bubble left open on one is not
  // found open on the next.
  return <Floating key={pathname} batch={batch} pathname={pathname} />;
}

function Floating({ batch, pathname }: { batch: Batch; pathname: string }) {
  const { paused } = useDownloads();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const router = useRouter();
  const spot = useSpot(pathname);
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const said = t.downloads.button;

  const left = batch.underWay + batch.waiting;
  const finished = left === 0;
  const moving = batch.underWay > 0 && !paused;
  const drift = useDrift(moving);

  useEffect(() => {
    if (!open) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => listener.remove();
  }, [open]);

  const current = batch.current;
  const state = t.downloads.short(batch.underWay, batch.waiting, paused) || (finished ? said.finished : '');
  // Full once there is nothing left, which is the ring's way of saying so.
  const progress = finished ? 100 : (current?.progress ?? 0);
  /*
    One small mark on its shoulder: a tick when the run is over, an
    exclamation mark where any of it failed, and otherwise how many are left
    — said only when that is more than the one the ring is already showing.
  */
  const badge = finished ? (batch.failed > 0 ? '!' : '✓') : left > 1 ? (left > 99 ? '99+' : String(left)) : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {open ? (
        <>
          {/*
            Clear, and the whole screen: a touch anywhere else closes the
            bubble. Not a veil. This is a glance at a number, and the app
            behind it should look exactly as it did.
          */}
          <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.bubble,
              {
                right: spot.right,
                bottom: spot.bottom + SIZE + 10,
                width: Math.min(288, width - spot.right - 16),
              },
            ]}>
            <Text style={styles.heading}>{t.format.upper(said.heading)}</Text>
            {current ? (
              <View style={styles.current}>
                <Text style={styles.title} numberOfLines={2}>
                  {namesOf(current).title}
                </Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {statusLabel(current, t)}
                </Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.min(Math.max(current.progress, 0), 100)}%` }]} />
                </View>
              </View>
            ) : (
              <Text style={styles.title}>{paused ? said.paused : finished ? said.allDone : said.idle}</Text>
            )}
            {/* Of this run only: how many it has left, and how the rest of it went. */}
            <View style={styles.counts}>
              {batch.waiting > 0 ? <Text style={styles.count}>{said.waiting(batch.waiting)}</Text> : null}
              <Text style={styles.count}>{said.done(batch.done)}</Text>
              {batch.failed > 0 ? <Text style={styles.countBad}>{said.failed(batch.failed)}</Text> : null}
            </View>
            <Pressable
              android_ripple={pressed}
              accessibilityRole="link"
              style={styles.open}
              onPress={() => {
                setOpen(false);
                router.push('/downloads');
              }}>
              <Text style={styles.openLabel}>{said.open}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <View style={[styles.spot, spot]}>
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          accessibilityLabel={said.label(state)}
          accessibilityState={{ expanded: open }}
          style={styles.button}
          onPress={() => setOpen(!open)}>
          <Ring progress={progress} colour={c.accent} track={c.borderStrong} />
          <DownloadIcon size={22} color={c.text} arrow={drift} />
        </Pressable>
        {badge ? (
          <View style={styles.badge} pointerEvents="none">
            <Text
              allowFontScaling={false}
              style={finished ? (batch.failed > 0 ? styles.badgeBad : styles.badgeGood) : styles.badgeText}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Where the button goes: the bottom right, in a part of the screen nothing
 * else has, which depends on which screen it is and which way up.
 *
 * Upright it sits above whatever is along the bottom there — the tab bar
 * under the five tabs, and the bar of what is playing on the screens that
 * have one, while anything is playing — and above the strip the phone keeps
 * for its own gestures. Sideways both of those have moved to the sides: the
 * tabs are a rail down the left, nowhere near, and the player is a panel
 * down the right that the button stays to the left of.
 *
 * Worked out from the sizes those two say they are and not measured from
 * them, because this is drawn over the navigator and they inside its
 * screens, and neither can see the other.
 */
function useSpot(pathname: string): { right: number; bottom: number } {
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  const { fontScale } = useWindowDimensions();
  const playing = usePlayerState().current != null && WITH_PLAYER.has(pathname);
  if (landscape) {
    return {
      // The panel reaches the edge of the glass itself, cutout and all.
      right: (playing ? NOW_PLAYING_WIDTH : insets.right) + MARGIN,
      bottom: insets.bottom + MARGIN,
    };
  }
  return {
    right: insets.right + MARGIN,
    bottom:
      insets.bottom +
      (TABS.has(pathname) ? tabBarHeight(fontScale) : 0) +
      (playing ? nowPlayingHeight(fontScale) : 0) +
      MARGIN,
  };
}

/** Whether the keyboard is up, when the bottom of the screen is the last place for anything else. */
function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setUp(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setUp(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return up;
}

/** One trip of the arrow towards the tray, in milliseconds. Slow: it is to be noticed, not watched. */
const DRIFT_MS = 1500;

/**
 * The arrow's small movement while something is being fetched: it comes
 * down a few points towards the tray, fades as it gets there, and starts
 * again from the top.
 *
 * Run by the phone and not from here — nothing on this side is done a frame
 * at a time — and not run at all when it is paused, when everything has
 * finished, or when Settings has asked for the decoration to hold still.
 * The ring says the same thing without moving.
 *
 * The setting is read as the movement is about to start. It can only have
 * changed on a screen this button was drawn afresh for on the way back from.
 */
function useDrift(moving: boolean) {
  const [along] = useState(() => new Animated.Value(0));
  const [style] = useState(() => ({
    opacity: along.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 1, 0] }),
    transform: [{ translateY: along.interpolate({ inputRange: [0, 1], outputRange: [-3, 3] }) }],
  }));
  useEffect(() => {
    if (!moving || motionReduced()) {
      // At rest in the middle of its travel, where it is fully drawn.
      along.setValue(0.5);
      return;
    }
    along.setValue(0);
    const loop = Animated.loop(
      Animated.timing(along, { toValue: 1, duration: DRIFT_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [moving, along]);
  return style;
}

/**
 * A ring that fills clockwise from the top, drawn from plain views.
 *
 * Two half-rings, each turning behind a window the shape of the other half
 * of the circle: the first swings into the right-hand window over the first
 * half of the download and the second into the left-hand one over the rest.
 * It is turned once a second, when the download is read, so the turning is
 * a style and not an animation.
 */
function Ring({ progress, colour, track }: { progress: number; colour: string; track: string }) {
  const angle = Math.min(Math.max(progress, 0), 100) * 3.6;
  const half = SIZE / 2;
  const ring = { width: SIZE, height: SIZE, borderRadius: half, borderWidth: RING };
  return (
    <View pointerEvents="none" style={ringStyles.frame}>
      <View style={[ring, { borderColor: track }]} />
      {/* Not drawn at all at nought: an edge exactly on the window's own is a hairline of colour. */}
      {angle > 0 ? (
        <View style={[ringStyles.window, { left: half }]}>
          <View style={[ringStyles.turning, { left: -half, transform: [{ rotate: `${Math.min(angle, 180)}deg` }] }]}>
            <View style={ringStyles.half}>
              <View style={[ring, { borderColor: colour }]} />
            </View>
          </View>
        </View>
      ) : null}
      {angle > 180 ? (
        <View style={[ringStyles.window, { left: 0 }]}>
          <View style={[ringStyles.turning, { left: 0, transform: [{ rotate: `${angle - 180}deg` }] }]}>
            <View style={[ringStyles.half, { marginLeft: half }]}>
              <View style={[ring, { borderColor: colour, marginLeft: -half }]} />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const ringStyles = StyleSheet.create({
  frame: { position: 'absolute', top: 0, left: 0, width: SIZE, height: SIZE },
  window: { position: 'absolute', top: 0, width: SIZE / 2, height: SIZE, overflow: 'hidden' },
  turning: { position: 'absolute', top: 0, width: SIZE, height: SIZE },
  half: { width: SIZE / 2, height: SIZE, overflow: 'hidden' },
});

const useStyles = makeStyles((c) => {
  /*
    Flat colours, whatever the theme writes its surfaces in. Both of these
    lie over a list that goes on scrolling underneath, and through a fill of
    glass the list would be read through the button and the bubble's words.
  */
  const ground = laid(c.surface, c.bg);
  const raised = laid(c.surfaceRaised, c.bg);
  return StyleSheet.create({
    spot: { position: 'absolute', width: SIZE, height: SIZE },
    button: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: raised,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ground,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    badgeText: { color: c.text, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
    badgeGood: { color: c.success, fontSize: 11, fontWeight: '700' },
    badgeBad: { color: c.danger, fontSize: 12, fontWeight: '700' },

    bubble: {
      position: 'absolute',
      backgroundColor: ground,
      borderRadius: 14,
      paddingTop: 14,
      paddingHorizontal: 16,
      paddingBottom: 4,
      gap: 10,
      ...outlined(c),
    },
    heading: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
    current: { gap: 3 },
    title: { color: c.text, fontSize: 14.5, lineHeight: 20 },
    muted: { color: c.textMuted, fontSize: 12, lineHeight: 16 },
    track: { height: 3, backgroundColor: c.borderStrong, borderRadius: 2, marginTop: 5, overflow: 'hidden' },
    fill: { height: 3, backgroundColor: c.accent },
    counts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 2 },
    count: { color: c.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
    countBad: { color: c.danger, fontSize: 13, fontVariant: ['tabular-nums'] },
    open: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      marginHorizontal: -8,
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    openLabel: { color: c.text, fontSize: 14, fontWeight: '500' },
    chevron: { color: c.textDisabled, fontSize: 20, lineHeight: 22 },
  });
});
