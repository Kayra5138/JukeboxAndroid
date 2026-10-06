import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import JukeboxAudio from '../../../modules/jukebox-audio';
import { FormScroll, TextField } from '../FormScroll';
import { saveCredit } from '../../lib/db/credits';
import { listeningFor, type TrackListening } from '../../lib/db/history';
import {
  forgetMetadata,
  readMetadata,
  saveMetadata,
  type TrackMetadata,
} from '../../lib/db/metadata';
import { tagsFor } from '../../lib/db/tags';
import { formatDateTime } from '../../lib/format/date';
import { useTrackArtwork } from '../../lib/media/artwork';
import { artworkChanged } from '../../lib/media/artworkEvents';
import { isAbortError } from '../../lib/metadata/http';
import {
  lookUpGeneral,
  numberComplaint,
  typedPlace,
  typedYear,
} from '../../lib/metadata/single';
import type { Track } from '../../lib/types';
import { shared } from './styles';

type Fields = {
  title: string;
  artist: string;
  album: string;
  year: string;
  trackNumber: string;
  discNumber: string;
};

const FIELDS: { key: keyof Fields; label: string; number?: 'year' | 'place' }[] = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'album', label: 'Album' },
  { key: 'year', label: 'Release year', number: 'year' },
  { key: 'trackNumber', label: 'Track number', number: 'place' },
  { key: 'discNumber', label: 'Disc number', number: 'place' },
];

/**
 * What the cover is going to be once this is saved.
 *
 * Kept apart from the cover there is, because a picture chosen and then
 * thought better of must leave the old one exactly where it was.
 */
type Cover = { kind: 'kept' } | { kind: 'chosen'; uri: string } | { kind: 'removed' };

const SOURCE_NAMES = { musicbrainz: 'MusicBrainz', itunes: 'Apple' } as const;

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

function cameFrom(stored: TrackMetadata | null): string {
  if (!stored) return 'not looked up';
  if (stored.status === 'manual') return 'your edit';
  if (stored.status === 'not_found') return 'not found';
  return stored.source === 'itunes' ? 'Apple' : stored.source === 'musicbrainz' ? 'MusicBrainz' : (stored.source ?? 'a lookup');
}

/** What is known of the track, with the file's own word where nothing better is. */
function fieldsOf(track: Track, stored: TrackMetadata | null): Fields {
  const known = stored && stored.status !== 'not_found' ? stored : null;
  const place = known?.trackNumber ?? track.trackNumber;
  return {
    title: known?.title ?? track.title,
    artist: known?.artist ?? track.artist ?? '',
    album: known?.album ?? track.album ?? '',
    year: known?.year ? String(known.year) : '',
    trackNumber: place != null ? String(place) : '',
    discNumber: known?.discNumber != null ? String(known.discNumber) : '',
  };
}

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

/**
 * Everything about a track that is not its tags or its words: what it is
 * called, whose it is, the record it is on, its cover — all of which can be
 * corrected — and, below, what the phone knows of the file and of how it has
 * been listened to, which cannot.
 *
 * Nothing here is written until Save. A lookup fills the fields in and stops,
 * because a catalogue can come back with another recording of the same song
 * and the person looking at it is the one who can tell.
 */
export function GeneralTab({
  track,
  onChanged,
}: {
  /** As the library reads it, before anything looked up or typed is laid over it. */
  track: Track;
  /** Told after a save or a discard, so whatever shows the track can read it again. */
  onChanged: () => void;
}) {
  const [stored, setStored] = useState<TrackMetadata | null>(null);
  const [fields, setFields] = useState<Fields>(() => fieldsOf(track, null));
  const [cover, setCover] = useState<Cover>({ kind: 'kept' });
  /** The file's own picture, for showing what removing the cover would leave. */
  const [embedded, setEmbedded] = useState<string | null>(null);
  const [listening, setListening] = useState<TrackListening | null>(null);
  const [looking, setLooking] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const current = useTrackArtwork(track);
  const search = useRef<AbortController | null>(null);

  useEffect(() => () => search.current?.abort(), []);

  /** Reads the track again from what is stored, dropping whatever was typed. */
  const reset = useCallback(() => {
    const row = readMetadata(track.id);
    setStored(row);
    setFields(fieldsOf(track, row));
    setCover({ kind: 'kept' });
  }, [track]);

  // Keyed on the id and not on the track: the screen reads the track again
  // after every save, and a new object for the same file must not throw away
  // what is being typed in the other fields.
  useEffect(() => {
    reset();
    setListening(listeningFor(track.id));
    setNote(null);
    let cancelled = false;
    void JukeboxAudio.getEmbeddedArtworkAsync(track.id)
      .then((uri) => {
        if (!cancelled) setEmbedded(uri);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id]);

  const set = (key: keyof Fields, value: string) =>
    setFields((before) => ({ ...before, [key]: value }));

  const shown =
    cover.kind === 'chosen' ? cover.uri : cover.kind === 'removed' ? embedded : current;
  // Only a cover of the app's own can be taken off. The picture inside the
  // file is the file's, and this screen does not write to files.
  const removable =
    cover.kind === 'chosen' || (cover.kind === 'kept' && Boolean(stored?.artworkUrl));

  const complaints = FIELDS.map((field) =>
    field.number ? numberComplaint(fields[field.key], field.number) : null
  );
  const valid = complaints.every((complaint) => complaint == null);

  const pick = useCallback(async () => {
    try {
      const picked = await JukeboxAudio.pickImageAsync?.();
      // Null is backing out of the gallery, which changes nothing.
      if (picked) {
        setCover({ kind: 'chosen', uri: picked });
        setNote({ text: 'Cover chosen. Save to keep it.' });
      }
    } catch (error) {
      setNote({
        text: error instanceof Error ? error.message : 'That picture would not load.',
        bad: true,
      });
    }
  }, []);

  const lookUp = useCallback(async () => {
    search.current?.abort();
    const controller = new AbortController();
    search.current = controller;
    setLooking(true);
    setNote(null);
    try {
      // Asked about what is in the fields, not about what is stored: fixing a
      // misspelt artist and looking again is the whole use of having both here.
      const found = await lookUpGeneral(
        {
          ...track,
          title: fields.title.trim() || track.title,
          artist: fields.artist.trim() || null,
          album: fields.album.trim() || null,
        },
        controller.signal
      );
      if (controller.signal.aborted) return;
      if (!found) {
        setNote({ text: 'Nothing was found for that title and artist.', bad: true });
        return;
      }
      if (found.credit) saveCredit(found.credit.text, found.credit.oneArtist);

      // Only what the catalogues had. A field they said nothing about keeps
      // what was in it, rather than being emptied by a silence.
      setFields((before) => ({
        title: found.title ?? before.title,
        artist: found.artist ?? before.artist,
        album: found.album ?? before.album,
        year: found.year != null ? String(found.year) : before.year,
        trackNumber: found.trackNumber != null ? String(found.trackNumber) : before.trackNumber,
        discNumber: found.discNumber != null ? String(found.discNumber) : before.discNumber,
      }));

      let withCover = false;
      if (found.artworkUrl && JukeboxAudio.downloadArtworkAsync) {
        const uri = await JukeboxAudio.downloadArtworkAsync(found.artworkUrl).catch(() => null);
        if (controller.signal.aborted) return;
        if (uri) {
          setCover({ kind: 'chosen', uri });
          withCover = true;
        }
      }

      const names = found.sources.map((source) => SOURCE_NAMES[source]).join(' and ');
      setNote({
        text: `Found on ${names}${withCover ? ', cover included' : ''}. Check it, then save to keep it.`,
      });
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setNote({ text: 'The search did not get through.', bad: true });
    } finally {
      if (!controller.signal.aborted) setLooking(false);
    }
  }, [track, fields.title, fields.artist, fields.album]);

  const save = useCallback(() => {
    if (!valid) return;
    const kept = readMetadata(track.id);
    saveMetadata({
      trackId: track.id,
      status: 'manual',
      source: 'manual',
      title: fields.title.trim() || track.title,
      artist: fields.artist.trim() || null,
      album: fields.album.trim() || null,
      // The tags have a tab of their own and are not this one's to change. The
      // genre is the first of them, so it is read rather than carried over.
      genre: tagsFor(track.id)[0]?.tag ?? kept?.genre ?? null,
      year: typedYear(fields.year),
      trackNumber: typedPlace(fields.trackNumber),
      discNumber: typedPlace(fields.discNumber),
      artworkUrl:
        cover.kind === 'chosen'
          ? cover.uri
          : cover.kind === 'removed'
            ? null
            : (kept?.artworkUrl ?? null),
    });
    artworkChanged();
    reset();
    setNote({ text: 'Saved.' });
    onChanged();
  }, [valid, track, fields, cover, reset, onChanged]);

  const discard = useCallback(() => {
    // The row and nothing else. The tags are edited in their own tab, and
    // what is listened to is not an edit.
    forgetMetadata([track.id], true);
    artworkChanged();
    reset();
    setNote({ text: 'Your edit is gone. A lookup can fill this in again.' });
    onChanged();
  }, [track.id, reset, onChanged]);

  return (
    <FormScroll contentContainerStyle={shared.content}>
      <View style={styles.coverRow}>
        <Pressable onPress={() => void pick()} accessibilityLabel="Choose a cover from the gallery">
          {shown ? (
            <Image source={{ uri: shown }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, styles.coverEmpty]}>
              <Text style={styles.coverEmptyLabel}>No cover</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.coverActions}>
          <Pressable style={shared.button} onPress={() => void pick()}>
            <Text style={shared.buttonLabel}>Choose from gallery</Text>
          </Pressable>
          {removable ? (
            <Pressable style={shared.button} onPress={() => setCover({ kind: 'removed' })}>
              <Text style={shared.buttonLabel}>Remove cover</Text>
            </Pressable>
          ) : null}
          {cover.kind !== 'kept' ? (
            <Pressable onPress={() => setCover({ kind: 'kept' })}>
              <Text style={shared.link}>Keep the one it had</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Pressable
        style={[shared.action, looking && shared.actionOff]}
        disabled={looking}
        onPress={() => void lookUp()}>
        {looking ? (
          <ActivityIndicator color="#121212" />
        ) : (
          <Text style={shared.actionLabel}>Look up</Text>
        )}
      </Pressable>
      <Text style={shared.hint}>
        Searches for the title and artist as they are written below, and fills in what it
        finds: names, album, year, place on the record and cover.
      </Text>

      {FIELDS.map((field, index) => (
        <View key={field.key} style={shared.field}>
          <Text style={shared.label}>{field.label}</Text>
          <TextField
            style={shared.input}
            value={fields[field.key]}
            onChangeText={(value) => set(field.key, value)}
            keyboardType={field.number ? 'number-pad' : 'default'}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {complaints[index] ? <Text style={shared.complaint}>{complaints[index]}</Text> : null}
        </View>
      ))}

      {note ? <Text style={note.bad ? shared.noteBad : shared.note}>{note.text}</Text> : null}

      <View style={shared.actions}>
        <Pressable
          style={[shared.action, shared.actionWide, !valid && shared.actionOff]}
          disabled={!valid}
          onPress={save}>
          <Text style={shared.actionLabel}>Save</Text>
        </Pressable>
        {stored?.status === 'manual' ? (
          <Pressable style={shared.button} onPress={discard}>
            <Text style={shared.buttonLabel}>Discard my edit</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={shared.hint}>
        What is saved here is kept as yours: looking the library up again will leave this
        track alone rather than write over it.
      </Text>

      {listening ? (
        <>
          <Text style={shared.section}>Listening</Text>
          <Row label="Times played" value={String(listening.playCount)} />
          <Row label="Played to the end" value={String(listening.completedCount)} />
          <Row label="Time spent" value={formatListened(listening.totalSeconds)} />
          <Row label="First played" value={formatPlayed(listening.firstPlayed)} />
          <Row label="Last played" value={formatPlayed(listening.lastPlayed)} />
        </>
      ) : null}

      <Text style={shared.section}>File</Text>
      <Row label="Name" value={track.filename ?? 'unknown'} />
      <Row label="Folder" value={track.folder ?? 'unknown'} />
      <Row label="Length" value={formatDuration(track.durationSec)} />
      <Row label="Details from" value={cameFrom(stored)} />
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cover: { width: 124, height: 124, borderRadius: 10 },
  coverEmpty: {
    backgroundColor: '#1c1c1c',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a2a',
  },
  coverEmptyLabel: { color: '#5f5f5f', fontSize: 12 },
  coverActions: { flex: 1, gap: 10, alignItems: 'flex-start' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, paddingVertical: 7 },
  rowLabel: { color: '#7a7a7a', fontSize: 13.5 },
  rowValue: { color: '#ededed', fontSize: 13.5, flexShrink: 1, textAlign: 'right' },
});
