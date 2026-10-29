import { useDownloadLibraryRevision } from '../lib/youtube/DownloadsProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter, useIsFocused } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurArea, GlassScene } from '../components/Frosted';
import { Pressable } from '../components/Pressable';
import { Segmented } from '../components/Segmented';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NowPlayingBar, usePageSides } from '../components/NowPlayingBar';
import { useUnderBars } from '../components/UnderBars';
import { PlaylistCover } from '../components/PlaylistCover';
import { OptionSheet } from '../components/OptionSheet';
import { TextPrompt } from '../components/TextPrompt';
import { useListFiles } from '../components/useListFiles';
import { AUTO_LISTS, autoListTrackIds, type AutoListId } from '../lib/db/autoLists';
import {
  addToPlaylist,
  createPlaylist,
  markListPlayed,
  playlistMembers,
  playlists,
  type Playlist,
} from '../lib/db/playlists';
import { tagCounts, trackIdsWithTag, type TagCount } from '../lib/db/tags';
import { useT } from '../lib/i18n/index';
import { refreshLibrary } from '../lib/library/index';
import { useLibrary } from '../lib/library/useLibrary';
import { makeStyles, outlined, outlinedClip, scene, useColours, usePressed } from '../lib/theme/index';
import { favorites, useFavoritesShown } from '../lib/playlists/favorites';
import {
  CompassIcon,
  FlameIcon,
  HeartIcon,
  HourglassIcon,
  MoreIcon,
  SkipIcon,
  PlusIcon,
  ShuffleIcon,
  SparkleIcon,
  TagIcon,
} from '../components/Icons';
import { usePlayerActions } from '../lib/player/PlayerProvider';
import { haptic } from '../lib/ui/haptics';
import { Behind, scrimOf } from '../lib/theme/Veil';
import { useLandscape } from '../lib/ui/layout';
import type { Track } from '../lib/types';
import { useBack } from '../lib/ui/back';

/** Enough tags to pick from without the sheet becoming the tag screen. */
const TAG_CHOICES = 40;

/** How many covers a square holds, and so how many tracks are asked for. */
const COVER_TRACKS = 4;

const COVER_SIZE = 52;

/** How many rows of lists the tab shows before Show all, Favorites among them. */
const ROWS_SHOWN = 4;

const FAVORITES_ART = COVER_SIZE;

/** The sign on each tile of the lists made from listening. */
const AUTO_SIGNS: Record<AutoListId, typeof FlameIcon> = {
  mostPlayed: FlameIcon,
  recentlyFound: SparkleIcon,
  forgotten: HourglassIcon,
  skipped: SkipIcon,
};

export default function PlaylistsScreen() {
  const router = useRouter();
  const downloadRevision = useDownloadLibraryRevision();
  const insets = useSafeAreaInsets();
  const sides = usePageSides();
  // In a theme of glass the tab bar and the bar of what is playing are over the foot of this.
  const under = useUnderBars({ player: true });
  // The tab bar alone, which the sheet of tags stands on as it always has: it covers the bar of what is playing.
  const tabBar = useUnderBars();
  const landscape = useLandscape();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
  const favoritesOn = useFavoritesShown();

  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [naming, setNaming] = useState(false);
  const [fromTags, setFromTags] = useState(false);
  /*
    Back closes the sheet of tags rather than the tab under it: it is the way
    out a screen reader's user reaches for first, and the sheet has no button
    of its own to cancel with.
  */
  const focused = useIsFocused();
  useBack(fromTags && focused, () => setFromTags(false));
  /** Which of the two a tag list will be. Following the tag is the one people
      mean more often, and it is also the one that cannot be got back to by
      hand once a copy has been taken. */
  const [live, setLive] = useState(true);
  /** The first few tracks of each list, for the covers. */
  const [covers, setCovers] = useState<Map<number, Track[]>>(new Map());
  /** How many of each list's members the library holds, once it has been read. */
  const [counts, setCounts] = useState<Map<number, number>>(new Map());
  /** How long each list plays for, in seconds, once the library has been read. */
  const [lengths, setLengths] = useState<Map<number, number>>(new Map());
  /** Each list's tracks as the library has them, for its shuffle button. */
  const members = useRef<Map<number, Track[]>>(new Map());
  const [moreOpen, setMoreOpen] = useState(false);
  const [allShown, setAllShown] = useState(false);
  const { playQueue } = usePlayerActions();

  /** Plays [tracks] at once in a new order of their own: the shuffle button beside a list. */
  const shufflePlay = (tracks: readonly Track[], listId?: number) => {
    if (tracks.length === 0) return;
    // Up to the top of the lists next time the tab is opened, as playing it from its own page does.
    if (listId != null) markListPlayed(listId, Date.now());
    const order = [...tracks];
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [order[index], order[swap]] = [order[swap]!, order[index]!];
    }
    haptic('player', 'click');
    void playQueue(order, 0);
  };
  const autoTracks = (id: AutoListId) => {
    const byId = new Map((library ?? []).map((entry) => [entry.id, entry]));
    return autoListTrackIds(id, Date.now())
      .map((trackId) => byId.get(trackId))
      .filter((entry): entry is Track => entry != null);
  };
  /** How long a list plays for, as hours and minutes, or nothing before the library is in. */
  const lengthOf = (list: Playlist) => {
    const seconds = lengths.get(list.id);
    if (!seconds) return null;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return t.common.minutes(Math.max(1, minutes));
    const hours = t.common.hours(Math.floor(minutes / 60));
    return minutes % 60 === 0 ? hours : `${hours} ${t.common.minutes(minutes % 60)}`;
  };

  const load = useCallback(() => {
    // Made here on the first visit after an update, in the language the app speaks now.
    favorites();
    setLists(playlists());
    setTags(tagCounts().slice(0, TAG_CHOICES));
  }, []);

  /*
    The library, as it is held for the whole app (`lib/library`): this screen
    does not read it, only asks on each visit below that it be looked at again.
    Null until there is one to show, and the same list from one render to the
    next for as long as nothing in it has changed.
  */
  const shared = useLibrary();
  const library: Track[] | null = shared.kind === 'library' ? shared.tracks : null;

  /*
    The covers are worked out after the rows rather than with them. The names
    and counts — which are what the screen is actually for — are in hand
    without the library, and are drawn without waiting for it.
  */
  useEffect(() => {
    // No library yet, or none to be had: the rows keep what the lists say of
    // themselves, the squares stay empty and the counts are the stored ones.
    // An empty library is another matter, and is counted like any other.
    if (!library) return;
    const byId = new Map(library.map((entry) => [entry.id, entry]));
    const resolved = new Map<number, Track[]>();
    /*
      Counted against the library as well as drawn from it. A list keeps a
      member whose file is outside the library today, and the row should say
      how many tracks opening it will show, not how many are written down.
    */
    const present = new Map<number, number>();
    const length = new Map<number, number>();
    const whole = new Map<number, Track[]>();
    for (const [id, trackIds] of playlistMembers()) {
      const here = trackIds
        .map((trackId) => byId.get(trackId))
        .filter((entry): entry is Track => entry != null);
      present.set(id, here.length);
      resolved.set(id, here.slice(0, COVER_TRACKS));
      length.set(id, here.reduce((sum, entry) => sum + (entry.durationSec > 0 ? entry.durationSec : 0), 0));
      whole.set(id, here);
    }
    /*
      A list that follows a tag keeps no membership to read the first four
      out of, so they are asked of the tag instead. Without this every tag
      list wears the empty square, which reads as a list with nothing in it
      next to a count saying otherwise.
    */
    for (const list of lists ?? []) {
      if (!list.tag) continue;
      const here = trackIdsWithTag(list.tag)
        .map((trackId) => byId.get(trackId))
        .filter((entry): entry is Track => entry != null);
      present.set(list.id, here.length);
      resolved.set(list.id, here.slice(0, COVER_TRACKS));
      length.set(list.id, here.reduce((sum, entry) => sum + (entry.durationSec > 0 ? entry.durationSec : 0), 0));
      whole.set(list.id, here);
    }
    setCovers(resolved);
    setCounts(present);
    setLengths(length);
    members.current = whole;
  }, [library, lists]);

  /** What the row says a list holds: the stored number until the library is in. */
  const held = (list: Playlist) => counts.get(list.id) ?? list.trackCount;

  // Reloaded on focus, so a list edited or emptied on the detail screen is
  // described correctly on the way back.
  useFocusEffect(
    useCallback(() => {
      load();
      // And the library looked at again, for the covers and the counts. It
      // says for itself when it has changed, and usually it has not.
      void refreshLibrary();
    }, [load, downloadRevision])
  );

  const create = useCallback(
    (name: string) => {
      const id = createPlaylist(name, Date.now());
      setNaming(false);
      load();
      router.push({ pathname: '/playlist', params: { id: String(id) } });
    },
    [load, router]
  );

  /**
   * A list made out of a tag, one of the two ways that can mean.
   *
   * `live` keeps the question: the list is read from the tag every time it is
   * opened, so tagging something next week puts it in, and nothing in it can
   * be reordered or taken out — those would each be answers the tag did not
   * give. Otherwise it is a copy, taken once: whatever carries the tag at this
   * moment comes across and from then on the two go their own ways, which is
   * what makes it arrangeable.
   *
   * Both are worth having and neither is the obvious default, which is why the
   * sheet asks rather than picks.
   */
  const createFromTag = useCallback(
    (tag: string, live: boolean) => {
      const now = Date.now();
      const id = live ? createPlaylist(tag, now, tag) : createPlaylist(tag, now);
      if (!live) addToPlaylist(id, trackIdsWithTag(tag), now);
      setFromTags(false);
      load();
      router.push({ pathname: '/playlist', params: { id: String(id) } });
    },
    [load, router]
  );

  /*
    Playlist files: brought in from other players, and every list written
    out for them. Its sheets are windows of their own, so all this screen
    does is offer the two and read the lists again after an import.
  */
  const files = useListFiles({
    onChanged: load,
    onOpen: (listId) => router.push({ pathname: '/playlist', params: { id: String(listId) } }),
  });

  if (!lists) return <View style={styles.screen} />;

  /*
    Favorites first, whenever it was last touched, and not at all where
    Settings has taken it out of the lists: it is the one list there always is.
  */
  const shownLists = [
    ...(favoritesOn ? lists.filter((list) => list.kind === 'favorites') : []),
    ...lists.filter((list) => list.kind !== 'favorites'),
  ];

  /*
    The lists people made, in the order they were last used: the first few
    of them, with Favorites four rows in all, and the rest a press away, so
    that the lists made from listening are not pushed off the screen.
  */
  const yours = shownLists.filter((list) => list.kind !== 'favorites');
  const fits = ROWS_SHOWN - (favoritesOn ? 1 : 0);
  const shown = allShown || yours.length <= fits ? yours : yours.slice(0, fits);
  // Favorites at the head of them, in the same card: the one list there always is.
  const rows = [...shownLists.filter((list) => list.kind === 'favorites'), ...shown];

  return (
    <View style={styles.screen}>
      {/* What the sheet of tags is laid over: all of the screen but it. */}
      {/* The lists an area the bars over them blur, in a theme of glass: see `Frosted`. */}
      <GlassScene>
      <Behind veiled={fromTags} style={landscape ? styles.sideways : styles.upright}>
      <BlurArea style={styles.middle}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 18,
            // See usePageSides for why these are not the phone's own sideways.
            paddingLeft: sides.left + 20,
            paddingRight: sides.right + 20,
            paddingBottom: insets.bottom + 32 + under.bottom,
          },
        ]}>
        {/*
          The name of the tab, how many lists there are, and what can be made:
          a list from a tag, the files, and a new list, as round buttons on
          the right where there used to be two wide ones and a row of links.
        */}
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text accessibilityRole="header" style={styles.title}>{t.nav.lists}</Text>
            <Text style={styles.subtitle}>{t.lists.screen.count(shownLists.length)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.lists.screen.fromTag}
            android_ripple={pressed}
            style={styles.round}
            onPress={() => setFromTags(true)}>
            <TagIcon size={20} color={c.text} />
          </Pressable>
          {files.available ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.lists.screen.more}
              android_ripple={pressed}
              style={styles.round}
              onPress={() => setMoreOpen(true)}>
              <MoreIcon size={20} color={c.text} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.lists.screen.newList}
            android_ripple={pressed}
            style={[styles.round, styles.roundOn]}
            onPress={() => setNaming(true)}>
            <PlusIcon size={18} color={c.onPrimary} />
          </Pressable>
        </View>

        {rows.length === 0 ? null : (
          <View style={landscape ? styles.grid : styles.listCard}>
            {rows.map((list, at) => (
                <Pressable
                  accessibilityRole="button"
                  android_ripple={pressed}
                  key={list.id}
                  style={[styles.listRow, at > 0 && !landscape && styles.listRule, landscape && styles.cell]}
                  onPress={() => router.push({ pathname: '/playlist', params: { id: String(list.id) } })}>
                  {/* Favorites: the newest four of it behind the heart, or the heart alone on colour while it is empty. */}
                  {list.kind === 'favorites' ? (
                    <View style={styles.favoritesArt}>
                      {(covers.get(list.id) ?? []).length > 0 ? (
                        <>
                          <View style={StyleSheet.absoluteFill}>
                            <PlaylistCover tracks={covers.get(list.id) ?? []} chosen={null} picture={null} size={FAVORITES_ART} />
                          </View>
                          <View style={styles.favoritesVeil} />
                          <HeartIcon size={24} color="#ffffff" full />
                        </>
                      ) : (
                        <HeartIcon size={24} color={c.onAccent} full />
                      )}
                    </View>
                  ) : (
                    <PlaylistCover
                      tracks={covers.get(list.id) ?? []}
                      chosen={(covers.get(list.id) ?? []).find((entry) => entry.id === list.coverTrackId) ?? null}
                      picture={list.coverUri}
                      size={COVER_SIZE}
                    />
                  )}
                  <View style={styles.rowText}>
                    <View style={styles.nameLine}>
                      {list.tag ? <TagIcon size={14} color={c.textSecondary} /> : null}
                      <Text style={styles.rowName} numberOfLines={1}>
                        {list.name}
                      </Text>
                    </View>
                    <Text style={styles.rowDetail} numberOfLines={1}>
                      {/* Worth saying on the row: the two look alike here and behave differently once opened. */}
                      {list.tag
                        ? t.lists.screen.followingTag(held(list), list.tag)
                        : [t.common.tracks(held(list)), lengthOf(list)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.lists.screen.shuffleList(list.name)}
                    android_ripple={pressed}
                    hitSlop={6}
                    style={styles.shuffle}
                    onPress={() => shufflePlay(members.current.get(list.id) ?? [], list.id)}>
                    <ShuffleIcon size={20} color={c.textSecondary} />
                  </Pressable>
                </Pressable>
              ))}
            {/* The rest of them, which there was no room for: at the foot of the card, and back again. */}
            {yours.length > fits ? (
              <Pressable
                accessibilityRole="button"
                android_ripple={pressed}
                style={[styles.more, !landscape && styles.listRule, landscape && styles.moreWide]}
                onPress={() => setAllShown((now) => !now)}>
                <Text style={styles.moreLabel}>
                  {allShown ? t.lists.screen.showFewer : t.lists.screen.showAll(yours.length)}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {yours.length === 0 ? <Text style={styles.empty}>{t.lists.screen.empty}</Text> : null}

        {/*
          The lists nobody made, as small tiles two to a row, each with its own
          sign: what is played most, what is new, what has been forgotten, what
          is skipped, and Discover. A tap opens one; held, it is shuffled and
          played.
        */}
        <Text accessibilityRole="header" style={styles.section}>{t.format.upper(t.lists.screen.fromListening)}</Text>
        <View style={styles.tiles}>
          {AUTO_LISTS.map((list) => {
            const Sign = AUTO_SIGNS[list];
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityHint={t.lists.screen.holdToShuffle}
                android_ripple={pressed}
                key={list}
                style={styles.tile}
                onPress={() => router.push({ pathname: '/playlist', params: { auto: list } })}
                onLongPress={() => {
                  haptic('holds', 'hold');
                  shufflePlay(autoTracks(list));
                }}>
                <Sign size={20} color={c.accent} />
                <Text style={styles.tileName} numberOfLines={1}>{t.lists.auto[list].name}</Text>
                <Text style={styles.tileDetail} numberOfLines={2}>{t.lists.auto[list].hint}</Text>
              </Pressable>
            );
          })}
          {/*
            Beside the lists made from listening, because it is made the same
            way and from the same thing; its own screen, since nothing in it
            can be played until it is fetched.
          */}
          <Pressable
            accessibilityRole="button"
            android_ripple={pressed}
            style={styles.tile}
            onPress={() => router.push('/(tabs)/search?mode=discover')}>
            <CompassIcon size={20} color={c.accent} />
            <Text style={styles.tileName} numberOfLines={1}>{t.lists.screen.discover}</Text>
            <Text style={styles.tileDetail} numberOfLines={2}>{t.lists.screen.discoverHint}</Text>
          </Pressable>
        </View>
      </ScrollView>
      </BlurArea>

      {/* Starting a track and being left looking at the list reads as the tap
          having gone nowhere. */}
      <NowPlayingBar column={landscape} />
      </Behind>
      </GlassScene>

      <TextPrompt
        visible={naming}
        heading={t.lists.naming.heading}
        placeholder={t.lists.naming.placeholder}
        confirmLabel={t.lists.naming.create}
        onSubmit={create}
        onClose={() => setNaming(false)}
      />

      {fromTags ? (
        <View style={StyleSheet.absoluteFill}>
          {/* Named, for a screen reader: in a sheet drawn over the screen rather than in a window
              of its own, touching outside it is one of the ways out, and it has to be findable. */}
          <Pressable
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            onPress={() => setFromTags(false)}
          />
          <View style={[styles.sheet, { bottom: tabBar.bottom, paddingBottom: insets.bottom + 20 }]}>
            <Text accessibilityRole="header" style={styles.sheetHeading}>{t.lists.screen.tagSheet.heading}</Text>
            <Segmented
              size="compact"
              style={styles.kinds}
              options={[
                { value: 'follows', label: t.lists.screen.tagSheet.follows },
                { value: 'copy', label: t.lists.screen.tagSheet.copy },
              ]}
              value={live ? 'follows' : 'copy'}
              onChange={(kind) => setLive(kind === 'follows')}
            />
            <Text style={styles.sheetHint}>
              {live ? t.lists.screen.tagSheet.followsHint : t.lists.screen.tagSheet.copyHint}
            </Text>
            <ScrollView style={styles.tagScroll}>
              {tags.length === 0 ? (
                <Text style={styles.empty}>{t.lists.screen.tagSheet.noTags}</Text>
              ) : (
                tags.map((entry) => (
                  <Pressable
                    accessibilityRole="button"
                    android_ripple={pressed}
                    key={entry.tag}
                    style={styles.tagRow}
                    onPress={() => createFromTag(entry.tag, live)}>
                    <Text style={styles.tagName} numberOfLines={1}>
                      {entry.tag}
                    </Text>
                    <Text style={styles.rowDetail}>{t.format.number(entry.trackCount)}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* The files, brought out now and then rather than every visit: behind the button of three dots. */}
      <OptionSheet<'import' | 'export' | 'none'>
        visible={moreOpen}
        heading={t.lists.screen.files}
        options={[
          { value: 'import', label: t.lists.files.importFiles },
          ...(lists.length > 0 ? [{ value: 'export' as const, label: t.lists.files.exportAll }] : []),
        ]}
        chosen="none"
        onChoose={(what) => {
          setMoreOpen(false);
          if (what === 'import') files.importFiles();
          else if (what === 'export') files.exportAll();
        }}
        onClose={() => setMoreOpen(false)}
      />

      {files.element}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  upright: { flex: 1 },
  sideways: { flex: 1, flexDirection: 'row' },
  /* Takes what the rail and the player leave, rather than only what it needs. */
  middle: { flex: 1, minWidth: 0 },
  fill: { flex: 1 },
  content: { gap: 4 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 18 },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: c.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: c.textFaint, fontSize: 13 },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: c.surface,
    ...outlinedClip(c),
  },
  roundOn: { backgroundColor: c.primary, ...outlined(c, c.primary) },

  favoritesArt: {
    width: FAVORITES_ART,
    height: FAVORITES_ART,
    // As PlaylistCover rounds a square this size, so it sits in the column of covers as one of them.
    borderRadius: Math.max(6, FAVORITES_ART * 0.09),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
  },
  favoritesVeil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.38)' },

  shuffle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 140,
    gap: 4,
    padding: 14,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: c.surface,
    ...outlinedClip(c),
  },
  tileName: { color: c.text, fontSize: 14.5, fontWeight: '600', paddingTop: 6 },
  tileDetail: { color: c.textFaint, fontSize: 12, lineHeight: 16 },

  listCard: { borderRadius: 16, overflow: 'hidden', backgroundColor: c.surface, ...outlinedClip(c) },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingLeft: 12, paddingRight: 6, paddingVertical: 10 },
  more: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  moreWide: { flexBasis: '100%' },
  moreLabel: { color: c.accent, fontSize: 14, fontWeight: '600' },
  listRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 240,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: c.surface,
    ...outlinedClip(c),
  },

  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowName: { color: c.text, fontSize: 15.5, flexShrink: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowDetail: { color: c.textFaint, fontSize: 12.5 },

  section: {
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
    paddingTop: 26,
    paddingBottom: 12,
  },
  empty: { color: c.textFaint, fontSize: 13, lineHeight: 20, paddingVertical: 10 },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: scrimOf(c) },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '75%',
    backgroundColor: c.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 20,
    gap: 6,
    ...outlined(c),
  },
  sheetHeading: { color: c.text, fontSize: 15, fontWeight: '600' },
  sheetHint: { color: c.textFaint, fontSize: 12, lineHeight: 18, paddingBottom: 8 },
  // On the sheet, which is the surface a tray is elsewhere: the page's colour is the step off it here.
  kinds: { backgroundColor: c.bg, marginTop: 10 },
  tagScroll: { flexGrow: 0 },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  tagName: { color: c.text, fontSize: 14.5, flex: 1, minWidth: 0 },
}));
