import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CardListPage, CardRow, ListCard, useChoosing } from '../../../components/CardList';
import { TextButton } from '../../../components/Button';
import { ConfirmSheet } from '../../../components/ConfirmSheet';
import { Switch } from '../../../components/Switch';
import { useTrackMenu } from '../../../components/useTrackMenu';
import { useT } from '../../../lib/i18n/index';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import { answerPairs, keepApart, mergeSongs, sameSongs, type Side, type Suggestion } from '../../../lib/identity/index';
import { makeStyles } from '../../../lib/theme/index';
import { SPACE, TYPE } from '../../../lib/theme/measures';
import { tell } from '../../../lib/ui/undo';

/** Where the file is, as much of it as is known. One lost long ago has only a name. */
const whereabouts = (side: Side) => `${side.folder ?? ''}${side.filename ?? ''}`;

/** What a pair is known by on this screen, and chosen by. */
const keyOf = (pair: Suggestion) => `${pair.from.id}\u0000${pair.to.id}`;

function File({ caption, side }: { caption: string; side: Side }) {
  const t = useT();
  const styles = useStyles();
  return (
    <CardRow
      caption={caption}
      title={side.title ?? side.filename ?? t.details.same.unknown}
      subtitle={side.artist ?? t.common.unknownArtist}
      hint={whereabouts(side) || t.details.same.noFileName}
      extra={<Text style={styles.holds}>{t.details.same.holds(side)}</Text>}
    />
  );
}

/**
 * The pairs of files that might be one song, for somebody to say.
 *
 * Only the ones the app would not decide for itself. A file that is the same
 * to the byte as one that has gone is taken for it without a word; what is
 * listed here is everything short of that -- the same name at a different
 * size, a copy with a history of its own -- where being wrong would mix two
 * songs' listens together and there would be no telling them apart again.
 */
export default function SameSongsScreen() {
  const [pairs, setPairs] = useState<Suggestion[] | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const choosing = useChoosing((pairs ?? []).map(keyOf));
  /** Whether the merge of the chosen is waiting for a yes: it cannot be undone. */
  const [asking, setAsking] = useState(false);
  /** Whether a merge of the chosen takes the first file of each pair off the phone as well. */
  const [deleteToo, setDeleteToo] = useState(false);
  /*
    Erasing the way the menu does, queue and all. Android asks first, and
    says what it was told; the merge has been made by then, so a refusal
    leaves the history together and both files where they were.
  */
  const { erase } = useTrackMenu();
  /*
    Only a file still on the phone can be erased. The first of a pair may be
    one that went long ago and left its history behind; asked to erase it
    along with the rest, Android would refuse the lot.
  */
  const present = useLibraryTracks();
  const onPhone = (ids: readonly string[]) => {
    const here = new Set(present.map((track) => track.id));
    return ids.filter((id) => here.has(id));
  };
  const t = useT();
  const styles = useStyles();
  const said = t.details.same;

  const load = useCallback(() => {
    try {
      setPairs(sameSongs());
      setTrouble(null);
    } catch (error) {
      setPairs([]);
      setTrouble(String(error));
    }
  }, []);

  useFocusEffect(load);

  /*
    Either answer is read back from the database rather than taken off the
    list by hand. Joining one pair can settle another -- the same old file
    asked about against two new ones -- and the list should say what is still
    in question, not what was a moment ago.
  */
  const answer = async (pair: Suggestion, join: boolean, remove = false) => {
    let merged = false;
    try {
      if (join) mergeSongs(pair.from.id, pair.to.id);
      else keepApart(pair.from.id, pair.to.id);
      merged = join;
    } catch (error) {
      // The write is all or nothing, so a failure here has changed nothing.
      tell(said.failed(String(error)), { bad: true });
    }
    load();
    // The file goes only after its history has: erasing first would take its listens and tags with it.
    if (merged && remove && onPhone([pair.from.id]).length > 0) {
      const gone = await erase([pair.from.id]).catch(() => false);
      tell(gone ? said.bulk.deleted(1) : said.bulk.notDeleted, { bad: !gone });
      load();
    }
  };

  /** The one answer to every pair ticked, in the order they are listed. */
  const answerChosen = async (join: boolean) => {
    const keys = new Set(choosing.picked());
    const picked = (pairs ?? []).filter((pair) => keys.has(keyOf(pair)));
    const { done, skipped, failed, joined } = answerPairs(picked, join);
    const outcome = said.bulk.done(done, skipped);
    if (failed) tell(said.failed(failed), { bad: true });
    else tell(outcome);
    choosing.clear();
    load();
    // One request for all of them, so Android asks once.
    const erasable = join && deleteToo ? onPhone(joined) : [];
    if (erasable.length > 0) {
      const gone = await erase(erasable).catch(() => false);
      tell(`${outcome} ${gone ? said.bulk.deleted(erasable.length) : said.bulk.notDeleted}`, { bad: !gone });
      load();
    }
  };

  return (
    <CardListPage
      items={pairs}
      keyOf={keyOf}
      note={said.note}
      empty={said.empty}
      error={trouble}
      onRetry={load}
      choosing={choosing}
      renderItem={(pair) => (
        <ListCard
          chosen={choosing.has(keyOf(pair))}
          // The box to tick for an answer to many; the two buttons under it still answer this one pair alone.
          check={{ on: choosing.has(keyOf(pair)), onPress: () => choosing.toggle(keyOf(pair)), label: said.bulk.choose }}
          actions={[
            { label: said.keepApart, onPress: () => void answer(pair, false) },
            { label: said.merge, kind: 'primary', onPress: () => void answer(pair, true) },
          ]}
          // For the copy that is only a copy: the history moves, and then the file goes.
          foot={
            <TextButton
              label={said.bulk.mergeDelete}
              tone="danger"
              strong
              accessibilityHint={said.bulk.deleteNote}
              onPress={() => void answer(pair, true, true)}
            />
          }>
          <File caption={said.from} side={pair.from} />
          <File caption={said.into} side={pair.to} />
        </ListCard>
      )}
      bar={{
        text: said.bulk.chosen(choosing.count),
        actions: [
          // Keeping apart is only ever a note, and is not asked.
          { label: said.bulk.keepApart(choosing.count), onPress: () => void answerChosen(false) },
          { label: said.bulk.merge(choosing.count), kind: 'primary', onPress: () => setAsking(true) },
        ],
      }}
      sheets={
        // A merge of several is asked about first: it moves listens that cannot be told apart again.
        <ConfirmSheet
          visible={asking}
          title={said.bulk.merge(choosing.count)}
          body={said.bulk.confirm(choosing.count)}
          confirmLabel={said.merge}
          danger
          onConfirm={() => void answerChosen(true)}
          onCancel={() => setAsking(false)}>
          <View style={styles.deleteRow}>
            <Text style={styles.deleteText}>{said.bulk.deleteToo}</Text>
            <Switch
              accessibilityLabel={said.bulk.deleteToo}
              accessibilityHint={said.bulk.deleteNote}
              value={deleteToo}
              onValueChange={setDeleteToo}
            />
          </View>
        </ConfirmSheet>
      }
    />
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    holds: { color: c.accent, fontSize: TYPE.hint, fontVariant: ['tabular-nums'] },
    deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.m },
    deleteText: { flex: 1, color: c.text, fontSize: TYPE.small },
  })
);
