import { useDownloadLibraryRevision } from '../lib/youtube/DownloadsProvider';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../components/Pressable';
import { Segmented } from '../components/Segmented';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NowPlayingBar, usePageSides } from '../components/NowPlayingBar';
import { useUnderBars } from '../components/UnderBars';
import { PlaylistCover } from '../components/PlaylistCover';
import { TextPrompt } from '../components/TextPrompt';
import { useListFiles } from '../components/useListFiles';
import { AUTO_LISTS } from '../lib/db/autoLists';
import {
  addToPlaylist,
  createPlaylist,
  playlistMembers,
  playlists,
  type Playlist,
} from '../lib/db/playlists';
import { tagCounts, trackIdsWithTag, type TagCount } from '../lib/db/tags';
import { useT } from '../lib/i18n/index';
import { refreshLibrary } from '../lib/library/index';
import { useLibrary } from '../lib/library/useLibrary';
import { makeStyles, outlined, scene, usePressed } from '../lib/theme/index';
import { Behind, scrimOf } from '../lib/theme/Veil';
import { useLandscape } from '../lib/ui/layout';
import type { Track } from '../lib/types';

/** Enough tags to pick from without the sheet becoming the tag screen. */
const TAG_CHOICES = 40;

/** How many covers a square holds, and so how many tracks are asked for. */
const COVER_TRACKS = 4;

const COVER_SIZE = 52;

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

  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [naming, setNaming] = useState(false);
  const [fromTags, setFromTags] = useState(false);
  /*
    Back closes the sheet of tags rather than the tab under it: it is the way
    out a screen reader's user reaches for first, and the sheet has no button
    of its own to cancel with.
  */
  useEffect(() => {
    if (!fromTags) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setFromTags(false);
      return true;
    });
    return () => listener.remove();
  }, [fromTags]);
  /** Which of the two a tag list will be. Following the tag is the one people
      mean more often, and it is also the one that cannot be got back to by
      hand once a copy has been taken. */
  const [live, setLive] = useState(true);
  /** The first few tracks of each list, for the covers. */
  const [covers, setCovers] = useState<Map<number, Track[]>>(new Map());
  /** How many of each list's members the library holds, once it has been read. */
  const [counts, setCounts] = useState<Map<number, number>>(new Map());

  const load = useCallback(() => {
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
    for (const [id, trackIds] of playlistMembers()) {
      const here = trackIds
        .map((trackId) => byId.get(trackId))
        .filter((entry): entry is Track => entry != null);
      present.set(id, here.length);
      resolved.set(id, here.slice(0, COVER_TRACKS));
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
    }
    setCovers(resolved);
    setCounts(present);
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

  return (
    <View style={styles.screen}>
      {/* What the sheet of tags is laid over: all of the screen but it. */}
      <Behind veiled={fromTags} style={landscape ? styles.sideways : styles.upright}>
      <ScrollView
        style={styles.middle}
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
        <View style={[styles.newRow, files.available && styles.newRowOverLinks]}>
          <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.new} onPress={() => setNaming(true)}>
            <Text style={styles.newLabel}>{t.lists.screen.newList}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.secondary} onPress={() => setFromTags(true)}>
            <Text style={styles.secondaryLabel}>{t.lists.screen.fromTag}</Text>
          </Pressable>
        </View>

        {/* Quieter than the two above: brought out now and then, not every visit. */}
        {files.available ? (
          <View style={styles.fileLinks}>
            <Pressable style={styles.fileLinkHit} accessibilityRole="button" onPress={files.importFiles}>
              <Text style={styles.fileLink}>{t.lists.files.importFiles}</Text>
            </Pressable>
            <Pressable
              style={styles.fileLinkHit}
              accessibilityRole="button"
              disabled={lists.length === 0}
              onPress={files.exportAll}>
              <Text style={[styles.fileLink, lists.length === 0 && styles.fileLinkOff]}>{t.lists.files.exportAll}</Text>
            </Pressable>
          </View>
        ) : null}

        {lists.length === 0 ? (
          <Text style={styles.empty}>{t.lists.screen.empty}</Text>
        ) : (
          <View style={landscape ? styles.grid : undefined}>
            {lists.map((list) => (
              <Pressable
                accessibilityRole="button"
                android_ripple={pressed}
                key={list.id}
                style={[styles.row, styles.withCover, landscape && styles.cell]}
                onPress={() =>
                  router.push({ pathname: '/playlist', params: { id: String(list.id) } })
                }>
                <PlaylistCover
                  tracks={covers.get(list.id) ?? []}
                  chosen={
                    (covers.get(list.id) ?? []).find(
                      (entry) => entry.id === list.coverTrackId
                    ) ?? null
                  }
                  picture={list.coverUri}
                  size={COVER_SIZE}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {list.name}
                  </Text>
                  <Text style={styles.rowDetail}>
                    {/* Worth saying on the row: the two look alike here and
                        behave differently once opened. */}
                    {list.tag
                      ? t.lists.screen.followingTag(held(list), list.tag)
                      : t.common.tracks(held(list))}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Text accessibilityRole="header" style={styles.section}>{t.format.upper(t.lists.screen.fromListening)}</Text>
        <View style={landscape ? styles.grid : undefined}>
          {AUTO_LISTS.map((list) => (
            <Pressable
              accessibilityRole="button"
              android_ripple={pressed}
              key={list}
              style={[styles.row, landscape && styles.cell]}
              onPress={() =>
                router.push({ pathname: '/playlist', params: { auto: list } })
              }>
              <Text style={styles.rowName} numberOfLines={1}>
                {t.lists.auto[list].name}
              </Text>
              <Text style={styles.rowDetail}>{t.lists.auto[list].hint}</Text>
            </Pressable>
          ))}
          {/*
            Beside the lists made from listening, because it is made the same
            way and from the same thing — the difference is only that it points
            outside the library rather than into it. Its own screen rather than
            a list, since nothing in it can be played.
          */}
          <Pressable
            accessibilityRole="button"
            android_ripple={pressed}
            style={[styles.row, landscape && styles.cell]}
            onPress={() => router.push('/(tabs)/search?mode=discover')}>
            <Text style={styles.rowName} numberOfLines={1}>
              {t.lists.screen.discover}
            </Text>
            <Text style={styles.rowDetail}>{t.lists.screen.discoverHint}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Starting a track and being left looking at the list reads as the tap
          having gone nowhere. */}
      <NowPlayingBar column={landscape} />
      </Behind>

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
  content: { gap: 4 },

  newRow: { flexDirection: 'row', gap: 10, paddingBottom: 22 },
  /* The links below take the room the buttons kept under them, inside their own finger's height. */
  newRowOverLinks: { paddingBottom: 4 },
  fileLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, paddingBottom: 10 },
  fileLinkHit: { minHeight: 48, justifyContent: 'center' },
  fileLink: { color: c.accent, fontSize: 13.5 },
  fileLinkOff: { opacity: 0.35 },
  new: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: c.primary,
    borderRadius: 11,
    paddingVertical: 13,
    ...outlined(c, c.primary),
  },
  newLabel: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  secondary: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 11,
    paddingVertical: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  secondaryLabel: { color: c.text, fontSize: 15 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexGrow: 1, flexBasis: '31%', minWidth: 200 },

  row: {
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
    marginBottom: 8,
    ...outlined(c),
  },
  withCover: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 11 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowName: { color: c.text, fontSize: 15.5 },
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
