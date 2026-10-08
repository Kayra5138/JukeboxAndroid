import { memo, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LIST_COVER_SIZE } from '../components/ListHeading';
import { PlaylistCover } from '../components/PlaylistCover';
import { Pressable } from '../components/Pressable';
import { lookUpAlbumOnYouTube, lookUpAlbumRest } from '../lib/album/index';
import { downloadFor, findFor, jobsForPlaces, slotState, unsought } from '../lib/album/fetch';
import { sharedGenre, slotOf, type Placement } from '../lib/album/placement';
import type { RestOutcome, RestTrack } from '../lib/album/rest';
import type { Stage, YouTubeOutcome } from '../lib/album/youtube';
import { useT } from '../lib/i18n/index';
import type { Strings } from '../lib/i18n/index';
import { albumsOf, type Album } from '../lib/media/albums';
import { scanLibrary } from '../lib/media/library';
import { withMetadata } from '../lib/media/merge';
import { makeStyles, outlined, scene, useColours, usePressed } from '../lib/theme/index';
import { useDownloadLibraryRevision, useDownloads } from '../lib/youtube/DownloadsProvider';
import { youtubeError } from '../lib/youtube/errors';
import { downloads } from '../lib/youtube/native';
import {
  durationLabel,
  jobError,
  jobForVideo,
  statusLabel,
  type DownloadJob,
  type YouTubeVideo,
} from '../lib/youtube/types';

/** Where a track list is read from. */
type Source = 'musicbrainz' | 'youtube';

/** The list on screen, whichever of the two it was read from. */
type Shown = {
  source: Source;
  tracks: (RestTrack & { video?: YouTubeVideo })[];
  discs: number;
  year: number | null;
  /** How many of the library's tracks were found on it. */
  covered: number;
  rivals: number;
};

/**
 * What a row is, which decides what it is drawn as:
 *
 *  - `have`: in the library already, and said so quietly;
 *  - `busy`: on its way — in the queue, waiting to be looked for, being
 *    looked for or being downloaded — with nothing to tick while it is;
 *  - `open`: missing, and the user's to tick or leave.
 */
type Kind = 'have' | 'busy' | 'open';

type Row = {
  slot: string;
  place: Placement;
  lengthSec: number | null;
  /** The video that is this track, where the list was read off a playlist. */
  video: YouTubeVideo | null;
  /** The disc it opens, on a record of more than one. */
  heading: string | null;
  position: number;
  title: string;
  detail: string;
  kind: Kind;
  status: string | null;
  bad: boolean;
  /** How far a download has got, while there is one to show it for. */
  progress: number | null;
};

/** What a missing track's row says under its name, and whether it is bad news. */
function saidOf(
  job: DownloadJob | undefined,
  t: Strings
): { kind: Kind; status: string | null; bad: boolean; progress: number | null } {
  const said = t.library.rest;
  const state = slotState(job);
  if (!job || !state) return { kind: 'open', status: null, bad: false, progress: null };
  switch (state) {
    case 'waiting':
      return { kind: 'busy', status: said.waiting, bad: false, progress: null };
    case 'searching':
      return { kind: 'busy', status: said.searching, bad: false, progress: null };
    case 'fetching':
      return { kind: 'busy', status: statusLabel(job, t), bad: false, progress: job.progress };
    // In the library by now; the next reading of it turns the row into one it has.
    case 'here':
      return { kind: 'have', status: statusLabel(job, t), bad: false, progress: null };
    case 'notFound':
      return { kind: 'open', status: said.noMatch, bad: true, progress: null };
    case 'stopped':
      return { kind: 'open', status: jobError(job) ?? statusLabel(job, t), bad: job.status === 'failed', progress: null };
  }
}

/**
 * The rest of an album: every track of it, the ones the library has and the
 * ones it does not, with the missing ones there to be downloaded.
 *
 * A screen of its own and not a sheet, because it is waited on and come back
 * to. Looking the album up takes a few seconds, the downloads take minutes,
 * and nothing here has to be watched: a missing track is asked for by name
 * of the one queue of downloads, and each row reads its state off the job
 * that made, so leaving and returning — or closing the app — finds it where
 * it has got to. A track that arrives is filed under this album by the downloads
 * themselves (see `album/placement.ts`), not by this screen being open.
 *
 * The list is MusicBrainz's where MusicBrainz can tell which record this is,
 * and otherwise the record as YouTube has it (see `album/youtube.ts`), whose
 * tracks come with their videos and are downloaded as those. Either can be
 * asked for in place of the other; the downloads belong to the record and
 * not to the list, so changing lists leaves them as they are.
 */
export default function AlbumRestScreen() {
  const { album: key = '' } = useLocalSearchParams<{ album?: string }>();
  const router = useRouter();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const insets = useSafeAreaInsets();
  const revision = useDownloadLibraryRevision();
  const { jobs, enqueueFindAll, enqueueAll, cancelMany } = useDownloads();
  const said = t.library.rest;

  /** Undefined until the library has been read; null when the album is not in it. */
  const [album, setAlbum] = useState<Album | null | undefined>(undefined);
  const [outcome, setOutcome] = useState<RestOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** YouTube's answer, once it has been asked; kept while the other list is looked at. */
  const [tube, setTube] = useState<YouTubeOutcome | null>(null);
  const [tubeAttempt, setTubeAttempt] = useState(0);
  /** How far asking YouTube has got, for the words beside the spinner. */
  const [stage, setStage] = useState<Stage | null>(null);
  /** The list the user asked for by name. Until they do, it is whichever can tell what the record is. */
  const [asked, setAsked] = useState<Source | null>(null);
  /**
   * The places whose box has been touched, and how it was left. One that has
   * not been is ticked or not as the whole list is to begin with.
   */
  const [choice, setChoice] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  /** Why the queue would not take what was last asked of it, until it is asked again. */
  const [refused, setRefused] = useState<string | null>(null);

  // Read again whenever a download lands, which is when a missing track stops
  // being one.
  useEffect(() => {
    let live = true;
    scanLibrary().then(
      (tracks) => {
        if (live) setAlbum(albumsOf(withMetadata(tracks)).find((entry) => entry.key === key) ?? null);
      },
      () => {
        if (live) setAlbum(null);
      }
    );
    return () => {
      live = false;
    };
  }, [key, revision]);

  /*
    Asked again for every reading of the library, since what is missing is
    worked out against the tracks that are there. Only the first costs
    anything: the catalogue's answers are kept, and the rest is arithmetic.
  */
  useEffect(() => {
    if (!album) return;
    const controller = new AbortController();
    lookUpAlbumRest(album, controller.signal).then(
      (found) => {
        if (!controller.signal.aborted) setOutcome(found);
      },
      // Stopped, by the lines below. Nothing else is ever thrown from there.
      () => {}
    );
    return () => controller.abort();
  }, [album, attempt]);

  const catalogue = outcome?.ok ? outcome.rest : null;
  /*
    MusicBrainz cannot say what the record is: it has none by this name, it
    was given no one artist to ask with, or it has one and none of the
    library's tracks are on it. Then YouTube is asked without being asked for.
    Not where MusicBrainz could not be reached: that is said, with a way to
    ask again, and YouTube is the user's to turn to.
  */
  const stuck =
    outcome != null &&
    (outcome.ok ? outcome.rest.covered === 0 : outcome.why === 'notFound' || outcome.why === 'unnamed');
  const wantTube = asked ? asked === 'youtube' : stuck;

  /*
    As above, and for the same reason asked again at every reading of the
    library. Leaving the screen stops the request the phone is making; a
    reading of the library does not, since the next asking picks the same
    request up (see `lookUpAlbumOnYouTube`).
  */
  useEffect(() => {
    if (!album || !wantTube) return;
    const controller = new AbortController();
    const live = () => !controller.signal.aborted;
    lookUpAlbumOnYouTube(album, {
      signal: controller.signal,
      onStage: (at) => {
        if (live()) setStage(at);
      },
    }).then(
      (found) => {
        if (!live()) return;
        setTube(found);
        setStage(null);
      },
      () => {}
    );
    return () => controller.abort();
  }, [album, wantTube, tubeAttempt]);

  const playlist = wantTube && tube?.ok ? tube.album : null;
  /** YouTube is being asked and has not answered. */
  const pending = wantTube && tube == null;
  /*
    MusicBrainz's list stays up while YouTube is asked only where somebody
    was reading it and asked for the other. One that could not be vouched for
    is not shown first and then swapped for another under the user's thumb.
  */
  const shown: Shown | null = playlist
    ? {
        source: 'youtube',
        tracks: playlist.tracks,
        discs: 1,
        year: null,
        covered: playlist.covered,
        rivals: 0,
      }
    : catalogue && (!pending || asked === 'youtube')
      ? {
          source: 'musicbrainz',
          tracks: catalogue.tracks,
          discs: catalogue.discs,
          year: catalogue.release.year,
          covered: catalogue.covered,
          rivals: catalogue.rivals,
        }
      : null;

  const genre = album ? sharedGenre(album.tracks) : null;
  const places: Placement[] =
    album && shown
      ? shown.tracks.map((track) => ({
          album: album.name,
          title: track.title,
          // The library's spelling of whose record it is, unless this one
          // track is somebody else's.
          artist: track.artist ?? album.artist,
          track: track.position,
          disc: shown.discs > 1 ? track.disc : null,
          // The album's own year where it has one, so the record does not
          // come to disagree with itself about when it was made.
          year: album.year ?? shown.year,
          genre,
        }))
      : [];
  const queued = jobsForPlaces(jobs, key, places);

  const rows: Row[] =
    album && shown
      ? shown.tracks.map((track, index) => {
          const place = places[index]!;
          const slot = slotOf(place);
          /*
            A video that is here already, or on its way, for some other
            reason — it was downloaded by hand before the album was looked
            up. The phone answers a second asking with that same job, so it
            is that job the row is about.
          */
          const twin = track.video ? jobForVideo(jobs, track.video.id) : undefined;
          const elsewhere = ['here', 'fetching'].includes(slotState(twin) ?? '') ? twin : undefined;
          const state = track.have
            ? { kind: 'have' as const, status: t.search.status.done, bad: false, progress: null }
            : saidOf(queued.get(slot) ?? elsewhere, t);
          return {
            slot,
            place,
            lengthSec: track.lengthSec,
            video: track.video ?? null,
            heading:
              shown.discs > 1 && shown.tracks[index - 1]?.disc !== track.disc
                ? said.disc(track.disc)
                : null,
            position: track.position,
            title: track.title,
            detail: [durationLabel(track.lengthSec), track.artist].filter(Boolean).join(' · '),
            ...state,
          };
        })
      : [];

  const open = rows.filter((row) => row.kind === 'open');
  const missing = rows.filter((row) => row.kind !== 'have').length;
  /*
    Everything missing, until the user says otherwise — except where none of
    the library's tracks was found on the record. Then nothing vouches for it
    being the same record, and what looks missing may be here under a title
    that was not recognised; downloading it all would be a second copy.
  */
  const unsure = shown != null && shown.covered === 0;
  const ticked = open.filter((row) => choice.get(row.slot) ?? !unsure);
  const waiting = unsought(jobs, key);

  // Reads what it changes from the state itself, so that it is the same
  // function from one reading of the downloads to the next and a row is not
  // drawn again for having been handed a new one.
  const toggle = (slot: string) =>
    setChoice((held) => new Map(held).set(slot, !(held.get(slot) ?? !unsure)));

  const download = () => {
    if (ticked.length === 0) return;
    // Asked for once. One that comes back with no match is then left
    // unticked, so the button does not offer the same search again unasked.
    setChoice((held) => {
      const next = new Map(held);
      for (const row of ticked) next.set(row.slot, false);
      return next;
    });
    setRefused(null);
    /*
      Read off a playlist, each track has its video, and is downloaded as
      that: in the record's order, and as downloads of the record and not of
      the playlist. Read off the catalogue it has a name, and is looked for.
      MP3 either way, as the Search tab saves unless it is told otherwise.
    */
    const sent =
      shown?.source === 'youtube'
        ? enqueueAll(
            ticked.flatMap((row) => (row.video ? [downloadFor(row.video, row.place)] : [])),
            'mp3'
          )
        : enqueueFindAll(
            ticked.map((row) => findFor({ place: row.place, lengthSec: row.lengthSec })),
            'mp3'
          );
    sent.catch((error: unknown) =>
      setRefused(youtubeError(error, error instanceof Error && error.message ? error.message : said.searchFailed, t))
    );
  };

  // The ones not looked for yet. One being looked for, or downloaded, is seen through.
  const stop = () => {
    cancelMany(waiting.map((job) => job.id)).catch(() => {});
  };

  /**
   * Asking by name is the queue's to do, and a build from before the queue
   * cannot. A video that is already known, any build that downloads can take.
   */
  const able =
    shown?.source === 'youtube' ? downloads != null : downloads?.enqueueFindAsync != null;

  const byHand = (query: string) => router.navigate({ pathname: '/search', params: { q: query } });

  // From the beginning: MusicBrainz, and whatever follows from its answer.
  const retry = () => {
    setOutcome(null);
    setAsked(null);
    setAttempt((value) => value + 1);
  };
  const retryTube = () => {
    setTube(null);
    setTubeAttempt((value) => value + 1);
  };

  /*
    The other list. What was ticked was ticked on this one, by places that
    are other tracks' on that one, so the ticks do not go with it. The
    downloads do: they are the queue's, and each row finds its own again.
  */
  const lookOnTube = () => {
    setChoice(new Map());
    setAsked('youtube');
    // An answer is kept; a failure is asked about again.
    if (tube && !tube.ok) retryTube();
  };
  const useCatalogue = () => {
    setChoice(new Map());
    setAsked('musicbrainz');
  };

  const edges = { paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right };

  const trouble = wantTube && tube && !tube.ok ? tube : null;
  /** Whether MusicBrainz failed in a way that asking again could mend. */
  const passing =
    outcome != null &&
    !outcome.ok &&
    (outcome.why === 'offline' || outcome.why === 'throttled' || outcome.why === 'failed');
  /*
    What is said in place of a list, and whether asking again could be
    answered differently. YouTube's failure where YouTube was the last asked;
    "neither" where both were asked and neither had it.
  */
  const notice: { text: string; again: (() => void) | null } | null =
    album === null
      ? { text: said.failed.gone, again: null }
      : shown || pending
        ? null
        : trouble
          ? trouble.why === 'failed'
            ? { text: youtubeError(trouble.error, said.failed.tube, t), again: retryTube }
            : trouble.why === 'unavailable'
              ? // To somebody who asked for YouTube. Otherwise what MusicBrainz said stands.
                asked !== 'youtube' && outcome && !outcome.ok
                ? { text: said.failed[outcome.why], again: null }
                : { text: said.failed.tooOld, again: null }
              : trouble.why === 'unnamed'
                ? { text: said.failed.unnamed, again: null }
                : outcome && !outcome.ok && outcome.why === 'notFound'
                  ? { text: said.failed.neither, again: null }
                  : { text: said.tubeNotFound, again: passing ? retry : null }
          : outcome && !outcome.ok
            ? { text: said.failed[outcome.why], again: passing ? retry : null }
            : null;
  /** Under MusicBrainz's list, what came of asking YouTube as well. */
  const aside =
    shown && trouble
      ? trouble.why === 'failed'
        ? youtubeError(trouble.error, said.failed.tube, t)
        : trouble.why === 'unavailable'
          ? // Only to somebody who asked: it is not news on every album.
            asked === 'youtube' ? said.failed.tooOld : null
          : trouble.why === 'notFound'
            ? said.tubeNotFound
            : null
      : null;
  /*
    The way to the other list. To YouTube from MusicBrainz's, unless YouTube
    has just said it has nothing; and from MusicBrainz being out of reach. To
    MusicBrainz from YouTube's only where MusicBrainz had a list to show.
  */
  const other: Source | null = pending
    ? null
    : shown?.source === 'youtube'
      ? catalogue ? 'musicbrainz' : null
      : shown
        ? !trouble || trouble.why === 'failed' ? 'youtube' : null
        : passing && !trouble ? 'youtube' : null;

  return (
    <View style={styles.screen}>
      {/* The album's own name over it, once the library has said what that is. */}
      <Stack.Screen options={{ title: album?.name ?? t.nav.albumRest }} />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.slot}
        contentContainerStyle={[styles.content, edges, { paddingBottom: 24 + insets.bottom }]}
        ListHeaderComponent={
          <View style={styles.header}>
            {album ? (
              <View style={styles.identity}>
                <PlaylistCover
                  tracks={album.tracks}
                  chosen={album.tracks[0] ?? null}
                  size={LIST_COVER_SIZE}
                />
                <View style={styles.identityText}>
                  <Text style={styles.name} numberOfLines={3}>
                    {album.name}
                  </Text>
                  {album.artist ? <Text style={styles.detail}>{album.artist}</Text> : null}
                  {shown ? (
                    <>
                      <Text style={styles.detail}>
                        {playlist
                          ? said.source.youtube(playlist.playlist.title, playlist.playlist.channel)
                          : said.source.musicbrainz}
                      </Text>
                      <Text style={styles.detail}>
                        {said.release(shown.tracks.length, album.year ?? shown.year)}
                      </Text>
                      <Text style={styles.detail}>
                        {missing === 0
                          ? said.complete
                          : said.have(rows.length - missing, rows.length)}
                      </Text>
                    </>
                  ) : null}
                </View>
              </View>
            ) : null}

            {notice ? (
              <View style={styles.notice}>
                <Text accessibilityRole="alert" style={styles.note}>
                  {notice.text}
                </Text>
                {/* Only where asking again could be answered differently. */}
                {notice.again ? (
                  <Pressable
                    android_ripple={pressed}
                    accessibilityRole="button"
                    style={styles.secondary}
                    onPress={notice.again}>
                    <Text style={styles.secondaryLabel}>{t.common.tryAgain}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {pending || (!shown && !notice) ? (
              <View style={styles.looking}>
                <ActivityIndicator color={c.text} />
                <Text style={styles.detail}>
                  {pending
                    ? stage === 'reading' ? said.readingTube : said.lookingTube
                    : said.looking}
                </Text>
              </View>
            ) : null}

            {other ? (
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                style={styles.other}
                onPress={other === 'youtube' ? lookOnTube : useCatalogue}>
                <Text style={styles.otherLabel}>{said.other[other]}</Text>
              </Pressable>
            ) : null}

            {shown ? (
              <>
                {unsure ? <Text style={styles.note}>{said.unsure}</Text> : null}
                {playlist?.by === 'album' ? <Text style={styles.hint}>{said.onTrust}</Text> : null}
                {shown.rivals > 0 ? <Text style={styles.hint}>{said.rivals}</Text> : null}
                {aside ? <Text style={styles.hint}>{aside}</Text> : null}
                {!able && missing > 0 ? (
                  <Text style={styles.note}>{t.search.unavailable.downloads}</Text>
                ) : null}
                {refused ? (
                  <Text accessibilityRole="alert" style={styles.note}>
                    {refused}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <RestRow
            slot={item.slot}
            heading={item.heading}
            position={item.position}
            title={item.title}
            detail={item.detail}
            query={[item.place.artist, item.place.title].filter(Boolean).join(' ')}
            kind={item.kind}
            ticked={choice.get(item.slot) ?? !unsure}
            status={item.status}
            bad={item.bad}
            progress={item.progress}
            onToggle={toggle}
            onByHand={byHand}
          />
        )}
      />

      {shown && missing > 0 && able ? (
        <View style={[styles.bar, edges, { paddingBottom: 12 + insets.bottom }]}>
          {waiting.length > 0 ? (
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              style={styles.secondary}
              onPress={stop}>
              <Text style={styles.secondaryLabel}>{said.stop}</Text>
            </Pressable>
          ) : null}
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            disabled={ticked.length === 0}
            style={[styles.primary, ticked.length === 0 && styles.off]}
            onPress={download}>
            <Text style={styles.primaryLabel}>
              {ticked.length > 0 ? said.download(ticked.length) : said.nothingTicked}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/**
 * One track of the record.
 *
 * Handed what it says and not the job it says it about: the jobs are read
 * again every second while anything is downloading, and a row whose words
 * have not changed should not be drawn again for a percentage three rows up.
 */
const RestRow = memo(function RestRow({
  slot,
  heading,
  position,
  title,
  detail,
  query,
  kind,
  ticked,
  status,
  bad,
  progress,
  onToggle,
  onByHand,
}: {
  slot: string;
  heading: string | null;
  position: number;
  title: string;
  detail: string;
  /** What the Search tab is opened with to look for this one by hand. */
  query: string;
  kind: Kind;
  ticked: boolean;
  status: string | null;
  bad: boolean;
  progress: number | null;
  onToggle: (slot: string) => void;
  onByHand: (query: string) => void;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.library.rest;
  const open = kind === 'open';
  const line = [detail, status].filter(Boolean).join(' · ');

  return (
    <>
      {heading ? <Text style={styles.disc}>{t.format.upper(heading)}</Text> : null}
      <View style={styles.row}>
        <Pressable
          android_ripple={open ? pressed : undefined}
          disabled={!open}
          // The whole of it is the tick box, as a row of the library is while
          // tracks are being chosen. One the library has is only read out.
          accessibilityRole={open ? 'checkbox' : 'text'}
          accessibilityState={open ? { checked: ticked } : undefined}
          accessibilityLabel={[title, line].filter(Boolean).join(', ')}
          accessibilityHint={open ? said.ticks : undefined}
          style={styles.rowMain}
          onPress={() => onToggle(slot)}>
          {open ? (
            <View style={[styles.checkbox, ticked && styles.checkboxOn]}>
              {ticked ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
          ) : (
            <View style={styles.mark}>
              {kind === 'have' ? (
                <Text style={styles.present}>✓</Text>
              ) : (
                <ActivityIndicator size="small" color={c.textFaint} />
              )}
            </View>
          )}
          <Text style={styles.position}>{t.format.number(position)}</Text>
          <View style={styles.rowText}>
            <Text style={kind === 'have' ? styles.titleHave : styles.title} numberOfLines={2}>
              {title}
            </Text>
            {line ? (
              <Text style={bad ? styles.lineBad : styles.line} numberOfLines={2}>
                {line}
              </Text>
            ) : null}
            {progress != null ? (
              <View style={styles.progressTrack}>
                <View style={[styles.progress, { width: `${progress}%` }]} />
              </View>
            ) : null}
          </View>
        </Pressable>
        {open ? (
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            accessibilityLabel={said.byHandLabel(title)}
            style={styles.byHand}
            onPress={() => onByHand(query)}>
            <Text style={styles.byHandLabel}>{said.byHand}</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
});

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  content: { paddingTop: 16 },

  // The heading of a list, without the buttons: `ListHeading`'s measures.
  header: { gap: 12, paddingBottom: 14 },
  identity: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  identityText: { flex: 1, minWidth: 0, gap: 5 },
  name: { color: c.text, fontSize: 22, fontWeight: '600' },
  detail: { color: c.textMuted, fontSize: 13 },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 18 },
  note: { color: c.danger, fontSize: 12.5, lineHeight: 18 },
  notice: { gap: 12, alignItems: 'flex-start' },
  looking: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  // A link and not a button: the list on screen is the answer, and this is the second opinion.
  other: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  otherLabel: { color: c.accent, fontSize: 12.5 },

  disc: {
    color: c.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    paddingTop: 16,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  // As `TrackRow` draws it.
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkMark: { color: c.onAccent, fontSize: 13, fontWeight: '700', lineHeight: 15 },
  // The box's place, kept by the rows that have none, so the names line up.
  mark: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  present: { color: c.textFaint, fontSize: 13, lineHeight: 15 },
  position: { color: c.textFaint, fontSize: 12.5, minWidth: 18, textAlign: 'right' },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: c.text, fontSize: 15 },
  titleHave: { color: c.textMuted, fontSize: 15 },
  line: { color: c.textFaint, fontSize: 12.5 },
  lineBad: { color: c.danger, fontSize: 12.5 },
  // The Search tab's, for the same download.
  progressTrack: { height: 3, backgroundColor: c.borderStrong, borderRadius: 2, marginTop: 3, overflow: 'hidden' },
  progress: { height: 3, backgroundColor: c.text },
  byHand: { minHeight: 44, justifyContent: 'center', paddingLeft: 12, paddingVertical: 8 },
  byHandLabel: { color: c.accent, fontSize: 12.5 },

  bar: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  // `ListHeading`'s two buttons.
  primary: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: c.primary,
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...outlined(c, c.primary),
  },
  primaryLabel: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  secondary: {
    alignItems: 'center',
    borderRadius: 11,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  secondaryLabel: { color: c.text, fontSize: 15 },
  off: { opacity: 0.35 },
}));
