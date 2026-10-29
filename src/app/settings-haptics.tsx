import { Switch, Text, View } from 'react-native';

import { Slider } from '../components/Fader';
import { Segmented } from '../components/Segmented';
import { SettingsPage, useRows } from '../components/settings/rows';
import { useT } from '../lib/i18n/index';
import { switchColours, useColours } from '../lib/theme/index';
import {
  HAPTIC_GROUPS,
  HAPTIC_MODES,
  haptic,
  hapticSample,
  setHaptics,
  useHaptics,
  type Feel,
  type HapticGroup,
} from '../lib/ui/haptics';

/** What each group is tried out with as it is switched on: its own most typical feel. */
const SAMPLE: Record<HapticGroup, Feel> = {
  holds: 'hold',
  choices: 'toggleOn',
  notches: 'tick',
  results: 'confirm',
  player: 'click',
  fun: 'heavy',
};

/**
 * Vibration, the app's: how much of it, and how strong. Settings → Look.
 *
 * Four ways to have it — none, the few that say most, all, or one's own pick
 * of the kinds of moment there are — and a strength, felt as it is set. The
 * phone's own switch for touch feedback is over all of it, and said so.
 */
export default function HapticsSettingsScreen() {
  const t = useT();
  const styles = useRows();
  const c = useColours();
  const settings = useHaptics();
  const said = t.settings.haptics;

  return (
    <SettingsPage>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>{said.mode}</Text>
          <Segmented
            role="radio"
            variant="chips"
            size="compact"
            wrap
            options={HAPTIC_MODES.map((mode) => ({ value: mode, label: said.modes[mode] }))}
            value={settings.mode}
            onChange={(mode) => {
              setHaptics({ ...settings, mode });
              if (mode !== 'off') hapticSample('click', settings.strength);
            }}
          />
          <Text style={styles.muted}>{said.modeNotes[settings.mode]}</Text>
        </View>
        {settings.mode !== 'off' ? (
          <>
            <View style={styles.rule} />
            <View style={styles.row}>
              <Slider
                label={said.strength}
                value={settings.strength}
                min={0.1}
                max={1}
                accent={c.accent}
                snap={(value) => Math.round(value * 20) / 20}
                format={(value) => t.settings.customTheme.percent(t.format.number(Math.round(value * 100)))}
                onDrag={() => {}}
                onSettle={(strength) => {
                  setHaptics({ ...settings, strength });
                  hapticSample('click', strength);
                }}
              />
              <Text style={styles.muted}>{said.strengthNote}</Text>
            </View>
          </>
        ) : null}
      </View>

      {settings.mode === 'custom' ? (
        <>
          <Text style={[styles.section, styles.sectionAfter]}>{t.format.upper(said.groupsHeading)}</Text>
          <View style={styles.card}>
            {HAPTIC_GROUPS.map((group, at) => (
              <View key={group}>
                {at > 0 ? <View style={styles.rule} /> : null}
                <View style={styles.row}>
                  <View style={styles.line}>
                    <Text style={styles.title}>{said.groups[group].title}</Text>
                    <Switch
                      accessibilityLabel={said.groups[group].title}
                      value={settings.groups[group]}
                      onValueChange={(on) => {
                        setHaptics({ ...settings, groups: { ...settings.groups, [group]: on } });
                        if (on) hapticSample(SAMPLE[group], settings.strength);
                        else haptic('choices', 'toggleOff');
                      }}
                      {...switchColours(c, settings.groups[group])}
                    />
                  </View>
                  <Text style={styles.muted}>{said.groups[group].note}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.aside}>{said.phone}</Text>
    </SettingsPage>
  );
}
