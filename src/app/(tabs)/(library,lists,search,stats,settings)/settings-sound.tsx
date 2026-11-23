import { useCallback, useState } from 'react';
import { formatSpeed } from '../../../lib/player/playback';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { Text } from '../../../components/settings/Find';
import { Switch } from '../../../components/Switch';

import JukeboxAudio from '../../../../modules/jukebox-audio';
import { SettingsPage, useRows, LinkRow } from '../../../components/settings/rows';
import { useT } from '../../../lib/i18n/index';
import { useSpeed } from '../../../lib/player/current';
import { useLandscape } from '../../../lib/ui/layout';
import { haptic } from '../../../lib/ui/haptics';

/**
 * What is done to the sound on its way out: the equalizer, the effects, the
 * evening-out of loud and quiet, how one track gives way to the next, and
 * how fast and how high it is all played.
 *
 * The rows are the ones that were on the Settings tab, as they were, with the
 * page of playback settings that the last of them opens (`playback`).
 */
export default function SoundSettingsScreen() {
  const t = useT();
  const styles = useRows();
  const landscape = useLandscape();
  const speed = useSpeed();
  /**
   * Whether tracks are evened out, or null where this build cannot say.
   *
   * Kept by the player rather than with the other settings, because the
   * player has to know it with the app closed. Null until it has answered,
   * and for good on a native build from before the feature — the row is not
   * drawn then, rather than drawn as a switch that does nothing.
   */
  const [even, setEven] = useState<boolean | null>(null);

  useFocusEffect(useCallback(() => {
    JukeboxAudio.getLoudnessAsync?.()
      .then((loudness) => setEven(loudness.enabled))
      .catch(() => setEven(null));
  }, []));

  const shaping = (
    <>
      <LinkRow
        title={t.nav.equalizer}
        hint={t.settings.equalizer.note}
        href="/equalizer"
      />
      <View style={styles.rule} />
      <LinkRow
        title={t.nav.effects}
        hint={t.settings.effects.note}
        href="/effects"
      />
      {/*
        A switch and no more. There is a target level and a ceiling
        behind it, and neither is offered: the one is a standard and
        the other is what stops a turned-up track clipping, and a
        slider for either is a way to make this sound worse.
      */}
      {even !== null ? (
        <>
          <View style={styles.rule} />
          <View style={styles.row}>
            <View style={styles.line}>
              <Text style={styles.title}>{t.settings.loudness.title}</Text>
              <Switch
                // Named, for a screen reader, which otherwise says only "switch, off".
                accessibilityLabel={t.settings.loudness.title}
                value={even}
                onValueChange={(on) => {
                  // Shown at once and put back if the player would not
                  // take it, so the switch never lags the finger.
                  setEven(on);
                  JukeboxAudio.setLoudnessAsync?.({ enabled: on })
                    .then((loudness) => {
                      // Felt as a refusal where the switch goes back on its own.
                      if (loudness.enabled !== on) haptic('results', 'reject');
                      setEven(loudness.enabled);
                    })
                    .catch((failure: unknown) => {
                      console.warn('Even loudness could not be set', failure);
                      haptic('results', 'reject');
                      setEven(!on);
                    });
                }}
              />
            </View>
            <Text style={styles.muted}>{t.settings.loudness.note}</Text>
          </View>
        </>
      ) : null}
    </>
  );
  const pacing = (
    <>
      <LinkRow
        title={t.nav.crossfade}
        hint={t.settings.crossfade.note}
        href="/transitions"
      />
      <View style={styles.rule} />
      {/* A page of its own, as everything Settings opens is: it was a sheet laid over this one. */}
      <LinkRow
        title={t.settings.playback.title}
        hint={t.settings.playback.note(formatSpeed(speed, t).replace(/×$/, ''))}
        href="/playback"
      />
    </>
  );

  return (
    <SettingsPage>
      {/*
        One card upright. Sideways it is five rows in a frame that shows two,
        so it is cut in two where the subject changes — what shapes the sound,
        and what paces it — and the halves stand beside each other.
      */}
      {landscape ? (
        <View style={[styles.columns, styles.columnsWide]}>
          <View style={styles.column}>
            <View style={styles.card}>{shaping}</View>
          </View>
          <View style={styles.column}>
            <View style={styles.card}>{pacing}</View>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          {shaping}
          <View style={styles.rule} />
          {pacing}
        </View>
      )}
    </SettingsPage>
  );
}
