import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { PlayIcon } from '../components/Icons';
import { TrackMenu, type TrackAction } from '../components/TrackMenu';
import { SearchField } from '../components/SearchField';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { SelectIcon } from '../components/Icons';
import { rackWanted, useLandscape, useListColumns } from '../lib/ui/layout';
import { useDragSelect } from '../lib/ui/useDragSelect';
import { TagPrompt } from '../components/TagPrompt';
import { PlaylistPicker } from '../components/PlaylistPicker';
import { NowPlayingBar } from '../components/NowPlayingBar';
import { PlaylistCover } from '../components/PlaylistCover';
import { CoverFlow } from '../components/CoverFlow';
import { albumKey, albumsOf } from '../lib/media/albums';
import { addTagToTracks } from '../lib/db/tags';
import { deleteTracks } from '../lib/media/remove';
import { SwipeRow } from '../components/SwipeRow';
import { TRACK_ROW_HEIGHT, TrackRow } from '../components/TrackRow';
import {
  ensureAudioPermission,
  ensureNotificationPermission,
  libraryRoot,
  scanLibrary,
} from '../lib/media/library';
import { withMetadata, type EnrichedTrack } from '../lib/media/merge';
import { forgetMetadata } from '../lib/db/metadata';
import { describeTrack } from '../lib/media/import';
import { search } from '../lib/media/search';
import {
  asSortOrder,
  nextSort,
  sortAlbums,
  sortTracks,
  type SortOrder,
} from '../lib/media/sort';
import { lastPlayedAt } from '../lib/db/history';
import { artistKey, spreadShuffle } from '../lib/media/shuffle';
import { usePlayerActions, usePlayerState } from '../lib/player/PlayerProvider';
import { useDownloadLibraryRevision } from '../lib/youtube/DownloadsProvider';

type Screen =
  | { kind: 'loading' }
  | { kind: 'denied' }
  | { kind: 'library'; tracks: EnrichedTrack[] }
  | { kind: 'error'; message: string };

/** A stable empty library, so the searching below is not re-run over a new one. */
const NOTHING: EnrichedTrack[] = [];

/** The same, for a listening history that has not been read yet. */
const UNPLAYED: ReadonlyMap<string, number> = new Map();

/**
 * How each order is named on the button, and how it is read out.
 *
 * The written form has to be short enough to sit beside the search box without
 * taking anything from it, which rules out saying anything about *what* is
 * being ordered — a reader can see that for themselves, since the list is right
 * there. The spoken form is under no such pressure and says it properly.
 */
const SORT_NAMES: Record<SortOrder, { short: string; spoken: string }> = {
  name: { short: 'A–Z', spoken: 'name' },
  added: { short: 'Added', spoken: 'when it was added' },
  played: { short: 'Played', spoken: 'when it was last played' },
};

/**
 * Declared rather than measured, unlike the switch beside it.
 *
 * The switch says the same two words whatever happens, so it can be measured
 * once and pinned; this changes what it says on every tap, and a slot pinned to
 * the width of `A–Z` would wrap `Played` into a column of letters. Wide enough
 * for the longest of the three, and the same width for all of them so that the
 * search box does not breathe in and out as the order changes.
 */
const SORT_WIDTH = 56;

export default function LibraryScreen() {
  const downloadRevision = useDownloadLibraryRevision();
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [query, setQuery] = useState('');
  const [menuTrack, setMenuTrack] = useState<EnrichedTrack | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  /*
    Selection is a mode rather than something a long press falls into: the long
    press already opens the track's own menu, and one gesture cannot sensibly do
    both. The button in the header is what turns the list from something to play
    into something to choose from.
  */
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /**
   * Which tracks the list picker is holding, or null when it is closed.
   *
   * Kept apart from `selected` because the picker is opened from two places
   * that mean different things — a single row held down, and a whole
   * selection — and the picker should not have to know which.
   */
  const [albumView, setAlbumView] = useState(false);
  const [sort, setSort] = useState<SortOrder>('name');
  /**
   * When each track was last listened to, read alongside the library itself.
   *
   * Read even when nothing is being ordered by it, because the alternative is
   * reading it at the moment the order changes — which is a tap, and a query
   * between a finger going down and the list redrawing is exactly where a
   * stutter is noticed.
   */
  const [played, setPlayed] = useState<ReadonlyMap<string, number>>(UNPLAYED);
  /** Records as a rack of sleeves rather than as a list. Off unless asked for. */
  const [rack, setRack] = useState(false);
  const landscape = useLandscape();
  const insets = useSafeAreaInsets();
  const [addingTo, setAddingTo] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Restored in an effect rather than in the first render: opening the
  // database is not something to do on the thread drawing a frame.
  useEffect(() => {
    setAlbumView(readSetting(SETTINGS.libraryView) === 'albums');
    setSort(asSortOrder(readSetting(SETTINGS.librarySort)));
  }, []);

  // Read on focus rather than once, so coming back from Settings shows the
  // choice that was just made there.
  useFocusEffect(
    useCallback(() => {
      setRack(rackWanted(landscape));
    }, [landscape])
  );

  const chooseView = useCallback((wantsAlbums: boolean) => {
    setAlbumView(wantsAlbums);
    writeSetting(SETTINGS.libraryView, wantsAlbums ? 'albums' : 'tracks');
  }, []);

  // Written down for the same reason the view is: an order is chosen once and
  // then lived in, and having to choose it again on every launch would make it
  // a chore rather than a preference.
  const chooseSort = useCallback((order: SortOrder) => {
    setSort(order);
    writeSetting(SETTINGS.librarySort, order);
  }, []);
  const [tagging, setTagging] = useState(false);
  const columns = useListColumns();
  const { playQueue, playNext, addToQueue } = usePlayerActions();
  const { current } = usePlayerState();
  const router = useRouter();

  const library = screen.kind === 'library' ? screen.tracks : NOTHING;

  /*
    Folding the whole library is not something to do on every render. `search`
    normalises every title, artist, album and tag it looks at, and unmemoised it
    ran again for a menu opening or a track change as readily as for a keystroke.
  */
  const { tracks: found, matchedTags } = useMemo(
    () => search(library, query),
    [library, query]
  );

  /*
    Ordered after the search rather than before it, so the two compose: a query
    narrows the library and the order arranges whatever is left, which is what
    somebody searching an artist's name while sorted by what is new is asking
    for. Memoised for the same reason the search is — the comparison folds every
    title it looks at, and re-running it because a menu opened would fold the
    whole library again.
  */
  const results = useMemo(() => sortTracks(found, sort, played), [found, played, sort]);

  /*
    The records the search results belong to.

    Built from the results rather than from the whole library, so searching
    narrows the albums the same way it narrows the tracks — which is what
    anybody typing an artist's name into a library of albums expects.
  */
  const albums = useMemo(
    () => (albumView ? sortAlbums(albumsOf(results), sort, played) : []),
    [albumView, played, results, sort]
  );

  /**
   * Records whose name the query matched, for jumping straight to one.
   *
   * Only while browsing by track and only while searching. In the album view
   * the list is already the answer, and with no query every record in the
   * library would qualify.
   */
  const matchedAlbums = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (albumView || needle.length === 0) return [];
    return albumsOf(results)
      .filter((entry) => entry.key.includes(needle))
      .slice(0, 3);
  }, [albumView, query, results]);

  /** Each matched tag with the tracks carrying it, gathered once per search. */
  const tagShuffles = useMemo(
    () =>
      matchedTags.slice(0, 3).map((tag) => ({
        tag,
        tracks: library.filter((track) => track.tags.includes(tag)),
      })),
    [library, matchedTags]
  );

  // Read at press time rather than closed over, so the row handlers below stay
  // the same functions across a search that changes what is on screen.
  const resultsRef = useRef(results);
  resultsRef.current = results;

  const start = useCallback(
    async (tracks: EnrichedTrack[], index: number) => {
      // Asked here rather than at startup: this is the last moment before the
      // media notification would appear, and the first at which it means
      // anything to whoever is being asked.
      await ensureNotificationPermission();
      await playQueue(tracks, index);
    },
    [playQueue]
  );

  const toggleSelected = useCallback((track: EnrichedTrack) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(track.id)) next.delete(track.id);
      else next.add(track.id);
      return next;
    });
  }, []);

  const onRowPress = useCallback(
    (track: EnrichedTrack) => {
      if (selecting) {
        toggleSelected(track);
        return;
      }
      const index = resultsRef.current.indexOf(track);
      if (index >= 0) void start(resultsRef.current, index);
    },
    [selecting, start, toggleSelected]
  );

  /** Leaves the mode and forgets the run; one never outlives the other. */
  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  /*
    The switch stepping aside for the search box.

    Its width has to be measured rather than declared, because it is the width
    of two words in whatever font the phone ended up using. Measured once, on
    the layout that happens before anything animates: after that the view is
    being given a width, and reading it back would be reading the animation.
  */
  const [searching, setSearching] = useState(false);
  const [viewsWidth, setViewsWidth] = useState(0);
  const measureViews = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (viewsWidth === 0 && width > 0) setViewsWidth(width);
    },
    [viewsWidth]
  );

  /*
    Only upright. Sideways the row is half again as wide and the box already
    has more than it can use, so there is nothing to be gained by taking the
    switch away — and rotating mid-search would otherwise strand it.
  */
  const aside = searching && !landscape;
  const reveal = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(reveal, {
      toValue: aside ? 0 : 1,
      duration: 190,
      easing: Easing.out(Easing.quad),
      // Width is a layout property, which the native driver cannot touch. One
      // small view for a fifth of a second is well within what JavaScript can
      // keep up with.
      useNativeDriver: false,
    }).start();
  }, [aside, reveal]);

  /*
    Nothing until the width is known, so the first layout is the one that
    measures. The gap to the search box is animated with it — left behind, it
    is ten points of nothing where the switch used to be.
  */
  const slot = viewsWidth
    ? {
        width: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, viewsWidth] }),
        marginRight: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }),
        opacity: reveal,
      }
    : null;

  /*
    The sort button leaves with the switch, and for the same reason: while a
    query is being typed the box wants everything it can get, and nobody
    reaches for the order of a list they are in the middle of narrowing.

    Its own width is known in advance, so unlike the switch it needs no
    measuring pass. The negative margin on the way out is the row's `gap`: a
    child collapsed to no width still has one on either side of it, and without
    taking one back there would be a dozen points of nothing where the button
    had been.
  */
  const sortSlot = {
    width: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, SORT_WIDTH] }),
    marginRight: reveal.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
    opacity: reveal,
  };

  /*
    Two things worth doing to a row without opening anything, reached by
    pulling it aside: the pair of queue entries out of its menu, which is most
    of what that menu gets opened for.

    Held back while rows are being chosen — a sideways pull is what picks a run
    of them then, and one gesture cannot mean both.
  */
  const renderItem = useCallback(
    ({ item }: { item: EnrichedTrack }) => (
      <SwipeRow
        style={columns > 1 ? styles.swipeShared : undefined}
        enabled={!selecting}
        left={{
          label: 'Play next',
          colour: '#1d3348',
          tint: '#9ecbff',
          onAct: () => void playNext(item),
        }}
        right={{
          label: 'Add to queue',
          colour: '#26372a',
          tint: '#a7d5a9',
          onAct: () => void addToQueue(item),
        }}>
        <TrackRow
          track={item}
          playing={item.id === current?.id}
          onPress={onRowPress}
          // The per-track menu would be reached by the same gesture that picks a
          // row, so while choosing it steps aside.
          onLongPress={selecting ? toggleSelected : setMenuTrack}
          selectable={selecting}
          selected={selected.has(item.id)}
        />
      </SwipeRow>
    ),
    [addToQueue, columns, current?.id, onRowPress, playNext, selected, selecting, toggleSelected]
  );

  /*
    Where the list was left, so returning to the tab returns to the same place.

    Held in a ref rather than in state: it changes on every frame of a scroll
    and nothing on screen depends on it, so storing it in state would re-render
    the whole library to record a number only the list itself reads back.
  */
  const restoreTo = useRef(0);

  /** The track a lookup is running for, so the row can say so. */
  const [lookingUp, setLookingUp] = useState<string | null>(null);

  const load = useCallback(async () => {
    // The spinner is for having nothing to show, not for re-reading something
    // already on screen. Swapping the list out for it on every focus tore the
    // list down and rebuilt it at the top, losing the reader's place — which is
    // what made coming back from another tab start over.
    setScreen((shown) => (shown.kind === 'library' ? shown : { kind: 'loading' }));
    try {
      if (!(await ensureAudioPermission())) {
        setScreen({ kind: 'denied' });
        return;
      }
      setScreen({ kind: 'library', tracks: withMetadata(await scanLibrary()) });
      // Re-read with the library rather than once, so a track played on another
      // screen and then returned from has moved by the time the list is seen
      // again — which is the whole point of ordering by it.
      setPlayed(lastPlayedAt());
    } catch (error) {
      setScreen({ kind: 'error', message: String(error) });
    }
  }, []);

  /**
   * Search again for everything a track can be told about itself: its tags, its
   * artist, its cover — and its words.
   *
   * The same pass an imported file goes through, so that asking for a lookup by
   * hand and getting one automatically arrive at the same place. It used to run
   * the enrichment alone and leave the lyrics as they were, which made "look up
   * details" no help at all for the case it was most often reached for: a track
   * whose words were never found.
   *
   * What is already known is thrown away first. The enrichment skips anything
   * it has an answer for — the point of it, when sweeping a library — but
   * asking for one track by name is asking for it to be tried again, and a
   * track looked up and missed would otherwise be skipped in silence.
   */
  const lookUp = useCallback(
    async (track: EnrichedTrack) => {
      setLookingUp(track.id);
      try {
        forgetMetadata([track.id]);
        await describeTrack(track.id);
        await load();
      } finally {
        setLookingUp(null);
      }
    },
    [load]
  );

  const drag = useDragSelect({
    ids: useMemo(() => results.map((track) => track.id), [results]),
    rowHeight: TRACK_ROW_HEIGHT,
    columns,
    enabled: selecting,
    selected,
    onChange: setSelected,
  });

  /** Everything the search is currently showing, not the whole library. */
  const selectAll = useCallback(() => {
    setSelected(new Set(results.map((track) => track.id)));
  }, [results]);

  const chosen = useCallback(
    () => library.filter((track) => selected.has(track.id)),
    [library, selected]
  );

  const queueSelected = useCallback(() => {
    for (const track of chosen()) void addToQueue(track);
    stopSelecting();
  }, [addToQueue, chosen, stopSelecting]);

  const tagSelected = useCallback(
    (tag: string) => {
      addTagToTracks([...selected], tag);
      setTagging(false);
      stopSelecting();
      void load();
    },
    [load, selected, stopSelecting]
  );

  /**
   * Erases the chosen tracks, once the system has asked and the user agreed.
   *
   * The selection is only cleared when something was actually deleted. Backing
   * out of the confirmation should leave the run intact, ready to be narrowed
   * or acted on differently, rather than making the user pick it all again.
   */
  const deleteSelected = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (await deleteTracks(ids)) {
      stopSelecting();
      await load();
    }
  }, [load, selected, stopSelecting]);

  const runAction = useCallback(
    (action: TrackAction, track: EnrichedTrack) => {
      setMenuTrack(null);
      // Spelled out rather than built from `action`: a menu entry that is not a
      // route is then a type error here instead of a dead end at the tap.
      if (action === 'playNext') void playNext(track);
      else if (action === 'addToQueue') void addToQueue(track);
      else if (action === 'lookup') void lookUp(track);
      else if (action === 'delete') {
        void deleteTracks([track.id]).then((gone) => {
          if (gone) void load();
        });
      }
      else if (action === 'edit') router.push({ pathname: '/edit', params: { trackId: track.id } });
      else if (action === 'lyrics') router.push({ pathname: '/lyrics', params: { trackId: track.id } });
      else if (action === 'addToPlaylist') setAddingTo([track.id]);
      else if (action === 'tiles') {
        // The name goes with it. The game shows what it is about to play before
        // the player has been told anything, and the name it should show is the
        // one on the row that was pressed -- tags corrected by hand included.
        router.push({ pathname: '/tiles', params: { track: track.id, title: track.title } });
      }
      else if (action === 'album') {
        const name = track.album?.trim();
        if (name) router.push({ pathname: '/playlist', params: { album: albumKey(name) } });
      }
      else router.push({ pathname: '/view', params: { trackId: track.id } });
    },
    [addToQueue, load, lookUp, playNext, router]
  );

  // Re-read on focus so metadata gathered on the other screen shows up here.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, downloadRevision])
  );

  if (screen.kind === 'loading') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color="#ededed" />
      </View>
    );
  }

  if (screen.kind === 'denied' || screen.kind === 'error') {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.body}>
          {screen.kind === 'denied'
            ? 'Jukebox needs access to the audio on this device.'
            : screen.message}
        </Text>
        <Pressable style={styles.button} onPress={() => void load()}>
          <Text style={styles.buttonLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (screen.tracks.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.body}>Nothing in {libraryRoot()}.</Text>
        <Text style={styles.muted}>
          Jukebox plays everything below that folder, including subfolders.
        </Text>
        <Text style={styles.muted}>Choose your library folder in Settings.</Text>
      </View>
    );
  }

  /*
    Two ways of looking at one library rather than two collections, which is
    why this sits with the library and not in its own tab.

    Beside the search rather than above it, and small: it is read once on the
    way past and pressed rarely, while the box next to it is the reason most
    people come to this screen. A row of its own was a row of height spent on
    the lesser of the two.
  */
  const views = (
    <View style={[styles.views, viewsWidth ? { width: viewsWidth } : null]} onLayout={measureViews}>
      {([false, true] as const).map((wantsAlbums) => (
        <Pressable
          key={String(wantsAlbums)}
          style={[styles.view, wantsAlbums === albumView && styles.viewOn]}
          onPress={() => chooseView(wantsAlbums)}>
          <Text style={[styles.viewLabel, wantsAlbums === albumView && styles.viewLabelOn]}>
            {wantsAlbums ? 'Albums' : 'Tracks'}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView
      style={styles.screen}
      /*
        No left edge while the tabs are down that side. The rail already keeps
        clear of the cutout, and asking again put a second inset's worth of
        empty grey between it and the screen — which on the album view was a
        strip of nothing beside the records.
      */
      /*
        Nor a top edge sideways. The panel down the right is meant to run the
        whole height of the window, the way it does on the Lists screen, and a
        safe area around everything stopped it under the clock instead — the
        two screens disagreed about where the same panel began. What needs
        keeping clear of the clock is the header, and that asks for itself.
      */
      edges={landscape ? ['right'] : ['top', 'left', 'right']}>
      <View style={landscape ? styles.sideways : styles.upright}>
        <View style={styles.middle}>
      <View
        style={[
          styles.header,
          ((rack && albumView) || landscape) && styles.headerTight,
          // What the safe area used to do for the whole screen, asked for by
          // the one part of it that is actually under the clock.
          landscape && { paddingTop: insets.top + 8 },
        ]}>
        <View style={styles.headerRow}>
        {/*
          Pulled aside while the box is being typed in, and put back when it is
          let go of. Upright, searching is the one thing on this screen that
          wants the whole width — a query is longer than anything else typed
          into a phone — and it is also the one time the switch is certainly
          not about to be pressed.
        */}
        <Animated.View style={[styles.viewsSlot, slot]}>{views}</Animated.View>
        <View style={[styles.searchRow, styles.searchGrow]}>
          <View style={styles.searchGrow}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearching(true)}
              onBlur={() => setSearching(false)}
              placeholder="Search titles, artists and tags"
            />
          </View>
          {/*
            What the library is in order of, and the only way to change it.

            A word rather than a glyph. The three orders are not degrees of one
            thing that an arrow could point along, and an icon that has to be
            tapped before it means anything is no use to the reader who only
            wants to know where they are — which is most of the times this is
            looked at. Stacked over a label, because `Added` on its own reads
            as a filter, something the list has been reduced to; it is the
            small grey word above it that makes it an ordering. Stacking is
            also what fits it into less width than the two laid side by side
            would need, and the width here belongs to the search box.
          */}
          <Animated.View style={[styles.sortSlot, sortSlot]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sorted by ${SORT_NAMES[sort].spoken}`}
              accessibilityHint="Changes the order of the library"
              style={styles.sort}
              onPress={() => chooseSort(nextSort(sort))}>
              <Text style={styles.sortLabel}>Sort</Text>
              <Text style={styles.sortValue} numberOfLines={1}>
                {SORT_NAMES[sort].short}
              </Text>
            </Pressable>
          </Animated.View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selecting ? 'Stop selecting' : 'Select tracks'}
            accessibilityState={{ selected: selecting }}
            style={styles.selectButton}
            onPress={() => (selecting ? stopSelecting() : setSelecting(true))}>
            <SelectIcon size={22} color={selecting ? '#7ab8ff' : '#7a7a7a'} />
          </Pressable>
        </View>
        </View>

        {/* Directly under the search box, where the run it acts on begins.
            Below that row rather than inside it: it is a second line of
            chrome, and in the row it became a third thing competing for the
            width with the switch and the box. */}
        {selecting ? (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkCount}>{selected.size} selected</Text>
            <View style={styles.bulkActions}>
              <Pressable
                style={styles.bulkAction}
                onPress={selected.size === results.length ? () => setSelected(new Set()) : selectAll}>
                <Text style={styles.bulkLabel}>
                  {selected.size === results.length && results.length > 0
                    ? 'Clear'
                    : 'Select all'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={queueSelected}>
                <Text style={styles.bulkLabel}>Add to queue</Text>
              </Pressable>
              <Pressable
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={() => setAddingTo([...selected])}>
                <Text style={styles.bulkLabel}>Add to list</Text>
              </Pressable>
              <Pressable
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={() => setTagging(true)}>
                <Text style={styles.bulkLabel}>Add tag</Text>
              </Pressable>
              <Pressable
                style={[styles.bulkAction, selected.size === 0 && styles.bulkDisabled]}
                disabled={selected.size === 0}
                onPress={() => void deleteSelected()}>
                <Text style={styles.bulkDestructive}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {albumView ? null : (
        <View style={styles.meta}>
          <Text style={styles.metaText} numberOfLines={1}>
            {/* A lookup takes seconds and changes nothing until it lands, so it
                says so rather than appearing to have done nothing. Whatever the
                list picker last did is said here too, since adding to a list
                otherwise looks like nothing happening. */}
            {lookingUp
              ? 'Looking up details…'
              : (note ?? `${libraryRoot()} · ${library.length} tracks`)}
          </Text>
        </View>
        )}
      </View>

      {albumView && rack ? (
        <CoverFlow albums={albums} onPlay={(album, index) => void start(album.tracks, index)} />
      ) : albumView ? (
        <FlatList
          data={albums}
          key={`albums-${columns}`}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.columnRow : undefined}
          keyExtractor={(album) => album.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item: album }) => (
            <Pressable
              style={[styles.albumRow, columns > 1 && styles.albumCell]}
              onPress={() =>
                router.push({ pathname: '/playlist', params: { album: album.key } })
              }>
              {/* One cover, not four: a record has its own, and the first
                  track's is it. */}
              <PlaylistCover tracks={album.tracks} chosen={album.tracks[0]} size={52} />
              <View style={styles.albumText}>
                <Text style={styles.albumName} numberOfLines={1}>
                  {album.name}
                </Text>
                <Text style={styles.albumDetail} numberOfLines={1}>
                  {[
                    album.artist,
                    `${album.tracks.length} ${album.tracks.length === 1 ? 'track' : 'tracks'}`,
                    album.year,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.muted}>
              No albums yet. A record only appears once its tracks have been
              looked up — the folder a file sits in is not an album.
            </Text>
          }
        />
      ) : (
      <View
        style={styles.listWrapper}
        ref={drag.wrapperRef}
        // Page coordinates are what a gesture reports, so where the list sits
        // in the window is needed to turn one into a row and a column.
        onLayout={drag.onWrapperLayout}
        {...drag.panHandlers}>
      <FlatList
        data={results}
        onLayout={(event) => drag.onWidth(event.nativeEvent.layout.width)}
        /*
          Remounts the list when the count changes. React Native refuses to
          alter numColumns on an existing list, and turning the phone is exactly
          when it changes.
        */
        key={columns}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.columnRow : undefined}
        keyExtractor={(track) => track.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        onScroll={(event) => {
          restoreTo.current = event.nativeEvent.contentOffset.y;
          drag.onScroll(event.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
        // Read once, when the list is built. Covers the case the guard above
        // cannot: the list being torn down while the screen around it lives on.
        contentOffset={{ x: 0, y: restoreTo.current }}
        /*
          Measured rather than calculated once there is more than one column.

          The header counts towards an offset, and with a single column the
          arithmetic is exact: a row per item, each one lower than the last. Two
          across breaks that. A pair shares one offset, so the offsets stop
          increasing with the index — and the list finds the visible range by
          searching those offsets, which only works while they rise. It settled
          on the wrong window part way down and unmounted rows that were on
          screen, which is why the middle of the list went blank while the two
          ends, where the window is pinned, stayed put.

          Letting it measure costs the exactness of scrolling to an index.
          Nothing here does that: the place is restored from a pixel offset,
          which is independent of this.
        */
        getItemLayout={
          columns > 1
            ? undefined
            : (_data, index) => ({
                length: TRACK_ROW_HEIGHT,
                offset: headerHeight + TRACK_ROW_HEIGHT * index,
                index,
              })
        }
        // Covers are read out of the files, so keep that to what is on screen.
        initialNumToRender={12 * columns}
        windowSize={7}
        // Left to the list to measure, clipping guesses at what is off screen
        // from the same frames, and guesses wrong in the same way.
        removeClippedSubviews={columns === 1}
        ListHeaderComponent={
          <View
            style={tagShuffles.length > 0 || matchedAlbums.length > 0 ? styles.tagActions : null}
            onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
            {matchedAlbums.map((entry) => (
              <Pressable
                key={`album:${entry.key}`}
                style={styles.tagAction}
                onPress={() =>
                  router.push({ pathname: '/playlist', params: { album: entry.key } })
                }>
                <View style={styles.albumActionIcon}>
                  <PlaylistCover tracks={entry.tracks} chosen={entry.tracks[0]} size={22} />
                </View>
                <Text style={styles.tagActionLabel} numberOfLines={1}>
                  {entry.name}
                </Text>
                <Text style={styles.tagActionCount}>{entry.tracks.length}</Text>
              </Pressable>
            ))}
            {tagShuffles.map(({ tag, tracks: tagged }) => (
              <Pressable
                key={tag}
                style={styles.tagAction}
                onPress={() => void start(spreadShuffle(tagged, artistKey), 0)}>
                <View style={styles.tagActionIcon}>
                  <PlayIcon size={11} color="#121212" />
                </View>
                <Text style={styles.tagActionLabel} numberOfLines={1}>
                  Shuffle “{tag}”
                </Text>
                <Text style={styles.tagActionCount}>{tagged.length}</Text>
              </Pressable>
            ))}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Nothing matches “{query}”.</Text>}
        renderItem={renderItem}
      />
      </View>
      )}

        </View>
        {/* The bar becomes a panel down the right, so the middle keeps its
            width and the height goes to the list. */}
        <NowPlayingBar column={landscape} />
      </View>

      <TrackMenu track={menuTrack} onSelect={runAction} onClose={() => setMenuTrack(null)} />

      <TagPrompt
        visible={tagging}
        count={selected.size}
        onSubmit={tagSelected}
        onClose={() => setTagging(false)}
      />

      <PlaylistPicker
        visible={addingTo != null}
        trackIds={addingTo ?? []}
        onClose={() => setAddingTo(null)}
        onAdded={(message) => {
          setAddingTo(null);
          setNote(message);
          // Said once and then gone. A line that stays says the thing happened
          // just now, long after it did.
          setTimeout(() => setNote(null), 2500);
          if (selecting) stopSelecting();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  upright: { flex: 1 },
  sideways: { flex: 1, flexDirection: 'row' },
  middle: { flex: 1, minWidth: 0 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },

  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 },
  // Each row takes an equal share of the width so the pair lines up.
  columnRow: { gap: 8 },
  swipeShared: { flex: 1, minWidth: 0 },
  listWrapper: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTight: { paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  /*
    The slot clips; the switch inside is pinned to the width it measured.

    Clipping alone was not enough. A child of a view whose width is animating
    to nothing is still laid out against that width, so the two words wrapped
    into columns of letters on the way out and the header grew a centimetre
    taller — the box appeared to change height when what moved was the row
    above holding it down.
  */
  viewsSlot: { overflow: 'hidden', flexShrink: 0 },
  views: { flexDirection: 'row', backgroundColor: '#1c1c1c', borderRadius: 9, padding: 2 },
  // As small as two legible words: it is read once on the way past and pressed
  // rarely, and every point it takes is one the search box does not get.
  view: { alignItems: 'center', paddingVertical: 7, paddingHorizontal: 11, borderRadius: 7 },
  viewOn: { backgroundColor: '#2e2e2e' },
  viewLabel: { color: '#7a7a7a', fontSize: 12.5 },
  viewLabelOn: { color: '#ededed', fontWeight: '600' },
  // The cover stands in for the play button the tag rows carry, so the two
  // kinds of shortcut line up rather than each finding their own left edge.
  albumActionIcon: { width: 22, height: 22, borderRadius: 4, overflow: 'hidden' },
  albumRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 4, paddingVertical: 9 },
  albumCell: { flex: 1, minWidth: 0 },
  albumText: { flex: 1, minWidth: 0, gap: 3 },
  albumName: { color: '#ededed', fontSize: 15 },
  albumDetail: { color: '#6a6a6a', fontSize: 12.5 },
  searchGrow: { flex: 1 },
  // Clips the button on its way out, exactly as the switch's slot does; the
  // button inside keeps the width it was given so that nothing inside it
  // reflows while that is happening.
  sortSlot: { overflow: 'hidden', flexShrink: 0 },
  sort: {
    width: SORT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1c',
    borderRadius: 9,
    paddingVertical: 5,
  },
  sortLabel: { color: '#6a6a6a', fontSize: 8.5, letterSpacing: 1, textTransform: 'uppercase' },
  sortValue: { color: '#ededed', fontSize: 12.5, fontWeight: '600' },
  selectButton: { padding: 8 },
  bulkBar: { gap: 8, paddingTop: 4 },
  bulkCount: { color: '#7ab8ff', fontSize: 12 },
  bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bulkAction: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3a',
  },
  bulkDisabled: { opacity: 0.35 },
  bulkLabel: { color: '#ededed', fontSize: 13 },
  bulkDestructive: { color: '#e08585', fontSize: 13 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  metaText: { color: '#5f5f5f', fontSize: 12, flexShrink: 1 },
  links: { flexDirection: 'row', gap: 16 },
  link: { color: '#7ab8ff', fontSize: 13 },

  list: { paddingBottom: 8 },
  tagActions: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  tagAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  tagActionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ededed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagActionLabel: { color: '#ededed', fontSize: 14, flex: 1 },
  tagActionCount: { color: '#5f5f5f', fontSize: 12, fontVariant: ['tabular-nums'] },
  empty: { color: '#5f5f5f', fontSize: 14, textAlign: 'center', padding: 32 },

  body: { color: '#ededed', fontSize: 16, textAlign: 'center' },
  muted: { color: '#7a7a7a', fontSize: 14, textAlign: 'center' },
  button: { backgroundColor: '#252525', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  buttonLabel: { color: '#ededed', fontSize: 15 },

});
