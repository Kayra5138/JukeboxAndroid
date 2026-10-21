import { StyleSheet, Text, View } from 'react-native';

import { MinusIcon, PlusIcon } from '../Icons';
import { Pressable } from '../Pressable';
import { Sheet } from './Sheet';
import { useT } from '../../lib/i18n/index';
import { makeStyles, usePressed } from '../../lib/theme/index';

/**
 * What Discover is, where its songs come from and what the two buttons on a
 * row do: behind the "i" over the list.
 *
 * It used to stand over the list as three sentences, every day, between the
 * heading and the first song. It is read once, by somebody who has just
 * found the screen, and is then a paragraph in the way of the songs.
 */
export function DiscoverAbout({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.discover.about;
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <Text accessibilityRole="header" style={styles.heading}>
          {said.heading}
        </Text>
        <Text style={styles.text}>{said.what}</Text>
        {/* Why a new install, with nothing played, has a list at all. */}
        <Text style={styles.text}>{t.welcome.discoverEarly}</Text>
        <Text style={styles.text}>{said.source}</Text>
        {/* Each button beside what it does, drawn as it is on a row. */}
        <View style={styles.pair}>
          <View style={styles.sign}>
            <PlusIcon size={18} />
          </View>
          <Text style={styles.signText}>{said.keep}</Text>
        </View>
        <View style={styles.pair}>
          <View style={styles.sign}>
            <MinusIcon size={18} />
          </View>
          <Text style={styles.signText}>{said.exclude}</Text>
        </View>
        <Text style={styles.text}>{said.room}</Text>
        <View style={styles.actions}>
          <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.button} onPress={onClose}>
            <Text style={styles.buttonLabel}>{t.common.close}</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 18, gap: 12 },
  heading: { color: c.text, fontSize: 16, fontWeight: '600' },
  text: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  pair: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sign: { width: 24, height: 20, alignItems: 'center', justifyContent: 'center' },
  signText: { flex: 1, color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  button: { paddingHorizontal: 16, paddingVertical: 9, minHeight: 44, justifyContent: 'center', borderRadius: 8 },
  buttonLabel: { color: c.textSecondary, fontSize: 14 },
}));
