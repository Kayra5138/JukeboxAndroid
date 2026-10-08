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
import { canWriteFiles, lineFor, writable, writeToFiles } from '../../lib/filetags';
import { formatDateTime } from '../../lib/format/date';
import { useT, type Strings } from '../../lib/i18n/index';
import { useTrackArtwork } from '../../lib/media/artwork';
import { artworkChanged } from '../../lib/media/artworkEvents';
import type { EnrichedTrack } from '../../lib/media/enriched';
import { isAbortError } from '../../lib/metadata/http';
import { usePlayerState } from '../../lib/player/PlayerProvider';
import {
  lookUpGeneral,
  numberComplaint,
  typedPlace,
  typedYear,
} from '../../lib/metadata/single';
import { makeStyles, useColours, usePressed } from '../../lib/theme/index';
import type { Track } from '../../lib/types';
import { useShared } from './styles';

type Fields = {
  title: string;
  artist: string;
  album: string;
  year: string;
  trackNumber: string;
  discNumber: string;
};

const FIELDS: { key: keyof Fields; number?: 'year' | 'place' }[] = [
  { key: 'title' },
  { key: 'artist' },
  { key: 'album' },
  { key: 'year', number: 'year' },
  { key: 'trackNumber', number: 'place' },
  { key: 'discNumber', number: 'place' },
];

/**
 * What the cover is going to be once this is saved.
 *
 * Kept apart from the cover there is, because a picture chosen and then
 * thought better of must leave the old one exactly where it was.
 */
type Cover = { kind: 'kept' } | { kind: 'chosen'; uri: string } | { kind: 'removed' };

const SOURCE_NAMES = { musicbrainz: 'MusicBrainz', itunes: 'Apple' } as const;

function formatDuration(seconds: number, t: Strings): string {
  if (seconds <= 0) return t.details.general.unknown;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatListened(seconds: number, t: Strings): string {
  const said = t.details.general;
  if (seconds < 60) return said.listenedSeconds(Math.round(seconds));
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return said.listenedMinutes(minutes);
  return said.listenedHours(Math.floor(minutes / 60), minutes % 60);
}

function formatPlayed(timestamp: number | null, t: Strings): string {
  return timestamp ? formatDateTime(new Date(timestamp), t) : t.details.general.never;
}

function cameFrom(stored: TrackMetadata | null, t: Strings): string {
  const from = t.details.general.from;
  if (!stored) return from.notLookedUp;
  if (stored.status === 'manual') return from.yourEdit;
  if (stored.status === 'not_found') return from.notFound;
  return stored.source === 'itunes' ? 'Apple' : stored.source === 'musicbrainz' ? 'MusicBrainz' : (stored.source ?? from.lookup);
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
  const styles = useStyles();
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
 *
 * Save writes to the app's own database and never to the song. Putting what
 * is saved into the file itself is a separate button further down, pressed on
 * purpose, and nothing else on this screen does it.
 */
export function GeneralTab({
  track,
  shown: merged,
  onChanged,
}: {
  /** As the library reads it, before anything looked up or typed is laid over it. */
  track: Track;
  /** The same track as the app shows it, which is what Write to file writes. */
  shown: EnrichedTrack;
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
  const [writing, setWriting] = useState(false);
  /** What became of the last Write to file, kept apart from what Save says. */
  const [fileNote, setFileNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const { current: playing } = usePlayerState();
  const current = useTrackArtwork(track);
  const search = useRef<AbortController | null>(null);
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const shared = useShared();
  const pressed = usePressed();
  const said = t.details.general;

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
    setFileNote(null);
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
  // file is the file's, and taking one out of a file is not something this
  // app does.
  const removable =
    cover.kind === 'chosen' || (cover.kind === 'kept' && Boolean(stored?.artworkUrl));

  const complaints = FIELDS.map((field) =>
    field.number ? numberComplaint(fields[field.key], field.number, t) : null
  );
  const valid = complaints.every((complaint) => complaint == null);

  const pick = useCallback(async () => {
    try {
      const picked = await JukeboxAudio.pickImageAsync?.();
      // Null is backing out of the gallery, which changes nothing.
      if (picked) {
        setCover({ kind: 'chosen', uri: picked });
        setNote({ text: said.coverChosen });
      }
    } catch (error) {
      setNote({
        text: error instanceof Error ? error.message : t.common.pictureFailed,
        bad: true,
      });
    }
  }, [said]);

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
        setNote({ text: said.nothingFound, bad: true });
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

      setNote({
        text: said.found(found.sources.map((source) => SOURCE_NAMES[source]), withCover),
      });
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setNote({ text: t.details.searchFailed, bad: true });
    } finally {
      if (!controller.signal.aborted) setLooking(false);
    }
  }, [track, fields.title, fields.artist, fields.album, t, said]);

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
    setNote({ text: t.common.saved });
    onChanged();
  }, [valid, track, fields, cover, reset, onChanged, t]);

  const discard = useCallback(() => {
    // The row and nothing else. The tags are edited in their own tab, and
    // what is listened to is not an edit.
    forgetMetadata([track.id], true);
    artworkChanged();
    reset();
    setNote({ text: said.editGone });
    onChanged();
  }, [track.id, reset, onChanged, said]);

  // Anything typed or chosen and not yet saved. What goes into the file is
  // what is saved, so with this true the fields on screen and the file would
  // end up saying different things, and the button waits for Save.
  const asSaved = fieldsOf(track, stored);
  const unsaved =
    cover.kind !== 'kept' || FIELDS.some((field) => fields[field.key] !== asSaved[field.key]);

  /**
   * Writes what the app shows for this track into the file.
   *
   * The system asks first. Backing out of that is not an error and changes
   * nothing, and is said as plainly as a write is.
   */
  const writeFile = useCallback(async () => {
    setWriting(true);
    setFileNote(null);
    try {
      const outcomes = await writeToFiles([merged], { playingId: playing?.id ?? null });
      const result = outcomes?.[0]?.result;
      if (!result) {
        setFileNote({ text: said.nothingWritten });
        return;
      }
      setFileNote({ text: lineFor(result, t), bad: result.status === 'failed' || result.status === 'skipped' });
      // The file's own tags are different now, and the rows below show them.
      if (result.status === 'written') onChanged();
    } catch (error) {
      setFileNote({
        text: error instanceof Error ? error.message : said.couldNotWrite,
        bad: true,
      });
    } finally {
      setWriting(false);
    }
  }, [merged, playing?.id, onChanged, t, said]);

  return (
    <FormScroll contentContainerStyle={shared.content}>
      <View style={styles.coverRow}>
        <Pressable onPress={() => void pick()} accessibilityLabel={said.chooseCoverLabel}>
          {shown ? (
            <Image source={{ uri: shown }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, styles.coverEmpty]}>
              <Text style={styles.coverEmptyLabel}>{said.noCover}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.coverActions}>
          <Pressable android_ripple={pressed} style={shared.button} onPress={() => void pick()}>
            <Text style={shared.buttonLabel}>{said.chooseFromGallery}</Text>
          </Pressable>
          {removable ? (
            <Pressable android_ripple={pressed} style={shared.button} onPress={() => setCover({ kind: 'removed' })}>
              <Text style={shared.buttonLabel}>{said.removeCover}</Text>
            </Pressable>
          ) : null}
          {cover.kind !== 'kept' ? (
            <Pressable onPress={() => setCover({ kind: 'kept' })}>
              <Text style={shared.link}>{said.keepCover}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Pressable
        android_ripple={pressed}
        style={[shared.action, looking && shared.actionOff]}
        disabled={looking}
        onPress={() => void lookUp()}>
        {looking ? (
          <ActivityIndicator color={c.onPrimary} />
        ) : (
          <Text style={shared.actionLabel}>{t.details.lookUp}</Text>
        )}
      </Pressable>
      <Text style={shared.hint}>{said.lookUpHint}</Text>

      {FIELDS.map((field, index) => (
        <View key={field.key} style={shared.field}>
          <Text style={shared.label}>{t.format.upper(said.fields[field.key])}</Text>
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
          android_ripple={pressed}
          style={[shared.action, shared.actionWide, !valid && shared.actionOff]}
          disabled={!valid}
          onPress={save}>
          <Text style={shared.actionLabel}>{t.common.save}</Text>
        </Pressable>
        {stored?.status === 'manual' ? (
          <Pressable android_ripple={pressed} style={shared.button} onPress={discard}>
            <Text style={shared.buttonLabel}>{said.discard}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={shared.hint}>{said.saveHint}</Text>

      {/* Not drawn at all where it cannot be done: Android 10, or a build of
          the native side from before it could. */}
      {canWriteFiles() ? (
        <>
          <Text style={shared.section}>{t.format.upper(said.inFile)}</Text>
          {writable(track) ? (
            <>
              <Pressable
                android_ripple={pressed}
                style={[shared.button, styles.fileButton, (writing || unsaved) && shared.actionOff]}
                disabled={writing || unsaved}
                accessibilityRole="button"
                accessibilityLabel={said.writeLabel}
                accessibilityState={{ disabled: writing || unsaved, busy: writing }}
                onPress={() => void writeFile()}>
                {writing ? (
                  <ActivityIndicator color={c.text} />
                ) : (
                  <Text style={shared.buttonLabel}>{said.writeToFile}</Text>
                )}
              </Pressable>
              <Text style={shared.hint}>{unsaved ? said.saveFirst : said.writeHint}</Text>
            </>
          ) : (
            <Text style={shared.hint}>{said.cannotWrite}</Text>
          )}
          {fileNote ? (
            <Text style={fileNote.bad ? shared.noteBad : shared.note} accessibilityLiveRegion="polite">
              {fileNote.text}
            </Text>
          ) : null}
        </>
      ) : null}

      {listening ? (
        <>
          <Text style={shared.section}>{t.format.upper(said.listening)}</Text>
          <Row label={said.timesPlayed} value={t.format.number(listening.playCount)} />
          <Row label={said.playedToEnd} value={t.format.number(listening.completedCount)} />
          <Row label={said.timeSpent} value={formatListened(listening.totalSeconds, t)} />
          <Row label={said.firstPlayed} value={formatPlayed(listening.firstPlayed, t)} />
          <Row label={said.lastPlayed} value={formatPlayed(listening.lastPlayed, t)} />
        </>
      ) : null}

      <Text style={shared.section}>{t.format.upper(said.file)}</Text>
      <Row label={said.name} value={track.filename ?? said.unknown} />
      <Row label={said.folder} value={track.folder ?? said.unknown} />
      <Row label={said.length} value={formatDuration(track.durationSec, t)} />
      <Row label={said.detailsFrom} value={cameFrom(stored, t)} />
    </FormScroll>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cover: { width: 124, height: 124, borderRadius: 10 },
  coverEmpty: {
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  coverEmptyLabel: { color: c.textFaint, fontSize: 12 },
  coverActions: { flex: 1, gap: 10, alignItems: 'flex-start' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, paddingVertical: 7 },
  rowLabel: { color: c.textMuted, fontSize: 13.5 },
  rowValue: { color: c.text, fontSize: 13.5, flexShrink: 1, textAlign: 'right' },
  fileButton: { alignSelf: 'flex-start', alignItems: 'center', minWidth: 132 },
}));
