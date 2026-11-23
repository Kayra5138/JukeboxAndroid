import { TabTitle, usePageRoom } from '../components/Page';
import { ICON, ICON_SMALL, LEADING, RADIUS, ROW_COVER, SPACE, TYPE, TOUCH } from '../lib/theme/measures';
import { useDownloadLibraryRevision } from '../lib/youtube/DownloadsProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurArea, ClockGlass, GlassScene } from '../components/Frosted';
import { Pressable } from '../components/Pressable';
import { Segmented } from '../components/Segmented';

import { useUnderBars } from '../components/UnderBars';
import { PlaylistCover } from '../components/PlaylistCover';
import { MediaRow, RowControl } from '../components/MediaRow';
import { OptionSheet } from '../components/OptionSheet';
import { TextPrompt } from '../components/TextPrompt';
import { useListFiles } from '../components/useListFiles';
import { OnAPage } from '../components/OnAPage';
import { useRows } from '../components/settings/rows';
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
import { makeStyles, outlinedClip, scene, useColours, usePressed } from '../lib/theme/index';
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
  SmartIcon,
  SparkleIcon,
  TagIcon,
} from '../components/Icons';
import { readSmartStats, smartListTracks } from '../lib/lists/smartLive';
import { usePlayerActions } from '../lib/player/PlayerProvider';
import { haptic } from '../lib/ui/haptics';
import { Behind } from '../lib/theme/Veil';
import { useLandscape } from '../lib/ui/layout';
import { useTabOpen } from '../lib/ui/tabOpen';
import type { Track } from '../lib/types';
import type { EnrichedTrack } from '../lib/media/merge';
import { useTopOnReselect } from '../lib/ui/tabReselect';

/** Enough tags to pick from without the sheet becoming the tag screen. */
const TAG_CHOICES = 40;

/** How many covers a square holds, and so how many tracks are asked for. */
const COVER_TRACKS = 4;

/** How many rows of lists the tab shows before Show all, Favorites among them. */
const ROWS_SHOWN = 4;

/** The sign on each tile of the lists made from listening. */
const AUTO_SIGNS: Record<AutoListId, typeof FlameIcon> = {
  mostPlayed: FlameIcon,
  recentlyFound: SparkleIcon,
  forgotten: HourglassIcon,
  skipped: SkipIcon,
};

/** Whether two readings of the database say the same: plain rows, compared as written. */
function sameAs(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function PlaylistsScreen() {
  const router = useRouter();
  const downloadRevision = useDownloadLibraryRevision();
  // The skeleton of the page a tab opens on: see `usePageRoom`.
  const room = usePageRoom({ root: true });
  // The tab bar, which the sheet of tags stands on; the bar of what is playing is part of it now, and is not counted twice.
  const tabBar = useUnderBars({ player: false });
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
  const card = useRows();
  /** A list made from the tags sheet since it was opened: a second tap while it closes makes no second list. */
  const made = useRef(false);
  /*
    Back closes the sheet of tags rather than the tab under it: it is the way
    out a screen reader's user reaches for first, and the sheet has no button
    of its own to cancel with.
  */
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
    // Kept as they were where nothing has changed: a new list of the same lists is every row and cover drawn again.
    const lists = playlists();
    setLists((before) => (sameAs(before, lists) ? before : lists));
    const tags = tagCounts().slice(0, TAG_CHOICES);
    setTags((before) => (sameAs(before, tags) ? before : tags));
  }, []);

  /*
    The library, as it is held for the whole app (`lib/library`): this screen
    does not read it, only asks on each visit below that it be looked at again.
    Null until there is one to show, and the same list from one render to the
    next for as long as nothing in it has changed.
  */
  const shared = useLibrary();
  const library: Track[] | null = shared.kind === 'library' ? shared.tracks : null;
  // The same tracks with what is known of each beyond the file, which a smart list's rules ask about.
  const enriched: EnrichedTrack[] | null = shared.kind === 'library' ? shared.tracks : null;

  /*
    The covers are worked out after the rows rather than with them. The names
    and counts — which are what the screen is actually for — are in hand
    without the library, and are drawn without waiting for it.
  */
  /*
    And only while the tab is open and this page is in front of it: worked out at every change of the library,
    a download landing among them, with every smart list's rules run over the
    whole of it, for a tab nobody had in front of them. Opened again, it is
    worked out then, once, if anything has changed meanwhile.
  */
  // Nor under a list's page pushed over it, in a tab that is open.
  const focused = useIsFocused();
  const open = useTabOpen() && focused;
  const workedFrom = useRef<{ library: unknown; enriched: unknown; lists: unknown } | null>(null);
  useEffect(() => {
    // No library yet, or none to be had: the rows keep what the lists say of
    // themselves, the squares stay empty and the counts are the stored ones.
    // An empty library is another matter, and is counted like any other.
    if (!library || !open) return;
    const from = workedFrom.current;
    if (from && from.library === library && from.enriched === enriched && from.lists === lists) return;
    workedFrom.current = { library, enriched, lists };
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
    /*
      A smart list keeps no membership either, and its songs are worked out
      from its rules here as they are on its own page: what listening has been
      done is read once for all of them.
    */
    const smart = (lists ?? []).filter((list) => list.kind === 'smart');
    const stats = smart.length > 0 ? readSmartStats() : null;
    for (const list of smart) {
      if (!stats) break;
      const here = smartListTracks(enriched ?? [], list.rules, stats);
      present.set(list.id, here.length);
      resolved.set(list.id, here.slice(0, COVER_TRACKS));
      length.set(list.id, here.reduce((sum, entry) => sum + (entry.durationSec > 0 ? entry.durationSec : 0), 0));
      whole.set(list.id, here);
    }
    setCovers(resolved);
    setCounts(present);
    setLengths(length);
    members.current = whole;
  }, [library, enriched, lists, open]);

  /** What the row says a list holds: the stored number until the library is in. */
  const held = (list: Playlist) => counts.get(list.id) ?? list.trackCount;

  // Reloaded on focus, so a list edited or emptied on the detail screen is
  // described correctly on the way back.
  useFocusEffect(
    useCallback(() => {
      // After the tab is on the screen, not before it: see the library's.
      const later = setTimeout(() => {
        load();
        // And the library looked at again, for the covers and the counts. It
        // says for itself when it has changed, and usually it has not.
        void refreshLibrary();
      }, 0);
      return () => clearTimeout(later);
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
      if (made.current) return;
      made.current = true;
      const now = Date.now();
      const id = live ? createPlaylist(tag, now, tag) : createPlaylist(tag, now);
      if (!live) addToPlaylist(id, trackIdsWithTag(tag), now);
      load();
      // In place of the page of tags, which closes as it goes (`OnAPage`): back from the list is the Lists tab.
      router.replace({ pathname: '/playlist', params: { id: String(id) } });
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
  // Its tab pressed again: back to the top of it.
  const backUp = useTopOnReselect();

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
      <Behind veiled={false} style={landscape ? styles.sideways : styles.upright}>
      <BlurArea style={styles.middle}>
      <ScrollView
        {...backUp}
        style={styles.fill}
        // The skeleton of a tab's own page (`usePageRoom`).
        contentContainerStyle={[styles.content, room]}>
        {/*
          The name of the tab, how many lists there are, and what can be made:
          a smart list, a list from a tag, the files, and a new list, as round buttons on
          the right where there used to be two wide ones and a row of links.
        */}
        <TabTitle
          title={t.nav.lists}
          subtitle={t.lists.screen.count(shownLists.length)}
          actions={[
            { label: t.smart.newList, wide: false, onPress: () => router.push('/smart-list'), mark: (ink: string) => <SmartIcon size={ICON} color={ink} /> },
            {
              label: t.lists.screen.fromTag,
              wide: false,
              onPress: () => {
                made.current = false;
                setFromTags(true);
              },
              mark: (ink: string) => <TagIcon size={ICON} color={ink} />,
            },
            ...(files.available
              ? [{ label: t.lists.screen.more, wide: false, onPress: () => setMoreOpen(true), mark: (ink: string) => <MoreIcon size={ICON} color={ink} /> }]
              : []),
            { label: t.lists.screen.newList, kind: 'primary', wide: false, onPress: () => setNaming(true), mark: (ink: string) => <PlusIcon size={ICON} color={ink} /> },
          ]}
        />

        {rows.length === 0 ? null : (
          <View style={landscape ? styles.grid : styles.listCard}>
            {rows.map((list, at) => (
                <MediaRow
                  key={list.id}
                  style={[at > 0 && !landscape && styles.listRule, landscape && styles.cell]}
                  onPress={() => router.push({ pathname: '/playlist', params: { id: String(list.id) } })}
                  lead={
                    // Favorites: the newest four of it behind the heart, or the heart alone on colour while it is empty.
                    list.kind === 'favorites' ? (
                      <View style={styles.favoritesArt}>
                        {(covers.get(list.id) ?? []).length > 0 ? (
                          <>
                            <View style={StyleSheet.absoluteFill}>
                              <PlaylistCover tracks={covers.get(list.id) ?? []} chosen={null} picture={null} size={ROW_COVER} />
                            </View>
                            <View style={styles.favoritesVeil} />
                            <HeartIcon size={ICON} color="#ffffff" full />
                          </>
                        ) : (
                          <HeartIcon size={ICON} color={c.onAccent} full />
                        )}
                      </View>
                    ) : (
                      <PlaylistCover
                        tracks={covers.get(list.id) ?? []}
                        chosen={(covers.get(list.id) ?? []).find((entry) => entry.id === list.coverTrackId) ?? null}
                        picture={list.coverUri}
                        size={ROW_COVER}
                      />
                    )
                  }
                  titleMark={
                    list.tag ? (
                      <TagIcon size={ICON_SMALL} color={c.textSecondary} />
                    ) : list.kind === 'smart' ? (
                      <View accessible accessibilityLabel={t.smart.sign}>
                        <SmartIcon size={ICON_SMALL} color={c.textSecondary} />
                      </View>
                    ) : undefined
                  }
                  title={list.name}
                  subtitle={
                    // Worth saying on the row: the two look alike here and behave differently once opened.
                    list.kind === 'smart'
                      ? [t.smart.detail(held(list)), lengthOf(list)].filter(Boolean).join(' · ')
                      : list.tag
                      ? t.lists.screen.followingTag(held(list), list.tag)
                      : [t.common.tracks(held(list)), lengthOf(list)].filter(Boolean).join(' · ')
                  }
                  trailing={
                    <RowControl
                      accessibilityLabel={t.lists.screen.shuffleList(list.name)}
                      onPress={() => shufflePlay(members.current.get(list.id) ?? [], list.id)}>
                      <ShuffleIcon size={ICON} color={c.textSecondary} />
                    </RowControl>
                  }
                  menu={false}
                />
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
            onPress={() => router.navigate('/search?mode=discover')}>
            <CompassIcon size={20} color={c.accent} />
            <Text style={styles.tileName} numberOfLines={1}>{t.lists.screen.discover}</Text>
            <Text style={styles.tileDetail} numberOfLines={2}>{t.lists.screen.discoverHint}</Text>
          </Pressable>
        </View>
      </ScrollView>
      </BlurArea>
      {/* And behind the clock, over the page scrolled up under it: see `ClockGlass`. */}
      <ClockGlass />

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

      {/*
        A page of its own in the tab, as Settings asks its questions, and not a
        sheet over the screen: that one stood between the page and the bars,
        the tab bar and the bar of what is playing put out of focus under it.
      */}
      <OnAPage visible={fromTags} title={t.lists.screen.tagSheet.heading} onClose={() => setFromTags(false)}>
        <View style={card.card}>
          <View style={card.row}>
            <Segmented
              options={[
                { value: 'follows', label: t.lists.screen.tagSheet.follows },
                { value: 'copy', label: t.lists.screen.tagSheet.copy },
              ]}
              value={live ? 'follows' : 'copy'}
              onChange={(kind) => setLive(kind === 'follows')}
            />
            <Text style={card.muted}>
              {live ? t.lists.screen.tagSheet.followsHint : t.lists.screen.tagSheet.copyHint}
            </Text>
          </View>
        </View>
        <View style={[card.card, styles.tagCard]}>
          {tags.length === 0 ? (
            <View style={card.row}>
              <Text style={card.muted}>{t.lists.screen.tagSheet.noTags}</Text>
            </View>
          ) : (
            tags.map((entry, index) => (
              <View key={entry.tag}>
                {index > 0 ? <View style={card.rule} /> : null}
                <Pressable
                  accessibilityRole="button"
                  android_ripple={pressed}
                  style={card.row}
                  onPress={() => createFromTag(entry.tag, live)}>
                  <View style={card.line}>
                    <Text style={card.title} numberOfLines={1}>
                      {entry.tag}
                    </Text>
                    <Text style={card.value}>{t.format.number(entry.trackCount)}</Text>
                  </View>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </OnAPage>

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
  content: { gap: SPACE.xs },


  favoritesArt: {
    width: ROW_COVER,
    height: ROW_COVER,
    // As PlaylistCover rounds a square this size, so it sits in the column of covers as one of them.
    borderRadius: Math.max(RADIUS.cover, ROW_COVER * 0.09),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
  },
  favoritesVeil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.38)' },


  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 140,
    gap: SPACE.xs,
    padding: SPACE.m,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    backgroundColor: c.surface,
    ...outlinedClip(c),
  },
  tileName: { color: c.text, fontSize: TYPE.body, fontWeight: '600', paddingTop: SPACE.xs },
  tileDetail: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.hint },

  listCard: { borderRadius: RADIUS.card, overflow: 'hidden', backgroundColor: c.surface, ...outlinedClip(c) },
  more: { alignItems: 'center', justifyContent: 'center', minHeight: TOUCH.normal },
  // A row of the grid to itself, the whole of its width: a share of it as a basis was not taken, and the words stood in two lines at its start.
  moreWide: { width: '100%' },
  moreLabel: { color: c.accent, fontSize: TYPE.small, fontWeight: '600' },
  listRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  cell: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 240,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    backgroundColor: c.surface,
    ...outlinedClip(c),
  },


  section: {
    color: c.textFaint,
    fontSize: TYPE.label,
    letterSpacing: 1,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.m,
  },
  empty: { color: c.textFaint, fontSize: TYPE.small, lineHeight: LEADING.small, paddingVertical: SPACE.s },

  // The tags' card, under the card of how the list is to be made: apart, as cards are.
  tagCard: { marginTop: SPACE.xl },
}));
