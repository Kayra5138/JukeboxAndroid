import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlayIcon } from '../Icons';
import { TrackCover } from './shared';
import { shelfListens } from '../../lib/db/history';
import type { EnrichedTrack } from '../../lib/media/merge';
import { shuffled } from '../../lib/media/shuffle';
import { makeStyles, useColours } from '../../lib/theme/index';

/**
 * Over the Tracks view, rows of covers to choose from without knowing what
 * is wanted: what came in last, what is usually played at this hour, what
 * has been on repeat, what has not been heard in a while, what has never
 * been, and the library's biggest genres. Each scrolls sideways; a cover
 * plays its shelf from there, and the button by a shelf's name the shelf.
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
}: {
  tracks: EnrichedTrack[];
  counts: ReadonlyMap<string, number>;
  played: ReadonlyMap<string, number>;
  onPlay: (tracks: EnrichedTrack[], index: number) => void;
  onHold: (track: EnrichedTrack) => void;
}) {
  const styles = useStyles();
  const c = useColours();
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
      setListens(shelfListens(Date.now() - 30 * DAY, new Date().getHours()));
    } catch {
      setListens(null);
    }
  }, [tracks]);

  const shelves = useMemo(() => {
    const out: Shelf[] = [];
    const add = (key: string, name: string, held: EnrichedTrack[]) => {
      if (held.length >= 3) out.push({ key, name, tracks: held });
    };
    add('new', 'Recently added', [...tracks].sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0)).slice(0, MANY));
    if (listens) {
      const hour = new Date().getHours();
      add('hour', `Around ${String(hour).padStart(2, '0')}:00`, mostOf(tracks, listens.atHour));
      add('repeat', 'On repeat this month', mostOf(tracks, listens.recent));
    }
    const now = Date.now();
    add(
      'while',
      'Not heard in a while',
      tracks
        .filter((track) => {
          const last = played.get(track.id);
          return last != null && now - last > 60 * DAY;
        })
        .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
        .slice(0, MANY)
    );
    add('never', 'Never played', shuffled(tracks.filter((track) => !counts.get(track.id))).slice(0, MANY));
    const genres = new Map<string, EnrichedTrack[]>();
    for (const track of tracks) {
      const genre = genreOf(track);
      if (!genre) continue;
      const held = genres.get(genre);
      if (held) held.push(track);
      else genres.set(genre, [track]);
    }
    for (const [genre, held] of [...genres.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3)) {
      add(`genre:${genre}`, genre, shuffled(held).slice(0, MANY));
    }
    return out;
  }, [counts, listens, played, tracks]);

  return (
    <View style={styles.box}>
      {shelves.map((shelf) => (
        <View key={shelf.key} style={styles.shelf}>
          <View style={styles.heading}>
            <Text style={styles.name} numberOfLines={1}>
              {shelf.name}
            </Text>
            <Pressable hitSlop={8} style={styles.playAll} onPress={() => onPlay(shelf.tracks, 0)}>
              <PlayIcon size={12} color={c.accent} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.covers}
            // The rest of the shelf put up as soon as it is touched, and left up.
            onScrollBeginDrag={() => {
              if (!opened.has(shelf.key)) setOpened(new Set([...opened, shelf.key]));
            }}>
            {(opened.has(shelf.key) ? shelf.tracks : shelf.tracks.slice(0, FIRST)).map((item, index) => (
              <Pressable
                key={item.id}
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
            ))}
          </ScrollView>
        </View>
      ))}
      <Text style={styles.all}>All songs</Text>
    </View>
  );
});

const CARD = 116;

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    box: { paddingTop: 4, gap: 14, alignSelf: 'stretch' },
    shelf: { gap: 6 },
    heading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
    name: { flexShrink: 1, color: c.text, fontSize: 17, fontWeight: '700' },
    playAll: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderStrong,
    },
    covers: { paddingHorizontal: 16, gap: 10 },
    card: { width: CARD },
    pressed: { opacity: 0.6 },
    title: { color: c.text, fontSize: 13, fontWeight: '600', marginTop: 5 },
    artist: { color: c.textMuted, fontSize: 11.5 },
    all: { color: c.text, fontSize: 17, fontWeight: '700', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  })
);
