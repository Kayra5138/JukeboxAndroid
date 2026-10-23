import { useCallback, useState } from 'react';
import { AutoplaySetting } from '../components/AutoplaySetting';
import { AutoplaySizes } from '../components/AutoplaySizes';
import { TapSetting } from '../components/TapSetting';
import { HeartSetting } from '../components/HeartSetting';
import { ListButtonSetting } from '../components/ListButtonSetting';
import { LyricsFolderSetting } from '../components/LyricsFolderSetting';
import { useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';

import { OptionSheet } from '../components/OptionSheet';
import { Pressable } from '../components/Pressable';
import { Segmented } from '../components/Segmented';
import { SettingsPage, useRows } from '../components/settings/rows';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { useLanguage, useT } from '../lib/i18n/index';
import { namedTargets } from '../lib/lyrics/target';
import { chooseLyricsTarget, useLyricsTarget, useUnsupportedTargets } from '../lib/lyrics/useTarget';
import { JUMP_STEPS, stepFrom } from '../lib/player/jump';
import { usePressed } from '../lib/theme/index';

/**
 * The things about the player that are settled once and not from the player
 * itself: how far its jump buttons go, what a tap on a track plays, what plays when the queue runs out,
 * what its lyrics are translated into, and whether they are read from .lrc
 * files beside the songs.
 *
 * The rows are the ones that were on the Settings tab, as they were.
 */
export default function PlayerSettingsScreen() {
  const t = useT();
  const styles = useRows();
  const pressed = usePressed();
  /*
    Not read on focus like the step below, because they are not this screen's
    to keep: each is held where everything that depends on it is watching,
    and changing one redraws the app — this screen with it — on the spot.
  */
  const language = useLanguage();
  const lyricsTarget = useLyricsTarget();
  const unsupportedTargets = useUnsupportedTargets();
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [jump, setJump] = useState(() => stepFrom(readSetting(SETTINGS.jumpSeconds)));

  useFocusEffect(useCallback(() => {
    setJump(stepFrom(readSetting(SETTINGS.jumpSeconds)));
  }, []));

  const targets = namedTargets(t.languages, language);
  // The one already chosen stays in the list whatever is said of it, so that
  // the row and the tick never name something the list does not hold.
  const offered = targets.filter((target) => target.tag === lyricsTarget || !unsupportedTargets.has(target.tag));

  return (
    <SettingsPage
      sheets={
        <OptionSheet
          visible={targetsOpen}
          heading={t.settings.lyricsLanguage.title}
          note={t.settings.lyricsLanguage.note}
          options={offered.map((target) => ({ value: target.tag, label: target.name }))}
          chosen={lyricsTarget}
          onChoose={chooseLyricsTarget}
          onClose={() => setTargetsOpen(false)}
        />
      }>
      <View style={styles.card}>
        {/*
          Offered as the steps themselves rather than as a field to type a
          number into. There are only a few that anybody wants, the one in
          use has to be readable at a glance because it is also what is
          drawn on the buttons, and a keyboard over a settings list to
          change a 10 to a 15 is more ceremony than the choice deserves.
        */}
        <View style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.settings.jump.title}</Text>
            <Segmented
              role="button"
              variant="chips"
              size="compact"
              options={JUMP_STEPS.map((seconds) => ({ value: seconds, label: String(seconds) }))}
              value={jump}
              onChange={(seconds) => {
                setJump(seconds);
                writeSetting(SETTINGS.jumpSeconds, String(seconds));
              }}
            />
          </View>
          <Text style={styles.muted}>{t.settings.jump.note}</Text>
        </View>
        <View style={styles.rule} />
        {/* What a tap on a track plays, then what plays when the queue runs out: each opens its own list. */}
        <TapSetting />
        <View style={styles.rule} />
        <AutoplaySetting />
        <View style={styles.rule} />
        {/* How many either of the two above adds at a time. */}
        <AutoplaySizes />
        <View style={styles.rule} />
        {/*
          Too many to lay out as chips, so the row says which and opens a
          list. Named in the language the app is in, unlike the app's own
          languages on the tab: this is a list to read, not one to be found
          in by somebody who cannot.
        */}
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          style={styles.row}
          onPress={() => setTargetsOpen(true)}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.settings.lyricsLanguage.title}</Text>
            <View style={styles.choices}>
              <Text style={styles.value} numberOfLines={1}>
                {targets.find((target) => target.tag === lyricsTarget)?.name ?? lyricsTarget}
              </Text>
              <Text style={styles.chevron} importantForAccessibility="no">›</Text>
            </View>
          </View>
          <Text style={styles.muted}>{t.settings.lyricsLanguage.note}</Text>
        </Pressable>
        <View style={styles.rule} />
        {/* Beside the other lyrics row; see the component for why it asks for a folder. */}
        <LyricsFolderSetting />
        <View style={styles.rule} />
        <ListButtonSetting />
        <View style={styles.rule} />
        {/* The last row of the player's page, said nowhere else: see `Heart.tsx`. */}
        <HeartSetting />
      </View>
    </SettingsPage>
  );
}
