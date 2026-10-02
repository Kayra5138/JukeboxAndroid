import { useEffect, useRef } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

/**
 * A search box with a way out of it.
 *
 * The cross only appears once there is something to clear, so the field is
 * plain while it is empty and the button never sits there doing nothing.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  onFocus,
  onBlur,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  /** Told when the box is being typed in, for anything that should stand aside. */
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const input = useRef<TextInput>(null);

  /*
    Letting go of the keyboard is letting go of the box.

    Android's back key hides the keyboard without touching focus, so a field
    dismissed that way stayed focused for the rest of the screen's life and
    never reported otherwise. Anything that stands aside while this is being
    typed in would have stood aside for good.
  */
  useEffect(() => {
    const hidden = Keyboard.addListener('keyboardDidHide', () => input.current?.blur());
    return () => hidden.remove();
  }, []);

  return (
    <View style={styles.field}>
      <TextInput
        ref={input}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#5f5f5f"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        /*
          No taking the screen over to type in.

          On a phone held sideways Android decides there is too little room
          above the keyboard and puts up a full-screen editor of its own
          instead — a blank page with a Search button, and none of the results
          that are the whole point of typing here.
        */
        disableFullscreenUI
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear the search"
          // Larger than it looks: a cross drawn at the size it should appear is
          // smaller than a fingertip, so the padding is the target.
          hitSlop={10}
          style={styles.clear}
          onPress={() => onChangeText('')}>
          <View style={styles.clearCircle}>
            <Text style={styles.clearMark}>×</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1c',
    borderRadius: 10,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    color: '#ededed',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  clear: { padding: 6 },
  clearCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3a3a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearMark: {
    color: '#121212',
    fontSize: 15,
    fontWeight: '700',
    // The glyph sits high in its line box; this drops it onto the centre.
    lineHeight: 17,
  },
});
