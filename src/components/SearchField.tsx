import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useFocusEffect } from 'expo-router';
import { Keyboard, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from './Button';
import { TextField } from './FormScroll';
import { Pressable } from './Pressable';

import { useT } from '../lib/i18n/index';
import { hintKey, laid, makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { LEADING, RADIUS, SPACE, TOUCH, TYPE } from '../lib/theme/measures';

/** What a screen can do to its search box. */
export type SearchBox = { focus: () => void };

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
  onSubmitEditing,
  maxLength,
  style,
  height,
  go,
  ref,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  /** The search key on the keyboard, for a box whose search is asked for rather than run as it is typed. */
  onSubmitEditing?: () => void;
  maxLength?: number;
  /** The box as a whole, for where it is laid out. */
  style?: StyleProp<ViewStyle>;
  /** How tall the box is, where it stands in a row of things as tall as each other; its own height otherwise. */
  height?: number;
  /** Told when the box is being typed in, for anything that should stand aside. */
  onFocus?: () => void;
  onBlur?: () => void;
  /**
   * A search asked for rather than run as it is typed (a show, a book, a
   * video): its button beside the box, the app's own (`Button`), there to be
   * pressed once there is something to look for, and the keyboard's search
   * key doing the same.
   */
  go?: { label: string; onPress: () => void; busy?: boolean };
  /** For a screen to put the cursor in it: its tab pressed again at the top (`ui/tabReselect.ts`). */
  ref?: Ref<SearchBox>;
}) {
  const input = useRef<TextInput>(null);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), []);
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

  // Beside its button, as tall as it.
  const tall = height ?? (go ? TOUCH.normal : undefined);
  const box = (
    <View style={[styles.field, tall != null && { height: tall }, go ? styles.besideGo : style]}>
      {/*
        A form's field, which brings itself out from under the keyboard inside
        a form that scrolls (the details screen's lyrics) and is an ordinary
        field anywhere else.
      */}
      <TextField
        key={made}
        ref={input}
        style={[styles.input, tall != null && styles.inputFitted]}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmitEditing ?? (go && value.trim() ? go.onPress : undefined)}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
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
  if (!go) return box;
  return (
    <View style={[styles.withGo, style]}>
      {box}
      {/*
        Grey until there is something to look for, and not a faded fill: a
        see-through slab of the strongest colour was still the brightest thing
        on the screen, for a button that could not be pressed yet.
      */}
      <Button
        label={go.label}
        kind={value.trim() ? 'primary' : 'secondary'}
        busy={go.busy}
        disabled={!value.trim() || go.busy}
        onPress={go.onPress}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: RADIUS.control,
    paddingRight: SPACE.xs,
    ...outlined(c),
  },
  input: {
    flex: 1,
    color: c.text,
    fontSize: TYPE.body,
    paddingHorizontal: SPACE.m,
    paddingVertical: SPACE.m,
  },
  withGo: { flexDirection: 'row', gap: SPACE.s },
  besideGo: { flex: 1, minWidth: 0 },
  // In a box of a given height, the words in the middle of it rather than room round them.
  inputFitted: { paddingVertical: 0, alignSelf: 'stretch' },
  clear: { padding: SPACE.xs },
  clearCircle: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.control,
    backgroundColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearMark: {
    // Cut out of the circle rather than written on it: the colour of what the
    // field itself lies on. As one flat colour, since a field of glass is a
    // wash and a mark written in a wash is hardly there.
    color: laid(c.surface, c.bg),
    fontSize: TYPE.body,
    fontWeight: '700',
    // The glyph sits high in its line box; this drops it onto the centre.
    lineHeight: LEADING.body,
  },
}));
