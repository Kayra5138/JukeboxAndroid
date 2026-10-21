import { useCallback, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from './Pressable';

import { OptionSheet } from './OptionSheet';
import { TagPrompt } from './TagPrompt';
import { WriteFilesSheet } from './WriteFilesSheet';
import {
  forgetMetadata,
  readAllMetadata,
  readMetadata,
  refreshGenres,
  saveMetadataMany,
} from '../lib/db/metadata';
import { addTagToTracks, allTags, removeTagFromTracks, tagsAmong, type TagCount } from '../lib/db/tags';
import { canWriteFiles } from '../lib/filetags';
import { useT } from '../lib/i18n/index';
import { refreshLibrary } from '../lib/library/index';
import { artworkChanged } from '../lib/media/artworkEvents';
import { spreadCovers } from '../lib/media/coverSpread';
import type { EnrichedTrack } from '../lib/media/enriched';
import { scanLibrary } from '../lib/media/library';
import { withMetadata } from '../lib/media/merge';
import { chooseCoverFor } from '../lib/metadata/albumActions';
import {
  bulkLookupRunning,
  startBulkLookup,
  startCoverLookup,
  startLyricsLookup,
  useBulkLookup,
  type BulkKind,
  type BulkOutcome,
} from '../lib/metadata/bulk';
import {
  CLEARS,
  fieldsSet,
  SHARED_FIELDS,
  sharedEditEntry,
  sharedFields,
  sharedPlaceholder,
  type SharedEdit,
  type SharedField,
} from '../lib/metadata/edit';
import { describeOutcome } from '../lib/metadata/outcome';
import { numberComplaint } from '../lib/metadata/single';
import { canonicalLabel } from '../lib/metadata/text';
import { usePlayerState } from '../lib/player/PlayerProvider';
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';
import type { Track } from '../lib/types';

/**
 * Everything that can be done to tracks chosen together.
 *
 * The Tags screen and the library each have a way of choosing tracks, and
 * each began with the few things it needed doing to them. Somebody with a
 * hundred tracks filed under "Unknown artist" wants all of it in either
 * place: to find out about them, to put them right by hand, to file them,
 * and to be rid of them. So it is here once, as the track menu is, and the
 * two screens each draw it and say what became of it.
 *
 * The screen keeps the choosing. It hands this the ids chosen, the list
 * picker and the eraser its own track menu already has (`useTrackMenu`), and
 * is told when what it shows may have changed — `edited`, after which the
 * same tracks are still worth acting on, or `cleared`, after which they are
 * gone or back to nothing and the choice is over.
 */

export type SelectionAction =
  | 'lookUp'
  | 'covers'
  | 'lyrics'
  | 'edit'
  | 'addTag'
  | 'removeTag'
  | 'cover'
  | 'write'
  | 'addToList'
  | 'reset'
  | 'delete';

/** The sheet's parts, in order; `details.selection.actions` says what each entry is. */
const SECTIONS: readonly { key: 'find' | 'change' | 'other'; actions: readonly SelectionAction[] }[] = [
  { key: 'find', actions: ['lookUp', 'covers', 'lyrics'] },
  { key: 'change', actions: ['edit', 'addTag', 'removeTag', 'cover', 'write'] },
  { key: 'other', actions: ['addToList', 'reset', 'delete'] },
];

/** The entries that start the app's one run (`metadata/bulk.ts`), and wait while one is going. */
const RUNS: ReadonlySet<SelectionAction> = new Set(['lookUp', 'covers', 'lyrics']);

/** The fields of the shared edit as they stand in their boxes. */
type Typed = Record<SharedField, string>;

const NOTHING_TYPED: Typed = { artist: '', albumArtist: '', album: '', year: '' };

const NOTHING_CLEARED: readonly SharedField[] = [];

/**
 * The tracks of a shared edit, as the files have them, and what each field
 * says on all of them: see `sharedFields`.
 */
type Editing = { tracks: Track[]; shared: Record<SharedField, string | null> };

/** The chosen tracks as the files have them, which is what lookups and edits start from. */
async function filesOf(trackIds: readonly string[]): Promise<{ chosen: Track[]; all: Track[] }> {
  const all = await scanLibrary();
  const wanted = new Set(trackIds);
  return { chosen: all.filter((track) => wanted.has(track.id)), all };
}

export function useSelectionActions({
  trackIds,
  addToList,
  erase,
  onChanged,
  onSaid,
  sayRuns = false,
}: {
  /** The tracks chosen. */
  trackIds: readonly string[];
  /** The screen's track menu's list picker, opened for these ids. */
  addToList: (trackIds: string[]) => void;
  /** The screen's track menu's eraser, which takes the files out of the queue as well. */
  erase: (trackIds: string[]) => Promise<boolean>;
  /** What is shown may have changed; see above for the two kinds. */
  onChanged: (how: 'edited' | 'cleared') => void;
  /** A line to show for a moment: what was done, or why it was not. */
  onSaid: (line: string) => void;
  /**
   * Whether to say how a run started from here ended. Not on the Tags screen,
   * which shows every run and how it ended whoever started it.
   */
  sayRuns?: boolean;
}): {
  /** Opens the sheet with every entry on it. */
  open: () => void;
  /** Does one entry's work, for a screen that offers it as a button of its own. */
  run: (action: SelectionAction) => void;
  element: ReactNode;
} {
  const t = useT();
  const said = t.details.selection;
  const bulk = useBulkLookup();
  const busy = bulk.progress !== null;
  const { current } = usePlayerState();
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [tagging, setTagging] = useState(false);
  const [untagging, setUntagging] = useState<TagCount[] | null>(null);
  const [resetting, setResetting] = useState(false);
  const [writingTo, setWritingTo] = useState<EnrichedTrack[] | null>(null);

  const open = useCallback(() => setSheet(true), []);
  const close = useCallback(() => setSheet(false), []);

  /** Says how a run ended, where this screen is the one to say it. */
  const ended = useCallback(
    (kind: BulkKind, outcome: BulkOutcome | null) => {
      if (!outcome || !sayRuns) return;
      const line = describeOutcome(kind, outcome, t);
      if (line) onSaid(line);
    },
    [sayRuns, onSaid, t]
  );

  const startRun = useCallback(
    async (action: 'lookUp' | 'covers' | 'lyrics', ids: string[]) => {
      // One at a time: see `metadata/bulk.ts`. Asked before anything is
      // forgotten, so that being turned away throws nothing out.
      if (bulkLookupRunning()) {
        onSaid(said.busy);
        return;
      }
      const { chosen, all } = await filesOf(ids);
      if (chosen.length === 0) return;
      if (action === 'lookUp') {
        // Forgotten first, so tracks already tried are tried again rather than
        // skipped. A track somebody edited keeps the edit, and is not looked up.
        forgetMetadata(ids);
        ended('details', await startBulkLookup(chosen, all));
      } else if (action === 'covers') {
        ended('covers', await startCoverLookup(chosen, all));
      } else {
        // Asked about by the names the library shows, as a play asks.
        const shown = withMetadata(chosen);
        ended(
          'lyrics',
          await startLyricsLookup(
            shown.map((track) => ({
              id: track.id,
              query: {
                title: track.title,
                artist: track.artist,
                album: track.album,
                durationSec: track.durationSec,
              },
            }))
          )
        );
      }
    },
    [ended, onSaid, said]
  );

  const startEdit = useCallback(async (ids: string[]) => {
    const { chosen } = await filesOf(ids);
    if (chosen.length === 0) return;
    setEditing({ tracks: chosen, shared: sharedFields(chosen, readAllMetadata()) });
  }, []);

  const saveEdit = useCallback(
    (edit: SharedEdit) => {
      const target = editing;
      setEditing(null);
      if (!target || fieldsSet(edit).length === 0) return;
      const tags = allTags();
      const entries = target.tracks.flatMap((track) => {
        const entry = sharedEditEntry(
          track,
          readMetadata(track.id),
          edit,
          // The genre is the first tag, which the tags decide; see the details screen.
          tags.get(track.id)?.[0]?.tag ?? null
        );
        return entry ? [entry] : [];
      });
      saveMetadataMany(entries);
      const ids = entries.map((entry) => entry.trackId);
      // A record renamed or moved under another artist may show another cover.
      artworkChanged();
      void refreshLibrary();
      // And a track moved onto a record by its name takes the record's cover,
      // as a save on the details screen does.
      void spreadCovers({ trackIds: ids });
      onSaid(said.edited(entries.length));
      onChanged('edited');
    },
    [editing, onChanged, onSaid, said]
  );

  const addTag = useCallback(
    (typed: string) => {
      setTagging(false);
      const ids = [...trackIds];
      const tag = canonicalLabel(typed);
      if (!tag || ids.length === 0) return;
      addTagToTracks(ids, tag);
      refreshGenres(ids);
      void refreshLibrary();
      onSaid(said.tagAdded(tag, ids.length));
      onChanged('edited');
    },
    [trackIds, onChanged, onSaid, said]
  );

  const removeTag = useCallback(
    (tag: string) => {
      const carrying = untagging?.find((entry) => entry.tag === tag)?.trackCount ?? 0;
      setUntagging(null);
      const ids = [...trackIds];
      removeTagFromTracks(ids, tag);
      refreshGenres(ids);
      void refreshLibrary();
      onSaid(said.tagRemoved(tag, carrying));
      onChanged('edited');
    },
    [trackIds, untagging, onChanged, onSaid, said]
  );

  const reset = useCallback(() => {
    setResetting(false);
    const ids = [...trackIds];
    // What lookups found, and only that: an edit somebody typed stays, as it
    // does when the same tracks are looked up again.
    forgetMetadata(ids);
    artworkChanged();
    void refreshLibrary();
    onChanged('cleared');
  }, [trackIds, onChanged]);

  const run = useCallback(
    (action: SelectionAction) => {
      setSheet(false);
      const ids = [...trackIds];
      if (ids.length === 0) return;
      if (action === 'lookUp' || action === 'covers' || action === 'lyrics') void startRun(action, ids);
      else if (action === 'edit') void startEdit(ids);
      else if (action === 'addTag') setTagging(true);
      else if (action === 'removeTag') {
        const carried = tagsAmong(ids);
        if (carried.length === 0) onSaid(said.noTags);
        else setUntagging(carried);
      } else if (action === 'cover') {
        chooseCoverFor(ids).then(
          (chosen) => {
            // Null is backing out of the gallery, which changes nothing.
            if (chosen == null) return;
            onSaid(t.library.albumTools.coverChosen(chosen));
            onChanged('edited');
          },
          (error: unknown) => onSaid(error instanceof Error ? error.message : t.common.pictureFailed)
        );
      } else if (action === 'write') {
        void filesOf(ids).then(({ chosen }) => setWritingTo(withMetadata(chosen)));
      } else if (action === 'addToList') addToList(ids);
      else if (action === 'reset') setResetting(true);
      else {
        // Android asks first. Backing out of that leaves the choice as it was.
        void erase(ids).then((gone) => {
          if (gone) onChanged('cleared');
        });
      }
    },
    [trackIds, startRun, startEdit, addToList, erase, onChanged, onSaid, said, t]
  );

  const element = (
    <>
      <ActionSheet
        visible={sheet}
        count={trackIds.length}
        busy={busy}
        onSelect={run}
        onClose={close}
      />
      <EditSheet
        editing={editing}
        onSave={saveEdit}
        onClose={() => setEditing(null)}
      />
      <TagPrompt
        visible={tagging}
        count={trackIds.length}
        onSubmit={addTag}
        onClose={() => setTagging(false)}
      />
      <OptionSheet
        visible={untagging != null}
        heading={said.removeTagHeading(trackIds.length)}
        options={(untagging ?? []).map((entry) => ({
          value: entry.tag,
          label: said.tagOption(entry.tag, entry.trackCount),
        }))}
        // None of them is the answer yet; nothing is ticked.
        chosen=""
        onChoose={removeTag}
        onClose={() => setUntagging(null)}
      />
      <ResetSheet
        visible={resetting}
        count={trackIds.length}
        onConfirm={reset}
        onClose={() => setResetting(false)}
      />
      <WriteFilesSheet
        visible={writingTo != null}
        tracks={writingTo ?? []}
        playingId={current?.id ?? null}
        onClose={(wroteAny) => {
          setWritingTo(null);
          // The files' own tags are different now, and what is shown of them.
          if (wroteAny) onChanged('edited');
        }}
      />
    </>
  );

  return { open, run, element };
}

/**
 * The sheet itself: `TrackMenu`'s, for a run of tracks, in three parts.
 * A lookup cannot be started while another is going, and says so in place
 * of what it does.
 */
function ActionSheet({
  visible,
  count,
  busy,
  onSelect,
  onClose,
}: {
  visible: boolean;
  count: number;
  busy: boolean;
  onSelect: (action: SelectionAction) => void;
  onClose: () => void;
}) {
  const t = useT();
  const said = t.details.selection;
  const styles = useStyles();
  const pressed = usePressed();
  useWindowVeil(visible);
  // Not offered where it cannot be done: Android 10, or a native build from
  // before it could.
  const writable = canWriteFiles();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Not a stop for a screen reader; see `AlbumMenu`. The back gesture closes it. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetBody}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {said.heading(count)}
            </Text>
          </View>
          {SECTIONS.map((section) => (
            <View key={section.key}>
              <Text accessibilityRole="header" style={styles.section}>
                {t.format.upper(said.sections[section.key])}
              </Text>
              {section.actions
                .filter((action) => action !== 'write' || writable)
                .map((action) => {
                  const waiting = busy && RUNS.has(action);
                  const entry = said.actions[action];
                  return (
                    <Pressable
                      key={action}
                      accessibilityRole="button"
                      accessibilityLabel={entry.label}
                      accessibilityHint={waiting ? said.busy : entry.hint}
                      accessibilityState={{ disabled: waiting }}
                      android_ripple={pressed}
                      disabled={waiting}
                      style={[styles.action, waiting && styles.off]}
                      onPress={() => onSelect(action)}>
                      <Text style={action === 'delete' ? styles.danger : styles.actionLabel}>
                        {entry.label}
                      </Text>
                      <Text style={styles.actionHint}>{waiting ? said.busy : entry.hint}</Text>
                    </Pressable>
                  );
                })}
            </View>
          ))}
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

/**
 * The fields that can be set on all of them at once. Each box shows, faintly,
 * what the tracks already share, or that they do not; what is typed is what
 * goes on every one of them, and a box left empty changes nothing.
 *
 * Under each box is a tick box that empties the field on every one of them
 * instead, since an empty box cannot say that. Ticked, the box above is
 * closed and says what will happen in place of what was typed, which is kept
 * for when it is unticked again.
 */
function EditSheet({
  editing,
  onSave,
  onClose,
}: {
  editing: Editing | null;
  onSave: (edit: SharedEdit) => void;
  onClose: () => void;
}) {
  const t = useT();
  const said = t.details.selection;
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const visible = editing != null;
  useWindowVeil(visible);
  const [typed, setTyped] = useState<Typed>(NOTHING_TYPED);
  const [cleared, setCleared] = useState<readonly SharedField[]>(NOTHING_CLEARED);
  // Emptied each time it opens, for another set of tracks. Done while
  // drawing, as the lyrics tab seeds its search, rather than in an effect.
  const [openFor, setOpenFor] = useState<Editing | null>(null);
  if (openFor !== editing) {
    setOpenFor(editing);
    setTyped(NOTHING_TYPED);
    setCleared(NOTHING_CLEARED);
  }

  const edit: SharedEdit = { ...typed, cleared };
  // A year being cleared is not read, so what is in its box cannot be wrong.
  const complaint = cleared.includes('year') ? null : numberComplaint(typed.year, 'year', t);
  const ready = complaint == null && fieldsSet(edit).length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Neither the backdrop nor the sheet is a stop for a screen reader; see `OptionSheet`. */}
      <Pressable style={styles.centred} onPress={onClose} accessible={false}>
        <Pressable style={styles.dialog} onPress={() => {}} accessible={false}>
          <ScrollView contentContainerStyle={styles.dialogBody} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={styles.dialogHeading}>
              {said.editHeading(editing?.tracks.length ?? 0)}
            </Text>
            <Text style={styles.dialogHint}>{said.editHint}</Text>
            {SHARED_FIELDS.map((field) => {
              const name = t.details.general.fields[field];
              const clearing = cleared.includes(field);
              const faint = clearing ? said.cleared[CLEARS[field]] : sharedPlaceholder(editing?.shared[field] ?? null, said);
              return (
                <View key={field} style={styles.field}>
                  <Text style={styles.label} importantForAccessibility="no">
                    {t.format.upper(name)}
                  </Text>
                  <TextInput
                    style={[styles.input, clearing && styles.closed]}
                    // What was typed stays behind a cleared box, and comes back
                    // if it is unticked; it is not what the box says meanwhile.
                    value={clearing ? '' : typed[field]}
                    editable={!clearing}
                    onChangeText={(value) => setTyped((before) => ({ ...before, [field]: value }))}
                    placeholder={faint}
                    placeholderTextColor={c.textFaint}
                    // The name over the box is a line of its own to the eye, and
                    // the faint words in it are gone once anything is typed.
                    accessibilityLabel={name}
                    accessibilityHint={faint}
                    accessibilityState={{ disabled: clearing }}
                    keyboardType={field === 'year' ? 'number-pad' : 'default'}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  {field === 'year' && complaint ? <Text style={styles.complaint}>{complaint}</Text> : null}
                  <Pressable
                    android_ripple={pressed}
                    style={styles.clear}
                    // A tick box, which says whether it is ticked. It comes
                    // after its box, so its label names the field: heard on
                    // its own, "Remove from all" would not say what from.
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${name}: ${said.clearOn[CLEARS[field]]}`}
                    accessibilityState={{ checked: clearing }}
                    onPress={() =>
                      setCleared((before) =>
                        before.includes(field) ? before.filter((one) => one !== field) : [...before, field]
                      )
                    }>
                    <View style={[styles.tickBox, clearing && styles.tickBoxOn]}>
                      {clearing ? <View style={styles.tickMark} /> : null}
                    </View>
                    <Text style={styles.clearLabel}>{said.clearOn[CLEARS[field]]}</Text>
                  </Pressable>
                </View>
              );
            })}
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={onClose}>
                <Text style={styles.buttonLabel}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready }}
                android_ripple={pressed}
                style={[styles.button, styles.confirm, !ready && styles.off]}
                disabled={!ready}
                onPress={() => onSave(edit)}>
                <Text style={styles.confirmLabel}>{t.common.save}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Asked before what lookups found is thrown away, since it cannot be had back but by looking again. */
function ResetSheet({
  visible,
  count,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  count: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const said = t.details.selection;
  const styles = useStyles();
  const pressed = usePressed();
  useWindowVeil(visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.centred} onPress={onClose} accessible={false}>
        <Pressable style={styles.dialog} onPress={() => {}} accessible={false}>
          <View style={styles.dialogBody}>
            <Text accessibilityRole="header" style={styles.dialogHeading}>
              {said.resetQuestion(count)}
            </Text>
            <Text style={styles.dialogHint}>{said.resetBody}</Text>
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={onClose}>
                <Text style={styles.buttonLabel}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={onConfirm}>
                <Text style={styles.danger}>{t.details.library.reset}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// The sheet is `TrackMenu`'s, line for line; the dialogs are `TextPrompt`'s.
const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: scrimOf(c),
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    flexGrow: 0,
    ...outlined(c),
  },
  sheetBody: { paddingBottom: 28 },
  header: {
    gap: 3,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  title: { color: c.text, fontSize: 16, fontWeight: '600' },
  section: {
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 2,
  },
  action: { paddingHorizontal: 20, paddingVertical: 13, gap: 2 },
  actionLabel: { color: c.text, fontSize: 15 },
  actionHint: { color: c.textFaint, fontSize: 12 },
  danger: { color: c.danger, fontSize: 15 },
  off: { opacity: 0.35 },

  centred: {
    flex: 1,
    backgroundColor: scrimOf(c),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  dialog: {
    backgroundColor: c.surface,
    borderRadius: 14,
    alignSelf: 'stretch',
    maxHeight: '90%',
    ...outlined(c),
  },
  dialogBody: { padding: 18, gap: 14 },
  dialogHeading: { color: c.text, fontSize: 15, fontWeight: '600' },
  dialogHint: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: -8 },
  field: { gap: 6 },
  label: { color: c.textFaint, fontSize: 11, letterSpacing: 1 },
  input: {
    color: c.text,
    fontSize: 15,
    backgroundColor: c.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...outlined(c),
  },
  closed: { opacity: 0.6 },
  complaint: { color: c.danger, fontSize: 12 },
  // The box is `transitions.tsx`'s, a size down to sit under a field.
  clear: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  tickBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: c.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickBoxOn: { backgroundColor: c.accent, borderColor: c.accent },
  tickMark: { width: 7, height: 7, borderRadius: 2, backgroundColor: c.onAccent },
  clearLabel: { color: c.textSecondary, fontSize: 13 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  buttonLabel: { color: c.textSecondary, fontSize: 14 },
  confirm: { backgroundColor: c.primary },
  confirmLabel: { color: c.onPrimary, fontSize: 14, fontWeight: '600' },
}));
