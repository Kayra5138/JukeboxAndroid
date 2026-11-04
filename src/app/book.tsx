import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PauseIcon, PlayIcon } from '../components/Icons';
import { Image } from '../components/Picture';
import { Pressable } from '../components/Pressable';
import { useTrackMenu } from '../components/useTrackMenu';
import { PressRing } from '../components/PressMenu';
import { useTrackRing } from '../components/trackRing';
import { fetchBook, type Book, type BookPart } from '../lib/books/archive';
import { bookPartId, fetchBookParts } from '../lib/books/fetch';
import { useT } from '../lib/i18n/index';
import { libraryState, refreshLibrary } from '../lib/library/index';
import { useLibraryTracks } from '../lib/library/useLibrary';
import type { EnrichedTrack } from '../lib/media/merge';
import { usePlayerActions, usePlayerState } from '../lib/player/PlayerProvider';
import { nextToPlay } from '../lib/tapes/order';
import { progressOf, useTapePlaces } from '../lib/tapes/places';
import { makeStyles, outlinedClip, scene, useColours, usePressed } from '../lib/theme/index';
import { haptic } from '../lib/ui/haptics';
import { CLIP_SUBVIEWS } from '../lib/ui/lists';
import { useDownloadLibraryRevision, useDownloads } from '../lib/youtube/DownloadsProvider';
import { durationLabel, isActive, jobForVideo, statusLabel } from '../lib/youtube/types';

/**
 * One book from the Internet Archive: what it is, who wrote it and how long
 * it runs, and its parts in their order, each fetched on its own or all of
 * them at once into a folder of the Tapes folder named after the book. Parts
 * that are here play from here, the rest of the book after them; the book is
 * taken up at one press from the part part way through, or the first not heard.
 */
export default function BookScreen() {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const insets = useSafeAreaInsets();
  const said = t.search.tapes.books;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
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
      (book?.parts ?? []).map((part) => {
        const job = book ? jobForVideo(jobs, bookPartId(book, part)) : undefined;
        const track = job?.status === 'done' && job.trackId ? byId.get(job.trackId) : undefined;
        return { part, job, track };
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

  if (!book) {
    return (
      <View style={[styles.screen, styles.centered]}>
        {failed ? <Text style={styles.bad}>{said.bookFailed}</Text> : <ActivityIndicator color={c.text} />}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        removeClippedSubviews={CLIP_SUBVIEWS}
        data={standing}
        keyExtractor={(one) => one.part.name}
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        ListHeaderComponent={
          <>
            <View style={styles.head}>
              <Image source={{ uri: book.cover }} style={styles.cover} contentFit="cover" />
              <View style={styles.headText}>
                <Text style={styles.title} numberOfLines={4}>{book.title}</Text>
                {book.author ? <Text style={styles.muted} numberOfLines={2}>{book.author}</Text> : null}
                <Text style={styles.stats}>{said.stats(book.parts.length, Math.round(runtime / 60), here.length)}</Text>
              </View>
            </View>
            {book.description ? (
              <Pressable accessibilityRole="button" onPress={() => setMore(!more)} disabled={book.description.length < 200}>
                <Text style={styles.summary} numberOfLines={more ? undefined : 4}>{book.description}</Text>
                {book.description.length >= 200 ? <Text style={styles.more}>{more ? t.search.tapes.podcasts.less : t.search.tapes.podcasts.more}</Text> : null}
              </Pressable>
            ) : null}
            {next ? (
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityLabel={`${nextIsOn && playWhenReady ? t.common.pause : nextProgress != null ? t.search.tapes.podcasts.continue : t.search.tapes.podcasts.start}, ${next.title}`}
                style={styles.continue}
                onPress={() => (nextIsOn ? void toggle() : play(next))}>
                <View style={styles.continueText}>
                  <Text style={styles.continueLabel}>
                    {t.format.upper(nextProgress != null ? t.search.tapes.podcasts.continue : t.search.tapes.podcasts.start)}
                  </Text>
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
            {wanted.length > 0 ? (
              <>
                <Pressable
                  android_ripple={pressed}
                  accessibilityRole="button"
                  disabled={busy}
                  style={[styles.fetch, busy && styles.disabled]}
                  onPress={() => void fetchParts(wanted)}>
                  <Text style={styles.fetchLabel}>{wanted.length === book.parts.length ? said.fetchAll : said.fetchRest(wanted.length)}</Text>
                </Pressable>
                {bytes > 0 ? <Text style={styles.note}>{said.size(Math.max(1, Math.round(bytes / 1_000_000)))}</Text> : null}
              </>
            ) : null}
            <Text accessibilityRole="header" style={styles.section}>{t.format.upper(said.parts(book.parts.length))}</Text>
          </>
        }
        renderItem={({ item, index }) => {
          const { part, job, track } = item;
          const number = String(index + 1).padStart(2, '0');
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
                style={styles.part}
                onPress={() => play(track)}
                onLongPress={() => {
                  haptic('holds', 'hold');
                  menu.open(track);
                }}>
                <Text style={styles.number}>{number}</Text>
                <Text style={[styles.partTitle, track.id === current?.id && styles.partOn]} numberOfLines={2}>{part.title}</Text>
                <Text style={[styles.state, place?.finished && styles.stateHeard]}>{state}</Text>
              </Pressable>
              </PressRing>
            );
          }
          const locked = job != null && isActive(job);
          return (
            <View style={styles.part}>
              <Text style={styles.number}>{number}</Text>
              <View style={styles.partText}>
                <Text style={styles.partTitle} numberOfLines={2}>{part.title}</Text>
                {part.durationSec ? <Text style={styles.muted}>{durationLabel(part.durationSec)}</Text> : null}
              </View>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityLabel={`${t.search.tapes.podcasts.download} ${part.title}`}
                disabled={locked || busy}
                style={[styles.download, locked && styles.disabled]}
                onPress={() => void fetchParts([part])}>
                <Text style={styles.link}>{locked && job ? statusLabel(job, t) : t.search.tapes.podcasts.download}</Text>
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
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20 },
  head: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  cover: { width: 112, height: 112, borderRadius: 12 },
  headText: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: c.text, fontSize: 19, fontWeight: '600' },
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  stats: { color: c.textFaint, fontSize: 12, marginTop: 2 },
  summary: { color: c.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 14 },
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
  fetch: { marginTop: 16, alignSelf: 'flex-start', paddingHorizontal: 20, minHeight: 44, borderRadius: 22, justifyContent: 'center', overflow: 'hidden', backgroundColor: c.primary, ...outlinedClip(c, c.primary) },
  fetchLabel: { color: c.onPrimary, fontSize: 14.5, fontWeight: '600' },
  note: { color: c.textFaint, fontSize: 12, marginTop: 6, marginLeft: 4 },
  section: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 24, marginBottom: 6, marginLeft: 4 },
  part: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  number: { color: c.textFaint, fontSize: 12.5, fontVariant: ['tabular-nums'], minWidth: 22 },
  partText: { flex: 1, minWidth: 0, gap: 2 },
  partTitle: { flex: 1, color: c.text, fontSize: 14.5 },
  partOn: { color: c.accent, fontWeight: '600' },
  state: { color: c.textMuted, fontSize: 12.5 },
  stateHeard: { color: c.textFaint },
  download: { paddingHorizontal: 4, minHeight: 44, justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  link: { color: c.text, fontSize: 13, fontWeight: '500' },
  bad: { color: c.danger, fontSize: 13, textAlign: 'center' },
}));
