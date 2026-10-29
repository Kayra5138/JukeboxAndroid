import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from './Pressable';

import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';
import { haptic } from '../lib/ui/haptics';

/**
 * Asks for one line of text.
 *
 * Was the tag prompt, generalised when lists needed naming and renaming: the
 * dialog was never about tags, only its wording was.
 */
export function TextPrompt({
  visible,
  heading,
  hint,
  placeholder,
  confirmLabel,
  initial = '',
  keyboardType,
  secret,
  optional = false,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  heading: string;
  /** A line under the heading, for what the answer has to be: a range, a unit. */
  hint?: string;
  placeholder: string;
  /** What the button that accepts says. Save, unless it is something else that is being done. */
  confirmLabel?: string;
  /** What the field starts with, for renaming something rather than naming it. */
  initial?: string;
  /**
   * For a line that is a number, so the keys offered are the ones it is made
   * of. `numeric` is the one with a minus and a decimal point on it.
   */
  keyboardType?: 'default' | 'number-pad' | 'numeric';
  /**
   * For something that should not be read over a shoulder: a token, a key.
   * What is typed or pasted is shown as dots, and the keyboard is asked not to
   * learn it.
   */
  secret?: boolean;
  /** For an answer that may be left empty, as a note is: the button is live with nothing typed. */
  optional?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  useWindowVeil(visible);

  // Reset as it opens rather than as it closes, so the field is right from the
  // first frame instead of holding the last thing typed into it.
  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  /*
    Into the box and the keyboard up once the sheet's window is showing.
    Focused as it was made, inside a window still appearing, Android gave it
    the cursor and no keyboard, and a focus asked again of a box that has it
    already does nothing: so it is asked once, when the window says it is up.
  */
  const box = useRef<TextInput>(null);
  const later = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (later.current) clearTimeout(later.current);
  }, []);
  const shown = () => {
    if (later.current) clearTimeout(later.current);
    later.current = setTimeout(() => box.current?.focus(), 80);
  };

  const submit = () => {
    const cleaned = value.trim();
    // The button is not live with nothing typed; the keyboard's own key still is.
    if (cleaned.length === 0 && !optional) {
      haptic('results', 'reject');
      return;
    }
    onSubmit(cleaned);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={shown}>
      {/* Neither the backdrop nor the sheet is a stop for a screen reader; see
          `OptionSheet`. Cancel and the back gesture are the ways out. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        {/* Swallows taps so touching the sheet does not count as touching the
            backdrop behind it. */}
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <Text accessibilityRole="header" style={styles.heading}>{heading}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <TextInput
            ref={box}
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={c.textFaint}
            // Named by the heading for a screen reader: the hint is gone as
            // soon as there is anything in the box, a name given to rename
            // included, and the box would be only "edit box".
            accessibilityLabel={heading}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={keyboardType}
            secureTextEntry={secret}
            autoComplete={secret ? 'off' : undefined}
            importantForAutofill={secret ? 'no' : undefined}
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.button} onPress={onClose}>
              <Text style={styles.buttonLabel}>{t.common.cancel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              android_ripple={pressed}
              style={[styles.button, styles.confirm, !optional && !value.trim() && styles.disabled]}
              disabled={!optional && !value.trim()}
              onPress={submit}>
              <Text style={styles.confirmLabel}>{confirmLabel ?? t.common.save}</Text>
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
    padding: 28,
  },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 18,
    gap: 14,
    alignSelf: 'stretch',
    ...outlined(c),
  },
  heading: { color: c.text, fontSize: 15, fontWeight: '600' },
  // Pulled up towards the heading it belongs to, against the sheet's own gap.
  hint: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: -8 },
  input: {
    color: c.text,
    fontSize: 15,
    backgroundColor: c.bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...outlined(c),
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  buttonLabel: { color: c.textSecondary, fontSize: 14 },
  confirm: { backgroundColor: c.primary },
  confirmLabel: { color: c.onPrimary, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.35 },
}));
