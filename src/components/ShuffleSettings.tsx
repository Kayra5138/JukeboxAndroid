import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OptionSheet } from './OptionSheet';
import { Pressable } from './Pressable';
import { useRows } from './settings/rows';
import { TextPrompt } from './TextPrompt';
import { useT } from '../lib/i18n/index';
import { useLibraryTracks } from '../lib/library/useLibrary';
import {
  setShuffleLabel,
  setShuffleSource,
  shuffleChoices,
  shuffleNamesOf,
  shuffleWordsFor,
  sourceKey,
  sourceName,
  sourceOfKey,
  useShuffleLabel,
  useShuffleSource,
  type ShuffleNames,
} from '../lib/lists/shuffleSource';
import { useFavoritesShown } from '../lib/playlists/favorites';
import { usePressed } from '../lib/theme/index';
import { setAsideIdsIn, useSetAside } from '../lib/library/setAside';
import { isTape } from '../lib/tapes/tape';

/**
 * The shuffle button's settings: what it plays, and what it says. Under
 * Settings › Library, and what plays from the foot of the list the button
 * opens when held (`ShuffleButton`).
 */

/** Everything, and the lists made from the listening, by the names the app gives them in its language. */
export function useShuffleNames(): ShuffleNames {
  const t = useT();
  return useMemo(() => shuffleNamesOf(t), [t]);
}

/** What the button says, and what it is said to do aloud: see `shuffleWordsFor`. */
export function useShuffleWords(): { shown: string | null; spoken: string } {
  const t = useT();
  const names = useShuffleNames();
  const wanted = useShuffleSource();
  const label = useShuffleLabel();
  return shuffleWordsFor(t, wanted, label, sourceName(wanted, names) ?? names.all);
}

/** Choosing what the button plays from now on: every list it can play, with how many songs, the one it plays ticked. */
export function ShuffleSourceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const said = t.library.shuffle;
  const names = useShuffleNames();
  const music = useLibraryTracks();
  const favoritesShown = useFavoritesShown();
  const wanted = useShuffleSource();
  // Only while it is up: a smart list's songs are worked out to be counted. Everything less what is set aside.
  const rules = useSetAside();
  const choices = useMemo(
    () => (visible ? shuffleChoices(music, names, favoritesShown, undefined, setAsideIdsIn(music.filter((track) => !isTape(track)), rules)) : []),
    [visible, music, names, favoritesShown, rules]
  );
  return (
    <OptionSheet
      visible={visible}
      heading={said.heading}
      note={said.note}
      options={choices.map((choice) => ({ value: choice.key, label: choice.name, detail: t.common.tracks(choice.count) }))}
      chosen={sourceKey(wanted)}
      onChoose={(key) => {
        setShuffleSource(sourceOfKey(key));
        onClose();
      }}
      onClose={onClose}
    />
  );
}

/** The two rows under Settings › Library, each opening what it chooses. */
export function ShuffleSettingsRows() {
  const t = useT();
  const said = t.library.shuffle;
  const styles = useRows();
  const pressed = usePressed();
  const names = useShuffleNames();
  const wanted = useShuffleSource();
  const label = useShuffleLabel();
  const [choosing, setChoosing] = useState<'source' | 'label' | 'words' | null>(null);
  const playing = sourceName(wanted, names) ?? names.all;
  const saying = label.mode === 'words' ? label.words : said.label[label.mode];

  return (
    <>
      <Pressable
        android_ripple={pressed}
        accessibilityRole="button"
        accessibilityLabel={`${said.heading}, ${playing}`}
        style={styles.row}
        onPress={() => setChoosing('source')}>
        <View style={styles.line}>
          <Text style={[styles.title, own.title]}>{said.heading}</Text>
          <View style={[styles.choices, own.value]}>
            <Text style={styles.value} numberOfLines={1}>
              {playing}
            </Text>
            <Text style={styles.chevron} importantForAccessibility="no">›</Text>
          </View>
        </View>
        <Text style={styles.muted}>{said.note}</Text>
      </Pressable>
      <View style={styles.rule} />
      <Pressable
        android_ripple={pressed}
        accessibilityRole="button"
        accessibilityLabel={`${said.labelHeading}, ${saying}`}
        style={styles.row}
        onPress={() => setChoosing('label')}>
        <View style={styles.line}>
          <Text style={[styles.title, own.title]}>{said.labelHeading}</Text>
          <View style={[styles.choices, own.value]}>
            <Text style={styles.value} numberOfLines={1}>
              {saying}
            </Text>
            <Text style={styles.chevron} importantForAccessibility="no">›</Text>
          </View>
        </View>
      </Pressable>

      <ShuffleSourceSheet visible={choosing === 'source'} onClose={() => setChoosing(null)} />
      <OptionSheet
        visible={choosing === 'label'}
        heading={said.labelHeading}
        options={(['name', 'words', 'icon'] as const).map((mode) => ({ value: mode, label: said.label[mode] }))}
        chosen={label.mode}
        onChoose={(mode) => {
          if (mode === 'words') setChoosing('words');
          else {
            setShuffleLabel({ mode });
            setChoosing(null);
          }
        }}
        // Called as well after a choice: the words asked for stay asked for.
        onClose={() => setChoosing((now) => (now === 'label' ? null : now))}
      />
      <TextPrompt
        visible={choosing === 'words'}
        heading={said.wordsHeading}
        placeholder={said.wordsPlaceholder}
        initial={label.mode === 'words' ? label.words : ''}
        onSubmit={(words) => {
          setShuffleLabel(words.trim() ? { mode: 'words', words: words.trim() } : { mode: 'name' });
          setChoosing(null);
        }}
        onClose={() => setChoosing(null)}
      />
    </>
  );
}

/** The setting's name kept whole, and what it is set to cut short instead: a list's name may be long. */
const own = StyleSheet.create({
  title: { flexShrink: 0 },
  value: { flexShrink: 1, minWidth: 0 },
});
