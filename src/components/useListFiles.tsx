import { useState, type ReactNode } from 'react';
import { LEADING, SPACE, TYPE, RADIUS } from '../lib/theme/measures';
import { TextButton } from './Button';
import { CardAnswers } from './CardAnswers';
import { Dialog } from './Dialog';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Busy } from './Busy';
import { Pressable } from './Pressable';
import { Segmented } from './Segmented';

import { useT } from '../lib/i18n/index';
import {
  bringIn,
  exportAllLists,
  exportList,
  listFilesAvailable,
  listNamed,
  listNames,
  pathStyle,
  chooseListFiles,
  prepareListFiles,
  setPathStyle,
  type EntryResult,
  type Imported,
  type ListSource,
  type PathStyle,
  type Prepared,
} from '../lib/playlists/m3u/index';
import { freeListName } from '../lib/playlists/m3u/write';
import { makeStyles, useColours, usePressed } from '../lib/theme/index';
import { useAnnounce } from '../lib/ui/announce';

/**
 * Lists as M3U files, for a screen to offer: bringing playlists in from
 * other players and writing lists out for them.
 *
 * Every sheet here is a window of its own, so the screen that uses this has
 * nothing to lay out and nothing to put out of focus: it calls one of the
 * three and puts `element` somewhere in its tree.
 *
 * Bringing in is a short conversation. The files are picked and read against
 * the library all at once; where that comes to more than one playlist -- a
 * zip of Spotify's holds every playlist of the account -- the ones wanted are
 * ticked first; then each goes in, in the order picked, stopping only to ask
 * about one that has the name of a list already there; and at the end one
 * sheet says what came of all of them, with the entries that were not found
 * there to be looked through.
 */

type Ready = Extract<Prepared, { kind: 'ready' }>;

/** What became of one picked file. */
type Outcome =
  | { kind: 'imported'; imported: Imported; encoding: string }
  | { kind: 'problem'; file: string; problem: 'tooBig' | 'unreadable' | 'empty' }
  | { kind: 'skipped'; file: string };

/** A file whose list name is taken, and what is left to do after it. */
type Asking = { prepared: Ready; existing: { id: number; name: string }; rest: Prepared[]; done: Outcome[] };

/** Several playlists read, and which of them are ticked to come in, by place. */
type Choosing = { files: Prepared[]; ticked: boolean[] };

type Exporting = { kind: 'one'; source: ListSource } | { kind: 'all' };

/** How many of a playlist's entries were found in the library. */
const foundIn = (prepared: Ready) => prepared.results.filter((result) => result.trackId != null).length;

/** A failure in words, whatever was thrown. */
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Takes the files in order until one needs asking about, answering what was
 * done and, where it stopped, what it stopped on.
 */
function goOn(rest: Prepared[], done: Outcome[]): { done: Outcome[]; asking: Asking | null } {
  const outcomes = [...done];
  for (let at = 0; at < rest.length; at += 1) {
    const prepared = rest[at]!;
    if (prepared.kind === 'problem') {
      outcomes.push(prepared);
      continue;
    }
    const existing = listNamed(prepared.name);
    if (existing) return { done: outcomes, asking: { prepared, existing, rest: rest.slice(at + 1), done: outcomes } };
    outcomes.push({ kind: 'imported', imported: bringIn(prepared, { name: prepared.name }), encoding: prepared.encoding });
  }
  return { done: outcomes, asking: null };
}

/**
 * Picks the files, then reads them, saying so between the two: answers the
 * files, or why it could not. Not saying so while the system's picker is up,
 * where it would be left showing behind it for somebody who backed out.
 */
async function picked(
  names: { untitled: string; liked: string },
  onReading: (reading: boolean) => void
): Promise<{ files: Prepared[] } | { failure: string }> {
  try {
    const chosen = await chooseListFiles();
    if (chosen.length === 0) return { files: [] };
    onReading(true);
    return { files: await prepareListFiles(chosen, names) };
  } catch (error) {
    return { failure: reason(error) };
  } finally {
    onReading(false);
  }
}

/** Writes one list or all of them out, and answers what to say about it, or nothing when the user backed out. */
async function written(
  job: Exporting,
  style: PathStyle,
  t: ReturnType<typeof useT>
): Promise<string[] | null> {
  const said = t.lists.files;
  try {
    if (job.kind === 'one') {
      const result = await exportList(job.source, style, said.untitled);
      if (!result.saved) return null;
      return [said.saved(result.name), ...(result.left > 0 ? [said.leftOut(result.left)] : [])];
    }
    const result = await exportAllLists(style, said.untitled);
    if (!result) return null;
    return [
      said.savedAll(result.written, result.folder),
      ...(result.failed.length > 0 ? [said.notSaved(result.failed.join(', '))] : []),
      ...(result.left > 0 ? [said.leftOut(result.left)] : []),
    ];
  } catch (error) {
    return [said.failed(reason(error))];
  }
}

export function useListFiles({
  onChanged,
  onOpen,
}: {
  /** Lists were made or changed: read again what is shown. */
  onChanged?: () => void;
  /** Opens a list just imported, from the sheet that says it was. */
  onOpen?: (listId: number) => void;
} = {}): {
  /** False on a build without the native half, where none of this is offered. */
  available: boolean;
  importFiles: () => void;
  exportList: (source: ListSource) => void;
  exportAll: () => void;
  element: ReactNode;
} {
  const t = useT();
  const said = t.lists.files;
  const [reading, setReading] = useState(false);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [choosing, setChoosing] = useState<Choosing | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [exporting, setExporting] = useState<Exporting | null>(null);
  const [style, setStyle] = useState<PathStyle>('phone');
  const [message, setMessage] = useState<string[] | null>(null);

  const settle = (step: { done: Outcome[]; asking: Asking | null }) => {
    setAsking(step.asking);
    if (!step.asking) {
      setOutcomes(step.done);
      onChanged?.();
    }
  };

  const importFiles = () => {
    void (async () => {
      const result = await picked({ untitled: said.untitled, liked: said.liked }, setReading);
      if ('failure' in result) {
        setMessage([said.failed(result.failure)]);
        return;
      }
      if (result.files.length === 0) return;
      const { files } = result;
      if (files.filter((file) => file.kind === 'ready').length > 1) {
        // Ticked to begin with where there is something of it to bring.
        setChoosing({ files, ticked: files.map((file) => file.kind === 'ready' && foundIn(file) > 0) });
        return;
      }
      settle(goOn(files, []));
    })();
  };

  /** The ticked playlists in, and what could not be read said as before. */
  const bring = () => {
    if (!choosing) return;
    const { files, ticked } = choosing;
    setChoosing(null);
    settle(goOn(files.filter((file, at) => file.kind === 'problem' || ticked[at]), []));
  };

  const answer = (choice: 'replace' | 'keepBoth' | 'skip') => {
    if (!asking) return;
    const { prepared, existing, rest, done } = asking;
    const outcome: Outcome =
      choice === 'skip'
        ? { kind: 'skipped', file: prepared.file }
        : {
            kind: 'imported',
            imported: bringIn(
              prepared,
              choice === 'replace' ? { listId: existing.id } : { name: freeListName(prepared.name, listNames()) }
            ),
            encoding: prepared.encoding,
          };
    settle(goOn(rest, [...done, outcome]));
  };

  const ask = (job: Exporting) => {
    setStyle(pathStyle());
    setExporting(job);
  };

  const run = () => {
    if (!exporting) return;
    const job = exporting;
    setExporting(null);
    setPathStyle(style);
    void written(job, style, t).then((lines) => {
      if (lines) setMessage(lines);
    });
  };

  const element = (
    <>
      <Reading visible={reading} />
      <Choose
        choosing={choosing}
        onTick={(at) =>
          setChoosing((now) => (now ? { ...now, ticked: now.ticked.map((on, each) => (each === at ? !on : on)) } : now))
        }
        onAll={(on) =>
          setChoosing((now) => (now ? { ...now, ticked: now.files.map((file) => on && file.kind === 'ready') } : now))
        }
        onBring={bring}
        onClose={() => setChoosing(null)}
      />
      <Conflict asking={asking} onAnswer={answer} />
      <Outcomes
        outcomes={outcomes}
        onOpen={
          onOpen
            ? (listId) => {
                setOutcomes(null);
                onOpen(listId);
              }
            : undefined
        }
        onClose={() => setOutcomes(null)}
      />
      <ExportSheet
        exporting={exporting}
        style={style}
        onStyle={setStyle}
        onRun={run}
        onClose={() => setExporting(null)}
      />
      <Message lines={message} onClose={() => setMessage(null)} />
    </>
  );

  return {
    available: listFilesAvailable(),
    importFiles,
    exportList: (source) => ask({ kind: 'one', source }),
    exportAll: () => ask({ kind: 'all' }),
    element,
  };
}

/** The card every sheet here is drawn on, over a scrim; touching the scrim is [onClose] where there is one. */
function Card({ visible, onClose, children }: { visible: boolean; onClose?: () => void; children: ReactNode }) {
  // With no way out, Back and the scrim wait as the card does (`Dialog`).
  return (
    <Dialog visible={visible} onClose={onClose ?? (() => {})}>
      {children}
    </Dialog>
  );
}

function Reading({ visible }: { visible: boolean }) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  useAnnounce(visible ? t.lists.files.reading : null);
  return (
    <Card visible={visible}>
      <View style={styles.reading}>
        <Busy color={c.text} />
        <Text style={styles.body}>{t.lists.files.reading}</Text>
      </View>
    </Card>
  );
}

function Choose({
  choosing,
  onTick,
  onAll,
  onBring,
  onClose,
}: {
  choosing: Choosing | null;
  onTick: (at: number) => void;
  onAll: (on: boolean) => void;
  onBring: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.lists.files.choose;
  const ticked = choosing ? choosing.ticked.filter(Boolean).length : 0;
  const every = choosing ? choosing.files.every((file, at) => file.kind !== 'ready' || choosing.ticked[at]) : false;
  return (
    <Card visible={choosing != null} onClose={onClose}>
      <View style={styles.chooseHead}>
        <Text accessibilityRole="header" style={[styles.heading, styles.chooseHeading]}>{said.heading}</Text>
        <TextButton label={every ? said.none : said.all} strong onPress={() => onAll(!every)} />
      </View>
      <Text style={styles.hint}>{said.hint}</Text>
      <ScrollView style={styles.scroll}>
        {(choosing?.files ?? []).map((file, at) => {
          if (file.kind !== 'ready') return null;
          const on = choosing!.ticked[at] === true;
          return (
            <Pressable
              key={at}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              android_ripple={pressed}
              style={styles.chosen}
              onPress={() => onTick(at)}>
              <View style={styles.chosenText}>
                <Text style={styles.body} numberOfLines={2}>{file.name}</Text>
                <Text style={styles.hint}>{said.found(foundIn(file), file.results.length)}</Text>
              </View>
              {/* The tick box the track picker has. */}
              <View style={[styles.tick, on && styles.tickOn]}>{on ? <View style={styles.dot} /> : null}</View>
            </Pressable>
          );
        })}
      </ScrollView>
      <CardAnswers
        answers={[
          { label: t.common.cancel, kind: 'quiet', onPress: onClose },
          { label: said.bring(ticked), disabled: ticked === 0, onPress: onBring },
        ]}
      />
    </Card>
  );
}

function Conflict({ asking, onAnswer }: { asking: Asking | null; onAnswer: (choice: 'replace' | 'keepBoth' | 'skip') => void }) {
  const t = useT();
  const styles = useStyles();
  const said = t.lists.files.conflict;
  const other = asking ? freeListName(asking.prepared.name, listNames()) : '';
  return (
    <Card visible={asking != null} onClose={() => onAnswer('skip')}>
      <Text accessibilityRole="header" style={styles.heading}>
        {asking ? said.heading(asking.existing.name) : ''}
      </Text>
      <Text style={styles.hint}>{said.hint}</Text>
      {/* Putting the new list over the one there cannot be taken back; keeping both or leaving it changes nothing there. */}
      <CardAnswers
        answers={[
          { label: said.skip, kind: 'quiet', onPress: () => onAnswer('skip') },
          { label: said.keepBoth(other), onPress: () => onAnswer('keepBoth') },
          { label: said.replace, kind: 'danger', onPress: () => onAnswer('replace') },
        ]}
      />
    </Card>
  );
}

/** What an entry that was not found is called on screen: its `#EXTINF` name, or else its file's. */
function entryName(result: EntryResult): string {
  return result.entry.label ?? result.entry.location.split(/[\\/]/).filter(Boolean).pop() ?? result.entry.location;
}

function Outcomes({
  outcomes,
  onOpen,
  onClose,
}: {
  outcomes: Outcome[] | null;
  onOpen?: (listId: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const said = t.lists.files.result;
  /** Which imported lists have their missing entries showing, by list id. */
  const [open, setOpen] = useState<number[]>([]);
  // Said aloud as it appears, the first line being the one that matters.
  const first = outcomes?.[0];
  useAnnounce(
    first?.kind === 'imported'
      ? said.imported(first.imported.name, first.imported.found, first.imported.total)
      : null
  );

  return (
    <Card visible={outcomes != null} onClose={onClose}>
      <Text accessibilityRole="header" style={styles.heading}>{said.heading}</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.outcomes}>
        {(outcomes ?? []).map((outcome, index) => {
          if (outcome.kind !== 'imported') {
            return (
              <Text key={index} style={styles.body}>
                {outcome.kind === 'skipped' ? said.skipped(outcome.file) : said[outcome.problem](outcome.file)}
              </Text>
            );
          }
          const { imported, encoding } = outcome;
          const showing = open.includes(imported.listId);
          return (
            <View key={index} style={styles.outcome}>
              <Text style={styles.body}>{said.imported(imported.name, imported.found, imported.total)}</Text>
              {imported.repeated > 0 ? <Text style={styles.hint}>{said.repeated(imported.repeated)}</Text> : null}
              {/* Only where it was a guess: a file in UTF-8 said so itself. */}
              {encoding.startsWith('Windows') ? <Text style={styles.hint}>{said.encoding(encoding)}</Text> : null}
              <View style={styles.links}>
                {onOpen ? (
                  <TextButton label={said.open} strong onPress={() => onOpen(imported.listId)} />
                ) : null}
                {imported.missing.length > 0 ? (
                  <TextButton
                    label={showing ? said.hideMissing : said.showMissing(imported.missing.length)}
                    strong
                    expanded={showing}
                    onPress={() =>
                      setOpen(showing ? open.filter((id) => id !== imported.listId) : [...open, imported.listId])
                    }
                  />
                ) : null}
              </View>
              {showing
                ? imported.missing.map((result) => (
                    <View key={result.entry.line} style={styles.missing}>
                      <Text style={styles.missingName} numberOfLines={2}>{entryName(result)}</Text>
                      <Text style={styles.hint} numberOfLines={1} ellipsizeMode="middle">
                        {[
                          result.how === 'web' || result.how === 'ambiguous' ? said.reasons[result.how] : said.reasons.notFound,
                          // Another app's playlist names its songs and gives no file to show.
                          result.entry.location || null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  ))
                : null}
            </View>
          );
        })}
      </ScrollView>
      <CardAnswers answers={[{ label: t.common.close, onPress: onClose }]} />
    </Card>
  );
}

function ExportSheet({
  exporting,
  style,
  onStyle,
  onRun,
  onClose,
}: {
  exporting: Exporting | null;
  style: PathStyle;
  onStyle: (style: PathStyle) => void;
  onRun: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const said = t.lists.files.exportSheet;
  const all = exporting?.kind === 'all';
  return (
    <Card visible={exporting != null} onClose={onClose}>
      <Text accessibilityRole="header" style={styles.heading}>{all ? said.headingAll : said.heading}</Text>
      {/* One under the other, each with what it means: the two are told apart by what the paths are for. */}
      <Segmented
        layout="stack"
        style={styles.options}
        options={[
          { value: 'phone', label: said.phone, hint: said.phoneHint },
          { value: 'library', label: said.library, hint: said.libraryHint },
        ]}
        value={style}
        onChange={onStyle}
      />
      {all ? <Text style={styles.hint}>{said.allHint}</Text> : null}
      <CardAnswers
        answers={[
          { label: t.common.cancel, kind: 'quiet', onPress: onClose },
          { label: all ? said.chooseFolder : said.save, onPress: onRun },
        ]}
      />
    </Card>
  );
}

function Message({ lines, onClose }: { lines: string[] | null; onClose: () => void }) {
  const t = useT();
  const styles = useStyles();
  useAnnounce(lines ? lines.join(' ') : null);
  return (
    <Card visible={lines != null} onClose={onClose}>
      {(lines ?? []).map((line, index) => (
        <Text key={index} style={index === 0 ? styles.body : styles.hint}>{line}</Text>
      ))}
      <CardAnswers answers={[{ label: t.common.close, onPress: onClose }]} />
    </Card>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  reading: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m },
  heading: { color: c.text, fontSize: TYPE.body, fontWeight: '600' },
  body: { color: c.text, fontSize: TYPE.small, lineHeight: LEADING.small },
  hint: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.small },


  scroll: { flexGrow: 0 },
  outcomes: { gap: SPACE.m },
  outcome: { gap: SPACE.xxs },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACE.l },
  missing: {
    paddingVertical: SPACE.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    gap: SPACE.xxs,
  },
  missingName: { color: c.text, fontSize: TYPE.small },

  chooseHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m },
  chooseHeading: { flex: 1 },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, minHeight: 56, paddingVertical: SPACE.s },
  chosenText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  tick: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.control,
    borderWidth: 1.5,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: c.accent, borderColor: c.accent },
  dot: { width: 9, height: 9, borderRadius: 2, backgroundColor: c.onAccent },

  // On the card, which is the surface a tray is elsewhere: the page's colour is the step off it here.
  options: { backgroundColor: c.bg, marginTop: SPACE.xs },

}));
