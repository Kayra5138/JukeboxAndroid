import { useState } from 'react';
import { Note } from '../Note';
import { SectionLabel } from '../settings/rows';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import JukeboxAudio from '../../../modules/jukebox-audio/index';
import { Button, TextButton } from '../Button';
import { Field } from '../FormScroll';
import { useT } from '../../lib/i18n/index';
import { refreshLibrary } from '../../lib/library/index';
import { libraryRoot } from '../../lib/media/library';
import { folderNameFor, inNameOrder } from '../../lib/tapes/files';
import { folderNameOf, tapeFolderOf } from '../../lib/tapes/folders';
import { makeStyles } from '../../lib/theme/index';
import { haptic } from '../../lib/ui/haptics';
import { CLIP_SUBVIEWS, LIST_WINDOW } from '../../lib/ui/lists';
import { LEADING, SPACE, TYPE, PAGE } from '../../lib/theme/measures';
import { usePageRoom } from '../Page';

type Picked = { uri: string; name: string };

/**
 * Sound files already on the phone, brought into the Tapes folder: a book's
 * parts or a recording somebody was given, chosen in the phone's own picker,
 * many at once, and copied into a folder of the Tapes folder under a name
 * offered from theirs, in the order their names count. The files chosen stay
 * where they were; what is copied is a tape like any other.
 */
export function FilesPane() {
  const t = useT();
  const styles = useStyles();
  // The tab bar and the bar of what is playing, in a theme of glass laid over the foot of the list.
  // The page's room, under the choice of where tapes come from, which stands over it (see `PageScroll`'s [head]).
  const room = usePageRoom();
  const router = useRouter();
  const said = t.search.tapes.files;
  const [picked, setPicked] = useState<Picked[]>([]);
  const [name, setName] = useState('');
  const [copying, setCopying] = useState(false);
  /** How the last copying went: how many, or why not. */
  const [result, setResult] = useState<{ line: string; bad?: boolean } | null>(null);

  const choose = async () => {
    setResult(null);
    const files = await pickFiles(said.pickFailed);
    if (typeof files === 'string') return setResult({ line: files, bad: true });
    if (files.length === 0) return;
    setPicked(files);
    setName(folderNameFor(files.map((file) => file.name)));
  };

  const copy = async () => {
    const folder = folderNameOf(name, '');
    if (!folder || picked.length === 0 || copying) return;
    setCopying(true);
    const done = await copyFiles(picked, folder, said.failed);
    if (typeof done === 'string') {
      setResult({ line: done, bad: true });
    } else {
      haptic('results', done > 0 ? 'confirm' : 'reject');
      setResult(done > 0 ? { line: said.copied(done, picked.length) } : { line: said.failed, bad: true });
      if (done > 0) {
        setPicked([]);
        void refreshLibrary(true);
      }
    }
    setCopying(false);
  };

  return (
    <FlatList
      removeClippedSubviews={CLIP_SUBVIEWS}
      windowSize={LIST_WINDOW}
      data={picked}
      keyExtractor={(file) => file.uri}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ ...room, paddingTop: PAGE.top }}
      ListHeaderComponent={
        <>
          <Text style={styles.intro}>{said.intro}</Text>
          <Button kind="secondary" label={picked.length > 0 ? said.chooseOther : said.choose} disabled={copying} onPress={() => void choose()} style={styles.choose} />
          {result ? (
            <View style={styles.resultLine}>
              <Note tone={result.bad ? 'bad' : 'muted'} style={styles.noteRoom}>{result.line}</Note>
              {!result.bad ? (
                <TextButton label={said.toTapes} strong onPress={() => router.back()} />
              ) : null}
            </View>
          ) : null}
          {picked.length > 0 ? (
            <>
              <Text style={styles.label}>{said.folder}</Text>
              <Field
                value={name}
                onChangeText={setName}
                placeholder={said.folderPlaceholder}
                accessibilityLabel={said.folder}
                maxLength={80}
              />
              <Text style={styles.note}>{said.folderNote}</Text>
              <Button
                label={said.copy(picked.length)}
                busy={copying}
                disabled={copying || !folderNameOf(name, '')}
                onPress={() => void copy()}
                style={styles.copy}
              />
              <SectionLabel>{said.chosen(picked.length)}</SectionLabel>
            </>
          ) : null}
        </>
      }
      renderItem={({ item, index }) => (
        <View style={styles.row}>
          <Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text>
          <Text style={styles.file} numberOfLines={2}>{item.name}</Text>
        </View>
      )}
    />
  );
}

/** Sound files chosen in the phone's picker, in the order their names count; none if it was backed out of; or [failed], said where they could not be. */
async function pickFiles(failed: string): Promise<Picked[] | string> {
  try {
    return inNameOrder((await JukeboxAudio.pickAudioFilesAsync?.()) ?? []);
  } catch (error) {
    console.warn('The files could not be chosen', error);
    return failed;
  }
}

/** [files] copied into the folder [folder] of the Tapes folder: how many were, or [failed] where none could be. */
async function copyFiles(files: readonly Picked[], folder: string, failed: string): Promise<number | string> {
  try {
    if (!JukeboxAudio.copyTapeFilesAsync) return 0;
    return await JukeboxAudio.copyTapeFilesAsync(
      files.map((file) => file.uri),
      files.map((file) => file.name),
      tapeFolderOf(libraryRoot(), folder)
    );
  } catch (error) {
    console.warn('The files could not be copied', error);
    return failed;
  }
}

const useStyles = makeStyles((c) => StyleSheet.create({
  intro: { color: c.textMuted, fontSize: TYPE.small, lineHeight: LEADING.small, marginBottom: SPACE.l },
  // Under the words, as wide as its own: the start of what is done here, not the whole of the page.
  choose: { alignSelf: 'flex-start' },
  label: { color: c.textMuted, fontSize: TYPE.hint, marginTop: SPACE.l, marginBottom: SPACE.xs, marginLeft: SPACE.xs },
  note: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint, marginTop: SPACE.s },
  noteRoom: { marginTop: SPACE.s },
  resultLine: { marginTop: SPACE.xs },
  copy: { marginTop: SPACE.l, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: SPACE.s, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  number: { color: c.textFaint, fontSize: TYPE.hint, fontVariant: ['tabular-nums'], minWidth: 22 },
  file: { flex: 1, color: c.text, fontSize: TYPE.small },
}));
