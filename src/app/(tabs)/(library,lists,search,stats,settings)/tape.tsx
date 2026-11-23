import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { TextButton } from '../../../components/Button';
import { HeadCover, MediaHead, SectionLabel } from '../../../components/MediaPage';
import { PageScroll } from '../../../components/Page';
import { ScreenState } from '../../../components/ScreenState';
import { useRows } from '../../../components/settings/rows';

import { Pressable } from '../../../components/Pressable';
import { useT } from '../../../lib/i18n/index';
import { libraryState, refreshLibrary } from '../../../lib/library/index';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import { useTrackArtwork } from '../../../lib/media/artwork';
import { seriesOf } from '../../../lib/podcasts/series';
import { useMarks } from '../../../lib/tapes/marks';
import { useChapters, useSkipTrouble } from '../../../lib/tapes/extras';
import { tapeFlag } from '../../../lib/tapes/settings';
import JukeboxAudio from '../../../../modules/jukebox-audio/index';
import { partsOf } from '../../../lib/tapes/order';
import { useTapePlace } from '../../../lib/tapes/places';
import { tapeKeyOf, tapeSpeedOf } from '../../../lib/tapes/speed';
import { isTape } from '../../../lib/tapes/tape';
import { makeStyles, usePressed } from '../../../lib/theme/index';
import { LEADING, TYPE } from '../../../lib/theme/measures';
import { downloads } from '../../../lib/youtube/native';
import type { DownloadJob } from '../../../lib/youtube/types';

/**
 * One tape, to read about rather than to put right: how far into it you are
 * and when you last were, which part of its record it is, how fast it plays
 * and how many places are marked in it; where it came from — a video or a
 * playlist of YouTube's, an episode of a podcast, or a file put in the Tapes
 * folder by hand — with its address; and the file itself. A tape is not
 * looked up nor tagged, so none of a song's details are offered.
 */
export default function TapeDetailsScreen() {
  const t = useT();
  const styles = useStyles();
  const rows = useRows();
  const router = useRouter();
  const said = t.library.tapes.details;
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const library = useLibraryTracks();
  const place = useTapePlace(trackId);
  const marks = useMarks(trackId);
  const chapters = useChapters(trackId);
  const skipTrouble = useSkipTrouble(trackId);
  /** The download that brought it, if one did; undefined while that is still being asked. */
  const [job, setJob] = useState<DownloadJob | null | undefined>(undefined);

  // Opened before any screen has read the library: read it now.
  useEffect(() => {
    if (libraryState().kind !== 'library') void refreshLibrary();
  }, []);

  useEffect(() => {
    let gone = false;
    void jobOf(trackId).then((found) => {
      if (!gone) setJob(found);
    });
    return () => {
      gone = true;
    };
  }, [trackId]);

  const tapes = useMemo(() => library.filter((track) => isTape(track)), [library]);
  const track = tapes.find((one) => one.id === trackId) ?? null;
  const artwork = useTrackArtwork(track);

  if (!track) {
    return (
      <PageScroll>
        {libraryState().kind === 'library' ? <ScreenState kind="empty" text={said.missing} /> : <ScreenState kind="loading" />}
      </PageScroll>
    );
  }

  const parts = partsOf(track, tapes);
  const show = seriesOf(track);
  // As a tape's row counts them: what is heard down to the whole minute, the rest to the nearest.
  const minutes = (seconds: number) => Math.round(seconds / 60);
  const heard =
    place?.finished
      ? t.library.tapes.played
      : place && place.positionSec >= 10
        ? `${t.library.tapes.heard(Math.floor(place.positionSec / 60), Math.max(1, minutes(place.durationSec || track.durationSec)))} · ${t.library.tapes.left(Math.max(1, minutes((place.durationSec || track.durationSec) - place.positionSec)))}`
        : said.notBegun;
  // In the app's own way of writing a date, in the language chosen, as everywhere else: the phone's own was neither.
  const when = (ms: number | null | undefined) => (ms ? t.format.dateTime(new Date(ms)) : null);
  const day = (ms: number | null | undefined) => (ms ? t.format.date(new Date(ms)) : null);

  const video = job?.video;
  // A part of a playlist fetched as a book says which list; a video read off one for a list of songs says so too.
  const playlist = video?.tape?.list ?? video?.sourcePlaylist;
  // A book's part is fetched from its own address too, as a podcast's episode is; its id says which it is.
  const book = video?.id.startsWith('book-') === true;
  const kind = !job
    ? said.kinds.byHand
    : book
      ? said.kinds.book
      : video?.direct
        ? said.kinds.podcast
        : playlist
          ? said.kinds.playlist
          : said.kinds.youtube;
  // A podcast's file is fetched from its own address; a video of YouTube's is opened at its page.
  const address = video?.url ?? null;
  const listAddress = playlist?.id ? `https://www.youtube.com/playlist?list=${encodeURIComponent(playlist.id)}` : null;
  const extension = track.filename?.includes('.') ? track.filename.slice(track.filename.lastIndexOf('.') + 1).toUpperCase() : null;

  return (
    <PageScroll>
      <MediaHead
        cover={<HeadCover uri={artwork} />}
        title={track.title}
        lines={[track.artist, track.album && track.album !== track.artist ? track.album : null]}
      />

      <Section title={said.listening}>
        <Row label={said.heard} value={heard} />
        {place?.at ? <Row label={said.lastHeard} value={when(place.at)} /> : null}
        {parts.tracks.length > 1 ? <Row label={said.part} value={said.partOf(parts.index + 1, parts.tracks.length)} /> : null}
        <Row label={said.speed} value={`${Math.round(tapeSpeedOf(tapeKeyOf(track)) * 100) / 100}×`} />
        <Row
          label={said.marks}
          value={t.format.number(marks.length)}
          onPress={marks.length > 0 ? () => router.push('/marks') : undefined}
        />
      </Section>

      <Section title={said.source}>
        {job === undefined ? null : (
          <>
            <Row label={said.from} value={kind} />
            {video?.direct ? <Row label={book ? said.book : said.show} value={video.tape?.name ?? video.channel} /> : null}
            {video && !video.direct ? <Row label={said.channel} value={video.channel} /> : null}
            {playlist ? <Row label={said.list} value={playlist.name} /> : null}
            {video?.tape?.date ? <Row label={said.published} value={dayOfIso(t, video.tape.date)} /> : null}
            {job?.finishedAt ? <Row label={said.fetched} value={when(job.finishedAt)} /> : null}
            {chapters.length > 1 ? <Row label={said.chapters} value={t.format.number(chapters.length)} /> : null}
            {/* A video's parts SponsorBlock marked, which the player passes over: see `tapes/extras.ts`. */}
            {video && !video.direct ? (
              <Row label={said.skipped} value={!tapeFlag('skipSponsors') ? said.skippedOff : skipTrouble ? said.skippedTrouble : skippedLine(JukeboxAudio.getTapeSkips?.(trackId) ?? null, said)} />
            ) : null}
            {address ? <Row label={said.address} value={address} link onPress={() => void Linking.openURL(address)} /> : null}
            {listAddress ? <Row label={said.listAddress} value={listAddress} link onPress={() => void Linking.openURL(listAddress)} /> : null}
            {show ? (
              <View style={rows.row}>
                <TextButton
                  label={said.openSeries}
                  size="body"
                  strong
                  onPress={() => router.push({ pathname: '/podcast', params: { feed: show.feedUrl } })}
                />
              </View>
            ) : null}
          </>
        )}
      </Section>

      <Section title={said.file}>
        {track.filename ? <Row label={said.name} value={track.filename} /> : null}
        {track.folder ? <Row label={said.folder} value={track.folder} /> : null}
        {extension ? <Row label={said.format} value={extension} /> : null}
        {track.size ? <Row label={said.size} value={said.megabytes(Math.max(1, Math.round(track.size / 1_000_000)))} /> : null}
        {track.addedAt ? <Row label={said.added} value={day(track.addedAt)} /> : null}
      </Section>
    </PageScroll>
  );
}

/** What a tape's parts passed over come to: not looked for yet, none marked, or how many and how long. */
function skippedLine(skips: [number, number][] | null, said: ReturnType<typeof useT>['library']['tapes']['details']): string {
  if (skips == null) return said.skippedUnknown;
  if (skips.length === 0) return said.skippedNone;
  return said.skippedSome(skips.length, Math.round(skips.reduce((sum, [from, to]) => sum + (to - from), 0)));
}

/** A day written `2026-10-10`, as the phone writes days; as it was, where it is not one. */
function dayOfIso(t: ReturnType<typeof useT>, day: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return parts ? t.format.date(new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))) : day;
}

/** The download that brought [trackId], the latest should it have been fetched more than once; null for none. Never throws. */
async function jobOf(trackId: string): Promise<DownloadJob | null> {
  try {
    const jobs = (await downloads?.getJobsAsync(false)) ?? [];
    return jobs.filter((one) => one.trackId === trackId && one.status === 'done').pop() ?? null;
  } catch {
    return null;
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const rows = useRows();
  return (
    <>
      <SectionLabel>{title}</SectionLabel>
      <View style={rows.card}>{children}</View>
    </>
  );
}

/** A label and what it is, one above the other, so a long address or folder has the width to itself. */
function Row({ label, value, link = false, onPress }: { label: string; value: string | null; link?: boolean; onPress?: () => void }) {
  const styles = useStyles();
  const rows = useRows();
  const pressed = usePressed();
  if (value == null || value === '') return null;
  const body = (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, (link || onPress) && styles.valueLink]} selectable={!onPress}>{value}</Text>
    </>
  );
  return onPress ? (
    <Pressable android_ripple={pressed} accessibilityRole={link ? 'link' : 'button'} style={rows.row} onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    <View style={rows.row}>{body}</View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    label: { color: c.textMuted, fontSize: TYPE.hint },
    value: { color: c.text, fontSize: TYPE.body, lineHeight: LEADING.body },
    valueLink: { color: c.accent },
  })
);
