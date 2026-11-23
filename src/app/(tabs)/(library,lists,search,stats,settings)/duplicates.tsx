import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../../components/Button';
import { CardListPage, CardRow, ListCard } from '../../../components/CardList';
import { useTrackMenu } from '../../../components/useTrackMenu';
import { playCounts } from '../../../lib/db/history';
import { useT } from '../../../lib/i18n/index';
import { mergeSongs } from '../../../lib/identity/index';
import { chooseKeep, type KeepReason, type Weighed } from '../../../lib/library/copies';
import { markNotCopies, useCopies } from '../../../lib/library/copiesStore';
import { libraryRoot } from '../../../lib/media/library';
import type { EnrichedTrack } from '../../../lib/media/enriched';
import { makeStyles } from '../../../lib/theme/index';
import { TYPE } from '../../../lib/theme/measures';
import { tell } from '../../../lib/ui/undo';

/** What a song's copies are known by on this screen: the ids of all of them, in the order found. */
const keyOf = (group: readonly EnrichedTrack[]) => group.map((track) => track.id).join(',');

/** Where the file is: its folder and its name, as much as the media store says. */
const whereabouts = (track: EnrichedTrack) => `${track.folder ?? ''}${track.filename ?? ''}`;

function clock(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Whether a file sits in the library folder or below it. */
function inside(folder: string | null, root: string): boolean {
  const at = (folder ?? '').replace(/\/+$/, '');
  return at === root || at.startsWith(`${root}/`);
}

/** How many times each track has been listened to. None where the history cannot be read: the suggestion is only that. */
function readListens(): Map<string, number> {
  try {
    return new Map([...playCounts()].map(([id, counts]) => [id, counts.plays]));
  } catch {
    return new Map();
  }
}

function readRoot(): string {
  try {
    return libraryRoot().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** Every copy that is not the one kept. */
function leavingOf(
  groups: readonly (readonly EnrichedTrack[])[],
  keepOf: (group: readonly EnrichedTrack[]) => string
): string[] {
  return groups.flatMap((group) => {
    const keep = keepOf(group);
    return group.filter((copy) => copy.id !== keep).map((copy) => copy.id);
  });
}

/**
 * Moves the history of every copy that has gone to the copy kept, and says
 * what went wrong if one could not be.
 *
 * Once Android has deleted them and before what was known of them is let go
 * of, so that a refusal leaves every copy as it was. Each move is all or
 * nothing, so one that fails has changed nothing and the rest still go.
 */
function moveHistories(
  groups: readonly (readonly EnrichedTrack[])[],
  keepOf: (group: readonly EnrichedTrack[]) => string
): string | null {
  let failed: string | null = null;
  for (const group of groups) {
    const keep = keepOf(group);
    for (const copy of group) {
      if (copy.id === keep) continue;
      try {
        mergeSongs(copy.id, keep);
      } catch (error) {
        failed ??= String(error);
      }
    }
  }
  return failed;
}

/** Writes down that a group's files are different songs; what went wrong if it could not. */
function sayDifferent(ids: string[]): string | null {
  try {
    markNotCopies(ids);
    return null;
  } catch (error) {
    return String(error);
  }
}

/**
 * The songs the library holds more than once, for choosing which copy of
 * each to keep and deleting the rest.
 *
 * Every copy's history goes to the one kept as it is deleted, so the copy
 * that goes takes nothing with it but the file. The deleting is Android's,
 * which asks first and once for however many files: a refusal leaves every
 * file where it was, and every history with it.
 *
 * Not the Same song? screen, and not in its way. That one asks about a file
 * that may have replaced another, and moves a history; merging a pair there
 * whose two files are both still here does not delete either, so the pair
 * is still listed here as a song with two copies.
 */
export default function DuplicatesScreen() {
  const t = useT();
  const said = t.library.copies;
  const styles = useStyles();
  /*
    Worked out from the library and kept with it, so the list is read again
    by itself when files are deleted: Android's yes makes the library look
    at the device again, and the songs no longer twice drop out.
  */
  const groups = useCopies();
  const { erase } = useTrackMenu();
  const [listens, setListens] = useState<Map<string, number>>(() => readListens());
  const [root, setRoot] = useState(() => readRoot());
  /** The copy chosen by hand for a song, by `keyOf`, where it is not the one suggested. */
  const [picked, setPicked] = useState<ReadonlyMap<string, string>>(new Map());
  /** While Android is asking, so that nothing is asked twice. */
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setListens(readListens());
    setRoot(readRoot());
  }, []);
  useFocusEffect(load);

  const weigh = (track: EnrichedTrack): Weighed => ({
    id: track.id,
    listens: listens.get(track.id) ?? 0,
    described: track.enriched,
    cover: track.artworkUri != null,
    inLibrary: inside(track.folder, root),
    durationSec: track.durationSec,
    size: track.size ?? null,
    addedAt: track.addedAt,
  });

  /** Which copy of a song is kept, and why: the user's choice, or else the suggestion. */
  const decide = (group: readonly EnrichedTrack[]): { keep: string; reason: KeepReason | null } => {
    const suggestion = chooseKeep(group.map(weigh));
    const chosen = picked.get(keyOf(group));
    if (chosen != null && chosen !== suggestion.keep && group.some((track) => track.id === chosen)) {
      return { keep: chosen, reason: null };
    }
    return suggestion;
  };

  /*
    Not asked about first: the page already shows what goes and what stays,
    and Android puts up its own question, with the files' names in it.
  */
  const clean = async (chosen: readonly (readonly EnrichedTrack[])[]) => {
    const keepOf = (group: readonly EnrichedTrack[]) => decide(group).keep;
    const leaving = leavingOf(chosen, keepOf);
    if (leaving.length > 0) {
      setBusy(true);
      let failed: string | null = null;
      // One request for all of them, so Android asks once. The histories go
      // over once it has said yes, before the copies' own are let go of.
      const gone = await erase(leaving, () => {
        failed = moveHistories(chosen, keepOf);
      }).catch(() => false);
      setBusy(false);
      if (failed) tell(said.failed(failed), { bad: true });
      else tell(gone ? said.deleted(leaving.length) : said.notDeleted, { bad: !gone });
    }
    load();
  };

  const different = (group: readonly EnrichedTrack[]) => {
    const failed = sayDifferent(group.map((track) => track.id));
    if (failed) tell(said.failed(failed), { bad: true });
  };

  return (
    <CardListPage
      items={groups}
      keyOf={keyOf}
      note={said.note}
      empty={said.empty}
      header={
        groups.length > 1 ? (
          <Button
            label={said.cleanAll(groups.length)}
            kind="danger"
            busy={busy}
            accessibilityHint={t.details.same.bulk.deleteNote}
            onPress={() => void clean(groups)}
            style={styles.cleanAll}
          />
        ) : null
      }
      renderItem={(group) => {
        const { keep, reason } = decide(group);
        return (
          // One choice among the copies: whichever is marked stays, and the rest go.
          <ListCard
            label={said.choose}
            note={reason ? said.why[reason] : said.yourChoice}
            actions={[
              { label: said.different, disabled: busy, onPress: () => different(group) },
              { label: said.deleteOthers(group.length - 1), kind: 'danger', disabled: busy, onPress: () => void clean([group]) },
            ]}>
            {group.map((track) => {
              const kept = track.id === keep;
              const where = whereabouts(track);
              return (
                <CardRow
                  key={track.id}
                  choice={{ on: kept }}
                  caption={kept ? said.keeps : said.goes}
                  title={track.title}
                  subtitle={track.artist ?? t.common.unknownArtist}
                  hint={where}
                  extra={
                    <Text style={styles.holds}>
                      {`${clock(track.durationSec)} · ${said.holds({
                        listens: listens.get(track.id) ?? 0,
                        described: track.enriched,
                        cover: track.artworkUri != null,
                        outside: !inside(track.folder, root),
                      })}`}
                    </Text>
                  }
                  accessibilityLabel={`${track.title}, ${track.artist ?? t.common.unknownArtist}, ${where}`}
                  accessibilityHint={said.keepHint}
                  onPress={() => setPicked((before) => new Map(before).set(keyOf(group), track.id))}
                />
              );
            })}
          </ListCard>
        );
      }}
    />
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    cleanAll: { alignSelf: 'flex-start' },
    holds: { color: c.textSecondary, fontSize: TYPE.hint, fontVariant: ['tabular-nums'] },
  })
);
