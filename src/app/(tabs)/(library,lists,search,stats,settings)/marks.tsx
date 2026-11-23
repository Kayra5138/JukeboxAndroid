import { useEffect, useMemo, useState } from 'react';
import { LEADING, RADIUS, SPACE, TYPE } from '../../../lib/theme/measures';
import { ScreenState } from '../../../components/ScreenState';
import { TimedRow } from '../../../components/TimedRow';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { Image } from '../../../components/Picture';
import { TextPrompt } from '../../../components/TextPrompt';
import { useT } from '../../../lib/i18n/index';
import { libraryState, refreshLibrary } from '../../../lib/library/index';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import { useTrackArtwork } from '../../../lib/media/artwork';
import type { EnrichedTrack } from '../../../lib/media/merge';
import { usePlayerActions, usePlayerState } from '../../../lib/player/PlayerProvider';
import { removeMark, setMarkNote, useAllMarks, type TapeMark } from '../../../lib/tapes/marks';
import { partsOf } from '../../../lib/tapes/order';
import { isTape } from '../../../lib/tapes/tape';
import { makeStyles, scene } from '../../../lib/theme/index';
import { haptic } from '../../../lib/ui/haptics';
import { CLIP_SUBVIEWS, LIST_WINDOW } from '../../../lib/ui/lists';
import { durationLabel } from '../../../lib/youtube/types';
import { usePageRoom } from '../../../components/Page';

type Section = { key: string; track: EnrichedTrack; data: TapeMark[] };

/**
 * Every place marked in every tape, a tape at a time: the one marked last at
 * the top, its marks in the order they come in it. A mark pressed plays its
 * tape from there, the rest of its record after it; held, its note is written
 * again; its cross takes it away. A tape no longer in the library is not
 * shown, though its marks are kept for when it comes back.
 */
export default function MarksScreen() {
  const t = useT();
  const styles = useStyles();
  // The bar of what is playing is along the foot of every page of a tab (see the tabs' layout), laid over it in a theme of glass.
  // The skeleton of a page (`usePageRoom`), its rows running to the edges.
  const room = usePageRoom({ edge: true });
  const said = t.player.marks;
  const marks = useAllMarks();
  const library = useLibraryTracks();
  const { current, playWhenReady } = usePlayerState();
  const { playQueue, seekTo, toggle } = usePlayerActions();
  const [editing, setEditing] = useState<TapeMark | null>(null);
  /*
    Held, a mark's note is asked for as the finger comes up rather than while
    it is still down: the box opened under a finger that then lifted, and the
    lifting went to the window the box replaced, so the first press in the
    box, its Save, was taken as the end of that touch and did nothing.
  */

  // Opened before any screen has read the library: read it now.
  useEffect(() => {
    if (libraryState().kind !== 'library') void refreshLibrary();
  }, []);

  const tapes = useMemo(() => library.filter((track) => isTape(track)), [library]);
  const sections = useMemo((): Section[] => {
    const byId = new Map(tapes.map((track) => [track.id, track]));
    const grouped = new Map<string, TapeMark[]>();
    // Latest made first, so the first tape met is the one marked last.
    for (const mark of marks) {
      if (!byId.has(mark.trackId)) continue;
      grouped.set(mark.trackId, [...(grouped.get(mark.trackId) ?? []), mark]);
    }
    return [...grouped].map(([id, list]) => ({
      key: id,
      track: byId.get(id)!,
      data: list.sort((a, b) => a.positionSec - b.positionSec),
    }));
  }, [marks, tapes]);

  const play = async (track: EnrichedTrack, seconds: number) => {
    haptic('player', 'tick');
    if (current?.id !== track.id) {
      const { tracks, index } = partsOf(track, tapes);
      await playQueue(tracks, index);
    }
    await seekTo(seconds);
    // Gone to is to be heard: the tape playing but paused is played from the mark.
    if (current?.id === track.id && !playWhenReady) await toggle();
  };

  return (
    <View style={styles.screen}>
      <SectionList
        removeClippedSubviews={CLIP_SUBVIEWS}
        windowSize={LIST_WINDOW}
        sections={sections}
        keyExtractor={(mark) => String(mark.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={room}
        ListEmptyComponent={<ScreenState kind="empty" text={said.noneAnywhere} />}
        renderSectionHeader={({ section }) => <TapeHeading track={section.track} count={section.data.length} />}
        renderItem={({ item, section }) => (
          <TimedRow
            // Under the cover of the heading, beside it, as the rows of a thing are under its name.
            style={styles.row}
            at={durationLabel(item.positionSec)}
            text={item.note ?? said.noNote}
            empty={!item.note}
            lines={4}
            detail={t.format.date(new Date(item.createdAt))}
            accessibilityHint={said.playHint}
            holdLabel={said.editNote}
            onPress={() => void play(section.track, item.positionSec)}
            onHold={() => setEditing(item)}
            removeLabel={said.remove(durationLabel(item.positionSec))}
            onRemove={() => {
              haptic('choices', 'toggleOff');
              removeMark(item.id);
            }}
          />
        )}
        ListFooterComponent={sections.length > 0 ? <Text style={styles.hint}>{said.howTo}</Text> : null}
      />
      <TextPrompt
        visible={editing != null}
        heading={editing ? said.noteAt(durationLabel(editing.positionSec)) : ''}
        placeholder={said.notePlaceholder}
        initial={editing?.note ?? ''}
        optional
        onSubmit={(note) => {
          if (editing) setMarkNote(editing.id, note);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

/** A tape over its marks: its picture, its name and whose it is. */
function TapeHeading({ track, count }: { track: EnrichedTrack; count: number }) {
  const t = useT();
  const styles = useStyles();
  const artwork = useTrackArtwork(track);
  return (
    <View style={styles.heading} accessibilityRole="header">
      {artwork ? <Image source={{ uri: artwork }} style={styles.art} contentFit="cover" /> : <View style={[styles.art, styles.artEmpty]} />}
      <View style={styles.headingText}>
        <Text style={styles.title} numberOfLines={2}>{track.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {[track.artist, t.player.marks.count(count)].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  heading: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingHorizontal: SPACE.l, paddingTop: SPACE.l, paddingBottom: SPACE.xs },
  art: { width: 44, height: 44, borderRadius: RADIUS.cover },
  artEmpty: { backgroundColor: c.surface },
  headingText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  title: { color: c.text, fontSize: TYPE.body, fontWeight: '600' },
  subtitle: { color: c.textMuted, fontSize: TYPE.hint },
  row: { paddingLeft: 72 },
  hint: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.hint, paddingHorizontal: SPACE.l, paddingTop: SPACE.l },
}));
