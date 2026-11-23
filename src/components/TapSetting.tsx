import { useState } from 'react';
import { View } from 'react-native';
import { Text } from './settings/Find';

import { OptionSheet } from './OptionSheet';
import { Pressable } from './Pressable';
import { useRows, SwitchRow, Chevron } from './settings/rows';
import { useT } from '../lib/i18n/index';
import { SIMILAR_SOURCES, TAP_MODES } from '../lib/player/tap';
import { setSimilarSource, setTapEverywhere, setTapMode, useTapChoice } from '../lib/player/tapSetting';
import { usePressed } from '../lib/theme/index';

/**
 * Rows of the player's settings: what a tap on a track plays, and whether
 * that holds on the pages of albums and lists as well as on Tracks. The first
 * says which and opens the four choices, as the end of the queue's row does
 * beside it. Under it, where similar songs are chosen, where they come from;
 * and a switch for albums and lists, which only means anything once something
 * other than the list is chosen, so it is shown only then.
 */
export function TapSetting() {
  const t = useT();
  const rows = useRows();
  const pressed = usePressed();
  const { mode, everywhere, source } = useTapChoice();
  const [open, setOpen] = useState<'mode' | 'source' | null>(null);
  const said = t.settings.tap;
  const options = TAP_MODES.map((value) => ({ value, label: said[value].label, detail: said[value].note }));
  // Said as the end of the queue's choices are, since they are the same three, picked the same way.
  const sources = SIMILAR_SOURCES.map((value) => ({ value, label: t.settings.autoplay[value].label, detail: t.settings.autoplay[value].note }));

  return (
    <>
      <Pressable android_ripple={pressed} accessibilityRole="button" style={rows.row} onPress={() => setOpen('mode')}>
        <View style={rows.line}>
          <Text style={rows.title}>{said.title}</Text>
          <View style={rows.choices}>
            <Text style={rows.value} numberOfLines={1}>{said[mode].label}</Text>
            <Chevron />
          </View>
        </View>
        <Text style={rows.muted}>{said.note}</Text>
      </Pressable>
      {mode === 'similar' ? (
        <>
          <View style={rows.rule} />
          <Pressable android_ripple={pressed} accessibilityRole="button" style={rows.row} onPress={() => setOpen('source')}>
            <View style={rows.line}>
              <Text style={rows.title}>{said.source.title}</Text>
              <View style={rows.choices}>
                <Text style={rows.value} numberOfLines={1}>{t.settings.autoplay[source].label}</Text>
                <Chevron />
              </View>
            </View>
            <Text style={rows.muted}>{said.source.note}</Text>
          </Pressable>
        </>
      ) : null}
      {mode !== 'list' ? (
        <>
          <View style={rows.rule} />
          <SwitchRow
            title={said.everywhere.title}
            hint={said.everywhere.note}
            value={everywhere}
            onChange={setTapEverywhere}
          />
        </>
      ) : null}
      <OptionSheet
        page
        visible={open === 'mode'}
        heading={said.title}
        note={said.sheetNote}
        options={options}
        chosen={mode}
        onChoose={setTapMode}
        onClose={() => setOpen(null)}
      />
      <OptionSheet
        page
        visible={open === 'source'}
        heading={said.source.title}
        note={said.source.note}
        options={sources}
        chosen={source}
        onChoose={setSimilarSource}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
