import { useState } from 'react';
import { Text, View } from 'react-native';

import { OptionSheet } from './OptionSheet';
import { Pressable } from './Pressable';
import { useRows } from './settings/rows';
import { useT } from '../lib/i18n/index';
import { AUTOPLAY_MODES } from '../lib/player/autoplay/plan';
import { setAutoplayMode, useAutoplayMode } from '../lib/player/autoplay/setting';
import { usePressed } from '../lib/theme/index';

/**
 * A row of the player's settings: what plays when the queue is about to run
 * out. The row says which, and opens the four choices, each with a line of
 * what it means — two of them use the network and YouTube, and that is
 * somebody's to know before they choose.
 *
 * The sheet is drawn by the row itself, beside it in the page, since it is the
 * only thing that opens it.
 */
export function AutoplaySetting() {
  const t = useT();
  // The rows' own styles, so that this one is laid out as the lyrics row beside it is.
  const styles = useRows();
  const pressed = usePressed();
  const mode = useAutoplayMode();
  const [open, setOpen] = useState(false);
  const said = t.settings.autoplay;
  const options = AUTOPLAY_MODES.map((value) => ({ value, label: said[value].label, detail: said[value].note }));

  return (
    <>
      <Pressable
        android_ripple={pressed}
        accessibilityRole="button"
        style={styles.row}
        onPress={() => setOpen(true)}>
        <View style={styles.line}>
          <Text style={styles.title}>{said.title}</Text>
          <View style={styles.choices}>
            <Text style={styles.value} numberOfLines={1}>{said[mode].label}</Text>
            <Text style={styles.chevron} importantForAccessibility="no">›</Text>
          </View>
        </View>
        <Text style={styles.muted}>{said.note}</Text>
      </Pressable>
      <OptionSheet
        visible={open}
        heading={said.title}
        note={said.sheetNote}
        options={options}
        chosen={mode}
        onChoose={setAutoplayMode}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
