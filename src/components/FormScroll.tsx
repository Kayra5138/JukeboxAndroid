import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

/**
 * A scrolling form that keeps the field being typed in above the keyboard.
 *
 * The app draws edge to edge, and on Android that means the window is no
 * longer made shorter when the keyboard comes up: the keyboard simply arrives
 * over the bottom third of whatever was there. A field down the page was
 * typed into blind.
 *
 * Two things are done about it here, both measured rather than assumed. The
 * scroll view is given room at its foot equal to however much of it the
 * keyboard covers, so the last field can be scrolled clear. And whenever a
 * field takes the focus, or the keyboard arrives under one that has it, the
 * field is looked for on the screen and, only if it is hidden, scrolled up
 * to sit just above the keyboard. A field already in view is left where it
 * is: a page that jumps every time it is touched is worse than the fault.
 */

/** How far above the keyboard a revealed field is left, so its label is not on the edge. */
const CLEAR = 24;

/** Long enough for the room at the foot to be laid out before anything is measured against it. */
const SETTLE_MS = 80;

type Reveal = (input: { measureInWindow: TextInput['measureInWindow'] } | null) => void;

const RevealContext = createContext<Reveal | null>(null);

export function FormScroll({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const box = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const scrolled = useRef(0);
  /** Where the keyboard's top edge is on the screen, or null while it is away. */
  const keyboardTop = useRef<number | null>(null);
  const [room, setRoom] = useState(0);

  const pending = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => pending.current.forEach(clearTimeout), []);

  const reveal = useCallback<Reveal>((input) => {
    if (!input || keyboardTop.current == null) return;
    // Only the latest asking counts: taking the focus, the keyboard arriving
    // and the room being made all ask within a few frames of each other.
    pending.current.forEach(clearTimeout);

    const look = () => {
      const top = keyboardTop.current;
      if (top == null) return;
      box.current?.measureInWindow((_bx, boxTop) => {
        input.measureInWindow((_x, y, _width, height) => {
          // Nothing to measure: the field is on a tab that is not showing.
          if (height <= 0) return;
          const over = y + height + CLEAR - top;
          if (over <= 0) return;
          // A field taller than the space there is cannot be shown whole, and
          // its top is where the typing starts, so that is what is kept.
          const most = y - boxTop - CLEAR / 2;
          scroll.current?.scrollTo({ y: scrolled.current + Math.min(over, Math.max(0, most)), animated: true });
        });
      });
    };

    /*
      Looked at twice. The scroll view is being made shorter and is settling
      its own scrolling while this happens, and a single look taken in the
      middle of that measures a field that is still moving: on a phone it came
      up short by a third of the field. The second look, once everything has
      stopped, moves it the rest of the way, and does nothing if the first was
      right.
    */
    pending.current = [setTimeout(look, SETTLE_MS), setTimeout(look, SETTLE_MS + 320)];
  }, []);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      const top = event.endCoordinates.screenY;
      keyboardTop.current = top;
      box.current?.measureInWindow((_x, y, _width, height) => {
        // A form on a hidden tab has no height and is given no room.
        setRoom(height > 0 ? Math.max(0, y + height - top) : 0);
        if (height > 0) reveal(TextInput.State.currentlyFocusedInput());
      });
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setRoom(0);
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [reveal]);

  /*
    And again once the room at the foot is really there.

    The first look, as the keyboard arrives, is taken against a scroll view
    that has not been made shorter yet. It finds the field hidden and asks to
    scroll, and a scroll view will not scroll past its own end: measured on a
    phone, the field moved exactly as far as the old end allowed and stopped
    two thirds under the keyboard. The room changing is the moment the new end
    exists, so that is when it is asked again.
  */
  useEffect(() => {
    if (room > 0) reveal(TextInput.State.currentlyFocusedInput());
  }, [room, reveal]);

  return (
    <View ref={box} style={styles.box} collapsable={false}>
      <RevealContext value={reveal}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={32}
          onScroll={(event) => {
            scrolled.current = event.nativeEvent.contentOffset.y;
          }}>
          {children}
        </ScrollView>
      </RevealContext>
      {/* Under the scroll view rather than padding inside it, so the view
          itself ends where the keyboard begins and its own scrolling, bar
          and all, stays above it. */}
      <View style={{ height: room }} />
    </View>
  );
}

/**
 * A text field for a form.
 *
 * A plain TextInput with two things put right.
 *
 * Holding a finger on the text selects a word, as it should, and did not bring
 * the keyboard up: a field here only takes the focus when it is tapped, and a
 * long press is not a tap. So the selection handles appeared over text that
 * could not be typed into. A selection in a field without the focus is now
 * taken as asking for it.
 *
 * And taking the focus tells the form around it, so the field can be brought
 * out from under a keyboard that was already up.
 */
export function TextField({ onFocus, onSelectionChange, ...rest }: TextInputProps) {
  const input = useRef<TextInput>(null);
  const reveal = use(RevealContext);

  return (
    <TextInput
      ref={input}
      {...rest}
      onFocus={(event) => {
        reveal?.(input.current);
        onFocus?.(event);
      }}
      onSelectionChange={(event) => {
        const { start, end } = event.nativeEvent.selection;
        if (start !== end && input.current && !input.current.isFocused()) input.current.focus();
        onSelectionChange?.(event);
      }}
    />
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
});
