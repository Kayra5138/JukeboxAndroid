import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { BackHandler, Switch, Text, View } from 'react-native';

import JukeboxAudio from '../../modules/jukebox-audio';
import { PlayerSettings } from '../components/PlayerSettings';
import { Pressable } from '../components/Pressable';
import { SettingsPage, useRows } from '../components/settings/rows';
import { useT } from '../lib/i18n/index';
import { usePlayerActions, usePlayerState } from '../lib/player/PlayerProvider';
import { switchColours, useColours, usePressed } from '../lib/theme/index';
import { useLandscape } from '../lib/ui/layout';

/**
 * What is done to the sound on its way out: the equalizer, the effects, the
 * evening-out of loud and quiet, how one track gives way to the next, and
 * how fast and how high it is all played.
 *
 * The rows are the ones that were on the Settings tab, as they were, with the
 * sheet of playback settings that the last of them opens.
 */
export default function SoundSettingsScreen() {
  const t = useT();
  const c = useColours();
  const styles = useRows();
  const pressed = usePressed();
  const landscape = useLandscape();
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const { speed, pitch } = usePlayerState();
  const { setSpeed, setPitch } = usePlayerActions();
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
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!playbackOpen) return false;
      setPlaybackOpen(false);
      return true;
    });
    return () => listener.remove();
  }, [playbackOpen]));

  const shaping = (
    <>
      <Link href="/equalizer" asChild>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.nav.equalizer}</Text>
            <Text style={styles.chevron} importantForAccessibility="no">›</Text>
          </View>
          <Text style={styles.muted}>{t.settings.equalizer.note}</Text>
        </Pressable>
      </Link>
      <View style={styles.rule} />
      <Link href="/effects" asChild>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.nav.effects}</Text>
            <Text style={styles.chevron} importantForAccessibility="no">›</Text>
          </View>
          <Text style={styles.muted}>{t.settings.effects.note}</Text>
        </Pressable>
      </Link>
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
                    .then((loudness) => setEven(loudness.enabled))
                    .catch((failure: unknown) => {
                      console.warn('Even loudness could not be set', failure);
                      setEven(!on);
                    });
                }}
                {...switchColours(c, even)}
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
      <Link href="/transitions" asChild>
        <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.nav.crossfade}</Text>
            <Text style={styles.chevron} importantForAccessibility="no">›</Text>
          </View>
          <Text style={styles.muted}>{t.settings.crossfade.note}</Text>
        </Pressable>
      </Link>
      <View style={styles.rule} />
      <Pressable accessibilityRole="button" android_ripple={pressed} style={styles.row} onPress={() => setPlaybackOpen(true)}>
        <View style={styles.line}>
          <Text style={styles.title}>{t.settings.playback.title}</Text>
          <Text style={styles.chevron} importantForAccessibility="no">›</Text>
        </View>
        <Text style={styles.muted}>{t.settings.playback.note(String(speed))}</Text>
      </Pressable>
    </>
  );

  return (
    // The page itself goes out of focus behind the sheet of playback settings, which is laid over it.
    <SettingsPage
      veiled={playbackOpen}
      sheets={
        <PlayerSettings visible={playbackOpen} speed={speed} pitch={pitch} onSpeed={(value) => void setSpeed(value)} onPitch={(value) => void setPitch(value)} onClose={() => setPlaybackOpen(false)} />
      }>
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
