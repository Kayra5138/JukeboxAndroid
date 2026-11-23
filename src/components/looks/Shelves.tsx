import { memo, useEffect, useMemo, useState } from 'react';
import { CARD_GAP, PAGE, ROW, SPACE, TYPE, RADIUS } from '../../lib/theme/measures';
import { Rule, useRows } from '../settings/rows';
import { FadingScroll } from '../FadingScroll';
import { PressRing, type PressRingFor } from '../PressMenu';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlayIcon, QueueIcon, ShuffleIcon, TickIcon } from '../Icons';
import { TrackCover } from './shared';
import { playsMark, shelfListens } from '../../lib/db/history';
import { useT } from '../../lib/i18n/index';
import type { EnrichedTrack } from '../../lib/media/merge';
import { artistKey, spreadShuffle } from '../../lib/media/shuffle';
import { usePlayerActions } from '../../lib/player/PlayerProvider';
import { makeStyles, useColours } from '../../lib/theme/index';
import { announce } from '../../lib/ui/announce';

/**
 * Over the Tracks view, rows of covers to choose from without knowing what
 * is wanted: what came in last, what is usually played at this hour, what
 * has been on repeat, what has not been heard in a while, what has never
 * been, and the library's biggest genres. Each scrolls sideways; a cover
 * plays its shelf from there, and the buttons by a shelf's name play the
 * shelf, shuffle it or put it at the end of the queue.
 */
const DAY = 24 * 60 * 60 * 1000;
const MANY = 20;
/** How many covers a shelf has up before it is first scrolled: as many as are seen, and a few. */
const FIRST = 6;

type Shelf = { key: string; name: string; tracks: EnrichedTrack[] };

function genreOf(track: EnrichedTrack): string | null {
  const raw = track.genre ?? track.tags[0] ?? null;
  if (!raw) return null;
  const word = raw.trim().toLowerCase();
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : null;
}

function mostOf(tracks: EnrichedTrack[], score: ReadonlyMap<string, number>): EnrichedTrack[] {
  return tracks
    .filter((track) => (score.get(track.id) ?? 0) > 0)
    .sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0))
    .slice(0, MANY);
}

/*
  Drawn again only for other tracks or listens: the list it heads is drawn
  again for much less, and a few dozen covers with it each time.
*/
export const Shelves = memo(function Shelves({
  tracks,
  counts,
  played,
  onPlay,
  onHold,
  ring,
}: {
  tracks: EnrichedTrack[];
  counts: ReadonlyMap<string, number>;
  played: ReadonlyMap<string, number>;
  onPlay: (tracks: EnrichedTrack[], index: number) => void;
  onHold: (track: EnrichedTrack) => void;
  /** The ring a song held and dragged opens, as on a row of the list (`PressMenu`). */
  ring?: PressRingFor<EnrichedTrack>;
}) {
  const styles = useStyles();
  const rows = useRows();
  const c = useColours();
  const t = useT();
  const [listens, setListens] = useState<ReturnType<typeof shelfListens> | null>(null);
  /*
    The shelves scrolled so far, which have all their covers up. The rest
    have the few that are in sight and a few more: every cover of every shelf
    at once was some hundred and sixty pictures put up for a screen that shows
    a dozen. Once up a cover stays: a shelf that let go of those scrolled past
    drew them again on the way back, and each blinked as its picture came.
  */
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    try {
      setListens(listensNow());
    } catch {
      setListens(null);
    }
  }, [tracks]);

  const shelves = useMemo(() => {
    const out: Shelf[] = [];
    const add = (key: string, name: string, held: EnrichedTrack[]) => {
      if (held.length >= 3) out.push({ key, name, tracks: held });
    };
    const words = t.library.screen.shelf;
    add('new', words.added, [...tracks].sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0)).slice(0, MANY));
    if (listens) {
      const hour = new Date().getHours();
      add('hour', words.around(`${String(hour).padStart(2, '0')}:00`), mostOf(tracks, listens.atHour));
      add('repeat', words.repeat, mostOf(tracks, listens.recent));
    }
    const now = Date.now();
    add(
      'while',
      words.while,
      tracks
        .filter((track) => {
          const last = played.get(track.id);
          return last != null && now - last > 60 * DAY;
        })
        .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
        .slice(0, MANY)
    );
    // Picked at random, and spread, so that playing a shelf from its start is not one artist twice running either.
    add('never', words.never, spreadShuffle(tracks.filter((track) => !counts.get(track.id)), artistKey).slice(0, MANY));
    const genres = new Map<string, EnrichedTrack[]>();
    for (const track of tracks) {
      const genre = genreOf(track);
      if (!genre) continue;
      const held = genres.get(genre);
      if (held) held.push(track);
      else genres.set(genre, [track]);
    }
    for (const [genre, held] of [...genres.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3)) {
      add(`genre:${genre}`, genre, spreadShuffle(held, artistKey).slice(0, MANY));
    }
    return out;
  }, [counts, listens, played, t, tracks]);

  return (
    <View style={styles.box}>
      {/*
        Each shelf a card of its own, its name and buttons over a line and its
        covers under it (24 Nov, Kayra): over the page and apart from the
        covers, the heading hung in the air, and looked unfinished.
      */}
      {shelves.map((shelf) => (
        <View key={shelf.key} style={rows.card}>
          <View style={styles.heading}>
            <Text style={styles.name} numberOfLines={1}>
              {shelf.name}
            </Text>
            <ShelfButtons shelf={shelf} onPlay={onPlay} />
          </View>
          <Rule />
          {/* The covers fade at the side where there are more, to say that there are (24 Nov, Kayra). */}
          <FadingScroll
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.covers}
            // The rest of the shelf put up as soon as it is touched, and left up.
            onScrollBeginDrag={() => {
              if (!opened.has(shelf.key)) setOpened(new Set([...opened, shelf.key]));
            }}>
            {(opened.has(shelf.key) ? shelf.tracks : shelf.tracks.slice(0, FIRST)).map((item, index) => (
              <PressRing key={item.id} ring={ring} item={item}>
                <Pressable
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                  onPress={() => onPlay(shelf.tracks, index)}
                  onLongPress={() => onHold(item)}>
                  <TrackCover track={item} size={CARD} />
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.artist} numberOfLines={1}>
                    {item.artist ?? ''}
                  </Text>
                </Pressable>
              </PressRing>
            ))}
          </FadingScroll>
        </View>
      ))}
      <Text style={styles.all}>{t.library.screen.shelf.all}</Text>
    </View>
  );
});

/** Play, shuffle and the queue, by a shelf's name: small, as the shelf's are not the page's. */
function ShelfButtons({ shelf, onPlay }: { shelf: Shelf; onPlay: (tracks: EnrichedTrack[], index: number) => void }) {
  const styles = useStyles();
  const c = useColours();
  const t = useT();
  const { addToQueue } = usePlayerActions();
  const [queued, setQueued] = useState(false);
  useEffect(() => {
    if (!queued) return;
    const timer = setTimeout(() => setQueued(false), QUEUED_FOR_MS);
    return () => clearTimeout(timer);
  }, [queued]);
  const queueAll = async () => {
    for (const track of shelf.tracks) await addToQueue(track);
    setQueued(true);
    announce(t.library.screen.queuedAll(shelf.tracks.length));
  };
  return (
    <View style={styles.buttons}>
      <Pressable
        hitSlop={6}
        style={styles.playAll}
        accessibilityRole="button"
        accessibilityLabel={t.library.screen.shelf.play(shelf.name)}
        onPress={() => onPlay(shelf.tracks, 0)}>
        <PlayIcon size={12} color={c.accent} />
      </Pressable>
      <Pressable
        hitSlop={6}
        style={styles.playAll}
        accessibilityRole="button"
        accessibilityLabel={t.library.screen.shelf.shuffle(shelf.name)}
        // Shuffled here rather than by the player's shuffle, so the queue itself is in the new order; and spread, as every shuffle of many artists is (`media/shuffle.ts`).
        onPress={() => onPlay(spreadShuffle(shelf.tracks, artistKey), 0)}>
        <ShuffleIcon size={13} color={c.accent} />
      </Pressable>
      <Pressable
        hitSlop={6}
        style={styles.playAll}
        accessibilityRole="button"
        accessibilityLabel={t.library.screen.shelf.queue(shelf.name)}
        onPress={() => void queueAll()}>
        {queued ? <TickIcon size={13} color={c.accent} /> : <QueueIcon size={13} color={c.accent} />}
      </Pressable>
    </View>
  );
}

/** How long the queue button says it has done its work, as the page's does. */
const QUEUED_FOR_MS = 1800;

const CARD = 116;

/*
  The listens the shelves are made from, as last read and what they were
  read at: read again only for a listen written or taken away since, or
  another hour. Read at every change of the library, they were every listen
  ever made gone through again, every few seconds while songs were being
  looked up.
*/
let shelvesWere: { mark: string; hour: number; day: number; listens: ReturnType<typeof shelfListens> } | null = null;

function listensNow(): ReturnType<typeof shelfListens> {
  const mark = playsMark();
  const hour = new Date().getHours();
  const day = Math.floor(Date.now() / DAY);
  if (shelvesWere?.mark !== mark || shelvesWere.hour !== hour || shelvesWere.day !== day) {
    shelvesWere = { mark, hour, day, listens: shelfListens(Date.now() - 30 * DAY, hour) };
  }
  return shelvesWere.listens;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    box: { paddingTop: SPACE.xs, paddingHorizontal: PAGE.side, gap: CARD_GAP, alignSelf: 'stretch' },
    heading: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s, paddingHorizontal: ROW.horizontal, paddingVertical: ROW.vertical },
    // All the room the buttons leave, so that they stand at the right whatever the shelf is called (24 Nov, Kayra).
    name: { flex: 1, color: c.text, fontSize: TYPE.heading, fontWeight: '700' },
    buttons: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
    playAll: {
      width: 26,
      height: 26,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderStrong,
    },
    covers: { paddingHorizontal: ROW.horizontal, paddingVertical: ROW.vertical, gap: SPACE.s },
    card: { width: CARD },
    pressed: { opacity: 0.6 },
    title: { color: c.text, fontSize: TYPE.small, fontWeight: '600', marginTop: SPACE.xs },
    artist: { color: c.textMuted, fontSize: TYPE.label },
    all: { color: c.text, fontSize: TYPE.heading, fontWeight: '700', paddingTop: SPACE.xs, paddingBottom: SPACE.xs },
  })
);
