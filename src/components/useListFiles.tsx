import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';
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
 * the library all at once; then each goes in, in the order picked, stopping
 * only to ask about one that has the name of a list already there; and at
 * the end one sheet says what came of all of them, with the entries that were
 * not found there to be looked through.
 */

type Ready = Extract<Prepared, { kind: 'ready' }>;

/** What became of one picked file. */
type Outcome =
  | { kind: 'imported'; imported: Imported; encoding: string }
  | { kind: 'problem'; file: string; problem: 'tooBig' | 'unreadable' | 'empty' }
  | { kind: 'skipped'; file: string };

/** A file whose list name is taken, and what is left to do after it. */
type Asking = { prepared: Ready; existing: { id: number; name: string }; rest: Prepared[]; done: Outcome[] };

type Exporting = { kind: 'one'; source: ListSource } | { kind: 'all' };

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
  untitled: string,
  onReading: (reading: boolean) => void
): Promise<{ files: Prepared[] } | { failure: string }> {
  try {
    const chosen = await chooseListFiles();
    if (chosen.length === 0) return { files: [] };
    onReading(true);
    return { files: await prepareListFiles(chosen, untitled) };
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
      const result = await picked(said.untitled, setReading);
      if ('failure' in result) {
        setMessage([said.failed(result.failure)]);
        return;
      }
      if (result.files.length === 0) return;
      settle(goOn(result.files, []));
    })();
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
  const styles = useStyles();
  useWindowVeil(visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose ?? (() => {})}>
      {/* Neither the backdrop nor the card is a stop for a screen reader; see `OptionSheet`. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable style={styles.card} onPress={() => {}} accessible={false}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
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
        <ActivityIndicator color={c.text} />
        <Text style={styles.body}>{t.lists.files.reading}</Text>
      </View>
    </Card>
  );
}

function Conflict({ asking, onAnswer }: { asking: Asking | null; onAnswer: (choice: 'replace' | 'keepBoth' | 'skip') => void }) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.lists.files.conflict;
  const other = asking ? freeListName(asking.prepared.name, listNames()) : '';
  return (
    <Card visible={asking != null} onClose={() => onAnswer('skip')}>
      <Text accessibilityRole="header" style={styles.heading}>
        {asking ? said.heading(asking.existing.name) : ''}
      </Text>
      <Text style={styles.hint}>{said.hint}</Text>
      <View style={styles.choices}>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.choice} onPress={() => onAnswer('replace')}>
          <Text style={styles.link}>{said.replace}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.choice} onPress={() => onAnswer('keepBoth')}>
          <Text style={styles.link}>{said.keepBoth(other)}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.choice} onPress={() => onAnswer('skip')}>
          <Text style={styles.quiet}>{said.skip}</Text>
        </Pressable>
      </View>
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
  const pressed = usePressed();
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
                  <Pressable accessibilityRole="button" style={styles.linkHit} onPress={() => onOpen(imported.listId)}>
                    <Text style={styles.link}>{said.open}</Text>
                  </Pressable>
                ) : null}
                {imported.missing.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showing }}
                    style={styles.linkHit}
                    onPress={() =>
                      setOpen(showing ? open.filter((id) => id !== imported.listId) : [...open, imported.listId])
                    }>
                    <Text style={styles.link}>
                      {showing ? said.hideMissing : said.showMissing(imported.missing.length)}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {showing
                ? imported.missing.map((result) => (
                    <View key={result.entry.line} style={styles.missing}>
                      <Text style={styles.missingName} numberOfLines={2}>{entryName(result)}</Text>
                      <Text style={styles.hint} numberOfLines={1} ellipsizeMode="middle">
                        {`${result.how === 'web' || result.how === 'ambiguous' ? said.reasons[result.how] : said.reasons.notFound} · ${result.entry.location}`}
                      </Text>
                    </View>
                  ))
                : null}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={onClose}>
          <Text style={styles.link}>{t.common.close}</Text>
        </Pressable>
      </View>
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
  const pressed = usePressed();
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
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={onClose}>
          <Text style={styles.quiet}>{t.common.cancel}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={onRun}>
          <Text style={styles.link}>{all ? said.chooseFolder : said.save}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function Message({ lines, onClose }: { lines: string[] | null; onClose: () => void }) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  useAnnounce(lines ? lines.join(' ') : null);
  return (
    <Card visible={lines != null} onClose={onClose}>
      {(lines ?? []).map((line, index) => (
        <Text key={index} style={index === 0 ? styles.body : styles.hint}>{line}</Text>
      ))}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={onClose}>
          <Text style={styles.link}>{t.common.close}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: scrimOf(c),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 20,
    gap: 10,
    alignSelf: 'stretch',
    // Short enough to leave the backdrop showing, so there is always somewhere to tap that means "never mind".
    maxHeight: '85%',
    ...outlined(c),
  },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heading: { color: c.text, fontSize: 15.5, fontWeight: '600' },
  body: { color: c.text, fontSize: 14, lineHeight: 20 },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 18 },
  link: { color: c.accent, fontSize: 14 },
  quiet: { color: c.textMuted, fontSize: 14 },

  choices: { paddingTop: 4 },
  choice: { minHeight: 48, justifyContent: 'center' },

  scroll: { flexGrow: 0 },
  outcomes: { gap: 14 },
  outcome: { gap: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  missing: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    gap: 2,
  },
  missingName: { color: c.text, fontSize: 13.5 },

  // On the card, which is the surface a tray is elsewhere: the page's colour is the step off it here.
  options: { backgroundColor: c.bg, marginTop: 4 },

  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 6 },
  button: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
}));
