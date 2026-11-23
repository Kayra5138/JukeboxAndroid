import { useEffect, useRef, useState } from 'react';
import { LEADING, SPACE, TYPE } from '../lib/theme/measures';
import { DialogCard } from './Dialog';
import { Field } from './FormScroll';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Floating } from './Floating';
import { OnAPage } from './OnAPage';
import { CardAnswers } from './CardAnswers';
import { useRows } from './settings/rows';

import { useT } from '../lib/i18n/index';
import { makeStyles } from '../lib/theme/index';
import { haptic } from '../lib/ui/haptics';

/**
 * Asks for one line of text.
 *
 * Was the tag prompt, generalised when lists needed naming and renaming: the
 * dialog was never about tags, only its wording was.
 */
type Prompt = {
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
};

/**
 * Asked in a sheet over the screen, or with [page] on a page of its own in the
 * tab (`OnAPage`), as Settings asks everything now.
 */
export function TextPrompt({ page = false, ...prompt }: Prompt & { page?: boolean }) {
  return page ? <PromptOnAPage {...prompt} /> : <PromptInASheet {...prompt} />;
}

function PromptOnAPage({ visible, heading, onClose, ...rest }: Prompt) {
  return (
    <OnAPage visible={visible} title={heading} onClose={onClose}>
      <PromptFields heading={heading} onClose={onClose} {...rest} />
    </OnAPage>
  );
}

/**
 * The field and its buttons on a page: what is typed kept here, the page
 * drawing this same field each time whoever asked is drawn again.
 */
function PromptFields({
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
}: Omit<Prompt, 'visible'>) {
  const [value, setValue] = useState(initial);
  const t = useT();
  const styles = useStyles();
  const rows = useRows();
  const submit = () => {
    const cleaned = value.trim();
    if (cleaned.length === 0 && !optional) {
      haptic('results', 'reject');
      return;
    }
    onSubmit(cleaned);
  };
  return (
    <>
      <View style={[rows.card, styles.onPage]}>
        <Field
          // A page and not a window still appearing: the keyboard comes up with it.
          autoFocus
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
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
        <CardAnswers
          answers={[
            { label: t.common.cancel, kind: 'quiet', onPress: onClose },
            { label: confirmLabel ?? t.common.save, disabled: !optional && !value.trim(), onPress: submit },
          ]}
        />
      </View>
      {hint ? <Text style={rows.aside}>{hint}</Text> : null}
    </>
  );
}

function PromptInASheet({ visible, onClose, ...rest }: Prompt) {
  // The card is made afresh each time it opens, and keeps what is typed in itself: see [PromptCard].
  return (
    <Floating visible={visible} onClose={onClose}>
      <PromptCard onClose={onClose} {...rest} />
    </Floating>
  );
}

/**
 * The card: the heading, the box and its buttons, over a scrim to touch for
 * never mind. What is typed is kept here, in the card, which is drawn in the
 * tab's layer (`Floating`) and not where it was asked for: kept by whoever
 * asked, every letter would have gone round by them to come back.
 */
function PromptCard({
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
}: Omit<Prompt, 'visible'>) {
  const [value, setValue] = useState(initial);
  const t = useT();
  const styles = useStyles();

  /*
    Into the box and the keyboard up a moment after the card is there.
    Focused as it was made, inside a window still appearing, Android gave it
    the cursor and no keyboard.
  */
  const box = useRef<TextInput>(null);
  useEffect(() => {
    const later = setTimeout(() => box.current?.focus(), 120);
    return () => clearTimeout(later);
  }, []);

  const submit = () => {
    const cleaned = value.trim();
    // The button is not live with nothing typed; the keyboard's own key still is.
    if (cleaned.length === 0 && !optional) {
      haptic('results', 'reject');
      return;
    }
    onSubmit(cleaned);
  };

  // Cancel and the back gesture are the ways out.
  return (
    <DialogCard
      onClose={onClose}
      title={heading}
      answers={[
        { label: t.common.cancel, kind: 'quiet', onPress: onClose },
        { label: confirmLabel ?? t.common.save, disabled: !optional && !value.trim(), onPress: submit },
      ]}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Field
        ref={box}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
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
    </DialogCard>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  // Pulled up towards the heading it belongs to, against the sheet's own gap.
  hint: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint, marginTop: -SPACE.s },
  // On a page: the field and its buttons in a card of Settings, with room inside it.
  onPage: { padding: SPACE.l, gap: SPACE.m },
}));
