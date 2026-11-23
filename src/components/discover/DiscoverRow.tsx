import { memo, useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Busy } from '../Busy';

import { AlertIcon, MinusIcon, PlayIcon, PlayingIcon, PlusIcon, TickIcon } from '../Icons';
import { Artwork } from '../Artwork';
import { MediaRow, RowControl } from '../MediaRow';
import { SwipeRow } from '../SwipeRow';
import { trackRowHeight, useTrackRowHeight } from '../TrackRow';
import { ProgressRing } from './ProgressRing';
import { rowLabel, rowShows, watchRow, type RowShows, type RowWatch } from './show';
import { useDiscoverActions, useDiscoverEntry, type DiscoverEntryView } from '../../lib/discover/DiscoverProvider';
import { useT } from '../../lib/i18n/index';
import { makeStyles, useColours } from '../../lib/theme/index';
import { ICON_SMALL, SPACE, TYPE } from '../../lib/theme/measures';
import { haptic } from '../../lib/ui/haptics';

/**
 * As tall as a row of the Library, and worked out the same way, for the same
 * reason: the list lays itself out without measuring. This is the figure at
 * the ordinary size of writing, for what only stands in for a row; a row
 * itself grows with the writing (see `trackRowHeight`).
 */
export const DISCOVER_ROW_HEIGHT = trackRowHeight(1);

/** A row's height at the size of writing the phone is set to now. */
export const useDiscoverRowHeight = useTrackRowHeight;

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
  const said = t.discover.row;
  const shows = rowShows(entry, t);
  const { id } = entry;
  useAnnounced(entry);

  // Felt from the finger's own ways of keeping and excluding, and not from a
  // screen reader's actions, which say what they did out loud.
  const keepFelt = () => {
    haptic('results', 'confirm');
    keep(id);
  };
  const excludeFelt = () => {
    haptic('results', 'reject');
    exclude(id);
  };

  const lineStyle = shows.tone === 'danger' ? styles.lineBad : shows.tone === 'accent' ? styles.lineChosen : null;

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
          : { label: said.swipeKeep, colour: c.successSoft, tint: c.success, onAct: keepFelt }
      }
      right={{ label: said.swipeExclude, colour: c.dangerSoft, tint: c.danger, onAct: excludeFelt }}>
      <MediaRow
        /*
          The cover the list came with, for as long as the song is on it.
          The file that is fetched brings a picture of its own -- a still
          from the video -- and a row that changed to it showed one sleeve
          until the download landed and another after.
        */
        lead={<Artwork uri={entry.coverUrl} />}
        title={entry.title}
        subtitle={lineStyle ? <Text style={lineStyle}>{shows.line}</Text> : shows.line}
        playing={entry.isPlaying}
        selected={shows.chosen}
        off={shows.gone}
        onPress={() => play(id)}
        onLongPress={() => onMenu(id)}
        holdLabel={said.menu}
        // Everything the row shows, as words: a label takes the place of what is inside a button.
        accessibilityLabel={rowLabel(entry, t)}
        accessibilityHint={shows.gone ? undefined : said.hint}
        actions={[
          { name: 'keep', label: said.keep, run: () => keep(id) },
          { name: 'exclude', label: said.exclude, run: () => exclude(id) },
          { name: 'neverArtist', label: t.discover.taste.neverArtistLabel(entry.artist), run: () => excludeArtist(id) },
        ]}
        trailing={
          <>
            {/*
              The mark over the length, both to the right edge, so that the
              lengths stand in a column down the list as they do in the Library.
            */}
            <View style={styles.state}>
              <Mark shows={shows} />
              {shows.caption ? (
                <Text style={styles.caption} numberOfLines={1}>
                  {shows.caption}
                </Text>
              ) : null}
            </View>
            {/*
              For whoever has not found that a row can be pulled aside, which
              is most people the first week. Left out of what a screen reader
              goes through: the song already offers both as actions of its own.
            */}
            {shows.gone ? null : (
              <>
                <RowControl hidden disabled={shows.keeping} onPress={keepFelt}>
                  {shows.keeping ? <Busy size={ICON_SMALL} color={c.textMuted} /> : <PlusIcon size={MARK} />}
                </RowControl>
                <RowControl hidden onPress={excludeFelt}>
                  <MinusIcon size={MARK} color={c.textMuted} />
                </RowControl>
              </>
            )}
          </>
        }
      />
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
      return <Busy size={MARK} color={shows.chosen ? c.accent : c.textMuted} />;
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

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { height: DISCOVER_ROW_HEIGHT },
    shared: { flex: 1, minWidth: 0 },
    lineChosen: { color: c.accent },
    lineBad: { color: c.danger },
    // Wide enough for `100%` and for a song an hour long, and no wider: what this takes, the title loses.
    state: { minWidth: SPACE.xl + SPACE.s, alignItems: 'flex-end', justifyContent: 'center', gap: SPACE.xs },
    caption: { color: c.textMuted, fontSize: TYPE.hint, fontVariant: ['tabular-nums'] },
  })
);
