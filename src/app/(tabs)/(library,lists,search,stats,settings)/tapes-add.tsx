import { useEffect, useRef, useState } from 'react';
import { useIsFocused, useRouter } from 'expo-router';
import { isChannelAddress } from '../../../lib/podcasts/episodes';
import { channelFeedOf } from '../../../lib/podcasts/feed';
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image } from '../../../components/Picture';
import { Pressable } from '../../../components/Pressable';
import { SearchField } from '../../../components/SearchField';
import { BooksPane } from '../../../components/tapes/BooksPane';
import { FilesPane } from '../../../components/tapes/FilesPane';
import { PodcastsPane } from '../../../components/tapes/PodcastsPane';
import { Segmented } from '../../../components/Segmented';
import { useT } from '../../../lib/i18n/index';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import { noteError } from '../../../lib/support/errorLogStore';
import { folderNameOf } from '../../../lib/tapes/folders';
import { makeStyles, outlined, scene, useColours, usePressed } from '../../../lib/theme/index';
import { useBack } from '../../../lib/ui/back';
import { haptic } from '../../../lib/ui/haptics';
import { CLIP_SUBVIEWS } from '../../../lib/ui/lists';
import { useDownloads } from '../../../lib/youtube/DownloadsProvider';
import { youtubeError } from '../../../lib/youtube/errors';
import { downloads } from '../../../lib/youtube/native';
import { durationLabel, isActive, jobForVideo, statusLabel, type YouTubeResult, type YouTubeVideo } from '../../../lib/youtube/types';

/** A playlist's videos or a search's, whichever is asked for. Out here, for the React Compiler, which will not have a choice made inside a `try`. */
const lookUp = (playlist: boolean, text: string, id: string) =>
  playlist ? downloads!.playlistAsync(text, id) : downloads!.searchAsync(text, id);

/**
 * Tapes, fetched: opened from the tapes view of the library, which is the
 * one place in the app tapes are anything to do with.
 *
 * From YouTube, for now: a video, into a folder of the Tapes folder named
 * after its channel, which for a show is the show; or a playlist, as one
 * tape, its parts numbered in the list's order, into a folder named after the
 * list. What they become is decided on the phone (`fetchTape`): kept as they
 * came, with their chapters, and never looked up as songs.
 */
export default function AddTapesScreen() {
  const { jobs, enqueueTapes } = useDownloads();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const insets = useSafeAreaInsets();
  const said = t.search;
  /** Where tapes are fetched from: YouTube, or the podcasts followed and found. */
  const [source, setSource] = useState<'youtube' | 'podcasts' | 'books' | 'files'>('youtube');
  const [kind, setKind] = useState<'videos' | 'playlist'>('videos');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const searchId = useRef<string | null>(null);
  const addingRef = useRef(false);
  /** The results a playlist was opened from, to go back to with the back key. */
  const [openedFrom, setOpenedFrom] = useState<{ query: string; results: YouTubeResult[] } | null>(null);

  const stopSearch = () => {
    const id = searchId.current;
    searchId.current = null;
    setSearching(false);
    if (id && !id.startsWith('channel-')) void downloads?.cancelSearchAsync(id).catch(() => {});
  };
  useEffect(() => () => stopSearch(), []);

  const router = useRouter();
  const openChannel = async (address: string) => {
    setMessage(null);
    // A turn of its own, as a search has: stopped meanwhile, or another begun, it opens nothing and says nothing.
    const id = `channel-${Date.now()}`;
    searchId.current = id;
    setSearching(true);
    let feed: string | null = null;
    try {
      feed = await channelFeedOf(address);
    } catch {
      feed = null;
    }
    if (searchId.current !== id) return;
    searchId.current = null;
    setSearching(false);
    if (feed) router.push({ pathname: '/podcast', params: { feed } });
    else setMessage(t.search.tapes.podcasts.notChannel);
  };

  const search = async (override?: string, fromResults = false) => {
    const text = (override ?? query).trim();
    if (override) setQuery(override);
    if (!fromResults) setOpenedFrom(null);
    if (!text || !downloads) return;
    stopSearch();
    Keyboard.dismiss();
    // A channel's page is followed, not searched: it opens as a show, its videos its episodes.
    if (isChannelAddress(text)) return void openChannel(text);
    setMessage(null);
    setSearched(false);
    setResults([]);
    const id = `tapes-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    searchId.current = id;
    setSearching(true);
    const playlist = kind === 'playlist';
    try {
      const found = await lookUp(playlist, text, id);
      if (searchId.current !== id) return;
      setResults(found);
      setSearched(true);
    } catch (failure) {
      if (searchId.current === id) {
        setMessage(youtubeError(failure, said.failed.search, t));
        noteError('search', failure);
      }
    }
    if (searchId.current === id) { searchId.current = null; setSearching(false); }
  };

  const backTo = (was: { query: string; results: YouTubeResult[] }) => {
    stopSearch();
    setOpenedFrom(null);
    setQuery(was.query);
    setResults(was.results);
    setSearched(true);
    setMessage(null);
  };
  const focused = useIsFocused();
  useBack(openedFrom != null && focused, () => {
    if (openedFrom) backTo(openedFrom);
  });

  const addTapes = async (videos: YouTubeVideo[], name: string, firstPart: number | null, key: string) => {
    if (addingRef.current || videos.length === 0) return;
    addingRef.current = true;
    setAdding(key);
    setMessage(null);
    try {
      await enqueueTapes(videos, name, firstPart);
      haptic('results', 'confirm');
      setMessage(said.tapes.added(folderNameOf(name)));
    } catch (failure) {
      haptic('results', 'reject');
      setMessage(youtubeError(failure, said.failed.queue, t));
    }
    addingRef.current = false;
    setAdding(null);
  };

  const listed = results.slice(0, 500).filter((item): item is YouTubeVideo => item.kind !== 'playlist');
  const listName = listed[0]?.sourcePlaylist?.name ?? said.unnamedPlaylist;
  const inList = kind === 'playlist' && listed.length > 0;
  // A tape's job, and never a song's of the same video: the two are kept apart.
  const tapeJobs = jobs.filter((job) => job.video.tape != null);
  // Which of the tapes fetched are still here: one deleted since can be fetched again.
  const library = useLibraryTracks();
  const here = new Set(library.map((track) => track.id));

  if (!downloads) return (
    <View style={styles.unavailable}>
      <Text style={styles.heading}>{said.unavailable.heading}</Text>
      <Text style={styles.muted}>{said.unavailable.body}</Text>
    </View>
  );

  const sources = (
    <Segmented
      style={styles.sources}
      options={[
        { value: 'youtube', label: said.tapes.sources.youtube },
        { value: 'podcasts', label: said.tapes.sources.podcasts },
        { value: 'books', label: said.tapes.sources.books },
        { value: 'files', label: said.tapes.sources.files },
      ]}
      value={source}
      onChange={(next) => { stopSearch(); setSource(next); }}
    />
  );

  if (source === 'files') return (
    <View style={styles.screen}>
      <View style={styles.sourcesBox}>{sources}</View>
      <FilesPane />
    </View>
  );

  if (source === 'books') return (
    <View style={styles.screen}>
      <View style={styles.sourcesBox}>{sources}</View>
      <BooksPane />
    </View>
  );

  if (source === 'podcasts') return (
    <View style={styles.screen}>
      <View style={styles.sourcesBox}>{sources}</View>
      <PodcastsPane />
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.sourcesBox}>{sources}</View>
      <FlatList
        removeClippedSubviews={CLIP_SUBVIEWS}
        data={results.slice(0, 500)}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        ListHeaderComponent={<>
          {openedFrom ? (
            <Pressable android_ripple={pressed} accessibilityRole="button" hitSlop={8} style={styles.backLink} onPress={() => backTo(openedFrom)}>
              <Text style={styles.link}>{`‹ ${said.backToResults}`}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.intro}>{said.tapes.intro}</Text>
          <Segmented
            style={styles.kinds}
            options={[
              { value: 'videos', label: said.modes.videos },
              { value: 'playlist', label: said.modes.playlists },
            ]}
            value={kind}
            disabled={adding !== null}
            onChange={(next) => { stopSearch(); setOpenedFrom(null); setKind(next); setResults([]); setSearched(false); setMessage(null); }}
          />
          <View style={styles.searchRow}>
            <SearchField
              style={styles.input}
              accessibilityLabel={kind === 'playlist' ? said.inputLabel.playlist : said.inputLabel.videos}
              value={query}
              onChangeText={setQuery}
              placeholder={said.tapes.placeholder[kind]}
              maxLength={500}
              onSubmitEditing={() => void search()}
            />
            <Pressable android_ripple={pressed} accessibilityRole="button" style={[styles.searchButton, !query.trim() && styles.searchButtonOff]}
              disabled={!query.trim()} onPress={() => void search()}>
              <Text style={!query.trim() ? styles.darkTextOff : styles.darkText}>{t.common.search}</Text>
            </Pressable>
          </View>
          {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.note}>{message}</Text> : null}
          {searching ? <View style={styles.searching}>
            <ActivityIndicator color={c.text} /><Text style={styles.muted}>{said.searching}</Text>
            <Pressable android_ripple={pressed} accessibilityRole="button" onPress={stopSearch} style={styles.smallButton}><Text style={styles.link}>{t.common.cancel}</Text></Pressable>
          </View> : null}
          {results.length ? <Text accessibilityRole="header" style={styles.section}>{t.format.upper(said.results(Math.min(results.length, 500)))}</Text> : null}
          {inList ? <>
            <Pressable android_ripple={pressed} accessibilityRole="button" disabled={adding !== null}
              style={[styles.batch, adding !== null && styles.disabled]} onPress={() => void addTapes(listed, listName, 1, 'playlist')}>
              <Text style={styles.batchLabel}>{adding === 'playlist' ? said.addingPlaylist : said.tapes.downloadBook(listed.length)}</Text>
            </Pressable>
            <Text style={styles.hint}>{said.tapes.bookHint}</Text>
          </> : null}
        </>}
        ListEmptyComponent={!searching ? <View style={styles.empty}>
          <Text style={styles.emptyText}>{searched ? said.empty.none : said.tapes.empty[kind]}</Text>
        </View> : null}
        renderItem={({ item }) => {
          const playlist = item.kind === 'playlist';
          const job = playlist ? undefined : jobForVideo(tapeJobs, item.id);
          const locked = job && (isActive(job) || (job.status === 'done' && job.trackId != null && here.has(job.trackId)));
          const thumbnail = item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} contentFit="cover" /> : <View style={[styles.thumbnail, styles.thumbnailEmpty]} />;
          const named = <>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.muted} numberOfLines={1}>{[item.channel, playlist ? said.playlist : durationLabel(item.duration)].filter(Boolean).join(' · ')}</Text>
          </>;
          if (playlist) {
            return <Pressable android_ripple={pressed} accessibilityRole="button" accessibilityLabel={said.openPlaylistLabel(item.title)}
              disabled={adding !== null} style={styles.result}
              onPress={() => {
                setOpenedFrom({ query, results });
                void search(item.url, true);
              }}>
              {thumbnail}
              <View style={styles.flex}>
                {named}
                <View style={styles.downloadButton}><Text style={styles.link}>{said.openPlaylist}</Text></View>
              </View>
            </Pressable>;
          }
          return <View style={styles.result}>
            {thumbnail}
            <View style={styles.flex}>
              {named}
              <Pressable android_ripple={pressed} accessibilityRole="button" accessibilityLabel={said.downloadLabel(item.title)}
                disabled={!!locked || adding !== null} style={[styles.downloadButton, locked && styles.disabled]}
                onPress={() => {
                  // One of a list fetched on its own is still that list's, in its place.
                  const at = listed.indexOf(item);
                  if (inList && item.sourcePlaylist && at >= 0) void addTapes([item], listName, at + 1, item.id);
                  else void addTapes([item], item.channel || item.title, null, item.id);
                }}>
                <Text style={styles.link}>{adding === item.id ? said.adding : locked && job ? statusLabel(job, t) : said.tapes.download}</Text>
              </Pressable>
            </View>
          </View>;
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  content: { padding: 20, paddingTop: 12 },
  sourcesBox: { paddingHorizontal: 20, paddingTop: 12 },
  sources: {},
  flex: { flex: 1, gap: 5 },
  heading: { color: c.text, fontSize: 25, fontWeight: '600', marginBottom: 8 },
  intro: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  kinds: { marginBottom: 14 },
  title: { color: c.text, fontSize: 14, fontWeight: '500' },
  muted: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
  hint: { color: c.textFaint, fontSize: 11.5, lineHeight: 17, marginTop: 10, marginBottom: 4 },
  note: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 10 },
  searchRow: { flexDirection: 'row', gap: 8 },
  backLink: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  input: { flex: 1, minWidth: 0, borderRadius: 12, minHeight: 48 },
  searchButton: { backgroundColor: c.primary, paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center', minHeight: 48, ...outlined(c, c.primary) },
  searchButtonOff: { backgroundColor: c.surfaceRaised, ...outlined(c) },
  darkTextOff: { color: c.textDisabled, fontWeight: '600' },
  darkText: { color: c.onPrimary, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  batch: { backgroundColor: c.surface, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginTop: 4, ...outlined(c) },
  batchLabel: { color: c.text, fontSize: 13.5, fontWeight: '600' },
  searching: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  smallButton: { padding: 12, minHeight: 44, justifyContent: 'center' },
  link: { color: c.text, fontSize: 13, fontWeight: '500' },
  section: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 16, marginBottom: 10, marginLeft: 4 },
  result: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  thumbnail: { width: 112, height: 76, borderRadius: 8 },
  thumbnailEmpty: { backgroundColor: c.surfaceRaised },
  downloadButton: { alignSelf: 'flex-start', paddingVertical: 12, minHeight: 44 },
  empty: { paddingTop: 22, paddingBottom: 4, alignItems: 'center' },
  emptyText: { color: c.textFaint, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  unavailable: { flex: 1, ...scene(c), padding: 24, justifyContent: 'center', gap: 10 },
}));
