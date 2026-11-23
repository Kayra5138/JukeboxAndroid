import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, TextButton } from '../../../components/Button';
import { Segmented } from '../../../components/Segmented';
import { ConfirmSheet } from '../../../components/ConfirmSheet';
import { ContinueCard, HeadCover, HeadNote, MediaHead, MediaPage, SectionLabel } from '../../../components/MediaPage';
import { MediaRow } from '../../../components/MediaRow';
import { MenuCard } from '../../../components/MenuPage';
import { MenuEntry, MenuHeader } from '../../../components/MenuSheet';
import { DownloadIcon } from '../../../components/Icons';
import { useRows } from '../../../components/settings/rows';
import { NumberStepper } from '../../../components/NumberStepper';
import { Switch } from '../../../components/Switch';
import { useT } from '../../../lib/i18n/index';
import { episodeId, newestFirst, type Episode, type Show } from '../../../lib/podcasts/episodes';
import { fetchShow } from '../../../lib/podcasts/feed';
import { hostOf, isPrivateAddress } from '../../../lib/links/late';
import { dropWaiting, fetchEpisodes, follow, refreshShow } from '../../../lib/podcasts/refresh';
import { KEEP_RANGE, savedEpisodes, setAutoDownload, setFetchNext, setKeep, setNextCount, subscription, unsubscribe, type Subscription } from '../../../lib/podcasts/store';
import { makeStyles } from '../../../lib/theme/index';
import { LEADING, SPACE, TYPE } from '../../../lib/theme/measures';
import { haptic } from '../../../lib/ui/haptics';
import { useTrackMenu } from '../../../components/useTrackMenu';
import { PressRing } from '../../../components/PressMenu';
import { useTrackRing } from '../../../components/trackRing';
import { libraryState, refreshLibrary } from '../../../lib/library/index';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import { folderKey } from '../../../lib/media/folders';
import type { EnrichedTrack } from '../../../lib/media/merge';
import { usePlayerActions, usePlayerState } from '../../../lib/player/PlayerProvider';
import { schedulePodcasts } from '../../../lib/podcasts/background';
import { fetchNextAfter } from '../../../lib/podcasts/next';
import { seriesFolderOf } from '../../../lib/podcasts/series';
import { episodesWhen, yearsOf, type Order, type When } from '../../../lib/podcasts/when';
import { inSeriesOrder, nextToPlay } from '../../../lib/tapes/order';
import { progressOf, useTapePlaces } from '../../../lib/tapes/places';
import { useDownloadLibraryRevision, useDownloads } from '../../../lib/youtube/DownloadsProvider';
import { durationLabel, isActive, jobForVideo, statusLabel } from '../../../lib/youtube/types';



/**
 * One podcast: what it is, whether it is followed and how, and its episodes,
 * each of which can be fetched as a tape into the podcast's folder of the
 * Tapes folder. Opened from the podcasts of the Add tapes screen.
 *
 * Its feed is read as the screen opens; for a podcast already followed, what
 * was last read of it is shown meanwhile, and stands in for it offline.
 */
export default function PodcastScreen() {
  const { feed, outside } = useLocalSearchParams<{ feed: string; outside?: string }>();
  const feedUrl = feed ?? '';
  const router = useRouter();
  const { jobs, refresh } = useDownloads();
  const t = useT();
  const styles = useStyles();
  const rows = useRows();
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
  // What each episode here says of itself, by its tape, for the top of the tape's menu: the row has no room for it.
  const summaries = useMemo(() => {
    const by = new Map<string, string>();
    for (const episode of episodes) {
      const job = jobForVideo(jobs, episodeId(feedUrl, episode.guid));
      if (episode.summary && job?.trackId) by.set(job.trackId, episode.summary);
    }
    return by;
  }, [episodes, jobs, feedUrl]);
  const menu = useTrackMenu({ aboutOf: (track) => summaries.get(track.id) ?? null });
  // An episode not here, held: its own menu, what it says of itself and the way to fetch it.
  const [held, setHeld] = useState<Episode | null>(null);
  // A part held and slid from, with the finger never lifted: see `pressMenu.ts`.
  const ring = useTrackRing(menu);
  // The folder it was followed under, should the show have renamed itself since.
  const folder = followed ? seriesFolderOf(followed) : show ? seriesFolderOf(show) : null;
  const here = useMemo(
    () => (folder ? library.filter((track) => folderKey(track.folder ?? '').toLowerCase() === folder) : []),
    [folder, library]
  );
  const byId = useMemo(() => new Map(here.map((track) => [track.id, track])), [here]);
  // Its episodes here in the order they go, oldest first, and the one a press carries it on with.
  const inOrder = useMemo(() => inSeriesOrder(here), [here]);
  const next = nextToPlay(inOrder, places);
  const nextPlace = next ? (places.get(next.id) ?? null) : null;
  const nextProgress = progressOf(nextPlace);
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

  /*
    Whether an episode is being fetched, or has just been: just fetched, the
    library has yet to be read again, and it is not asked for twice meanwhile.
  */
  const lockedFor = (episode: Episode): boolean => {
    const job = jobForVideo(jobs, episodeId(feedUrl, episode.guid));
    return job != null && (isActive(job) || (job.status === 'done' && (job.finishedAt ?? 0) > Date.now() - 30_000));
  };

  /*
    Opened by a link from outside the app (`links/late.ts`), for a show not
    followed: the feed is not read until whoever is holding the phone says
    so, and one on the phone or its own network is not read at all.
  */
  const [fromLink] = useState(() => outside === '1' && subscription(feedUrl) == null);
  const refused = fromLink && isPrivateAddress(feedUrl);
  const [allowed, setAllowed] = useState(!fromLink);
  const allowedNow = useRef(!fromLink);
  const leaveUnread = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  useEffect(() => {
    if (refused) {
      setFailed(true);
      setLoading(false);
      return;
    }
    if (!allowed) return;
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
  }, [allowed, feedUrl, refused]);

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

  // In the app's own way of writing a date, in the language chosen, as everywhere else: the phone's own was neither.
  const dateOf = (ms: number | null) => (ms == null ? '' : t.format.date(new Date(ms)));

  /** One line of a show's settings: its name and its switch. */
  const switchRow = (label: string, value: boolean, onChange: (on: boolean) => void) => (
    <View style={rows.line}>
      <Text style={rows.title}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );

  const chips = (
    // Sideways, as the years run on as far back as the show does: which end first, then the latest weeks and months, then each year it has episodes in.
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {/* Which way round, a press turning it over: a button, the chips beside it one of a set. */}
      <Button
        kind="secondary"
        size="small"
        shape="pill"
        label={`⇅ ${order === 'newest' ? said.newest : said.oldest}`}
        onPress={() => setOrder(order === 'newest' ? 'oldest' : 'newest')}
      />
      <Segmented
        variant="chips"
        wrap={false}
        options={[
          { value: 'all', label: said.when.all },
          { value: 'week', label: said.when.week },
          { value: 'month', label: said.when.month },
          { value: 'quarter', label: said.when.quarter },
          ...years.map((year) => ({ value: `year:${year}`, label: String(year) })),
        ]}
        value={when}
        onChange={(value: string) => setWhen(value as When)}
      />
    </ScrollView>
  );

  return (
    <MediaPage
      head={(side) => (
        <MediaHead
          side={side}
          cover={<HeadCover uri={show?.image} />}
          title={show?.title ?? feedUrl}
          lines={[show?.author, episodes.length > 0 ? said.stats(episodes.length, here.length) : null]}
          // The whole of what the show says of itself, a press away.
          about={show?.summary}
          carryOn={
            // Carried on at one press: the episode part way through, or the newest not heard, with how far in it is and how long is left.
            next ? (
              <ContinueCard
                label={nextProgress != null ? said.continue : said.start}
                title={next.title}
                progress={nextProgress != null && nextPlace ? nextProgress : null}
                line={
                  nextProgress != null && nextPlace
                    ? t.library.tapes.left(Math.max(1, Math.round((nextPlace.durationSec - nextPlace.positionSec) / 60)))
                    : durationLabel(next.durationSec)
                }
                playing={nextIsOn && playWhenReady}
                accessibilityLabel={`${nextIsOn && playWhenReady ? t.common.pause : nextProgress != null ? said.continue : said.start}, ${next.title}`}
                onPress={() => (nextIsOn ? void toggle() : play(next))}
              />
            ) : null
          }
          actions={
            show
              ? [
                  {
                    label: followed ? said.unfollow : said.follow,
                    kind: followed ? 'secondary' : 'primary',
                    disabled: busy === 'follow',
                    onPress: () => void toggleFollow(),
                  },
                ]
              : undefined
          }>
          {show && !followed && episodes.length > 0 ? <HeadNote>{said.withoutFollowing}</HeadNote> : null}
          {followed ? (
            <View style={rows.card}>
              <View style={rows.row}>
                {switchRow(said.autoDownload, followed.autoDownload, (on) => {
                  setAutoDownload(feedUrl, on);
                  if (!on && !followed.fetchNext) void dropWaiting(followed.folder);
                  reread();
                  void schedulePodcasts();
                  if (on) catchUp('newest');
                })}
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
                    <Text style={rows.muted}>{said.autoDownloadNote(followed.keep)}</Text>
                  </>
                ) : null}
              </View>
              {/* Beside it: the ones after the episode being heard, for working through the show from older ones. */}
              <View style={rows.rule} />
              <View style={rows.row}>
                {switchRow(said.fetchNext, followed.fetchNext, (on) => {
                  setFetchNext(feedUrl, on);
                  // As the switch beside it does: with neither on, what was waiting to be fetched is not fetched later after all.
                  if (!on && !followed.autoDownload) void dropWaiting(followed.folder);
                  reread();
                  if (on) catchUp('next');
                })}
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
                <Text style={rows.muted}>{said.fetchNextNote(followed.nextCount)}</Text>
              </View>
            </View>
          ) : null}
        </MediaHead>
      )}
      above={
        episodes.length > 0 ? (
          <>
            <SectionLabel>{said.episodes(shown.length)}</SectionLabel>
            {chips}
          </>
        ) : null
      }
      items={loading && episodes.length === 0 ? null : shown}
      keyOf={(episode) => episode.guid}
      error={failed && episodes.length === 0 ? (refused ? said.linkRefused : said.feedFailed) : null}
      empty={episodes.length > 0 ? said.noneThen : said.noEpisodes}
      renderItem={(item) => {
        const job = jobForVideo(jobs, episodeId(feedUrl, item.guid));
        const track = job?.status === 'done' && job.trackId ? byId.get(job.trackId) : undefined;
        const line = said.line(dateOf(item.publishedAt), durationLabel(item.durationSec));
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
              <MediaRow
                title={item.title}
                subtitle={line}
                playing={current?.id === track.id}
                meta={state}
                metaOn={place?.finished === true}
                onPress={() => play(track)}
                onLongPress={() => menu.open(track)}
              />
            </PressRing>
          );
        }
        // Fetched and here is the row above, to play; fetched and deleted since, or never, it can be fetched (again).
        const locked = lockedFor(item);
        return (
          <MediaRow
            title={item.title}
            subtitle={line}
            onLongPress={() => setHeld(item)}
            trailing={
              <TextButton
                label={busy === item.guid ? said.download : locked && job ? statusLabel(job, t) : said.download}
                tone="plain"
                accessibilityLabel={said.downloadNamed(item.title)}
                disabled={locked || busy != null}
                onPress={() => void fetchOne(item)}
              />
            }
          />
        );
      }}
      sheets={
        <>
          {menu.element}
          <MenuCard visible={held != null} onClose={() => setHeld(null)}>
            {held ? (
              <>
                <MenuHeader
                  title={held.title}
                  detail={said.line(dateOf(held.publishedAt), durationLabel(held.durationSec))}
                  picture={held.image ?? show?.image ?? null}
                  about={held.summary}
                />
                <MenuEntry
                  icon={DownloadIcon}
                  label={said.download}
                  disabled={lockedFor(held) || busy != null}
                  onPress={() => {
                    const episode = held;
                    setHeld(null);
                    void fetchOne(episode);
                  }}
                />
              </>
            ) : null}
          </MenuCard>
          <ConfirmSheet
            visible={!allowed && !refused}
            title={said.linkAsk}
            body={said.linkAskBody(hostOf(feedUrl))}
            confirmLabel={said.linkOpen}
            onConfirm={() => {
              allowedNow.current = true;
              setAllowed(true);
            }}
            onCancel={() => {
              // Told after Open as well (`ConfirmSheet`): left only where it was not that.
              if (!allowedNow.current) leaveUnread();
            }}
          />
        </>
      }
    />
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    muted: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
    chips: { gap: SPACE.s, paddingBottom: SPACE.s, alignItems: 'center' },
  })
);
