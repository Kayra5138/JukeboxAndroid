import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import JukeboxAudio from '../../../modules/jukebox-audio/index';
import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import { refreshLibrary } from '../../lib/library/index';
import { libraryRoot } from '../../lib/media/library';
import { folderNameFor, inNameOrder } from '../../lib/tapes/files';
import { folderNameOf, tapeFolderOf } from '../../lib/tapes/folders';
import { makeStyles, outlinedClip, useColours, usePressed } from '../../lib/theme/index';
import { haptic } from '../../lib/ui/haptics';
import { CLIP_SUBVIEWS, LIST_WINDOW } from '../../lib/ui/lists';

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
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const insets = useSafeAreaInsets();
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
      contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
      ListHeaderComponent={
        <>
          <Text style={styles.intro}>{said.intro}</Text>
          <Pressable android_ripple={pressed} accessibilityRole="button" disabled={copying} style={styles.choose} onPress={() => void choose()}>
            <Text style={styles.chooseLabel}>{picked.length > 0 ? said.chooseOther : said.choose}</Text>
          </Pressable>
          {result ? (
            <View style={styles.resultLine}>
              <Text accessibilityRole={result.bad ? 'alert' : undefined} style={result.bad ? styles.bad : styles.note}>{result.line}</Text>
              {!result.bad ? (
                <Pressable accessibilityRole="button" onPress={() => router.back()}>
                  <Text style={styles.link}>{said.toTapes}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {picked.length > 0 ? (
            <>
              <Text style={styles.label}>{said.folder}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={said.folderPlaceholder}
                placeholderTextColor={c.textFaint}
                accessibilityLabel={said.folder}
                maxLength={80}
              />
              <Text style={styles.note}>{said.folderNote}</Text>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                disabled={copying || !folderNameOf(name, '')}
                style={[styles.copy, (copying || !folderNameOf(name, '')) && styles.disabled]}
                onPress={() => void copy()}>
                {copying ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.copyLabel}>{said.copy(picked.length)}</Text>}
              </Pressable>
              <Text accessibilityRole="header" style={styles.section}>{t.format.upper(said.chosen(picked.length))}</Text>
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
  content: { padding: 20 },
  intro: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  choose: { alignSelf: 'flex-start', paddingHorizontal: 20, minHeight: 44, borderRadius: 22, justifyContent: 'center', overflow: 'hidden', backgroundColor: c.surfaceRaised, ...outlinedClip(c) },
  chooseLabel: { color: c.text, fontSize: 14.5, fontWeight: '600' },
  label: { color: c.textMuted, fontSize: 12, marginTop: 20, marginBottom: 6, marginLeft: 4 },
  input: { color: c.text, fontSize: 15, minHeight: 48, borderRadius: 12, paddingHorizontal: 14, backgroundColor: c.surface, ...outlinedClip(c) },
  note: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  bad: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  link: { color: c.accent, fontSize: 13, fontWeight: '600', marginTop: 6 },
  resultLine: { marginTop: 4 },
  copy: { marginTop: 16, alignSelf: 'flex-start', paddingHorizontal: 20, minHeight: 44, minWidth: 120, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: c.primary, ...outlinedClip(c, c.primary) },
  copyLabel: { color: c.onPrimary, fontSize: 14.5, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  section: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 24, marginBottom: 6, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  number: { color: c.textFaint, fontSize: 12.5, fontVariant: ['tabular-nums'], minWidth: 22 },
  file: { flex: 1, color: c.text, fontSize: 14 },
}));
