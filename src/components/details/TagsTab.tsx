import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { FormScroll } from '../FormScroll';
import { TagEditor } from '../TagEditor';
import { saveGenre } from '../../lib/db/metadata';
import { saveManualTags, tagCounts, tagsFor, type TagEdit } from '../../lib/db/tags';
import { isAbortError } from '../../lib/metadata/http';
import { lookUpTags, withLookupTags } from '../../lib/metadata/single';
import type { Track } from '../../lib/types';
import { shared } from './styles';

const SOURCE_NAMES = { musicbrainz: 'MusicBrainz', itunes: 'Apple' } as const;

function read(trackId: string): TagEdit[] {
  // Sources come along: a tag only becomes the user's own by being typed
  // here, and a lookup can still replace one that was not.
  return tagsFor(trackId).map(({ tag, source }) => ({ tag, source }));
}

/**
 * A track's tags and their order.
 *
 * The editor is the one the old edit screen had, moved here whole. What is new
 * is that a lookup can be asked for on the spot, and that it only changes the
 * list on screen: what was typed stays where it was put, what a catalogue said
 * before is replaced by what it says now, and none of it is kept until Save.
 */
export function TagsTab({
  track,
  onChanged,
}: {
  /** With corrections laid over it, so a lookup asks about the names as they now are. */
  track: Track;
  onChanged: () => void;
}) {
  const [tags, setTags] = useState<TagEdit[]>([]);
  const [draft, setDraft] = useState('');
  const [known, setKnown] = useState<string[]>([]);
  const [looking, setLooking] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const search = useRef<AbortController | null>(null);

  useEffect(() => () => search.current?.abort(), []);

  useEffect(() => {
    setTags(read(track.id));
    // Read with the track rather than at mount, so a tag typed on the way
    // here is one of the spellings offered.
    setKnown(tagCounts().map((entry) => entry.tag));
    setNote(null);
  }, [track.id]);

  const lookUp = useCallback(async () => {
    search.current?.abort();
    const controller = new AbortController();
    search.current = controller;
    setLooking(true);
    setNote(null);
    try {
      const found = await lookUpTags(track, controller.signal);
      if (controller.signal.aborted) return;
      if (!found) {
        setNote({ text: 'No tags were found for this track.', bad: true });
        return;
      }
      setTags((before) => withLookupTags(before, found));
      setNote({
        text: `${found.tags.length} from ${SOURCE_NAMES[found.source]}. Arrange them, then save to keep them.`,
      });
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setNote({ text: 'The search did not get through.', bad: true });
    } finally {
      if (!controller.signal.aborted) setLooking(false);
    }
  }, [track]);

  const save = useCallback(() => {
    saveManualTags(track.id, tags);
    // Read back rather than taken from the list: saving drops a blank and
    // folds two spellings into one, and the genre has to be what was kept.
    const kept = read(track.id);
    saveGenre(track.id, kept[0]?.tag ?? null);
    setTags(kept);
    setNote({ text: 'Saved.' });
    onChanged();
  }, [track.id, tags, onChanged]);

  return (
    <FormScroll contentContainerStyle={shared.content}>
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
        Searches for this track's tags. The ones you typed stay; the ones a lookup brought
        before are replaced by what it finds now.
      </Text>

      <TagEditor
        tags={tags}
        suggestions={known}
        draft={draft}
        onDraft={setDraft}
        onChange={setTags}
      />

      {note ? <Text style={note.bad ? shared.noteBad : shared.note}>{note.text}</Text> : null}

      <View style={shared.actions}>
        <Pressable style={[shared.action, shared.actionWide]} onPress={save}>
          <Text style={shared.actionLabel}>Save</Text>
        </Pressable>
      </View>
      <Text style={shared.hint}>
        The first tag is the one counted as the genre. A tag you typed is kept as yours:
        no later lookup will remove it.
      </Text>
    </FormScroll>
  );
}
