import { Image } from './Picture';
import { useCallback, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDiscoverPreview } from './discover/hooks';
import { PlayingKeep } from './discover/PlayingActions';
import { PreviewBar } from './discover/PreviewBar';
import { NextIcon, PauseIcon, PlayIcon, PreviousIcon } from './Icons';
import { TrackStrip } from './TrackStrip';
import { useT } from '../lib/i18n/index';
import { useTrackArtwork } from '../lib/media/artwork';
import { useOpenPlayer } from '../lib/player/NowPlayingSheet';
import { usePlayerActions, usePlayerState } from '../lib/player/PlayerProvider';
import { makeStyles, outlineWidth, usePressed } from '../lib/theme/index';
import type { Track } from '../lib/types';
import { useLandscape } from '../lib/ui/layout';
import { BlurArea, Frost, GlassScene, useFrosted, useSceneTarget } from './Frosted';
import { barGlass, FootDock } from './UnderBars';

/** One track's cover, looked up per card so the neighbours arrive with theirs. */
function Cover({ track, column }: { track: Track; column: boolean }) {
  const artwork = useTrackArtwork(track);
  const styles = useStyles();
  const shape = column ? styles.artWide : styles.art;

  return artwork ? (
    <Image source={{ uri: artwork }} style={shape} contentFit="cover" />
  ) : (
    <View style={[shape, styles.artEmpty]} />
  );
}

/**
 * A screen with the bar at its foot, or beside it when the phone is on its
 * side: for the screens that are one scrolling page and have nothing else to
 * arrange round it.
 *
 * The library and the lists lay the bar out themselves, among their own
 * columns. Search, Stats and Settings had none at all, so what was playing
 * could be seen and stopped from two tabs and not from the other three —
 * leaving the tab one was on to pause a song.
 */
export function WithNowPlaying({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const landscape = useLandscape();
  // The page an area the bar blurs, in a theme of glass: see `Frosted`.
  return (
    <GlassScene>
      <View style={[landscape ? around.sideways : around.upright, style]}>
        <BlurArea style={around.page}>{children}</BlurArea>
        <NowPlayingBar column={landscape} />
      </View>
    </GlassScene>
  );
}

/**
 * What a tab's page keeps clear of at its two sides.
 *
 * Upright, whatever the phone says is there. Sideways the page does not reach
 * the edges of the glass: the rail of tabs is at one and keeps clear of what
 * is at it, and the panel of what is playing, when there is one, does the
 * same at the other. A page that asked again had a second inset's worth of
 * nothing on one side only, and sat off-centre in the room it was given. So
 * sideways there is nothing on the left, and on the right only when no panel
 * stands between the page and the edge.
 */
export function usePageSides(): { left: number; right: number } {
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  const playing = usePlayerState().current != null;
  const previewing = useDiscoverPreview() != null;
  if (!landscape) return { left: insets.left, right: insets.right };
  return { left: 0, right: playing || previewing ? 0 : insets.right };
}

const around = StyleSheet.create({
  upright: { flex: 1 },
  sideways: { flex: 1, flexDirection: 'row' },
  // Able to shrink below its contents, so that a long page scrolls inside it and does not push the bar off.
  page: { flex: 1, minWidth: 0, minHeight: 0 },
});

/**
 * Just enough to see what is playing and get to the full player. Shuffle,
 * repeat, the scrubber and the speed controls live there, where there is room
 * for them.
 *
 * Belongs at the foot of any screen you can start music from. Starting a track
 * and being left looking at the list you started it from reads as the tap
 * having gone nowhere — the bar appearing is what says otherwise, and it is
 * also the way back to the player without going through the library.
 *
 * Nothing at all when nothing is playing, so it costs no room until it earns
 * some.
 */
export function NowPlayingBar({ column = false }: { column?: boolean }) {
  /*
    Along the bottom in a theme of glass it is laid over the screen, on the
    tab bar, so that the list runs on under it; see `UnderBars`. Down the
    side it is a panel beside the list, as in every theme.
  */
  if (column) return <PlayingBar column />;
  return (
    <FootDock>
      <PlayingBar column={false} />
    </FootDock>
  );
}

function PlayingBar({ column }: { column: boolean }) {
  const { current, currentIndex, queue, repeat, isPlaying } = usePlayerState();
  const { toggle, next, previous, skipToIndex } = usePlayerActions();
  const openPlayer = useOpenPlayer();
  const preview = useDiscoverPreview();
  const insets = useSafeAreaInsets();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  // What scrolls under it, out of focus behind it, along the foot in a theme of glass: see `Frosted`.
  const target = useSceneTarget();
  const frosted = useFrosted(column ? null : target);

  /*
    By position rather than through the transport, which does not mean the same
    thing. `previous` restarts the track once it is a few seconds in, which is
    right for a button pressed twice to go back two, and wrong for a strip that
    has just been dragged until the previous track's cover is filling the frame.
  */
  const go = useCallback((to: number) => void skipToIndex(to), [skipToIndex]);

  /*
    The card is the button, rather than the whole bar being one with the card
    inside it. Which way round these nest decides whether the gesture works at
    all: a Pressable takes the responder the moment it is touched, and a strip
    underneath one never gets asked whether the finger is going sideways. The
    same arrangement as a row in the library — press on the inside, drag on the
    outside — and for the same reason.
  */
  const card = useCallback(
    (track: Track) => (
      <Pressable
        style={column ? styles.columnCard : styles.card}
        accessibilityRole="button"
        accessibilityHint={t.player.bar.opensPlayer}
        onPress={openPlayer}>
        <Cover track={track} column={column} />
        <View style={column ? styles.columnText : styles.text}>
          <Text style={styles.title} numberOfLines={column ? 2 : 1}>
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={column ? 2 : 1}>
            {track.artist ?? t.common.unknownArtist}
          </Text>
        </View>
      </Pressable>
    ),
    [column, openPlayer, styles, t]
  );

  /*
    A preview of a Discover song is being heard. It is not in the player, and
    what the player has is whatever was paused for it: named here, that would
    be the wrong song under the right sound. So for as long as it lasts this
    is the preview's bar, on every screen this one is on.
  */
  if (preview) return <PreviewBar preview={preview} column={column} width={NOW_PLAYING_WIDTH} />;

  if (!current) return null;

  const slop = column ? SLOP_COLUMN : SLOP;

  /*
    On its side it is a panel down the right instead of a bar along the
    bottom, for the same reason the tabs move to the left: height is what a
    landscape screen is short of, and neither of them needs it.

    The same parts either way, only stacked — the cover, what is playing, and
    the three controls. Sideways there is room to let the title wrap, which
    upright there is not.
  */
  return (
    <View
      style={[
        column ? styles.column : styles.bar,
        frosted && styles.clear,
        // Down the side it reaches the top of the screen, where the clock is.
        // Across the bottom the screen it sits on has already kept clear.
        /*
          Down the side it runs the whole height of the window, clock included,
          and what is in it sits in the middle of that — not stacked under the
          status bar, which left it clinging to the top of a tall empty column.
          The insets are still kept as padding so nothing can end up beneath
          the clock or in a cutout on a long queue.
        */
        column && {
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 14,
          paddingRight: 12 + insets.right,
        },
      ]}>
      {/*
        Underneath everything, so the whole bar opens the player and not only
        the card. The gesture needs the strip not to be inside a Pressable, and
        this way it is not — it is next to one, and anywhere the strip does not
        cover falls through to here.
      */}
      {/* Not offered to a screen reader, which would find a button the size of
          the bar with nothing to say for itself. The card says it, and does
          the same thing. */}
      {frosted && target ? <Frost target={target} edge="top" /> : null}
      <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={openPlayer} />
      {/*
        The controls are deliberately left out of the strip. They are the one
        thing here somebody might be aiming for, and a play button that slides
        out from under the thumb mid-press is worse than no gesture at all.
      */}
      <TrackStrip
        queue={queue}
        at={currentIndex}
        wraps={repeat === 'all'}
        renderTrack={card}
        onGo={go}
        style={column ? undefined : styles.strip}
      />
      <View style={column ? styles.columnControls : styles.inline}>
        {/*
          Keep, for a song of Discover's: nothing for any other track. Along
          the bottom it is the first of the controls; down the side the three
          fill their row, and it has the line under them.
        */}
        {column ? null : <PlayingKeep trackId={current.id} style={styles.control} hitSlop={slop} />}
        <Pressable
          android_ripple={pressed}
          style={styles.control}
          hitSlop={slop}
          accessibilityRole="button"
          accessibilityLabel={t.common.previousTrack}
          onPress={() => void previous()}>
          <PreviousIcon size={16} />
        </Pressable>
        {/* Named for what a press will do, as the picture is. */}
        <Pressable
          android_ripple={pressed}
          style={styles.control}
          hitSlop={slop}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? t.common.pause : t.common.play}
          onPress={() => void toggle()}>
          {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        </Pressable>
        <Pressable
          android_ripple={pressed}
          style={styles.control}
          hitSlop={slop}
          accessibilityRole="button"
          accessibilityLabel={t.common.nextTrack}
          onPress={() => void next()}>
          <NextIcon size={16} />
        </Pressable>
      </View>
      {column ? <PlayingKeep trackId={current.id} style={styles.columnKeep} hitSlop={slop} /> : null}
    </View>
  );
}

/*
  The controls are drawn about 32 across, which is a small thing to hit with a
  thumb while walking. They are left looking as they do and made easier to
  touch: this much further out on each side still counts as the button. Less
  sideways than up and down, because sideways is where the next button is —
  and less again down the side of the screen, where the three share a narrower
  row. Up and down they reach the 48 Android asks for; sideways they stop at
  half the gap to the next button, which is as far as they can go without two
  of them answering the same touch.
*/
const SLOP = { top: 8, bottom: 8, left: 5, right: 5 };
const SLOP_COLUMN = { top: 8, bottom: 8, left: 2, right: 2 };

/** How wide the panel is when it runs down the side. */
export const NOW_PLAYING_WIDTH = 132;

/** Worked out with the rest of what the bars cover; see there. */
export { nowPlayingHeight } from '../lib/ui/bars';

const useStyles = makeStyles((c) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // As the tab bar's: a hairline, or an outline's width where the bar is the
    // colour of the page under it.
    borderTopWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderTopColor: c.border,
    backgroundColor: c.surface,
    // In a theme of glass, the wash every bar with a list under it has.
    ...barGlass(c),
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  /** Its fill left to `Frost`, which draws it over the blur. */
  clear: { backgroundColor: 'transparent' },
  column: {
    /*
      Centred down its own length. Not `flex: 1` — this is a child of a row, so
      that grows it sideways, and the panel ate half the screen. Its height is
      already the window's; all it needed was somewhere to put its contents in
      that height.
    */
    justifyContent: 'center',
    width: NOW_PLAYING_WIDTH,
    borderLeftWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderLeftColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingTop: 14,
    gap: 10,
  },
  /** Along the bottom the strip takes whatever the controls leave. */
  strip: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  columnCard: { gap: 10 },
  columnText: { gap: 3 },
  columnControls: { flexDirection: 'row', justifyContent: 'space-between' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  art: { width: 40, height: 40, borderRadius: 6 },
  artWide: { width: '100%', aspectRatio: 1, borderRadius: 7 },
  artEmpty: { backgroundColor: c.surfaceRaised },
  text: { flex: 1, gap: 2 },
  title: { color: c.text, fontSize: 14.5 },
  artist: { color: c.textMuted, fontSize: 12 },
  control: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnKeep: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
}));
