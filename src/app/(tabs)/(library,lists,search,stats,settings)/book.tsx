import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { TextButton } from '../../../components/Button';
import { ContinueCard, HeadCover, HeadNote, MediaHead, MediaPage, SectionLabel } from '../../../components/MediaPage';
import { MediaRow } from '../../../components/MediaRow';
import { useTrackMenu } from '../../../components/useTrackMenu';
import { PressRing } from '../../../components/PressMenu';
import { useTrackRing } from '../../../components/trackRing';
import { fetchBook, type Book, type BookPart } from '../../../lib/books/archive';
import { bookPartId, fetchBookParts } from '../../../lib/books/fetch';
import { useT } from '../../../lib/i18n/index';
import { libraryState, refreshLibrary } from '../../../lib/library/index';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import type { EnrichedTrack } from '../../../lib/media/merge';
import { usePlayerActions, usePlayerState } from '../../../lib/player/PlayerProvider';
import { nextToPlay } from '../../../lib/tapes/order';
import { progressOf, useTapePlaces } from '../../../lib/tapes/places';
import { makeStyles } from '../../../lib/theme/index';
import { SPACE, TYPE } from '../../../lib/theme/measures';
import { haptic } from '../../../lib/ui/haptics';
import { useDownloadLibraryRevision, useDownloads } from '../../../lib/youtube/DownloadsProvider';
import { durationLabel, isActive, jobForVideo, statusLabel } from '../../../lib/youtube/types';

/**
 * One book from the Internet Archive: what it is, who wrote it and how long
 * it runs, and its parts in their order, each fetched on its own or all of
 * them at once into a folder of the Tapes folder named after the book. Parts
 * that are here play from here, the rest of the book after them; the book is
 * taken up at one press from the part part way through, or the first not heard.
 */
export default function BookScreen() {
  const t = useT();
  const styles = useStyles();
  const said = t.search.tapes.books;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const { jobs, refresh } = useDownloads();
  const library = useLibraryTracks();
  const places = useTapePlaces();
  const { playQueue, toggle } = usePlayerActions();
  const { current, playWhenReady } = usePlayerState();
  const menu = useTrackMenu({});
  // A part held and slid from, with the finger never lifted: see `pressMenu.ts`.
  const ring = useTrackRing(menu);

  // Opened before any screen has read the library: read it now.
  useEffect(() => {
    if (libraryState().kind !== 'library') void refreshLibrary();
  }, []);
  // And again as each part fetched from here arrives, so it is there to play without leaving and coming back.
  const arrived = useDownloadLibraryRevision();
  useEffect(() => {
    if (arrived > 0) void refreshLibrary();
  }, [arrived]);

  useEffect(() => {
    let gone = false;
    void fetchBook(id).then(
      (read) => {
        if (!gone) setBook(read);
      },
      () => {
        if (!gone) setFailed(true);
      }
    );
    return () => {
      gone = true;
    };
  }, [id]);

  /*
    Each part as it stands: its download, and the tape it became where it is
    here. A part fetched and then deleted keeps its download and has no tape,
    and is offered again.
  */
  const byId = useMemo(() => new Map(library.map((track) => [track.id, track])), [library]);
  const standing = useMemo(
    () =>
      (book?.parts ?? []).map((part, at) => {
        const job = book ? jobForVideo(jobs, bookPartId(book, part)) : undefined;
        const track = job?.status === 'done' && job.trackId ? byId.get(job.trackId) : undefined;
        return { part, job, track, at };
      }),
    [book, byId, jobs]
  );
  const here = useMemo(() => standing.flatMap((one) => (one.track ? [one.track] : [])), [standing]);
  const wanted = standing.filter((one) => !one.track && !(one.job && isActive(one.job))).map((one) => one.part);
  const next = nextToPlay(here, places, 'first');
  const nextPlace = next ? (places.get(next.id) ?? null) : null;
  const nextProgress = progressOf(nextPlace);
  const nextIsOn = next != null && current?.id === next.id;

  const runtime = (book?.parts ?? []).reduce((sum, part) => sum + (part.durationSec ?? 0), 0);
  const bytes = (book?.parts ?? []).reduce((sum, part) => sum + (part.bytes ?? 0), 0);

  const play = (track: EnrichedTrack) => {
    if (track.id === current?.id) {
      if (!playWhenReady) void toggle();
      return;
    }
    haptic('player', 'click');
    void playQueue(here, Math.max(0, here.findIndex((one) => one.id === track.id)));
  };

  const fetchParts = async (parts: readonly BookPart[]) => {
    if (!book || busy || parts.length === 0) return;
    setBusy(true);
    try {
      await fetchBookParts(book, parts);
      haptic('results', 'confirm');
      await refresh(true);
    } catch {
      haptic('results', 'reject');
    }
    setBusy(false);
  };

  const podcasts = t.search.tapes.podcasts;

  return (
    <MediaPage
      head={(side) =>
        book ? (
          <MediaHead
            side={side}
            cover={<HeadCover uri={book.cover} />}
            title={book.title}
            lines={[book.author, said.stats(book.parts.length, Math.round(runtime / 60), here.length)]}
            about={book.description}
            carryOn={
              // Taken up at one press: the part part way through, or the first not heard.
              next ? (
                <ContinueCard
                  label={nextProgress != null ? podcasts.continue : podcasts.start}
                  title={next.title}
                  progress={nextProgress != null && nextPlace ? nextProgress : null}
                  line={
                    nextProgress != null && nextPlace
                      ? t.library.tapes.left(Math.max(1, Math.round((nextPlace.durationSec - nextPlace.positionSec) / 60)))
                      : durationLabel(next.durationSec)
                  }
                  playing={nextIsOn && playWhenReady}
                  accessibilityLabel={`${nextIsOn && playWhenReady ? t.common.pause : nextProgress != null ? podcasts.continue : podcasts.start}, ${next.title}`}
                  onPress={() => (nextIsOn ? void toggle() : play(next))}
                />
              ) : null
            }
            actions={
              wanted.length > 0
                ? [
                    {
                      label: wanted.length === book.parts.length ? said.fetchAll : said.fetchRest(wanted.length),
                      kind: 'primary',
                      busy,
                      onPress: () => void fetchParts(wanted),
                    },
                  ]
                : undefined
            }>
            {wanted.length > 0 && bytes > 0 ? <HeadNote>{said.size(Math.max(1, Math.round(bytes / 1_000_000)))}</HeadNote> : null}
          </MediaHead>
        ) : null
      }
      above={book ? <SectionLabel>{said.parts(book.parts.length)}</SectionLabel> : null}
      items={book ? standing : failed ? [] : null}
      keyOf={(one) => one.part.name}
      error={failed ? said.bookFailed : null}
      renderItem={(item) => {
        const { part, job, track } = item;
        // Its number in the book where a song has its cover.
        const number = <Text style={styles.number}>{String(item.at + 1).padStart(2, '0')}</Text>;
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
                lead={number}
                title={part.title}
                playing={track.id === current?.id}
                meta={state}
                metaOn={place?.finished === true}
                onPress={() => play(track)}
                onLongPress={() => menu.open(track)}
              />
            </PressRing>
          );
        }
        const locked = job != null && isActive(job);
        return (
          <MediaRow
            lead={number}
            title={part.title}
            subtitle={part.durationSec ? durationLabel(part.durationSec) : undefined}
            trailing={
              <TextButton
                label={locked && job ? statusLabel(job, t) : podcasts.download}
                tone="plain"
                accessibilityLabel={podcasts.downloadNamed(part.title)}
                disabled={locked || busy}
                onPress={() => void fetchParts([part])}
              />
            }
          />
        );
      }}
      sheets={menu.element}
    />
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    number: { color: c.textMuted, fontSize: TYPE.hint, fontVariant: ['tabular-nums'], minWidth: SPACE.xl },
  })
);
