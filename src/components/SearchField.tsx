import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useT } from '../lib/i18n/index';
import { hintKey, makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';

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
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();

  /*
    The field is made again when its hint or its colours change -- but only
    once its screen is the one in front.

    Android lays a field's hint out once, so new words or new colours need a
    new field; see `hintKey`. That alone was not enough, and for a reason that
    took two goes to see: the language and the theme are changed in Settings,
    which is another tab, and a field made while its own tab is out of sight
    is measured with no width to measure against. Its hint came out on two
    lines either way, until it was touched. So the key is held at what it was
    while the screen is away, and moved on when the screen comes back, where
    the new field has a real width to be laid out in.
  */
  const wanted = hintKey(c, placeholder);
  const [made, setMade] = useState(wanted);
  const [inFront, setInFront] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setInFront(true);
      return () => setInFront(false);
    }, [])
  );
  useEffect(() => {
    if (inFront && made !== wanted) setMade(wanted);
  }, [inFront, made, wanted]);

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
        key={made}
        ref={input}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={c.textDisabled}
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
          android_ripple={pressed}
          accessibilityRole="button"
          accessibilityLabel={t.common.clearSearch}
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

const useStyles = makeStyles((c) => StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingRight: 6,
    ...outlined(c),
  },
  input: {
    flex: 1,
    color: c.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  clear: { padding: 6 },
  clearCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearMark: {
    // Cut out of the circle rather than written on it: the colour of what the
    // field itself lies on.
    color: c.surface,
    fontSize: 15,
    fontWeight: '700',
    // The glyph sits high in its line box; this drops it onto the centre.
    lineHeight: 17,
  },
}));
