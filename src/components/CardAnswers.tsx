import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, TextButton } from './Button';
import { makeStyles } from '../lib/theme/index';
import { SPACE } from '../lib/theme/measures';

/**
 * One of the answers at the foot of a card that asks something: [yes], the
 * one it is asking for, the app's own small button filled; [danger], a yes
 * that cannot be taken back (deleting, cutting off), in red; [quiet], the way
 * out or the answer that changes nothing, words alone.
 */
export type Answer = {
  label: string;
  onPress: () => void;
  kind?: 'yes' | 'danger' | 'quiet';
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * The answers along the foot of a card, at its right, the way out first and
 * what it asks for last (`ConfirmSheet`, `TextPrompt`, `OptionSheet`, and the
 * cards of their own kind). Each card drew its own row of them, all alike and
 * each a copy (settled with Kayra on 20 November 2026: the yes filled, the
 * way out words, a yes that cannot be undone red).
 */
export function CardAnswers({ answers, style }: { answers: Answer[]; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.row, style]}>
      {answers.map((answer) =>
        (answer.kind ?? 'yes') === 'quiet' ? (
          <TextButton
            key={answer.label}
            label={answer.label}
            tone="plain"
            size="body"
            disabled={answer.disabled}
            accessibilityLabel={answer.accessibilityLabel}
            onPress={answer.onPress}
            style={styles.quiet}
          />
        ) : (
          <Button
            key={answer.label}
            label={answer.label}
            size="small"
            kind={answer.kind === 'danger' ? 'danger' : 'primary'}
            disabled={answer.disabled}
            accessibilityLabel={answer.accessibilityLabel}
            onPress={answer.onPress}
          />
        )
      )}
    </View>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.s },
    // Words with room round them as the buttons beside them have, so that the two stand apart evenly.
    quiet: { alignSelf: 'center', paddingHorizontal: SPACE.m },
  })
);
