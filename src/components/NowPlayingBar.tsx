import { Image } from 'expo-image';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NextIcon, PauseIcon, PlayIcon, PreviousIcon } from './Icons';
import { TrackStrip } from './TrackStrip';
import { useTrackArtwork } from '../lib/media/artwork';
import { useOpenPlayer } from '../lib/player/NowPlayingSheet';
import { usePlayerActions, usePlayerState } from '../lib/player/PlayerProvider';
import type { Track } from '../lib/types';

/** One track's cover, looked up per card so the neighbours arrive with theirs. */
function Cover({ track, column }: { track: Track; column: boolean }) {
  const artwork = useTrackArtwork(track);
  const shape = column ? styles.artWide : styles.art;

  return artwork ? (
    <Image source={{ uri: artwork }} style={shape} contentFit="cover" />
  ) : (
    <View style={[shape, styles.artEmpty]} />
  );
}

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
  const { current, currentIndex, queue, repeat, isPlaying } = usePlayerState();
  const { toggle, next, previous, skipToIndex } = usePlayerActions();
  const openPlayer = useOpenPlayer();
  const insets = useSafeAreaInsets();

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
      <Pressable style={column ? styles.columnCard : styles.card} onPress={openPlayer}>
        <Cover track={track} column={column} />
        <View style={column ? styles.columnText : styles.text}>
          <Text style={styles.title} numberOfLines={column ? 2 : 1}>
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={column ? 2 : 1}>
            {track.artist ?? 'Unknown artist'}
          </Text>
        </View>
      </Pressable>
    ),
    [column, openPlayer]
  );

  if (!current) return null;

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
      <Pressable style={StyleSheet.absoluteFill} onPress={openPlayer} />
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
        <Pressable style={styles.control} onPress={() => void previous()}>
          <PreviousIcon size={16} />
        </Pressable>
        <Pressable style={styles.control} onPress={() => void toggle()}>
          {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        </Pressable>
        <Pressable style={styles.control} onPress={() => void next()}>
          <NextIcon size={16} />
        </Pressable>
      </View>
    </View>
  );
}

/** How wide the panel is when it runs down the side. */
export const NOW_PLAYING_WIDTH = 132;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#262626',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  column: {
    /*
      Centred down its own length. Not `flex: 1` — this is a child of a row, so
      that grows it sideways, and the panel ate half the screen. Its height is
      already the window's; all it needed was somewhere to put its contents in
      that height.
    */
    justifyContent: 'center',
    width: NOW_PLAYING_WIDTH,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#262626',
    backgroundColor: '#1a1a1a',
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
  artEmpty: { backgroundColor: '#262626' },
  text: { flex: 1, gap: 2 },
  title: { color: '#ededed', fontSize: 14.5 },
  artist: { color: '#7a7a7a', fontSize: 12 },
  control: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
