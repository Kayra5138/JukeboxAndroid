import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image } from '../components/Picture';
import { Pressable } from '../components/Pressable';
import { NumberStepper } from '../components/NumberStepper';
import { Switch } from '../components/Switch';
import { useT } from '../lib/i18n/index';
import { episodeId, newestFirst, type Episode, type Show } from '../lib/podcasts/episodes';
import { fetchShow } from '../lib/podcasts/feed';
import { dropWaiting, fetchEpisodes, follow, refreshShow } from '../lib/podcasts/refresh';
import { KEEP_RANGE, savedEpisodes, setAutoDownload, setFetchNext, setKeep, setNextCount, subscription, unsubscribe, type Subscription } from '../lib/podcasts/store';
import { makeStyles, outlined, outlinedClip, scene, switchColours, useColours, usePressed } from '../lib/theme/index';
import { haptic } from '../lib/ui/haptics';
import { useTrackMenu } from '../components/useTrackMenu';
import { PressRing } from '../components/PressMenu';
import { useTrackRing } from '../components/trackRing';
import { libraryState, refreshLibrary } from '../lib/library/index';
import { useLibraryTracks } from '../lib/library/useLibrary';
import { folderKey } from '../lib/media/folders';
import type { EnrichedTrack } from '../lib/media/merge';
import { usePlayerActions, usePlayerState } from '../lib/player/PlayerProvider';
import { schedulePodcasts } from '../lib/podcasts/background';
import { fetchNextAfter } from '../lib/podcasts/next';
import { seriesFolderOf } from '../lib/podcasts/series';
import { episodesWhen, yearsOf, type Order, type When } from '../lib/podcasts/when';
import { inSeriesOrder, nextToPlay } from '../lib/tapes/order';
import { PauseIcon, PlayIcon } from '../components/Icons';
import { progressOf, useTapePlaces } from '../lib/tapes/places';
import { CLIP_SUBVIEWS } from '../lib/ui/lists';
import { useDownloadLibraryRevision, useDownloads } from '../lib/youtube/DownloadsProvider';
import { durationLabel, isActive, jobForVideo, statusLabel } from '../lib/youtube/types';



/**
 * One podcast: what it is, whether it is followed and how, and its episodes,
 * each of which can be fetched as a tape into the podcast's folder of the
 * Tapes folder. Opened from the podcasts of the Add tapes screen.
 *
 * Its feed is read as the screen opens; for a podcast already followed, what
 * was last read of it is shown meanwhile, and stands in for it offline.
 */
export default function PodcastScreen() {
  const { feed } = useLocalSearchParams<{ feed: string }>();
  const feedUrl = feed ?? '';
  const { jobs, refresh } = useDownloads();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const insets = useSafeAreaInsets();
  const said = t.search.tapes.podcasts;
  const [followed, setFollowed] = useState<Subscription | null>(() => subscription(feedUrl));
  const [show, setShow] = useState<Show | null>(() => subscription(feedUrl));
  const [episodes, setEpisodes] = useState<Episode[]>(() => savedEpisodes(feedUrl));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  /*
    Its episodes that are here, as tapes in the library: played from here, in
    the order they came out, from the one pressed; held, the tape's menu.
  */
  const library = useLibraryTracks();
  // Opened straight from a link, before any screen has read the library: read it now.
  useEffect(() => {
    if (libraryState().kind !== 'library') void refreshLibrary();
  }, []);
  // And again as each part fetched from here arrives, so it is there to play without leaving and coming back.
  const arrived = useDownloadLibraryRevision();
  useEffect(() => {
    if (arrived > 0) void refreshLibrary();
  }, [arrived]);
  const places = useTapePlaces();
  const { playQueue, toggle } = usePlayerActions();
  const { current, playWhenReady } = usePlayerState();
  const menu = useTrackMenu({});
  // A part held and slid from, with the finger never lifted: see `pressMenu.ts`.
  const ring = useTrackRing(menu);
  // The folder it was followed under, should the show have renamed itself since.
  const folder = followed ? seriesFolderOf(followed) : show ? seriesFolderOf(show) : null;
  const here = useMemo(
    () => (folder ? library.filter((track) => folderKey(track.folder ?? '').toLocaleLowerCase() === folder) : []),
    [folder, library]
  );
  const byId = useMemo(() => new Map(here.map((track) => [track.id, track])), [here]);
  // Its episodes here in the order they go, oldest first, and the one a press carries it on with.
  const inOrder = useMemo(() => inSeriesOrder(here), [here]);
  const next = nextToPlay(inOrder, places);
  const nextPlace = next ? (places.get(next.id) ?? null) : null;
  const nextProgress = progressOf(nextPlace);
  const [more, setMore] = useState(false);
  // Which episodes the list shows, by when they came out, and which end first.
  const [when, setWhen] = useState<When>('all');
  const [order, setOrder] = useState<Order>('newest');
  const shown = useMemo(() => episodesWhen(episodes, when, order), [episodes, when, order]);
  const years = useMemo(() => yearsOf(episodes), [episodes]);
  // The episode the card offers is the one playing: its button pauses it and plays it on, in place.
  const nextIsOn = next != null && current?.id === next.id;
  const play = (track: EnrichedTrack) => {
    // The one playing is played on where it is, if it was paused, rather than put on again.
    if (track.id === current?.id) {
      if (!playWhenReady) void toggle();
      return;
    }
    const tracks = inOrder;
    const index = Math.max(0, tracks.findIndex((one) => one.id === track.id));
    haptic('player', 'click');
    void playQueue(tracks, index);
  };

  useEffect(() => {
    let gone = false;
    void (async () => {
      try {
        const read = await fetchShow(feedUrl);
        if (gone) return;
        setShow(read);
        setEpisodes(newestFirst(read.episodes));
      } catch {
        if (!gone) setFailed(true);
      }
      if (!gone) setLoading(false);
    })();
    return () => {
      gone = true;
    };
  }, [feedUrl]);

  const reread = () => setFollowed(subscription(feedUrl));

  /*
    A setting changed is acted on at once rather than at the next reading,
    six hours on: the newest fetched up to the number now kept, or the ones
    after the episode last listened to. A moment after the last press, so a
    number stepped through from 3 to 7 is one look and not four.
  */
  const soon = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (soon.current) clearTimeout(soon.current);
  }, []);
  const catchUp = (what: 'newest' | 'next') => {
    if (soon.current) clearTimeout(soon.current);
    soon.current = setTimeout(() => {
      const now = subscription(feedUrl);
      if (!now) return;
      if (what === 'newest') {
        if (now.autoDownload) void refreshShow(now).then(() => refresh(true)).catch(() => {});
        return;
      }
      if (!now.fetchNext) return;
      // The one playing, if it is of this show; else the one listened to last.
      const last =
        here.find((track) => track.id === current?.id) ??
        [...here].sort((a, b) => (places.get(b.id)?.at ?? 0) - (places.get(a.id)?.at ?? 0))[0];
      if (last) void fetchNextAfter(last.id).then(() => refresh(true));
    }, 1200);
  };

  const toggleFollow = async () => {
    if (!show || busy) return;
    setBusy('follow');
    try {
      if (followed) {
        // What it was fetching by itself and has not begun goes with it.
        void dropWaiting(followed.folder);
        unsubscribe(feedUrl);
        haptic('choices', 'toggleOff');
        void schedulePodcasts();
      } else {
        await follow(feedUrl, { ...show, episodes });
        haptic('results', 'confirm');
        void schedulePodcasts();
        void refresh(true);
      }
    } catch {
      haptic('results', 'reject');
    }
    reread();
    setBusy(null);
  };

  const fetchOne = async (episode: Episode) => {
    if (!show || busy) return;
    setBusy(episode.guid);
    try {
      await fetchEpisodes(feedUrl, show, [episode]);
      haptic('results', 'confirm');
      await refresh(true);
    } catch {
      haptic('results', 'reject');
    }
    setBusy(null);
  };

  const dateOf = (ms: number | null) => (ms == null ? '' : new Date(ms).toLocaleDateString());

  return (
    <View style={styles.screen}>
      <FlatList
        removeClippedSubviews={CLIP_SUBVIEWS}
        data={shown}
        keyExtractor={(episode) => episode.guid}
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        ListHeaderComponent={
          <>
            <View style={styles.head}>
              {show?.image ? <Image source={{ uri: show.image }} style={styles.cover} contentFit="cover" /> : <View style={[styles.cover, styles.coverEmpty]} />}
              <View style={styles.headText}>
                <Text style={styles.title} numberOfLines={3}>{show?.title ?? feedUrl}</Text>
                {show?.author ? <Text style={styles.muted} numberOfLines={2}>{show.author}</Text> : null}
                {episodes.length > 0 ? <Text style={styles.stats}>{said.stats(episodes.length, here.length)}</Text> : null}
              </View>
            </View>
            {show?.summary ? (
              // The whole of what the show says of itself, a press away.
              <Pressable accessibilityRole="button" onPress={() => setMore(!more)} disabled={show.summary.length < 160}>
                <Text style={styles.summary} numberOfLines={more ? undefined : 3}>{show.summary}</Text>
                {show.summary.length >= 160 ? <Text style={styles.more}>{more ? said.less : said.more}</Text> : null}
              </Pressable>
            ) : null}
            {/*
              Carried on at one press: the episode part way through, or the
              newest not heard, with how far in it is and how long is left.
            */}
            {next ? (
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityLabel={`${nextIsOn && playWhenReady ? t.common.pause : nextProgress != null ? said.continue : said.start}, ${next.title}`}
                style={styles.continue}
                onPress={() => (nextIsOn ? void toggle() : play(next))}>
                <View style={styles.continueText}>
                  <Text style={styles.continueLabel}>{t.format.upper(nextProgress != null ? said.continue : said.start)}</Text>
                  <Text style={styles.continueTitle} numberOfLines={2}>{next.title}</Text>
                  {nextProgress != null && nextPlace ? (
                    <>
                      <View style={styles.continueTrack}>
                        <View style={[styles.continueDone, { width: `${Math.round(nextProgress * 100)}%` }]} />
                      </View>
                      <Text style={styles.muted}>{t.library.tapes.left(Math.max(1, Math.round((nextPlace.durationSec - nextPlace.positionSec) / 60)))}</Text>
                    </>
                  ) : (
                    <Text style={styles.muted}>{durationLabel(next.durationSec)}</Text>
                  )}
                </View>
                <View style={styles.continuePlay}>
                  {nextIsOn && playWhenReady ? <PauseIcon size={26} color={c.onPrimary} /> : <PlayIcon size={26} color={c.onPrimary} />}
                </View>
              </Pressable>
            ) : null}
            {show ? (
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                disabled={busy === 'follow'}
                style={[styles.follow, followed && styles.followOn]}
                onPress={() => void toggleFollow()}>
                <Text style={followed ? styles.followLabelOn : styles.followLabel}>{followed ? said.unfollow : said.follow}</Text>
              </Pressable>
            ) : null}
            {show && !followed && episodes.length > 0 ? <Text style={styles.without}>{said.withoutFollowing}</Text> : null}
            {followed ? (
              <View style={styles.card}>
                <View style={styles.line}>
                  <Text style={styles.rowTitle}>{said.autoDownload}</Text>
                  <Switch
                    accessibilityLabel={said.autoDownload}
                    value={followed.autoDownload}
                    onValueChange={(on) => {
                      setAutoDownload(feedUrl, on);
                      if (!on && !followed.fetchNext) void dropWaiting(followed.folder);
                      reread();
                      void schedulePodcasts();
                      if (on) catchUp('newest');
                    }}
                    {...switchColours(c, followed.autoDownload)}
                  />
                </View>
                {followed.autoDownload ? (
                  <>
                    <NumberStepper
                      name={said.autoDownload}
                      range={KEEP_RANGE}
                      value={followed.keep}
                      onChange={(keep) => {
                        setKeep(feedUrl, keep);
                        reread();
                        catchUp('newest');
                      }}
                    />
                    <Text style={styles.muted}>{said.autoDownloadNote(followed.keep)}</Text>
                  </>
                ) : null}
                {/* Beside it: the ones after the episode being heard, for working through the show from older ones. */}
                <View style={styles.cardRule} />
                <View style={styles.line}>
                  <Text style={styles.rowTitle}>{said.fetchNext}</Text>
                  <Switch
                    accessibilityLabel={said.fetchNext}
                    value={followed.fetchNext}
                    onValueChange={(on) => {
                      setFetchNext(feedUrl, on);
                      reread();
                      if (on) catchUp('next');
                    }}
                    {...switchColours(c, followed.fetchNext)}
                  />
                </View>
                {followed.fetchNext ? (
                  <NumberStepper
                    name={said.fetchNext}
                    range={KEEP_RANGE}
                    value={followed.nextCount}
                    onChange={(count) => {
                      setNextCount(feedUrl, count);
                      reread();
                      catchUp('next');
                    }}
                  />
                ) : null}
                <Text style={styles.muted}>{said.fetchNextNote(followed.nextCount)}</Text>
              </View>
            ) : null}
            {loading && episodes.length === 0 ? <ActivityIndicator style={styles.loading} color={c.text} /> : null}
            {failed && episodes.length === 0 ? <Text style={styles.bad}>{said.feedFailed}</Text> : null}
            {episodes.length > 0 ? (
              <>
                <Text accessibilityRole="header" style={styles.section}>{t.format.upper(said.episodes(shown.length))}</Text>
                {/*
                  Sideways, as the years run on as far back as the show
                  does: which end first, then the latest weeks and months,
                  then each year it has episodes in.
                */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsOut} contentContainerStyle={styles.chips}>
                  <Pressable
                    android_ripple={pressed}
                    accessibilityRole="button"
                    style={styles.chip}
                    onPress={() => setOrder(order === 'newest' ? 'oldest' : 'newest')}>
                    <Text style={styles.chipLabel}>{`⇅ ${order === 'newest' ? said.newest : said.oldest}`}</Text>
                  </Pressable>
                  {([
                    ['all', said.when.all],
                    ['week', said.when.week],
                    ['month', said.when.month],
                    ['quarter', said.when.quarter],
                    ...years.map((year) => [`year:${year}`, String(year)] as const),
                  ] as const).map(([value, label]) => (
                    <Pressable
                      key={value}
                      android_ripple={pressed}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: when === value }}
                      style={[styles.chip, when === value && styles.chipOn]}
                      onPress={() => setWhen(value as When)}>
                      <Text style={when === value ? styles.chipLabelOn : styles.chipLabel}>{label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !loading && !failed ? <Text style={styles.muted}>{episodes.length > 0 ? said.noneThen : said.noEpisodes}</Text> : null
        }
        renderItem={({ item }) => {
          const job = jobForVideo(jobs, episodeId(feedUrl, item.guid));
          const track = job?.status === 'done' && job.trackId ? byId.get(job.trackId) : undefined;
          if (track) {
            const place = places.get(track.id) ?? null;
            const progress = progressOf(place);
            const state = place?.finished
              ? t.library.tapes.played
              : progress != null && place
                ? t.library.tapes.left(Math.max(1, Math.round((place.durationSec - place.positionSec) / 60)))
                : durationLabel(track.durationSec);
            return (
              <PressRing ring={ring} item={track}>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                style={styles.episode}
                onPress={() => play(track)}
                onLongPress={() => {
                  haptic('holds', 'hold');
                  menu.open(track);
                }}>
                <View style={styles.episodeText}>
                  <Text style={styles.episodeTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.muted}>{said.line(dateOf(item.publishedAt), durationLabel(item.durationSec))}</Text>
                  {item.summary ? <Text style={styles.episodeSummary} numberOfLines={2}>{item.summary}</Text> : null}
                </View>
                <Text style={[styles.state, place?.finished && styles.stateHeard]}>{state}</Text>
              </Pressable>
              </PressRing>
            );
          }
          // Fetched and here is the row above, to play; fetched and deleted since, or never, it can be fetched (again).
          // Just fetched, the library has yet to be read again, and it is not asked for twice meanwhile.
          const locked = job != null && (isActive(job) || (job.status === 'done' && (job.finishedAt ?? 0) > Date.now() - 30_000));
          return (
            <View style={styles.episode}>
              <View style={styles.episodeText}>
                <Text style={styles.episodeTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.muted}>{said.line(dateOf(item.publishedAt), durationLabel(item.durationSec))}</Text>
                {item.summary ? <Text style={styles.episodeSummary} numberOfLines={2}>{item.summary}</Text> : null}
              </View>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityLabel={`${said.download} ${item.title}`}
                disabled={locked || busy != null}
                style={[styles.download, locked && styles.disabled]}
                onPress={() => void fetchOne(item)}>
                <Text style={styles.link}>{busy === item.guid ? said.download : locked && job ? statusLabel(job, t) : said.download}</Text>
              </Pressable>
            </View>
          );
        }}
      />
      {menu.element}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  content: { padding: 20, gap: 0 },
  head: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  cover: { width: 112, height: 112, borderRadius: 12 },
  coverEmpty: { backgroundColor: c.surfaceRaised },
  headText: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: c.text, fontSize: 19, fontWeight: '600' },
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  summary: { color: c.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 14 },
  stats: { color: c.textFaint, fontSize: 12, marginTop: 2 },
  more: { color: c.accent, fontSize: 12.5, fontWeight: '600', marginTop: 4 },
  continue: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: c.surface,
    ...outlinedClip(c),
  },
  continueText: { flex: 1, minWidth: 0, gap: 4 },
  continueLabel: { color: c.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  continueTitle: { color: c.text, fontSize: 15.5, fontWeight: '600' },
  continueTrack: { height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden', marginTop: 4 },
  continueDone: { height: 4, backgroundColor: c.accent },
  continuePlay: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  episodeSummary: { color: c.textFaint, fontSize: 12, lineHeight: 17 },
  follow: { marginTop: 16, alignSelf: 'flex-start', paddingHorizontal: 20, minHeight: 44, borderRadius: 22, justifyContent: 'center', backgroundColor: c.primary, ...outlined(c, c.primary) },
  without: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 4 },
  followOn: { backgroundColor: c.surfaceRaised, ...outlined(c) },
  followLabel: { color: c.onPrimary, fontSize: 14.5, fontWeight: '600' },
  followLabelOn: { color: c.text, fontSize: 14.5, fontWeight: '600' },
  card: { marginTop: 16, padding: 16, gap: 10, borderRadius: 14, backgroundColor: c.surface, ...outlined(c) },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { color: c.text, fontSize: 15, flexShrink: 1 },
  loading: { marginTop: 24 },
  bad: { color: c.danger, fontSize: 13, marginTop: 16 },
  chipsOut: { marginHorizontal: -20, marginBottom: 6 },
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 4 },
  chip: { backgroundColor: c.surfaceRaised, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, overflow: 'hidden', ...outlinedClip(c) },
  chipOn: { backgroundColor: c.primary, ...outlinedClip(c, c.primary) },
  chipLabel: { color: c.textSecondary, fontSize: 13 },
  chipLabelOn: { color: c.onPrimary, fontSize: 13 },
  cardRule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 6 },
  section: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 24, marginBottom: 6, marginLeft: 4 },
  episode: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  episodeText: { flex: 1, minWidth: 0, gap: 3 },
  episodeTitle: { color: c.text, fontSize: 14.5 },
  download: { paddingHorizontal: 4, minHeight: 44, justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  link: { color: c.text, fontSize: 13, fontWeight: '500' },
  state: { color: c.textFaint, fontSize: 12, fontVariant: ['tabular-nums'] },
  stateHeard: { color: c.accent },
}));
