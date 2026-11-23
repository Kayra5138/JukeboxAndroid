import { useCallback, useState } from 'react';
import { SPACE, TYPE } from '../../../lib/theme/measures';
import { DialogCard } from '../../../components/Dialog';
import { Field } from '../../../components/FormScroll';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { CardListPage, CardRow, ListCard } from '../../../components/CardList';
import { Floating } from '../../../components/Floating';

import { useTrackMenu } from '../../../components/useTrackMenu';
import { playCounts } from '../../../lib/db/history';
import { readMetadata, saveMetadata } from '../../../lib/db/metadata';
import { tagsFor } from '../../../lib/db/tags';
import { nameOfVideo, type Mistake } from '../../../lib/discover/verify';
import { useT } from '../../../lib/i18n/index';
import { refreshLibrary } from '../../../lib/library/index';
import { markRight, useWrongDownloads } from '../../../lib/library/wrongDownloadsStore';
import { artworkChanged } from '../../../lib/media/artworkEvents';
import type { EnrichedTrack } from '../../../lib/media/enriched';
import { findTrack } from '../../../lib/media/library';
import { spreadCovers } from '../../../lib/media/coverSpread';
import { writable } from '../../../lib/filetags';
import { afterSaved, writeEditsOn } from '../../../lib/filetags/auto';
import { fieldsOf, manualEntry } from '../../../lib/metadata/edit';
import { usePlayerActions } from '../../../lib/player/PlayerProvider';
import { makeStyles } from '../../../lib/theme/index';
import { durationLabel } from '../../../lib/youtube/types';
import { tell } from '../../../lib/ui/undo';

type Name = { title: string; artist: string };

/** How many times each track has been listened to. None where the history cannot be read: it is only shown. */
function readListens(): Map<string, number> {
  try {
    return new Map([...playCounts()].map(([id, counts]) => [id, counts.plays]));
  } catch {
    return new Map();
  }
}

/**
 * Gives a track the name typed for it, as an edit of the user's own: the
 * same row the details screen's Save writes, so that no lookup writes over
 * it, with every other field what the track already showed. Read off the
 * file as it is, which is what an edit is made against. Answers what went
 * wrong, or null.
 */
async function rename(trackId: string, name: Name, gone: string): Promise<string | null> {
  try {
    // The one file asked for, and not the whole library read for it.
    const track = await findTrack(trackId);
    if (!track) return gone;
    const kept = readMetadata(trackId);
    const fields = { ...fieldsOf(track, kept), title: name.title, artist: name.artist };
    saveMetadata(manualEntry(track, kept, fields, tagsFor(trackId)[0]?.tag ?? null));
    // Under another artist it may be on another record, with another cover: told, and given the record's, as Save in the details does.
    artworkChanged();
    void spreadCovers({ trackIds: [trackId] });
    // And into the file, where somebody asked for what is saved to go there.
    if (writeEditsOn() && writable(track)) void afterSaved([trackId]).catch(() => undefined);
    void refreshLibrary();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Writes down that a file is right as it is; what went wrong if it could not. */
function sayRight(mistake: Mistake<EnrichedTrack>): string | null {
  try {
    markRight(mistake.track.id, mistake.job.video.id);
    return null;
  } catch (error) {
    return String(error);
  }
}

/**
 * The downloads in the library that may be another song than the one they
 * are filed as: see `discover/verify.ts` for which, and why there are any.
 *
 * Each is shown as what it is filed as against what its video was called,
 * and nothing is done to any of them until somebody says what: give it the
 * video's name, as an edit they can look over first; delete it, the way it
 * is deleted anywhere else, with Android asking; or say it is right, which
 * is remembered. A file renamed, deleted or said to be right drops out of
 * the list by itself, since the list is worked out from the library.
 *
 * Pressing the names plays the file, which is how anybody finds out.
 */
export default function WrongDownloadsScreen() {
  const t = useT();
  const said = t.library.wrong;
  const mistakes = useWrongDownloads();
  const { erase } = useTrackMenu();
  const { playQueue } = usePlayerActions();
  const [listens, setListens] = useState<Map<string, number>>(() => readListens());
  /** The file being named, and the name proposed for it. */
  const [naming, setNaming] = useState<{ mistake: Mistake<EnrichedTrack>; name: Name } | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => setListens(readListens()), []));

  const say = (done: string, failed: string | null) => {
    if (failed) tell(said.failed(failed), { bad: true });
    else tell(done);
  };

  const remove = async (mistake: Mistake<EnrichedTrack>) => {
    setBusy(true);
    const gone = await erase([mistake.track.id]).catch(() => false);
    setBusy(false);
    tell(gone ? said.deleted : said.notDeleted, { bad: !gone });
  };

  const save = async (name: Name) => {
    const target = naming;
    setNaming(null);
    if (!target) return;
    setBusy(true);
    const failed = await rename(target.mistake.track.id, name, t.details.screen.missing);
    setBusy(false);
    say(said.renamed(name.title), failed);
  };

  return (
    <CardListPage
      items={mistakes}
      keyOf={(mistake) => mistake.track.id}
      note={said.note}
      empty={said.empty}
      renderItem={(mistake) => {
        const { track, job } = mistake;
        const artist = track.artist ?? t.common.unknownArtist;
        // Pressing the names plays the file, which is how anybody finds out.
        const play = () => void playQueue([track], 0);
        return (
          <ListCard
            actions={[
              {
                label: said.rename,
                kind: 'primary',
                disabled: busy,
                onPress: () => setNaming({ mistake, name: nameOfVideo(job.video, track.artist) }),
              },
              { label: said.right, disabled: busy, onPress: () => say(said.keptRight, sayRight(mistake)) },
              {
                label: said.delete,
                kind: 'danger',
                disabled: busy,
                accessibilityHint: t.details.same.bulk.deleteNote,
                onPress: () => void remove(mistake),
              },
            ]}>
            <CardRow
              caption={said.filedAs}
              title={track.title}
              subtitle={artist}
              accessibilityLabel={`${said.filedAs}: ${track.title}, ${artist}`}
              accessibilityHint={said.playHint}
              onPress={play}
            />
            <CardRow
              caption={said.videoWas}
              title={job.video.title}
              subtitle={job.video.channel}
              hint={said.facts(durationLabel(track.durationSec || job.video.duration), listens.get(track.id) ?? 0)}
              accessibilityLabel={`${said.videoWas}: ${job.video.title}, ${job.video.channel}`}
              accessibilityHint={said.playHint}
              onPress={play}
            />
          </ListCard>
        );
      }}
      sheets={
        <NameSheet
          visible={naming != null}
          proposed={naming?.name ?? null}
          onSave={(name) => void save(name)}
          onClose={() => setNaming(null)}
        />
      }
    />
  );
}

/**
 * The name a file is about to be given, to be looked over and changed before
 * it is: what the video's title says is seldom quite what a catalogue would
 * call the song, and the user knows which song it is now that they have
 * heard it.
 */
function NameSheet({
  visible,
  proposed,
  onSave,
  onClose,
}: {
  visible: boolean;
  proposed: Name | null;
  onSave: (name: Name) => void;
  onClose: () => void;
}) {
  // Made afresh each time it opens, from the name proposed, and keeping what is typed in itself (see `Floating`).
  return (
    <Floating visible={visible} onClose={onClose}>
      <NameCard proposed={proposed} onSave={onSave} onClose={onClose} />
    </Floating>
  );
}

function NameCard({ proposed, onSave, onClose }: { proposed: Name | null; onSave: (name: Name) => void; onClose: () => void }) {
  const t = useT();
  const said = t.library.wrong;
  const styles = useSheetStyles();
  const [title, setTitle] = useState(proposed?.title ?? '');
  const [artist, setArtist] = useState(proposed?.artist ?? '');

  const ready = title.trim().length > 0;
  const submit = () => {
    if (ready) onSave({ title: title.trim(), artist: artist.trim() });
  };

  return (
    <DialogCard
      onClose={onClose}
      title={said.rename}
      body={said.sheetNote}
      answers={[
        { label: t.common.cancel, kind: 'quiet', onPress: onClose },
        { label: t.common.save, disabled: !ready, onPress: submit },
      ]}>
      <Text style={styles.label}>{said.titleField}</Text>
      <Field value={title} onChangeText={setTitle} accessibilityLabel={said.titleField} autoCorrect={false} returnKeyType="next" />
      <Text style={styles.label}>{said.artistField}</Text>
      <Field
        value={artist}
        onChangeText={setArtist}
        accessibilityLabel={said.artistField}
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
    </DialogCard>
  );
}

const useSheetStyles = makeStyles((c) => StyleSheet.create({
  label: { color: c.textSecondary, fontSize: TYPE.hint, marginBottom: -SPACE.xs },
}));
