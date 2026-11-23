import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { CardAnswers, type Answer } from './CardAnswers';
import { FloatingCard } from './CardGlass';
import { Floating } from './Floating';
import { Pressable } from './Pressable';
import { makeStyles, outlined } from '../lib/theme/index';
import { LEADING, RADIUS, SPACE, TYPE } from '../lib/theme/measures';
import { scrimOf } from '../lib/theme/Veil';

/**
 * A small card over the page that asks or says something: [title], [body]
 * under it, whatever else it needs ([children]), and its answers along the
 * foot (`CardAnswers`). Over a scrim, touching which is [onClose], as Back
 * is; short of the bars (`Floating`). [edge] where what is in it runs to the
 * card's sides, a list of choices (`OptionSheet`), and only the words keep
 * the card's margins.
 *
 * Every card of the app's was this, each its own copy: four margins round the
 * card, three of room inside it, two sizes of heading, two of tallest.
 */
export function Dialog({ visible, onClose, ...card }: DialogProps & { visible: boolean }) {
  return (
    <Floating visible={visible} onClose={onClose}>
      <DialogCard onClose={onClose} {...card} />
    </Floating>
  );
}

type DialogProps = {
  onClose: () => void;
  title?: string;
  body?: string;
  answers?: Answer[];
  edge?: boolean;
  children?: ReactNode;
};

/** The card itself, for one drawn in a `Floating` of its own making (`TextPrompt`, made afresh each time it opens). */
export function DialogCard({ onClose, title, body, answers, edge = false, children }: DialogProps) {
  const styles = useStyles();
  return (
    // Neither the backdrop nor the card is a stop for a screen reader: both are pressable only to sort touches, and as
    // stops they read the heading as a button that does nothing, or one that closes the card unasked.
    <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
      <FloatingCard style={[styles.card, edge && styles.edge]}>
        {title ? (
          <Text accessibilityRole="header" style={[styles.title, edge && styles.inset]}>
            {title}
          </Text>
        ) : null}
        {body ? <Text style={[styles.body, edge && styles.inset]}>{body}</Text> : null}
        {children}
        {answers && answers.length > 0 ? <CardAnswers answers={answers} style={edge ? styles.inset : null} /> : null}
      </FloatingCard>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: scrimOf(c), alignItems: 'center', justifyContent: 'center', padding: SPACE.xl },
    card: {
      alignSelf: 'stretch',
      // Short enough to leave the scrim showing above and below, so there is always somewhere to touch for never mind.
      maxHeight: '80%',
      gap: SPACE.m,
      padding: SPACE.l,
      borderRadius: RADIUS.card,
      backgroundColor: c.surface,
      ...outlined(c),
    },
    edge: { paddingHorizontal: 0 },
    inset: { paddingHorizontal: SPACE.l },
    title: { color: c.text, fontSize: TYPE.heading, fontWeight: '600' },
    body: { color: c.textMuted, fontSize: TYPE.small, lineHeight: LEADING.small },
  })
);
