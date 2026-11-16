import { useState } from 'react';
import { Text, View } from 'react-native';

import { OptionSheet } from './OptionSheet';
import { Pressable } from './Pressable';
import { Segmented } from './Segmented';
import { useRows } from './settings/rows';
import { useT } from '../lib/i18n/index';
import type { CoverMotion } from '../lib/ui/coverFace';
import {
  MOTIONS,
  setBeatFeel,
  setCoverMotion,
  setSongLook,
  setTapeLook,
  setTonearm,
  useBeatFeel,
  useCoverMotion,
  useSongLook,
  useTapeLook,
  useTonearm,
} from '../lib/ui/coverLook';
import { switchColours, useColours, usePressed } from '../lib/theme/index';
import { Switch } from './Switch';

/** What stands where the cover is in the player, for songs and for tapes, and what moves with the music round it: Settings → Player. See `ui/coverLook.ts`. */
export function CoverLookSettings() {
  const t = useT();
  const said = t.settings.coverLook;
  const styles = useRows();
  const pressed = usePressed();
  const song = useSongLook();
  const tape = useTapeLook();
  const motion = useCoverMotion();
  const beats = useBeatFeel();
  const tonearm = useTonearm();
  const c = useColours();
  const [choosing, setChoosing] = useState(false);
  const noteOf = (each: CoverMotion) => (each === 'none' ? undefined : said.notes[each]);

  return (
    <>
      <View style={styles.row}>
        <View style={styles.line}>
          <Text style={styles.title}>{said.songs}</Text>
          <Segmented
            role="radio"
            variant="chips"
            size="compact"
            options={[
              { value: 'cover' as const, label: said.cover },
              { value: 'record' as const, label: said.record },
            ]}
            value={song}
            onChange={setSongLook}
          />
        </View>
        <View style={styles.line}>
          <Text style={styles.title}>{said.tapes}</Text>
          <Segmented
            role="radio"
            variant="chips"
            size="compact"
            options={[
              { value: 'cover' as const, label: said.cover },
              { value: 'cassette' as const, label: said.cassette },
            ]}
            value={tape}
            onChange={setTapeLook}
          />
        </View>
        <Text style={styles.muted}>{said.note}</Text>
      </View>
      {/* Only where there is a record for it to be over. */}
      {song === 'record' ? (
        <>
          <View style={styles.rule} />
          <View style={styles.row}>
            <View style={styles.line}>
              <Text style={styles.title}>{said.tonearm}</Text>
              <Switch accessibilityLabel={said.tonearm} value={tonearm} onValueChange={setTonearm} {...switchColours(c, tonearm)} />
            </View>
            <Text style={styles.muted}>{said.tonearmNote}</Text>
          </View>
        </>
      ) : null}
      <View style={styles.rule} />
      {/* Five of them, each with a line of what it is: a list, not chips. */}
      <Pressable
        android_ripple={pressed}
        accessibilityRole="button"
        accessibilityLabel={`${said.motion}, ${said[motion]}`}
        style={styles.row}
        onPress={() => setChoosing(true)}>
        <View style={styles.line}>
          <Text style={styles.title}>{said.motion}</Text>
          <View style={styles.choices}>
            <Text style={styles.value} numberOfLines={1}>
              {said[motion]}
            </Text>
            <Text style={styles.chevron} importantForAccessibility="no">›</Text>
          </View>
        </View>
        <Text style={styles.muted}>{said.motionNote}</Text>
      </Pressable>
      <View style={styles.rule} />
      <View style={styles.row}>
        <View style={styles.line}>
          <Text style={styles.title}>{said.beats}</Text>
          <Switch accessibilityLabel={said.beats} value={beats} onValueChange={setBeatFeel} {...switchColours(c, beats)} />
        </View>
        <Text style={styles.muted}>{said.beatsNote}</Text>
      </View>
      <OptionSheet
        visible={choosing}
        heading={said.motion}
        options={MOTIONS.map((each) => ({ value: each, label: said[each], detail: noteOf(each) }))}
        chosen={motion}
        onChoose={setCoverMotion}
        onClose={() => setChoosing(false)}
      />
    </>
  );
}
