import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { FormScroll } from '../FormScroll';
import { TagEditor } from '../TagEditor';
import { saveGenre } from '../../lib/db/metadata';
import { useT } from '../../lib/i18n/index';
import { saveManualTags, tagCounts, tagsFor, type TagEdit } from '../../lib/db/tags';
import { isAbortError } from '../../lib/metadata/http';
import { lookUpTags, withLookupTags } from '../../lib/metadata/single';
import { useColours, usePressed } from '../../lib/theme/index';
import type { Track } from '../../lib/types';
import { useShared } from './styles';

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
  const t = useT();
  const c = useColours();
  const shared = useShared();
  const pressed = usePressed();

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
        setNote({ text: t.details.tags.noneFound, bad: true });
        return;
      }
      setTags((before) => withLookupTags(before, found));
      setNote({
        text: t.details.tags.found(found.tags.length, SOURCE_NAMES[found.source]),
      });
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setNote({ text: t.details.searchFailed, bad: true });
    } finally {
      if (!controller.signal.aborted) setLooking(false);
    }
  }, [track, t]);

  const save = useCallback(() => {
    saveManualTags(track.id, tags);
    // Read back rather than taken from the list: saving drops a blank and
    // folds two spellings into one, and the genre has to be what was kept.
    const kept = read(track.id);
    saveGenre(track.id, kept[0]?.tag ?? null);
    setTags(kept);
    setNote({ text: t.common.saved });
    onChanged();
  }, [track.id, tags, onChanged, t]);

  return (
    <FormScroll contentContainerStyle={shared.content}>
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
      <Text style={shared.hint}>{t.details.tags.lookUpHint}</Text>

      <TagEditor
        tags={tags}
        suggestions={known}
        draft={draft}
        onDraft={setDraft}
        onChange={setTags}
      />

      {note ? <Text style={note.bad ? shared.noteBad : shared.note}>{note.text}</Text> : null}

      <View style={shared.actions}>
        <Pressable android_ripple={pressed} style={[shared.action, shared.actionWide]} onPress={save}>
          <Text style={shared.actionLabel}>{t.common.save}</Text>
        </Pressable>
      </View>
      <Text style={shared.hint}>{t.details.tags.saveHint}</Text>
    </FormScroll>
  );
}
