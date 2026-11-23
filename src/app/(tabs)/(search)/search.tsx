import { BlurArea, Frost, GlassScene, useFrosted, useOwnScene } from '../../../components/Frosted';
import { Note } from '../../../components/Note';
import { ScreenState } from '../../../components/ScreenState';
import { SectionLabel } from '../../../components/settings/rows';
import { SearchField, type SearchBox } from '../../../components/SearchField';
import { Button, TextButton } from '../../../components/Button';
import { jobState, Searching, VideoRow } from '../../../components/downloads/VideoResults';
import { DownloadIcon, PlayIcon } from '../../../components/Icons';
import { usePageSides, WithNowPlaying } from '../../../components/NowPlayingBar';
import { BarsOver, topGlass, useLaidOver, useUnderBars } from '../../../components/UnderBars';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DiscoverPanel } from '../../../components/DiscoverPanel';
import { QueueLink } from '../../../components/downloads/QueueLink';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';
import { Segmented } from '../../../components/Segmented';
import { useT } from '../../../lib/i18n/index';
import { makeStyles, scene } from '../../../lib/theme/index';
import { LEADING, SPACE, TYPE } from '../../../lib/theme/measures';
import { useLandscape } from '../../../lib/ui/layout';
import { useColumnsInSight, useTabOpen } from '../../../lib/ui/tabOpen';
import { youtubeError } from '../../../lib/youtube/errors';
import { noteError } from '../../../lib/support/errorLogStore';
import { downloads } from '../../../lib/youtube/native';
import { useDownloads } from '../../../lib/youtube/DownloadsProvider';
import { isActive, isListenJob, jobForVideo, statusLabel, type AudioFormat, type YouTubeVideo, type YouTubeResult } from '../../../lib/youtube/types';
import { ownedVideos } from '../../../lib/youtube/owned';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import { CLIP_SUBVIEWS, LIST_WINDOW } from '../../../lib/ui/lists';
import { useBackInFront } from '../../../lib/ui/back';
import { haptic } from '../../../lib/ui/haptics';
import { listening, listenTo } from '../../../lib/listen/index';
import { useTopOnReselect } from '../../../lib/ui/tabReselect';

const cache = new Map<string, { at: number; videos: YouTubeResult[] }>();

/** A playlist's entries or a search's results, whichever the tab is on. Only asked for where there is a build to ask. */
const lookUp = (playlist: boolean, text: string, id: string) =>
  playlist ? downloads!.playlistAsync(text, id) : downloads!.searchAsync(text, id);

export default function YouTubeScreen() {
  const { jobs: jobsNow, error, refresh, enqueue, enqueueBatch } = useDownloads();
  /*
    The downloads as they were when the tab was last open, while it is not:
    told of them every second something downloads, the whole tab was drawn
    again behind whichever one was in sight.
  */
  const open = useTabOpen();
  const [jobsSeen, setJobsSeen] = useState(jobsNow);
  if (open && jobsSeen !== jobsNow) setJobsSeen(jobsNow);
  const jobs = open ? jobsNow : jobsSeen;
  const downloadJobs = jobs.filter((job) => !isListenJob(job));
  const listenJobs = jobs.filter((job) => isListenJob(job));
  const listeningTo = useSyncExternalStore(listening.subscribe, listening.get);
  const libraryTracks = useLibraryTracks();
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  const sides = usePageSides();
  /*
    In a theme of glass the switches along the top are laid over what is
    below them, which runs on under them, and the bars at the foot over the
    foot of it: both lists keep clear of the two by that much.
  */
  // Upright, on up behind the clock: see `useLaidOver`.
  const top = useLaidOver({ clock: true });
  // The results out of focus behind the row of modes, where it is laid over them: see `Frosted`.
  const scene = useOwnScene();
  const frosted = useFrosted(top.laid ? scene.target : null);
  const under = useUnderBars({ player: true });
  const columns = useColumnsInSight();
  const t = useT();
  const styles = useStyles();
  const said = t.search;
  const params = useLocalSearchParams<{ mode?: string; q?: string; run?: string }>();
  const [mode, setMode] = useState<'discover' | 'videos' | 'playlist'>('discover');
  useEffect(() => { if (params.mode === 'discover') setMode('discover'); }, [params.mode]);
  const [query, setQuery] = useState('');
  // Its tab pressed again: back to the top of the results, and from there into the box.
  const searchBox = useRef<SearchBox>(null);
  const backUp = useTopOnReselect(() => searchBox.current?.focus());
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [format, setFormat] = useState<AudioFormat>('mp3');
  const [message, setMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const searchId = useRef<string | null>(null);
  const addingRef = useRef(false);
  useFocusEffect(useCallback(() => { void refresh(true); }, [refresh]));
  useEffect(() => () => {
    const id = searchId.current;
    searchId.current = null;
    if (id) void downloads?.cancelSearchAsync(id).catch(() => {});
  }, []);

  const stopSearch = () => {
    const id = searchId.current;
    searchId.current = null;
    setSearching(false);
    if (id) void downloads?.cancelSearchAsync(id).catch(() => {});
  };

  /*
    The results a list was opened from, to go back to. Opening a list is not a
    screen of its own — its songs take the results' place — so without this the
    back key left the tab altogether and the search was gone. Forgotten as soon
    as anything else is searched for, or the kind of search changes.
  */
  const [openedFrom, setOpenedFrom] = useState<{ query: string; results: YouTubeResult[] } | null>(null);

  // [as]: the mode searched in, where it is being set in the same breath and this drawing still has the one before.
  const search = async (override?: string, fromResults = false, as: typeof mode = mode) => {
    const text = (override ?? query).trim();
    if (override) setQuery(override);
    if (!fromResults) setOpenedFrom(null);
    if (!text || !downloads) return;
    stopSearch();
    Keyboard.dismiss();
    setMessage(null);
    setSearched(false);
    setResults([]);
    // By what is searched for and not by the tab: a search asked for from the library may come while Discover is the one open.
    const cacheKey = `${as === 'playlist' ? 'playlist' : 'videos'}:${text}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < 5 * 60_000) {
      setResults(cached.videos); setSearched(true); return;
    }
    const id = `search-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    searchId.current = id;
    setSearching(true);
    // Chosen out here: the React Compiler cannot yet read a choice made
    // inside a `try`, and leaves the whole screen alone for one.
    const playlist = as === 'playlist';
    try {
      const videos = await lookUp(playlist, text, id);
      // Superseded or stopped, and whoever did that has already tidied up.
      if (searchId.current !== id) return;
      if (cache.size >= 10) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, { at: Date.now(), videos });
      setResults(videos);
      setSearched(true);
    } catch (failure) {
      if (searchId.current === id) {
        setMessage(youtubeError(failure, said.failed.search, t));
        noteError('search', failure);
      }
    }
    // After the catch and not in a `finally`, which the React Compiler will
    // not compile a component for having. Nothing above is thrown onwards, so
    // it says the same thing; the one way out early does its own tidying.
    if (searchId.current === id) { searchId.current = null; setSearching(false); }
  };

  // A song another screen could not find a recording of, handed over to be
  // looked for by hand. Written into the box and left there: which of the
  // results is the right one is the part that needed a person. With [run] —
  // the library's search, which found nothing of its own worth stopping at —
  // it is searched for at once as well; [run] is new each time, so the same
  // words asked for twice are searched twice.
  useEffect(() => {
    if (!params.q) return;
    setMode('videos');
    setQuery(params.q);
    if (params.run) void search(params.q, false, 'videos');
  }, [params.q, params.run]);

  /** Back to the results [was], which the open list came from. */
  const backTo = (was: { query: string; results: YouTubeResult[] }) => {
    stopSearch();
    setOpenedFrom(null);
    setQuery(was.query);
    setResults(was.results);
    setSearched(true);
    setMessage(null);
  };

  // The back key does the same, while there is somewhere to go back to and this tab is in front.
  useBackInFront(openedFrom != null, () => {
    if (openedFrom) backTo(openedFrom);
  });

  const listen = async (video: YouTubeVideo) => {
    setMessage(null);
    try {
      await listenTo(video);
      haptic('results', 'confirm');
    } catch (failure) {
      haptic('results', 'reject');
      setMessage(youtubeError(failure, said.failed.queue, t));
    }
  };

  const add = async (video: YouTubeVideo, choice: AudioFormat = format) => {
    if (addingRef.current) return;
    addingRef.current = true;
    setAdding(video.id);
    setMessage(null);
    try {
      await enqueue(video, choice);
      haptic('results', 'confirm');
    }
    catch (failure) {
      haptic('results', 'reject');
      setMessage(youtubeError(failure, said.failed.queue, t));
    }
    addingRef.current = false;
    setAdding(null);
  };

  const addPlaylist = async () => {
    if (addingRef.current) return;
    const selected = results.slice(0, 500).filter((item): item is YouTubeVideo => item.kind !== 'playlist');
    if (!selected.length) return;
    addingRef.current = true;
    setAdding('playlist');
    setMessage(null);
    const name = selected[0].sourcePlaylist?.name ?? said.unnamedPlaylist;
    // What the library has already, from a computer or an older version, is put in the list and not fetched again.
    const here = ownedVideos(selected, libraryTracks);
    const done = here.size > 0 ? `${said.listCreated(name)} ${said.alreadyHave(here.size)}` : said.listCreated(name);
    try {
      await enqueueBatch(selected, format, here);
      haptic('results', 'confirm');
      setMessage(done);
    } catch (failure) {
      haptic('results', 'reject');
      setMessage(youtubeError(failure, said.failed.queuePlaylist, t));
    }
    addingRef.current = false;
    setAdding(null);
  };

  /** Which of the results the library has already, by a file no job of the queue's knows of. */
  const owned = ownedVideos(
    results.filter((item): item is YouTubeVideo => item.kind !== 'playlist'),
    libraryTracks
  );

  if (!downloads) return (
    <View style={styles.unavailable}>
      <ScreenState kind="empty" title={said.unavailable.heading} text={said.unavailable.body} />
    </View>
  );

  return (
    <WithNowPlaying style={styles.screen}>
    <View style={[styles.inside, { paddingTop: landscape || top.clock > 0 ? 0 : insets.top, paddingLeft: sides.left, paddingRight: sides.right }]}>
      <GlassScene scene={scene}>
      <View
        style={[
          styles.modeRow,
          // Sideways, hard under the strip across the top, with the little room under it inside: no band of another colour between.
          landscape && { paddingTop: insets.top + SPACE.s },
          top.clock > 0 && { paddingTop: top.clock + SPACE.m },
          top.laid && [styles.modeRowOver, { top: landscape || top.clock > 0 ? 0 : insets.top, left: sides.left, right: sides.right }],
          frosted && styles.clear,
        ]}
        onLayout={top.onLayout}>
        {frosted && scene.target ? <Frost target={scene.target} edge="bottom" /> : null}
        {/*
          A tab apart from the two beside it, standing for a screen of its own
          rather than a way of searching: a tray of its own, marked while it is
          open, the size of the two it stands with.
        */}
        <Segmented
          role="tab"
          // As wide as its word: alone in its tray, sharing the row would have it take all of it.
          layout="fit"
          options={[{ value: 'discover', label: said.modes.discover }]}
          value={mode === 'discover' ? 'discover' : null}
          onChange={() => { stopSearch(); setOpenedFrom(null); setMode('discover'); }}
        />
        <View style={styles.downloadModes}>
          <Text style={styles.downloadHeading}>{said.modes.download}</Text>
          {/*
            One tray with the choices inside it, rather than a row of separate
            pills: two pills side by side read as two buttons that happen to be
            near each other, and one tray as one setting with two positions.
            Without a mark while Discover is open, since neither is.
          */}
          <Segmented
            role="tab"
            options={[
              { value: 'videos', label: said.modes.videos },
              { value: 'playlist', label: said.modes.playlists },
            ]}
            value={mode === 'discover' ? null : mode}
            disabled={adding !== null}
            onChange={(choice) => { stopSearch(); setOpenedFrom(null); setMode(choice); setResults([]); setSearched(false); setMessage(null); }}
          />
        </View>
      </View>
      {/* What scrolls under the row of modes, which blurs it: see `Frosted`. */}
      <BlurArea style={styles.fill}>
      <BarsOver top={top.height}>
      {mode === 'discover' ? <DiscoverPanel /> : <FlatList
              removeClippedSubviews={CLIP_SUBVIEWS}
              windowSize={LIST_WINDOW}
        {...backUp}
        data={results.slice(0, 500)}
        // Remounted when the count changes: a list will not take a new
        // numColumns in place, and turning the phone is when it changes.
        key={columns}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.resultColumns : undefined}
        keyExtractor={(video) => video.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: SPACE.l + top.height, paddingBottom: 32 + under.bottom }]}
        ListHeaderComponent={<>
          {openedFrom ? (
            <TextButton label={`‹ ${said.backToResults}`} size="body" onPress={() => backTo(openedFrom)} style={styles.backLink} />
          ) : null}
          <Text style={styles.intro}>{mode === 'playlist' ? said.intro.playlist : said.intro.videos}</Text>
          {/* The library's own box, cross and all. */}
          <SearchField
            ref={searchBox}
            accessibilityLabel={mode === 'playlist' ? said.inputLabel.playlist : said.inputLabel.videos}
            value={query}
            onChangeText={setQuery}
            placeholder={mode === 'playlist' ? said.placeholder.playlist : said.placeholder.videos}
            maxLength={500}
            go={{ label: t.common.search, onPress: () => void search() }}
          />
          <Segmented
            style={styles.formats}
            options={(['mp3', 'original'] as const).map((choice) => ({ value: choice, label: said.formats[choice] }))}
            value={format}
            onChange={setFormat}
          />
          <Text style={styles.hint}>{said.formatHint[format]}</Text>
          {message || error ? <Note tone="bad" style={styles.bad}>{message ?? youtubeError(error, said.failed.readReopen, t)}</Note> : null}
          {searching ? <Searching onCancel={stopSearch} /> : null}
          {results.length ? <SectionLabel>{said.results(Math.min(results.length, 500))}</SectionLabel> : null}
          {mode === 'playlist' && results.length > 0 && results[0].kind !== 'playlist' ? <>
            <Button kind="secondary" label={adding === 'playlist' ? said.addingPlaylist : said.downloadListed[format]} disabled={adding !== null} onPress={() => void addPlaylist()} style={styles.batch} />
            <Text style={styles.hint}>{said.listedHint}</Text>
          </> : null}
        </>}
        // The queue has a screen of its own; this is the way to it.
        ListFooterComponent={<QueueLink />}
        ListEmptyComponent={!searching ? <ScreenState kind="empty" text={searched ? said.empty.none : mode === 'playlist' ? said.empty.playlist : said.empty.videos} /> : null}
        renderItem={({ item }) => {
          const playlist = item.kind === 'playlist';
          // A song listened to has a job of its own, which says nothing of whether it is in the library.
          const job = playlist ? undefined : jobForVideo(downloadJobs, item.id);
          // The newest: the jobs come newest first, and a Listen asked for again is the one getting ready.
          const heard = playlist ? undefined : listenJobs.find((one) => one.video.id === item.id);
          const readying = heard != null && (isActive(heard) || listeningTo?.jobId === heard.id);
          // In the library already, by a file that came some other way: see `owned.ts`.
          const have = !playlist && !job && owned.has(item.id);
          const locked = have || (job && (isActive(job) || job.status === 'done'));
          if (playlist) {
            return <VideoRow video={item} shared={columns > 1} openDisabled={adding !== null}
              onOpen={() => {
                setOpenedFrom({ query, results });
                void search(item.url, true);
              }} />;
          }
          // How each stands, said after what it is: the marks alone say only what can be done.
          const listening = readying ? (heard && heard.status === 'downloading' ? statusLabel(heard, t) : said.readying) : null;
          const fetching = adding === item.id ? said.adding : have ? said.inLibrary : locked && job ? statusLabel(job, t) : null;
          return <VideoRow video={item} shared={columns > 1} actions={[
            // Heard at once, kept only if kept: see `lib/listen`. Not for one in the library already.
            ...(have ? [] : [{
              icon: PlayIcon,
              accessibilityLabel: listening ? `${said.listenLabel(item.title)} · ${listening}` : said.listenLabel(item.title),
              ...(readying ? { state: 'busy' as const, percent: heard?.status === 'downloading' ? heard.progress : undefined } : {}),
              onPress: () => void listen(item),
            }]),
            {
              icon: DownloadIcon,
              accessibilityLabel: fetching ? `${said.downloadLabel(item.title)} · ${fetching}` : said.downloadLabel(item.title),
              ...(adding === item.id ? { state: 'busy' as const } : have ? { state: 'done' as const } : locked ? jobState(job) : {}),
              disabled: !!locked || adding !== null,
              onPress: () => void add(item),
            },
          ]} />;
        }}
      />}
      </BarsOver>
      </BlurArea>
      </GlassScene>
    </View>
    </WithNowPlaying>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  modeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.xl, paddingHorizontal: SPACE.l, paddingTop: SPACE.m, paddingBottom: SPACE.xs },
  // Laid over the list in a theme of glass, with a little more room above its edge.
  modeRowOver: { ...topGlass(c), paddingBottom: SPACE.s },
  /** Its fill left to `Frost`, which draws it over the blur. */
  clear: { backgroundColor: 'transparent' },
  fill: { flex: 1 },
  downloadModes: { flex: 1, maxWidth: 270, marginLeft: 'auto', gap: SPACE.xs },
  downloadHeading: { color: c.textFaint, fontSize: TYPE.label, textAlign: 'center', letterSpacing: 1 },
  screen: { flex: 1, ...scene(c) },
  inside: { flex: 1 },
  resultColumns: { gap: SPACE.s },
  content: { padding: SPACE.l, paddingBottom: 32 },
  intro: { color: c.textMuted, fontSize: TYPE.small, lineHeight: LEADING.small, marginTop: SPACE.m, marginBottom: SPACE.l },
  hint: { color: c.textFaint, fontSize: TYPE.label, lineHeight: 17, marginTop: SPACE.s, marginBottom: SPACE.xs },
  bad: { marginVertical: SPACE.s },
  backLink: { marginBottom: SPACE.s },
  formats: { marginTop: SPACE.m },
  batch: { marginTop: SPACE.xs },
  unavailable: { flex: 1, ...scene(c), padding: SPACE.xl, justifyContent: 'center', gap: SPACE.s },
}));
