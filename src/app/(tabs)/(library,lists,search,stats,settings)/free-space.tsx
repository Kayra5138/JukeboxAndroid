import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CardRow, GroupedCardListPage, useChoosing } from '../../../components/CardList';
import { NumberStepper } from '../../../components/NumberStepper';
import { useRows, SwitchRow, SectionLabel } from '../../../components/settings/rows';
import { useTrackMenu } from '../../../components/useTrackMenu';
import { useT } from '../../../lib/i18n/index';
import { mergeSongs } from '../../../lib/identity/index';
import { chooseKeep } from '../../../lib/library/copies';
import { useCopies } from '../../../lib/library/copiesStore';
import { useLibrary } from '../../../lib/library/useLibrary';
import type { EnrichedTrack } from '../../../lib/media/enriched';
import { libraryRoot } from '../../../lib/media/library';
import { autoDelete, setAutoDelete, type AutoDelete } from '../../../lib/space/auto';
import {
  AUTO_MONTHS_RANGE,
  bytesFreed,
  freeUpCandidates,
  LONG_AGO_MONTHS,
  type Candidate,
  type CopyGroup,
  type Listening,
} from '../../../lib/space/candidates';
import { readListening, readLists, type ListsOf } from '../../../lib/space/read';
import { isTape } from '../../../lib/tapes/tape';
import { makeStyles } from '../../../lib/theme/index';
import { DISABLED, LEADING, TYPE } from '../../../lib/theme/measures';
import { tell } from '../../../lib/ui/undo';

const NO_TRACKS: EnrichedTrack[] = [];

/** The history, or none where it cannot be read: the songs are then offered for their size and copies alone. */
function listeningNow(): Map<string, Listening> {
  try {
    return readListening();
  } catch {
    return new Map();
  }
}

/** The lists each song is in, or none where they cannot be read. */
function listsNow(): Map<string, ListsOf> {
  try {
    return readLists();
  } catch {
    return new Map();
  }
}

/** The deleting by itself as it is set, or off where the settings cannot be read. */
function autoNow(): AutoDelete {
  try {
    return autoDelete();
  } catch {
    return { on: false, months: LONG_AGO_MONTHS, favorites: false, lists: false };
  }
}

function rootNow(): string {
  try {
    return libraryRoot().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** Whether a file sits in the library folder or below it. */
function inside(folder: string | null, root: string): boolean {
  const at = (folder ?? '').replace(/\/+$/, '');
  return at === root || at.startsWith(`${root}/`);
}

/**
 * Moves the history of each copy that has gone to the copy kept, as the
 * Copies screen does. Once Android has deleted them, and before what was
 * known of them is let go of: a refusal leaves every song as it was.
 */
function moveHistories(chosen: readonly Candidate[]): void {
  for (const candidate of chosen) {
    if (candidate.reason !== 'copy' || candidate.keep == null) continue;
    try {
      mergeSongs(candidate.id, candidate.keep);
    } catch (error) {
      console.warn('The history of a copy could not be moved to the copy kept', error);
    }
  }
}

/**
 * The songs that could go to make room, in groups, for ticking and deleting;
 * and under them the switch for songs the app downloaded to go by themselves.
 *
 * Which songs and why is in `space/candidates.ts`. Deleting is Android's,
 * which asks once for however many files; a copy's listens go to the copy
 * kept as it is deleted, as on the Copies screen. Tapes are never here:
 * podcasts have a cleaning up of their own on the tapes' settings.
 */
export default function FreeSpaceScreen() {
  const t = useT();
  const said = t.space;
  const styles = useStyles();
  const rows = useRows();
  const library = useLibrary();
  const tracks = library.kind === 'library' ? library.tracks : NO_TRACKS;
  const copyGroups = useCopies();
  const { erase } = useTrackMenu();

  const [listening, setListening] = useState(() => listeningNow());
  const [lists, setLists] = useState(() => listsNow());
  const [root, setRoot] = useState(() => rootNow());
  const [auto, setAuto] = useState(() => autoNow());
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setListening(listeningNow());
    setLists(listsNow());
    setRoot(rootNow());
    setAuto(autoNow());
  }, []);
  // Read again each time the screen is come back to, but not as it first opens, when the lines above have just read it all.
  const opened = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!opened.current) {
        opened.current = true;
        return;
      }
      load();
    }, [load])
  );

  const songs = tracks.filter((track) => !isTape(track));
  const byId = new Map(songs.map((track) => [track.id, track]));
  // Which copy of each song stays, as the Copies screen suggests it.
  const copies: CopyGroup[] = copyGroups.map((group) => ({
    ids: group.map((track) => track.id),
    keep: chooseKeep(
      group.map((track) => ({
        id: track.id,
        listens: listening.get(track.id)?.plays ?? 0,
        described: track.enriched,
        cover: track.artworkUri != null,
        inLibrary: inside(track.folder, root),
        durationSec: track.durationSec,
        size: track.size ?? null,
        addedAt: track.addedAt,
      }))
    ).keep,
  }));
  const groups = freeUpCandidates(songs, listening, copies, Date.now());
  const choosing = useChoosing(groups.flatMap((group) => group.candidates.map((candidate) => candidate.id)));
  const ticked = groups.flatMap((group) => group.candidates).filter((candidate) => choosing.has(candidate.id));
  const tickedBytes = bytesFreed(groups, new Set(ticked.map((candidate) => candidate.id)));

  /** A size as the screen says it: in gigabytes from one up, in megabytes below. */
  const size = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? said.gigabytes(mb / 1024) : said.megabytes(mb);
  };

  // Android asks before anything goes, with the files' names.
  const remove = async () => {
    if (ticked.length === 0 || busy) return;
    const leaving = ticked.map((candidate) => candidate.id);
    const freed = bytesFreed(groups, new Set(leaving));
    setBusy(true);
    // One request for all of them, so Android asks once. The histories go
    // over once it has said yes and before the copies' own are let go of.
    const gone = await erase(leaving, () => moveHistories(ticked)).catch(() => false);
    setBusy(false);
    if (gone) {
      choosing.clear();
      tell(said.freed(leaving.length, size(freed)));
    } else {
      tell(said.notDeleted, { bad: true });
    }
    load();
  };

  const change = (next: Partial<AutoDelete>) => {
    setAutoDelete(next);
    setAuto((before) => ({ ...before, ...next }));
  };

  /** Why a song is here, in words. */
  const why = (candidate: Candidate): string => {
    const heard = candidate.listening;
    if (candidate.reason === 'copy') return said.why.copy;
    if (candidate.reason === 'skipped') return said.why.skipped(heard.skips, heard.completed, Math.round(heard.skippedAfter ?? 0));
    if (candidate.reason === 'neverPlayed' && candidate.addedAt != null) return said.why.neverPlayed(candidate.addedAt);
    if (candidate.reason === 'forgotten' && heard.lastPlayedAt != null) return said.why.forgotten(heard.lastPlayedAt);
    return said.why.large;
  };

  /** The lists a song is in, Favorites first under its own name; null for none. */
  const listsLine = (id: string): string | null => {
    const held = lists.get(id);
    if (!held) return null;
    const names = [...(held.favorite ? [t.lists.favorites.name] : []), ...held.names];
    return names.length > 0 ? said.inLists(names.join(said.listSeparator)) : null;
  };

  return (
    <GroupedCardListPage
      groups={
        library.kind === 'loading'
          ? null
          : groups.map((group) => {
              const ids = group.candidates.map((candidate) => candidate.id);
              const all = ids.every((id) => choosing.has(id));
              const some = !all && ids.some((id) => choosing.has(id));
              const name = said.groups[group.reason];
              return {
                key: group.reason,
                title: name,
                subtitle: said.groupSize(group.candidates.length, size(group.bytes)),
                rows: group.candidates,
                // Every song in the group at once, with a dash where only some of it is ticked.
                check: { on: all, mixed: some, label: said.tickGroup(name), onPress: () => choosing.set(ids, !all) },
              };
            })
      }
      keyOf={(candidate) => candidate.id}
      note={said.note}
      empty={said.empty}
      openHint={said.showHint}
      choosing={choosing}
      header={
        // The deleting by itself first, its details shown faded while it is off, so what it would do is there to read.
        <View>
          <SectionLabel after={false}>{said.auto.heading}</SectionLabel>
          <View style={rows.card}>
            <SwitchRow
              title={said.auto.title}
              hint={auto.on ? said.auto.after(auto.months) : said.auto.off}
              value={auto.on}
              onChange={(on) => change({ on })}
            />
            <View style={[!auto.on && styles.faded]} pointerEvents={auto.on ? 'auto' : 'none'}>
              <View style={rows.rule} />
              <View style={rows.row}>
                <View style={rows.line}>
                  <Text style={rows.title}>{said.auto.months}</Text>
                  <NumberStepper
                    name={said.auto.months}
                    range={AUTO_MONTHS_RANGE}
                    value={auto.months}
                    label={said.auto.monthCount}
                    disabled={!auto.on}
                    onChange={(months) => change({ months })}
                  />
                </View>
              </View>
              <View style={rows.rule} />
              <SwitchRow
                title={said.auto.favorites}
                value={auto.favorites}
                onChange={(favorites) => change({ favorites })}
                disabled={!auto.on}
              />
              <View style={rows.rule} />
              <SwitchRow
                title={said.auto.lists}
                value={auto.lists}
                onChange={(on) => change({ lists: on })}
                disabled={!auto.on}
              />
            </View>
          </View>
        </View>
      }
      renderRow={(candidate) => {
        const track = byId.get(candidate.id);
        const artist = track?.artist ?? t.common.unknownArtist;
        const inLists = listsLine(candidate.id);
        return (
          <CardRow
            choice={{ on: choosing.has(candidate.id), shape: 'box' }}
            title={track?.title ?? candidate.id}
            subtitle={candidate.bytes > 0 ? `${artist} · ${size(candidate.bytes)}` : artist}
            hint={why(candidate)}
            extra={inLists ? <Text style={styles.lists} numberOfLines={2}>{inLists}</Text> : null}
            onPress={() => choosing.toggle(candidate.id)}
          />
        );
      }}
      bar={{
        actions: [
          { label: t.common.clear, onPress: choosing.clear },
          {
            label: said.delete(ticked.length, size(tickedBytes)),
            kind: 'danger',
            busy,
            disabled: ticked.length === 0,
            onPress: () => void remove(),
          },
        ],
      }}
    />
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    lists: { color: c.accent, fontSize: TYPE.hint, lineHeight: LEADING.hint },
    faded: { opacity: DISABLED },
  })
);
