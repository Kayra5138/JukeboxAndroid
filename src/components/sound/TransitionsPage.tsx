import { useState } from 'react';
import { LEADING, SPACE, TYPE, CARD_GAP, RADIUS } from '../../lib/theme/measures';
import { ScreenState } from '../ScreenState';
import { SectionLabel } from '../settings/rows';
import { StyleSheet, View } from 'react-native';
import { Text } from '../settings/Find';
import { Switch } from '../Switch';
import { Pressable } from '../Pressable';

import { Slider } from '../Fader';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlined, scene, useColours, usePressed } from '../../lib/theme/index';
import { useBack } from '../../lib/ui/back';
import { haptic } from '../../lib/ui/haptics';
import { PageScroll } from '../Page';
import { roundTransition as round, transitionSeconds as seconds, useTransitions } from '../../lib/player/useTransitions';
import { TextButton } from '../Button';

/** Where a duration is felt: at nothing, which is off. */
const OFF = [0] as const;

/**
 * Which of the four durations a row sets. What to call it, and the line
 * under it, are in the string tables under the same key.
 */
const OTHERS: {
  key: 'manualMs' | 'pauseMs' | 'seekMs';
  ceiling: 'maxManualMs' | 'maxPauseMs' | 'maxSeekMs';
}[] = [
  { key: 'manualMs', ceiling: 'maxManualMs' },
  { key: 'pauseMs', ceiling: 'maxPauseMs' },
  { key: 'seekMs', ceiling: 'maxSeekMs' },
];

/**
 * [focused] where it is a page of the tab, for whether it is the one in front
 * and Back its own; in the player's card (`PageInCard`) it is always that.
 */
export function TransitionsPage({ focused = true }: { focused?: boolean }) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const c = useColours();
  const say = t.sound.transitions;
  const written = (milliseconds: number) => seconds(milliseconds, t);
  const { state, missing, push, commit } = useTransitions();
  const [expanded, setExpanded] = useState(false);
  // Back folds the others away before it leaves.
  useBack(expanded && focused, () => setExpanded(false));

  if (missing) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <Text style={styles.note}>{say.missing}</Text>
      </View>
    );
  }

  if (!state) {
    return (
      <View style={styles.screen}>
        <ScreenState kind="loading" />
      </View>
    );
  }

  const off = !state.enabled;

  return (
    <PageScroll>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.title}>{say.title}</Text>
          <Text style={styles.hint}>{say.about}</Text>
        </View>
        <Switch
          // Named, for a screen reader, which otherwise says only "switch, off".
          accessibilityLabel={say.title}
          value={state.enabled}
          onValueChange={(enabled) => void commit({ enabled })}
        />
      </View>

      {/* Dimmed rather than removed when off, so what was set up is still
          there to come back to. Out of a screen reader's reach while it is,
          as it is out of a finger's: a reader would otherwise walk into
          settings that cannot be changed and change them anyway. */}
      <View
        // Never folded away and made again as it is turned off and on: see `TrackStrip`.
        collapsable={false}
        style={off ? styles.dimmed : undefined}
        pointerEvents={off ? 'none' : 'auto'}
        importantForAccessibility={off ? 'no-hide-descendants' : 'auto'}>
        <SectionLabel>{say.betweenTracks}</SectionLabel>
        <Slider
          label={say.overlap}
          value={state.autoMs}
          min={0}
          max={state.maxAutoMs}
          notches={OFF}
          snap={(value) => round(value, state.maxAutoMs)}
          accent={c.accent}
          format={written}
          onDrag={(value) => push({ autoMs: round(value, state.maxAutoMs) })}
          onSettle={(value) => void commit({ autoMs: round(value, state.maxAutoMs) })}
        />
        <Text style={styles.hint}>{say.overlapNote}</Text>

        <Pressable
          android_ripple={pressed}
          style={styles.toggle}
          // A tick box, which says whether it is ticked: the box at the end is
          // all that says so to the eye.
          accessibilityRole="checkbox"
          accessibilityState={{ checked: state.skipSameAlbum }}
          onPress={() => {
            haptic('choices', state.skipSameAlbum ? 'toggleOff' : 'toggleOn');
            void commit({ skipSameAlbum: !state.skipSameAlbum });
          }}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>{say.albums.title}</Text>
            <Text style={styles.hint}>{say.albums.note}</Text>
          </View>
          <Check on={state.skipSameAlbum} />
        </Pressable>

        {expanded ? (
          <View style={styles.others}>
            {OTHERS.map((entry) => (
              <View key={entry.key} style={styles.other}>
                <Slider
                  label={say.others[entry.key].label}
                  value={state[entry.key]}
                  min={0}
                  max={state[entry.ceiling]}
                  notches={OFF}
                  snap={(value) => round(value, state[entry.ceiling])}
                  accent={c.accent}
                  format={written}
                  onDrag={(value) => push({ [entry.key]: round(value, state[entry.ceiling]) })}
                  onSettle={(value) =>
                    void commit({ [entry.key]: round(value, state[entry.ceiling]) })
                  }
                />
                <Text style={styles.hint}>{say.others[entry.key].hint}</Text>
              </View>
            ))}

            <Pressable
              android_ripple={pressed}
              style={styles.toggle}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: state.equalPower }}
              onPress={() => {
                haptic('choices', state.equalPower ? 'toggleOff' : 'toggleOn');
                void commit({ equalPower: !state.equalPower });
              }}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>{say.equalPower.title}</Text>
                <Text style={styles.hint}>{say.equalPower.note}</Text>
              </View>
              <Check on={state.equalPower} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {/*
        Outside the dimmed block, and deliberately. These are not settings —
        one opens the rest of them and the other puts them all back — and
        sealing them behind the switch meant the only way to reset a crossfade
        you had turned off was to turn it on again first.
      */}
      <TextButton
        label={expanded ? say.fewer : say.more}
        style={styles.more}
        onPress={() => setExpanded((was) => !was)}
        expanded={expanded}
      />

      <TextButton
        label={say.reset}
        size="body"
        style={styles.reset}
        onPress={() => {
          haptic('results', 'confirm');
          void commit(state.defaults);
        }}
      />
    </PageScroll>
  );
}

function Check({ on }: { on: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.check, on && styles.checkOn]}>
      {on ? <View style={styles.tick} /> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, ...scene(c) },
  centred: { alignItems: 'center', justifyContent: 'center', padding: SPACE.xl },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.l },
  switchText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  title: { color: c.text, fontSize: TYPE.heading, fontWeight: '600' },
  hint: { color: c.textFaint, fontSize: TYPE.hint, lineHeight: LEADING.small },
  note: { color: c.textMuted, fontSize: TYPE.small, textAlign: 'center', lineHeight: LEADING.body },

  dimmed: { opacity: 0.35 },


  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.m,
    backgroundColor: c.surface,
    borderRadius: RADIUS.control,
    padding: SPACE.l,
    marginTop: SPACE.l,
    ...outlined(c),
  },
  toggleText: { flex: 1, minWidth: 0, gap: SPACE.xs },
  toggleLabel: { color: c.text, fontSize: TYPE.body },
  check: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.control,
    borderWidth: 1.5,
    borderColor: c.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: c.accent, borderColor: c.accent },
  tick: { width: 9, height: 9, borderRadius: 2, backgroundColor: c.onAccent },

  // Apart from the rest, in the middle, the way back to how it came.
  reset: { alignSelf: 'center', marginTop: CARD_GAP },
  more: { alignSelf: 'center', marginTop: SPACE.l },
  others: { paddingTop: SPACE.l, gap: SPACE.xl },
  other: { gap: SPACE.s },
}));
