import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

/**
 * Asks for one line of text.
 *
 * Was the tag prompt, generalised when lists needed naming and renaming: the
 * dialog was never about tags, only its wording was.
 */
export function TextPrompt({
  visible,
  heading,
  placeholder,
  confirmLabel = 'Save',
  initial = '',
  onSubmit,
  onClose,
}: {
  visible: boolean;
  heading: string;
  placeholder: string;
  confirmLabel?: string;
  /** What the field starts with, for renaming something rather than naming it. */
  initial?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);

  // Reset as it opens rather than as it closes, so the field is right from the
  // first frame instead of holding the last thing typed into it.
  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  const submit = () => {
    const cleaned = value.trim();
    if (cleaned.length === 0) return;
    onSubmit(cleaned);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows taps so touching the sheet does not count as touching the
            backdrop behind it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.heading}>{heading}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor="#5f5f5f"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={onClose}>
              <Text style={styles.buttonLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.confirm, !value.trim() && styles.disabled]}
              disabled={!value.trim()}
              onPress={submit}>
              <Text style={styles.confirmLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000cc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  sheet: {
    backgroundColor: '#1c1c1c',
    borderRadius: 14,
    padding: 18,
    gap: 14,
    alignSelf: 'stretch',
  },
  heading: { color: '#ededed', fontSize: 15, fontWeight: '600' },
  input: {
    color: '#ededed',
    fontSize: 15,
    backgroundColor: '#121212',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  buttonLabel: { color: '#9a9a9a', fontSize: 14 },
  confirm: { backgroundColor: '#ededed' },
  confirmLabel: { color: '#121212', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.35 },
});
