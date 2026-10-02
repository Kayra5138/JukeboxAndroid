import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listeningFor, type TrackListening } from '../lib/db/history';
import { formatDateTime } from '../lib/format/date';
import { useLandscape } from '../lib/ui/layout';
import { readAllMetadata, type TrackMetadata } from '../lib/db/metadata';
import { useTrackArtwork } from '../lib/media/artwork';
import { findTrack } from '../lib/media/library';
import { withMetadata, type EnrichedTrack } from '../lib/media/merge';

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'unknown';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatListened(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatPlayed(timestamp: number | null): string {
  return timestamp ? formatDateTime(new Date(timestamp)) : 'never';
}

const MISSING =
  'That track is no longer in the library. It may have been deleted, moved, or left outside the folder Jukebox is reading.';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function ViewScreen() {
  const router = useRouter();
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const [track, setTrack] = useState<EnrichedTrack | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [listening, setListening] = useState<TrackListening | null>(null);
  const [metadata, setMetadata] = useState<TrackMetadata | undefined>();
  const artwork = useTrackArtwork(track);
  const landscape = useLandscape();
  // Sideways the cutout sits beside the screen, and a routed screen gets no
  // horizontal inset from the navigator.
  /*
    Applied to the container, never to the padded content inside it. A style
    that sets `padding` sets all four sides, so a `paddingLeft` after it in the
    array replaces that side outright — and upright, where there is no cutout,
    the inset is zero. That is how the margins disappeared.
  */
  const insets = useSafeAreaInsets();
  const sides = { paddingLeft: insets.left, paddingRight: insets.right };

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const found = await findTrack(trackId);
          setGone(found === null ? MISSING : null);
          setTrack(found ? (withMetadata([found])[0] ?? null) : null);
          setListening(listeningFor(trackId));
          setMetadata(readAllMetadata().get(trackId));
        } catch (error) {
          /*
            Asking the provider for a track can be refused, and reading the
            answer can fail on a database that will not open. Neither leaves
            anything to show, and without this the screen holds its spinner for
            as long as the reader is willing to wait at it: there is nothing on
            it but Back, and nothing about it says to press that.
          */
          setGone(String(error));
        }
      })();
    }, [trackId])
  );

  if (gone) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.gone}>{gone}</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonLabel}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!track || !listening) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color="#ededed" />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.screen, sides]} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        {artwork ? (
          <Image source={{ uri: artwork }} style={styles.art} contentFit="cover" />
        ) : (
          <View style={[styles.art, styles.artEmpty]} />
        )}
        <View style={styles.headingText}>
          <Text style={styles.title}>{track.title}</Text>
          <Text style={styles.artist}>{track.artist ?? 'Unknown artist'}</Text>
        </View>
      </View>

      <View style={landscape ? styles.panels : undefined}>
        <View style={landscape ? styles.panel : undefined}>
          <Text style={styles.section}>Listening</Text>
          <Row label="Times played" value={String(listening.playCount)} />
          <Row label="Played to the end" value={String(listening.completedCount)} />
          <Row label="Time spent" value={formatListened(listening.totalSeconds)} />
          <Row label="First played" value={formatPlayed(listening.firstPlayed)} />
          <Row label="Last played" value={formatPlayed(listening.lastPlayed)} />
        </View>

        <View style={landscape ? styles.panel : undefined}>
          <Text style={styles.section}>File</Text>
          <Row label="Name" value={track.filename ?? '—'} />
          <Row label="Folder" value={track.folder ?? '—'} />
          <Row label="Length" value={formatDuration(track.durationSec)} />
          <Row label="Album" value={track.album ?? '—'} />
          {track.trackNumber != null ? (
            <Row label="Track number" value={String(track.trackNumber)} />
          ) : null}
          <Row label="Release year" value={track.year != null ? String(track.year) : '—'} />
        </View>
      </View>

      <Text style={styles.section}>Tags</Text>
      {track.tags.length > 0 ? (
        <View style={styles.tags}>
          {track.tags.map((tag, index) => (
            <View key={tag} style={[styles.tag, index === 0 && styles.tagPrimary]}>
              <Text style={index === 0 ? styles.tagPrimaryLabel : styles.tagLabel}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.none}>None yet.</Text>
      )}

      <Row
        label="Metadata from"
        value={metadata ? (metadata.source ?? 'not found') : 'not looked up'}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  panels: { flexDirection: 'row', gap: 28 },
  panel: { flex: 1, minWidth: 0 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  gone: { color: '#ededed', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: { backgroundColor: '#252525', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  buttonLabel: { color: '#ededed', fontSize: 15 },
  content: { padding: 20, paddingBottom: 40 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 8 },
  art: { width: 72, height: 72, borderRadius: 8 },
  artEmpty: { backgroundColor: '#1c1c1c' },
  headingText: { flex: 1, gap: 3 },
  title: { color: '#ededed', fontSize: 17, fontWeight: '600' },
  artist: { color: '#7a7a7a', fontSize: 13 },
  section: {
    color: '#5f5f5f',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: 24,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
    paddingVertical: 7,
  },
  rowLabel: { color: '#7a7a7a', fontSize: 13.5 },
  rowValue: { color: '#ededed', fontSize: 13.5, flexShrink: 1, textAlign: 'right' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3a',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagPrimary: { backgroundColor: '#ededed', borderColor: '#ededed' },
  tagLabel: { color: '#c8c8c8', fontSize: 13 },
  tagPrimaryLabel: { color: '#121212', fontSize: 13, fontWeight: '600' },
  none: { color: '#5f5f5f', fontSize: 13 },
});
