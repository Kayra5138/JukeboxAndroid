import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TagEditor } from '../components/TagEditor';
import { forgetMetadata, readAllMetadata, readMetadata, saveMetadata } from '../lib/db/metadata';
import {
  forgetManualTags,
  saveManualTags,
  tagCounts,
  tagsFor,
  type TagEdit,
} from '../lib/db/tags';
import { findTrack } from '../lib/media/library';
import type { Track } from '../lib/types';

type Fields = { artist: string; title: string; album: string; year: string };

const EMPTY: Fields = { artist: '', title: '', album: '', year: '' };

/**
 * What counts as a year. The old test let 9999 through and threw 1900 out with
 * everything before it; the phonograph is the earliest anything could have been
 * recorded, and next year is a date releases are routinely announced for.
 */
const FIRST_YEAR = 1877;
const isReleaseYear = (year: number) =>
  Number.isInteger(year) && year >= FIRST_YEAR && year <= new Date().getFullYear() + 1;

const MISSING =
  'That track is no longer in the library. It may have been deleted, moved, or left outside the folder Jukebox is reading.';

export default function EditScreen() {
  const router = useRouter();
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
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const [track, setTrack] = useState<Track | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [tags, setTags] = useState<TagEdit[]>([]);
  const [draftTag, setDraftTag] = useState('');
  const [wasManual, setWasManual] = useState(false);
  const [known, setKnown] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const found = await findTrack(trackId);
        if (!found) {
          setGone(MISSING);
          return;
        }
        setGone(null);
        setTrack(found);

        // Prefill from whatever is known, so correcting a near-miss is a small
        // edit rather than retyping everything.
        const stored = readAllMetadata().get(trackId);
        setWasManual(stored?.status === 'manual');
        setFields({
          artist: stored?.artist ?? found.artist ?? '',
          title: stored?.title ?? found.title,
          album: stored?.album ?? found.album ?? '',
          year: stored?.year ? String(stored.year) : '',
        });
        // Sources come along for the ride: a tag only becomes the user's own by
        // being typed here, and a lookup can still replace one that was not.
        setTags(tagsFor(trackId).map(({ tag, source }) => ({ tag, source })));
        // Read with the track rather than at mount, so a tag typed on the way
        // here is one of the spellings offered.
        setKnown(tagCounts().map((entry) => entry.tag));
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
  }, [trackId]);

  const save = useCallback(() => {
    if (!track) return;
    const year = Number.parseInt(fields.year, 10);
    const kept = readMetadata(track.id);
    saveMetadata({
      trackId: track.id,
      status: 'manual',
      source: 'manual',
      // Not among the fields this screen offers. A typed correction that left
      // them out would otherwise erase a position the catalogue had found.
      trackNumber: kept?.trackNumber ?? null,
      discNumber: kept?.discNumber ?? null,
      title: fields.title.trim() || track.title,
      artist: fields.artist.trim() || null,
      album: fields.album.trim() || null,
      // The leading tag is the genre: it is the one that best describes the
      // track, which is exactly what the statistics are counting.
      genre: tags[0]?.tag ?? null,
      year: isReleaseYear(year) ? year : null,
      artworkUrl: null,
    });
    saveManualTags(track.id, tags);
    router.back();
  }, [track, fields, tags, router]);

  const revert = useCallback(() => {
    if (!track) return;
    // Both halves of the edit, or the tags outlive the correction they came
    // with and no later lookup is allowed to replace them. What the catalogues
    // found is left where it is: it was never part of the edit being discarded.
    forgetMetadata([track.id], true);
    forgetManualTags(track.id);
    router.back();
  }, [track, router]);

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

  if (!track) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color="#f2f2f2" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, sides]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.filename} numberOfLines={2}>
          {track.filename ?? track.title}
        </Text>

        {(
          [
            ['artist', 'Artist'],
            ['title', 'Title'],
            ['album', 'Album'],
            ['year', 'Year'],
          ] as const
        ).map(([key, label]) => (
          <View key={key} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={fields[key]}
              onChangeText={(value) => setFields((current) => ({ ...current, [key]: value }))}
              keyboardType={key === 'year' ? 'number-pad' : 'default'}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        ))}

        <TagEditor
          tags={tags}
          suggestions={known}
          draft={draftTag}
          onDraft={setDraftTag}
          onChange={setTags}
        />

        <Text style={styles.note}>
          Saved edits are kept as yours: looking up the library again will skip this
          track rather than overwrite what you typed. The first tag is the one
          counted as the genre.
        </Text>

        <View style={styles.actions}>
          <Pressable style={[styles.button, styles.primary]} onPress={save}>
            <Text style={styles.primaryLabel}>Save</Text>
          </Pressable>
          {wasManual ? (
            <Pressable style={styles.button} onPress={revert}>
              <Text style={styles.buttonLabel}>Discard my edit</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  gone: { color: '#f2f2f2', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  content: { padding: 16, gap: 16 },
  filename: { color: '#9a9a9a', fontSize: 13 },
  field: { gap: 6 },
  label: { color: '#9a9a9a', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: '#1c1c1c',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a2a2a',
    color: '#f2f2f2',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  note: { color: '#6a6a6a', fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  button: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primary: { backgroundColor: '#7ab8ff' },
  primaryLabel: { color: '#121212', fontSize: 15, fontWeight: '600' },
  buttonLabel: { color: '#f2f2f2', fontSize: 15 },
});
