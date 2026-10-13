import { memo, useEffect, useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AlertIcon, MinusIcon, PlayIcon, PlayingIcon, PlusIcon, TickIcon } from '../Icons';
import { Image } from '../Picture';
import { Pressable } from '../Pressable';
import { SwipeRow } from '../SwipeRow';
import { TRACK_ROW_HEIGHT } from '../TrackRow';
import { ProgressRing } from './ProgressRing';
import { rowLabel, rowShows, watchRow, type RowShows, type RowWatch } from './show';
import { useDiscoverActions, useDiscoverEntry, type DiscoverEntryView } from '../../lib/discover/DiscoverProvider';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlined, useColours, usePressed } from '../../lib/theme/index';

/** As tall as a row of the Library, and fixed for the same reason: the list lays itself out without measuring. */
export const DISCOVER_ROW_HEIGHT = TRACK_ROW_HEIGHT;

/** Across the mark at the right of a row. */
const MARK = 18;

/**
 * One song of the Discover list.
 *
 * Handed the song's id and not the song. The list is then told only which
 * songs there are and in what order, and each row listens for its own: a
 * download reporting its percentage draws the one row it belongs to again,
 * once a second, and no other row and not the list.
 *
 * It is a row of the Library in every measure — the height, the cover, the
 * two sizes of writing — so that Discover reads as part of the same app and
 * not as a page from another. What differs is at the right: a mark for what
 * the song is doing, and the two things there are to say about it.
 */
export const DiscoverRow = memo(function DiscoverRow({
  id,
  shared,
  onMenu,
}: {
  id: string;
  /** True when the row is one of several across, and must share the width. */
  shared: boolean;
  /** Asked for the sheet of everything that can be done to the song. The same function for every row. */
  onMenu: (id: string) => void;
}) {
  const entry = useDiscoverEntry(id);
  const styles = useStyles();
  // Gone from the list in the moment between the list hearing of it and this being drawn: its place, kept, until then.
  if (!entry) return <View style={[styles.row, shared && styles.shared]} />;
  return <Song entry={entry} shared={shared} onMenu={onMenu} />;
});

function Song({
  entry,
  shared,
  onMenu,
}: {
  entry: DiscoverEntryView;
  shared: boolean;
  onMenu: (id: string) => void;
}) {
  const { play, keep, exclude, excludeArtist } = useDiscoverActions();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.discover.row;
  const shows = rowShows(entry, t);
  const { id } = entry;
  useAnnounced(entry);

  const busy = shows.mark === 'queued' || shows.mark === 'working' || shows.mark === 'progress';
  const lineStyle =
    shows.tone === 'danger' ? styles.lineBad : shows.tone === 'accent' ? styles.lineChosen : styles.line;

  return (
    <SwipeRow
      style={shared ? styles.shared : undefined}
      enabled={!shows.gone}
      /*
        The way a thing is taken and the way it is turned down: towards the
        hand that keeps and away from it, in the colours the app already has
        for a thing done and a thing lost. The same two the buttons do.
      */
      left={
        shows.keeping
          ? undefined
          : { label: said.swipeKeep, colour: c.successSoft, tint: c.success, onAct: () => keep(id) }
      }
      right={{ label: said.swipeExclude, colour: c.dangerSoft, tint: c.danger, onAct: () => exclude(id) }}>
      <View style={[styles.row, shows.chosen && styles.rowChosen, shows.gone && styles.rowGone]}>
        {/*
          The song is the button, and the two beside it are not inside it: a
          press on either would otherwise be the row's as well, and its wash
          would spread under them.
        */}
        <Pressable
          android_ripple={pressed}
          style={styles.song}
          disabled={shows.gone}
          onPress={() => play(id)}
          onLongPress={() => onMenu(id)}
          accessibilityRole="button"
          /*
            Everything the row shows, as words. A label takes the place of
            what is inside a button, so one that was only the title left the
            artist, the reason and the state unsaid.
          */
          accessibilityLabel={rowLabel(entry, t)}
          accessibilityHint={shows.gone ? undefined : said.hint}
          accessibilityState={{ busy, selected: entry.isPlaying, disabled: shows.gone }}
          /*
            A long press and a pull aside are not things a screen reader's
            user can be expected to find by trying. Named, they are in the
            reader's own list of what can be done here.
          */
          accessibilityActions={
            shows.gone
              ? undefined
              : [
                  { name: 'longpress', label: said.menu },
                  { name: 'keep', label: said.keep },
                  { name: 'exclude', label: said.exclude },
                  { name: 'neverArtist', label: t.discover.taste.neverArtistLabel(entry.artist) },
                ]
          }
          onAccessibilityAction={(event) => {
            const name = event.nativeEvent.actionName;
            if (name === 'longpress') onMenu(id);
            else if (name === 'keep') keep(id);
            else if (name === 'exclude') exclude(id);
            else if (name === 'neverArtist') excludeArtist(id);
          }}>
          {/*
            The cover the list came with, for as long as the song is on it.
            The file that is fetched brings a picture of its own — a still
            from the video — and a row that changed to it showed one sleeve
            until the download landed and another after.
          */}
          {entry.coverUrl ? (
            <Image source={{ uri: entry.coverUrl }} style={styles.art} contentFit="cover" transition={120} />
          ) : (
            <View style={[styles.art, styles.artEmpty]} />
          )}

          <View style={styles.text}>
            <Text style={[styles.title, entry.isPlaying && styles.titlePlaying]} numberOfLines={1}>
              {entry.title}
            </Text>
            <Text style={lineStyle} numberOfLines={1}>
              {shows.line}
            </Text>
          </View>

          <View style={styles.state}>
            <Mark shows={shows} />
            {shows.caption ? (
              <Text style={styles.caption} numberOfLines={1}>
                {shows.caption}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {/*
          For whoever has not found that a row can be pulled aside, which is
          most people the first week. Left out of what a screen reader goes
          through: the song already offers both as actions of its own, and
          three stops for every song is a list three times as long.
        */}
        {shows.gone ? null : (
          <>
            <Pressable
              android_ripple={pressed}
              style={styles.act}
              disabled={shows.keeping}
              onPress={() => keep(id)}
              accessible={false}
              importantForAccessibility="no-hide-descendants">
              {shows.keeping ? <ActivityIndicator size={16} color={c.textMuted} /> : <PlusIcon size={18} />}
            </Pressable>
            <Pressable
              android_ripple={pressed}
              style={styles.act}
              onPress={() => exclude(id)}
              accessible={false}
              importantForAccessibility="no-hide-descendants">
              <MinusIcon size={18} color={c.textMuted} />
            </Pressable>
          </>
        )}
      </View>
    </SwipeRow>
  );
}

/** What the song is doing, as a shape. Nothing at all for a song that is only there to be tapped. */
function Mark({ shows }: { shows: RowShows }) {
  const c = useColours();
  // The one that will start has a small triangle in its ring: it is being fetched to be played, not to be ready.
  const willStart = shows.chosen ? <PlayIcon size={6} color={c.accent} /> : null;
  switch (shows.mark) {
    case 'queued':
      return (
        <ProgressRing size={MARK} width={2} progress={0} colour={c.accent} track={c.borderStrong}>
          {willStart}
        </ProgressRing>
      );
    case 'progress':
      return (
        <ProgressRing size={MARK} width={2} progress={shows.progress} colour={c.accent} track={c.borderStrong}>
          {willStart}
        </ProgressRing>
      );
    case 'working':
      // Turned by the phone and not from here, like every spinner: nothing is done a frame at a time.
      return <ActivityIndicator size={MARK} color={shows.chosen ? c.accent : c.textMuted} />;
    case 'ready':
      return <TickIcon size={MARK - 3} color={c.success} />;
    case 'playing':
      return <PlayingIcon size={MARK - 4} color={c.accent} />;
    case 'alert':
      return <AlertIcon size={MARK - 1} color={c.danger} />;
    case 'none':
      return null;
  }
}

/**
 * Says aloud how a tap came out, for somebody who cannot see the mark
 * change: that the song has started, or that it could not be had.
 *
 * What the row was is kept in a ref and read only after it has been drawn.
 * Nothing drawn depends on it.
 */
function useAnnounced(entry: DiscoverEntryView): void {
  const t = useT();
  const watch = useRef<RowWatch | null>(null);
  useEffect(() => {
    const next = watchRow(watch.current, entry, t);
    watch.current = next.watch;
    if (next.say) AccessibilityInfo.announceForAccessibility(next.say);
  }, [entry, t]);
}

const useStyles = makeStyles((c) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: DISCOVER_ROW_HEIGHT,
    paddingRight: 4,
  },
  shared: { flex: 1, minWidth: 0 },
  // The wash a chosen row has in the Library, for the one somebody chose here.
  rowChosen: { backgroundColor: c.accentSoft },
  rowGone: { opacity: 0.5 },
  song: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 4,
  },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  art: { width: 46, height: 46, borderRadius: 6 },
  artEmpty: { backgroundColor: c.surface, ...outlined(c) },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: c.text, fontSize: 15.5 },
  // Heavier as well as coloured, as in the Library: not everybody is shown a colour.
  titlePlaying: { color: c.accent, fontWeight: '600' },
  line: { color: c.textMuted, fontSize: 12.5 },
  lineChosen: { color: c.accent, fontSize: 12.5 },
  lineBad: { color: c.danger, fontSize: 12.5 },
  /*
    The mark over the length, both to the right edge, so that the lengths
    stand in a column down the list as they do in the Library. Wide enough
    for `100%` and for a song an hour long, and no wider: what this takes,
    the title loses.
  */
  state: { minWidth: 32, alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  caption: { color: c.textFaint, fontSize: 12, fontVariant: ['tabular-nums'] },
  /*
    The full height of the row and most of a finger wide: narrow to look
    at, because a title has to fit beside two of them, and as tall as there
    is to aim at.
  */
  act: { width: 38, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
}));
