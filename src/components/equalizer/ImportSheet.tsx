import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from '../Pressable';

import JukeboxAudio from '../../../modules/jukebox-audio';
import {
  describeImport,
  nameFromFile,
  parseAutoEq,
  type AutoEqResult,
} from '../../lib/equalizer/autoeq';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlined, useColours, usePressed } from '../../lib/theme/index';
import { scrimOf, useWindowVeil } from '../../lib/theme/Veil';

/**
 * Asks for a headphone correction, as text.
 *
 * AutoEQ publishes one for most headphones anybody owns, as a few lines in a
 * file called ParametricEQ.txt. This app does not fetch it: which headphone,
 * measured by whom, against which target, is a choice with a few thousand
 * answers, and it is made on AutoEQ's own pages. What arrives here is the
 * result, by either of the two ways text gets from a web page into an app --
 * pasted, or saved as a file and picked.
 *
 * Nothing is changed until the text has been read and found to hold filters.
 * Text that does not is answered here, with the box still open and what was
 * pasted still in it.
 */
export function ImportSheet({
  visible,
  onImport,
  onClose,
}: {
  visible: boolean;
  /** `name` is a suggestion from the file's name, or empty where there was none. */
  onImport: (result: AutoEqResult, said: string, name: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
  useWindowVeil(visible);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  // Emptied as it opens rather than as it closes, like the text prompt.
  useEffect(() => {
    if (visible) {
      setText('');
      setProblem(null);
    }
  }, [visible]);

  const read = (source: string, fileName: string | null) => {
    const result = parseAutoEq(source);
    const said = describeImport(result, t);
    if (!said.ok) {
      setProblem(said.message);
      return;
    }
    onImport(result, said.message, nameFromFile(fileName));
  };

  const pick = async () => {
    try {
      const picked = await JukeboxAudio.pickTextFileAsync?.();
      // Backed out of the picker, which is not a failure and says nothing.
      if (!picked) return;
      setText(picked.text);
      read(picked.text, picked.name);
    } catch (trouble) {
      setProblem(trouble instanceof Error ? trouble.message : t.common.fileUnreadable);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows taps so touching the sheet does not count as touching the
            backdrop behind it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.heading}>{t.sound.autoEq.title}</Text>
          <Text style={styles.hint}>{t.sound.autoEq.about}</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(next) => {
              setText(next);
              setProblem(null);
            }}
            placeholder={'Preamp: -6.2 dB\nFilter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70'}
            placeholderTextColor={c.textDisabled}
            accessibilityLabel={t.sound.autoEq.textLabel}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            textAlignVertical="top"
          />
          {problem ? (
            <Text accessibilityRole="alert" style={styles.bad}>
              {problem}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {/* Not offered where the native side cannot do it; pasting needs
                nothing from it. */}
            {JukeboxAudio.pickTextFileAsync ? (
              <Pressable android_ripple={pressed} style={styles.button} onPress={() => void pick()} accessibilityRole="button">
                <Text style={styles.linkLabel}>{t.sound.autoEq.chooseFile}</Text>
              </Pressable>
            ) : null}
            <View style={styles.gap} />
            <Pressable android_ripple={pressed} style={styles.button} onPress={onClose} accessibilityRole="button">
              <Text style={styles.buttonLabel}>{t.common.cancel}</Text>
            </Pressable>
            <Pressable
              android_ripple={pressed}
              style={[styles.button, styles.confirm, !text.trim() && styles.disabled]}
              disabled={!text.trim()}
              onPress={() => read(text, null)}
              accessibilityRole="button"
              accessibilityState={{ disabled: !text.trim() }}>
              <Text style={styles.confirmLabel}>{t.common.import}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: scrimOf(c),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 18,
    gap: 12,
    alignSelf: 'stretch',
    // Leaves the keyboard room on a phone held sideways, where a sheet as
    // tall as it liked would put its own buttons underneath it.
    maxHeight: '100%',
    ...outlined(c),
  },
  heading: { color: c.text, fontSize: 15, fontWeight: '600' },
  hint: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  input: {
    color: c.text,
    fontSize: 12.5,
    fontFamily: 'monospace',
    backgroundColor: c.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    // About six lines, and scrolling inside itself past that: a correction
    // is eleven, and the buttons have to stay on the screen with it.
    height: 132,
    flexShrink: 1,
    ...outlined(c),
  },
  bad: { color: c.danger, fontSize: 12.5, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  gap: { flex: 1 },
  button: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  buttonLabel: { color: c.textSecondary, fontSize: 14 },
  linkLabel: { color: c.accent, fontSize: 14 },
  confirm: { backgroundColor: c.primary },
  confirmLabel: { color: c.onPrimary, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.35 },
}));
