import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Artwork } from './Artwork';
import { Button, TextButton } from './Button';
import { MediaRow } from './MediaRow';
import { usePageSides } from './NowPlayingBar';
import { ScreenState } from './ScreenState';

import { OnAPage } from './OnAPage';
import { SearchField } from './SearchField';
import { useUnderBars } from './UnderBars';
import { useT } from '../lib/i18n/index';
import { useTrackArtwork } from '../lib/media/artwork';
import { search } from '../lib/media/search';
import type { EnrichedTrack } from '../lib/media/merge';
import { makeStyles } from '../lib/theme/index';
import { PAGE, ROW_COVER_COMPACT, SPACE } from '../lib/theme/measures';
import { CLIP_SUBVIEWS, LIST_WINDOW } from '../lib/ui/lists';

/**
 * Picking tracks out of the library to put somewhere.
 *
 * Opened from a list, which is the other half of adding to one: the library
 * screen can send a track to a list, and this lets a list go and fetch them —
 * which is what somebody who has just made an empty list is trying to do, and
 * who would otherwise have to leave it, find each track, and come back.
 *
 * Several at once, because that is how a list gets made. Tracks already in it
 * are shown and marked rather than hidden: a list of search results with
 * silent gaps in it looks like a broken search.
 */
export function TrackPicker({
  visible,
  library,
  already,
  onClose,
  onAdd,
}: {
  visible: boolean;
  library: EnrichedTrack[];
  /** Ids the list already holds, shown ticked and not counted again. */
  already: Set<string>;
  onClose: () => void;
  onAdd: (trackIds: string[]) => void;
}) {
  const t = useT();
  // A page of its own in the tab, the bars where they are; what is searched and chosen is kept on it (`PickerPage`).
  return (
    <OnAPage visible={visible} title={t.lists.trackPicker.heading} onClose={onClose} bare>
      <PickerPage library={library} already={already} onAdd={onAdd} onDone={onClose} />
    </OnAPage>
  );
}

/**
 * The search, the songs and the button that adds the ones ticked. What is
 * typed and ticked is kept here, on the page, which is drawn where the page
 * is and not where it was opened from.
 */
function PickerPage({
  library,
  already,
  onAdd,
  onDone,
}: {
  library: EnrichedTrack[];
  already: Set<string>;
  onAdd: (trackIds: string[]) => void;
  onDone: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  // The bar of what is playing and the tab bar, in a theme of glass laid over the foot of the page.
  const under = useUnderBars({ player: true });
  const sides = usePageSides();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const results = useMemo(() => search(library, query).tracks, [library, query]);

  const toggle = useCallback((id: string) => {
    setChosen((held) => {
      const next = new Set(held);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // The search and the buttons at the page's margins; the songs to its sides, as rows of a list are (`MediaRow`).
  const margins = { paddingLeft: PAGE.side + sides.left, paddingRight: PAGE.side + sides.right };
  return (
    <View style={[styles.page, { paddingTop: PAGE.top + under.top, paddingBottom: SPACE.m + under.bottom }]}>
      <View style={margins}>
        <SearchField value={query} onChangeText={setQuery} placeholder={t.lists.trackPicker.search} />
      </View>

      <FlatList
        removeClippedSubviews={CLIP_SUBVIEWS}
        windowSize={LIST_WINDOW}
        style={styles.list}
        data={results}
        keyExtractor={(track) => track.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        renderItem={({ item }) => <Row track={item} held={already.has(item.id)} ticked={chosen.has(item.id)} onToggle={toggle} />}
        ListEmptyComponent={<ScreenState kind="empty" text={t.library.nothingMatches(query)} />}
      />

      <View style={[styles.actions, margins]}>
        <TextButton label={t.common.done} size="body" onPress={onDone} />
        <Button
          label={t.lists.trackPicker.add(chosen.size)}
          wide
          disabled={chosen.size === 0}
          onPress={() => {
            onAdd([...chosen]);
            // The page stays open. Building a list is several searches, and
            // closing after each one would mean opening it again for the next.
            setChosen(new Set());
            setQuery('');
          }}
        />
      </View>
    </View>
  );
}

/**
 * A song to tick, in a close-set row: the box at its start, as everywhere
 * something is chosen. One already in the list is ticked, faint, and cannot
 * be unticked here.
 */
const Row = memo(function Row({
  track,
  held,
  ticked,
  onToggle,
}: {
  track: EnrichedTrack;
  held: boolean;
  ticked: boolean;
  onToggle: (id: string) => void;
}) {
  const artwork = useTrackArtwork(track);
  const t = useT();
  return (
    <MediaRow
      size="compact"
      lead={<Artwork uri={artwork} size={ROW_COVER_COMPACT} />}
      title={track.title}
      subtitle={held ? t.lists.trackPicker.alreadyHere : (track.artist ?? t.common.unknownArtist)}
      check={ticked || held}
      selected={ticked}
      off={held}
      onPress={() => onToggle(track.id)}
    />
  );
});

const useStyles = makeStyles(() =>
  StyleSheet.create({
    page: { flex: 1, gap: SPACE.m },
    actions: { flexDirection: 'row', alignItems: 'center', gap: SPACE.l },
    list: { flex: 1 },
  })
);
