import { useState } from 'react';
import { LEADING, SPACE, TYPE } from '../../lib/theme/measures';
import { Note } from '../Note';
import { StyleSheet, Text, View } from 'react-native';
import { OnAPage } from '../OnAPage';
import { TextButton } from '../Button';
import { CardAnswers } from '../CardAnswers';
import { Field } from '../FormScroll';
import { useRows } from '../settings/rows';

import JukeboxAudio from '../../../modules/jukebox-audio';
import {
  describeImport,
  nameFromFile,
  parseAutoEq,
  type AutoEqResult,
} from '../../lib/equalizer/autoeq';
import { useT } from '../../lib/i18n/index';
import { makeStyles } from '../../lib/theme/index';

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
type Importing = {
  /** `name` is a suggestion from the file's name, or empty where there was none. */
  onImport: (result: AutoEqResult, said: string, name: string) => void;
  onClose: () => void;
};

export function ImportSheet({ visible, onImport, onClose }: Importing & { visible: boolean }) {
  const t = useT();
  // On a page of its own in the tab, as Settings asks everything now (`OnAPage`).
  return (
    <OnAPage visible={visible} title={t.sound.autoEq.title} onClose={onClose}>
      <ImportFields onImport={onImport} onClose={onClose} />
    </OnAPage>
  );
}

/**
 * What is pasted or read, kept here: the page draws this same field each time
 * the equalizer is drawn again, and a new one, empty, each time it is opened.
 */
function ImportFields({ onImport, onClose }: Importing) {
  const t = useT();
  const styles = useStyles();
  const rows = useRows();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

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
    // Asked outside the try, which the React Compiler cannot take a question mark inside of.
    const picker = JukeboxAudio.pickTextFileAsync;
    if (!picker) return;
    try {
      const picked = await picker();
      // Backed out of the picker, which is not a failure and says nothing.
      if (!picked) return;
      setText(picked.text);
      read(picked.text, picked.name);
    } catch (trouble) {
      setProblem(trouble instanceof Error ? trouble.message : t.common.fileUnreadable);
    }
  };

  return (
    <View style={[rows.card, styles.onPage]}>
          <Text style={styles.hint}>{t.sound.autoEq.about}</Text>
          <Field
            style={styles.input}
            value={text}
            onChangeText={(next) => {
              setText(next);
              setProblem(null);
            }}
            placeholder={'Preamp: -6.2 dB\nFilter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70'}
            accessibilityLabel={t.sound.autoEq.textLabel}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            textAlignVertical="top"
          />
          {problem ? (
            <Note tone="bad">
              {problem}
            </Note>
          ) : null}
          {/* Not offered where the native side cannot do it; pasting needs nothing from it. */}
          {JukeboxAudio.pickTextFileAsync ? <TextButton label={t.sound.autoEq.chooseFile} onPress={() => void pick()} /> : null}
          <CardAnswers
            answers={[
              { label: t.common.cancel, kind: 'quiet', onPress: onClose },
              { label: t.common.import, disabled: !text.trim(), onPress: () => read(text, null) },
            ]}
          />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  // In a card of Settings, with room inside it, on its page.
  onPage: { padding: SPACE.l, gap: SPACE.m },
  hint: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
  // The app's box, in letters of one width, the way a correction's columns line up; about six lines, and scrolling
  // inside itself past that: a correction is eleven, and the buttons have to stay on the screen with it.
  input: { fontSize: TYPE.hint, fontFamily: 'monospace', height: CORRECTION_BOX, flexShrink: 1 },
}));

/** How tall the box a correction is pasted into stands: see `input`. */
const CORRECTION_BOX = 132;
