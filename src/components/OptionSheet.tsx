import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, usePressed } from '../lib/theme/index';

/**
 * Asks for one of a list, where the list is too long to lay out in a row.
 *
 * Three alternatives are chips beside the setting's name and need no dialog.
 * Fifty languages are not, and this is where they go: the same sheet a line of
 * text is asked for on, with the list in place of the field and a tick against
 * the one already chosen. Choosing is the whole of the transaction — a tap
 * picks and closes, since there is nothing else here to confirm.
 */
export function OptionSheet<Value extends string>({
  visible,
  heading,
  note,
  options,
  chosen,
  onChoose,
  onClose,
}: {
  visible: boolean;
  heading: string;
  /** A line under the list about the choice as a whole. */
  note?: string;
  options: readonly { value: Value; label: string }[];
  chosen: Value;
  onChoose: (value: Value) => void;
  onClose: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows taps so touching the sheet does not count as touching the
            backdrop behind it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.heading}>{heading}</Text>
          <ScrollView style={styles.list}>
            {options.map((option) => {
              const on = option.value === chosen;
              return (
                <Pressable
                  android_ripple={pressed}
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={styles.option}
                  onPress={() => {
                    onChoose(option.value);
                    onClose();
                  }}>
                  <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                    {option.label}
                  </Text>
                  {on ? <Text style={styles.tick}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <View style={styles.actions}>
            <Pressable android_ripple={pressed} style={styles.button} accessibilityRole="button" onPress={onClose}>
              <Text style={styles.buttonLabel}>{t.common.cancel}</Text>
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
    backgroundColor: c.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: 14,
    paddingVertical: 18,
    gap: 12,
    alignSelf: 'stretch',
    // Short enough to leave the backdrop showing above and below, so there is
    // always somewhere to tap that means "never mind".
    maxHeight: '80%',
    ...outlined(c),
  },
  heading: { color: c.text, fontSize: 15, fontWeight: '600', paddingHorizontal: 18 },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  label: { color: c.text, fontSize: 15, flexShrink: 1 },
  labelOn: { color: c.accent },
  tick: { color: c.accent, fontSize: 15, fontWeight: '700' },
  note: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 18 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 18 },
  button: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  buttonLabel: { color: c.textSecondary, fontSize: 14 },
}));
