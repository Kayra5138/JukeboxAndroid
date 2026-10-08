import { useDownloadLibraryRevision } from '../lib/youtube/DownloadsProvider';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../components/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NowPlayingBar } from '../components/NowPlayingBar';
import { PlaylistCover } from '../components/PlaylistCover';
import { TextPrompt } from '../components/TextPrompt';
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
import { scanLibrary } from '../lib/media/library';
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
  const landscape = useLandscape();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();

  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [naming, setNaming] = useState(false);
  const [fromTags, setFromTags] = useState(false);
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
    The covers are loaded after the rows rather than with them. Reading the
    library is a trip to the media store, and the names and counts — which are
    what the screen is actually for — are already in hand without it.
  */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const library = await scanLibrary();
      if (cancelled) return;
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
    })().catch((failure) => {
      /*
        The rows are already drawn from what the lists say of themselves, and
        that is what they keep: the squares stay empty and the counts are the
        stored ones. Not worth a screen of its own — nothing here is lost, and
        the library is asked again the next time the lists are read, which is
        every return to this tab.
      */
      console.warn('Could not read the library for the list covers', failure);
    });
    return () => {
      cancelled = true;
    };
  }, [lists]);

  /** What the row says a list holds: the stored number until the library is in. */
  const held = (list: Playlist) => counts.get(list.id) ?? list.trackCount;

  // Reloaded on focus, so a list edited or emptied on the detail screen is
  // described correctly on the way back.
  useFocusEffect(useCallback(() => load(), [load, downloadRevision]));

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
            /*
              Neither inset sideways. What touches the edges of the screen
              there is the rail on one side and the player's panel on the
              other, and both keep clear of whatever is at them; asking again
              here adds a second inset's worth of nothing to one side only,
              which is what left this sitting off-centre in a space it was
              supposed to be filling evenly.
            */
            paddingLeft: (landscape ? 0 : insets.left) + 20,
            paddingRight: (landscape ? 0 : insets.right) + 20,
            paddingBottom: insets.bottom + 32,
          },
        ]}>
        <View style={styles.newRow}>
          <Pressable android_ripple={pressed} style={styles.new} onPress={() => setNaming(true)}>
            <Text style={styles.newLabel}>{t.lists.screen.newList}</Text>
          </Pressable>
          <Pressable android_ripple={pressed} style={styles.secondary} onPress={() => setFromTags(true)}>
            <Text style={styles.secondaryLabel}>{t.lists.screen.fromTag}</Text>
          </Pressable>
        </View>

        {lists.length === 0 ? (
          <Text style={styles.empty}>{t.lists.screen.empty}</Text>
        ) : (
          <View style={landscape ? styles.grid : undefined}>
            {lists.map((list) => (
              <Pressable
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

        <Text style={styles.section}>{t.format.upper(t.lists.screen.fromListening)}</Text>
        <View style={landscape ? styles.grid : undefined}>
          {AUTO_LISTS.map((list) => (
            <Pressable
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
          <Pressable style={styles.backdrop} onPress={() => setFromTags(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.sheetHeading}>{t.lists.screen.tagSheet.heading}</Text>
            <View style={styles.kinds}>
              {([true, false] as const).map((wantsLive) => (
                <Pressable
                  android_ripple={pressed}
                  key={String(wantsLive)}
                  style={[styles.kind, wantsLive === live && styles.kindOn]}
                  onPress={() => setLive(wantsLive)}>
                  <Text style={[styles.kindLabel, wantsLive === live && styles.kindLabelOn]}>
                    {wantsLive ? t.lists.screen.tagSheet.follows : t.lists.screen.tagSheet.copy}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sheetHint}>
              {live ? t.lists.screen.tagSheet.followsHint : t.lists.screen.tagSheet.copyHint}
            </Text>
            <ScrollView style={styles.tagScroll}>
              {tags.length === 0 ? (
                <Text style={styles.empty}>{t.lists.screen.tagSheet.noTags}</Text>
              ) : (
                tags.map((entry) => (
                  <Pressable
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
  kinds: { flexDirection: 'row', backgroundColor: c.bg, borderRadius: 9, padding: 2, marginTop: 10, ...outlined(c) },
  kind: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 7 },
  kindOn: { backgroundColor: c.selected },
  kindLabel: { color: c.textMuted, fontSize: 13 },
  kindLabelOn: { color: c.onSelected, fontWeight: '600' },
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
