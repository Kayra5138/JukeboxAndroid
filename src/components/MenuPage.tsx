import type { ReactNode } from 'react';
import { SPACE, RADIUS } from '../lib/theme/measures';
import { ScrollView, StyleSheet, View } from 'react-native';

import { makeStyles, outlined, outlinedClip } from '../lib/theme/index';
import { scrimOf, useWindowVeil } from '../lib/theme/Veil';
import { FloatingCard } from './CardGlass';
import { Floating, useInTab } from './Floating';
import { Modal } from './Modal';
import { OnAPage } from './OnAPage';
import { Pressable } from './Pressable';
import { useRows } from './settings/rows';

/**
 * A menu, or anything else more than a small question: a page of its own in
 * the tab (`OnAPage`), with the tab bar and the bar of what is playing where
 * they always are, and Back to close it. See `Floating` for the other kind.
 *
 * Where there is no tab — the player, which is over the bars itself — the
 * sheet from the foot of the screen it always was.
 */
export function MenuPage({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  /** The page's name in its bar; a sheet has none. */
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const inTab = useInTab();
  if (inTab) {
    return (
      <OnAPage visible={visible} title={title} onClose={onClose}>
        <InACard>{children}</InACard>
      </OnAPage>
    );
  }
  return (
    <MenuSheet visible={visible} onClose={onClose}>
      {children}
    </MenuSheet>
  );
}

/**
 * A menu of a few quick things, as a card floating over the page, short of
 * the bars (`Floating`): a song's, held. A page of its own was too much for
 * a play next or a heart.
 *
 * The touches go to what is touched from the first: told to keep them, the
 * list let a keyboard up, or a box with the cursor in it, have the first one
 * to put itself away, and the press it was meant for did nothing.
 */
export function MenuCard({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Floating visible={visible} onClose={onClose}>
      {/* Not a stop for a screen reader; the back gesture closes it. */}
      <Pressable style={styles.centred} onPress={onClose} accessible={false}>
        <FloatingCard style={styles.card}>
          <ScrollView contentContainerStyle={styles.cardBody} keyboardShouldPersistTaps="always">
            {children}
          </ScrollView>
        </FloatingCard>
      </Pressable>
    </Floating>
  );
}

function InACard({ children }: { children: ReactNode }) {
  const rows = useRows();
  return <View style={rows.card}>{children}</View>;
}

/** The sheet from the foot of the screen, in a window of its own: for the player. */
function MenuSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const styles = useStyles();
  useWindowVeil(visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Not a stop for a screen reader, which would otherwise read the whole
          heading as one button that closes the menu. The back gesture closes it. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        {visible ? (
          // Taller than a landscape screen, so the sheet is bounded and scrolls rather than running off the bottom.
          <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetBody}>
            {children}
          </ScrollView>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: scrimOf(c), justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: RADIUS.card,
      borderTopRightRadius: RADIUS.card,
      maxHeight: '85%',
      flexGrow: 0,
      ...outlined(c),
    },
    sheetBody: { paddingTop: SPACE.xs, paddingBottom: 28 },
    centred: { flex: 1, backgroundColor: scrimOf(c), alignItems: 'center', justifyContent: 'center', padding: SPACE.l },
    card: {
      backgroundColor: c.surface,
      borderRadius: RADIUS.card,
      alignSelf: 'stretch',
      maxWidth: 480,
      width: '100%',
      // Short enough to leave the scrim showing above and below, somewhere to touch for never mind.
      maxHeight: '88%',
      overflow: 'hidden',
      ...outlinedClip(c),
    },
    cardBody: { paddingBottom: SPACE.m },
  })
);
