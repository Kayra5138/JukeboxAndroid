import { useState } from 'react';
import { View } from 'react-native';

import { OptionSheet } from '../../../components/OptionSheet';
import { Pressable } from '../../../components/Pressable';
import { Segmented } from '../../../components/Segmented';
import { Switch } from '../../../components/Switch';
import { OrderButtons } from '../../../components/settings/OrderButtons';
import { Text } from '../../../components/settings/Find';
import { SettingsPage, useRows, Chevron } from '../../../components/settings/rows';
import { useT } from '../../../lib/i18n/index';
import { usePressed } from '../../../lib/theme/index';
import { useLandscape } from '../../../lib/ui/layout';
import {
  MINI_HOLDS,
  MINI_LINES,
  MOST_MINI_BUTTONS,
  miniButtonOrder,
  miniCover,
  miniFloating,
  miniHold,
  miniLeftHanded,
  miniLine,
  miniProgress,
  miniSwipe,
  miniTint,
  setMiniButtonShown,
  useMiniButtonsShown,
} from '../../../lib/ui/miniPlayer';

/**
 * The bar of what is playing, at the foot of every screen: what it shows,
 * which buttons it has, how it answers a finger and how it looks. Every
 * choice is held where the bars are watching it (`ui/miniPlayer.ts`), so the
 * bar at the foot of this very page changes as it is made.
 */
export default function MiniPlayerSettingsScreen() {
  const t = useT();
  const styles = useRows();
  const pressed = usePressed();
  const landscape = useLandscape();
  const said = t.settings.miniPlayer;
  const progress = miniProgress.useChoice();
  const line = miniLine.useChoice();
  const cover = miniCover.useChoice();
  const order = miniButtonOrder.useOrder();
  const shown = useMiniButtonsShown();
  const swipe = miniSwipe.useOn();
  const hold = miniHold.useChoice();
  const floating = miniFloating.useOn();
  const tint = miniTint.useOn();
  const leftHanded = miniLeftHanded.useOn();
  const [asking, setAsking] = useState<'line' | 'hold' | null>(null);
  const full = shown.size >= MOST_MINI_BUTTONS;

  const lineNames: Record<(typeof MINI_LINES)[number], string> = said.line;
  const holdNames: Record<(typeof MINI_HOLDS)[number], string> = said.hold;

  /** A switch with its name and a line under it. */
  const toggle = (title: string, note: string, on: boolean, set: (on: boolean) => void) => (
    <View style={styles.row}>
      <View style={styles.line}>
        <Text style={styles.title}>{title}</Text>
        <Switch accessibilityLabel={title} value={on} onValueChange={set} />
      </View>
      <Text style={styles.muted}>{note}</Text>
    </View>
  );

  /** A row that says what is chosen and opens the list to choose from. */
  const chooser = (title: string, value: string, note: string, open: () => void) => (
    <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row} onPress={open}>
      <View style={styles.line}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.choices}>
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
          <Chevron />
        </View>
      </View>
      <Text style={styles.muted}>{note}</Text>
    </Pressable>
  );

  return (
    <SettingsPage
      sheets={
        <>
          <OptionSheet
            page
            visible={asking === 'line'}
            heading={said.line.title}
            note={said.line.note}
            options={MINI_LINES.map((value) => ({ value, label: lineNames[value] }))}
            chosen={line}
            onChoose={miniLine.set}
            onClose={() => setAsking(null)}
          />
          <OptionSheet
            page
            visible={asking === 'hold'}
            heading={said.hold.title}
            note={said.hold.note}
            options={MINI_HOLDS.map((value) => ({ value, label: holdNames[value] }))}
            chosen={hold}
            onChoose={miniHold.set}
            onClose={() => setAsking(null)}
          />
        </>
      }>
      <View style={[styles.columns, landscape && styles.columnsWide]}>
        <View style={styles.column}>
          {/* What is on it: how far into the song, the line under the name, and the cover. */}
          <Text accessibilityRole="header" style={styles.section}>
            {t.format.upper(said.shows)}
          </Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.title}>{said.progress.title}</Text>
              <Segmented
                role="radio"
                variant="chips"
                size="compact"
                layout="fill"
                options={[
                  { value: 'none' as const, label: said.progress.none },
                  { value: 'line' as const, label: said.progress.line },
                  { value: 'fill' as const, label: said.progress.fill },
                ]}
                value={progress}
                onChange={miniProgress.set}
              />
              <Text style={styles.muted}>{said.progress.note}</Text>
            </View>
            <View style={styles.rule} />
            {chooser(said.line.title, lineNames[line], said.line.note, () => setAsking('line'))}
            <View style={styles.rule} />
            <View style={styles.row}>
              <Text style={styles.title}>{said.cover.title}</Text>
              <Segmented
                role="radio"
                variant="chips"
                size="compact"
                layout="fill"
                options={[
                  { value: 'square' as const, label: said.cover.square },
                  { value: 'round' as const, label: said.cover.round },
                  { value: 'record' as const, label: said.cover.record },
                ]}
                value={cover}
                onChange={miniCover.set}
              />
              <Text style={styles.muted}>{said.cover.note}</Text>
            </View>
          </View>

          {/* Its buttons: any of them, up to four, in the order chosen here. */}
          <Text accessibilityRole="header" style={[styles.section, styles.sectionAfter]}>
            {t.format.upper(said.buttons.title)}
          </Text>
          <View style={styles.card}>
            {order.map((button, index) => {
              const name = said.buttons.names[button];
              const on = shown.has(button);
              return (
                <View key={button}>
                  {index > 0 ? <View style={styles.rule} /> : null}
                  <View style={styles.row}>
                    <View style={styles.line}>
                      <Text style={styles.title}>{name}</Text>
                      <View style={styles.choices}>
                        <OrderButtons
                          name={name}
                          first={index === 0}
                          last={index === order.length - 1}
                          onMove={(by) => miniButtonOrder.move(button, by)}
                        />
                        <Switch
                          accessibilityLabel={name}
                          value={on}
                          // Four on, a fifth waits for one of them to go.
                          disabled={!on && full}
                          onValueChange={(wanted) => setMiniButtonShown(button, wanted)}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={styles.aside}>{said.buttons.aside}</Text>
        </View>

        <View style={styles.column}>
          {/* How it answers a finger. */}
          <Text accessibilityRole="header" style={styles.section}>
            {t.format.upper(said.handling)}
          </Text>
          <View style={styles.card}>
            {toggle(said.swipe.title, said.swipe.note, swipe, miniSwipe.set)}
            <View style={styles.rule} />
            {chooser(said.hold.title, holdNames[hold], said.hold.note, () => setAsking('hold'))}
          </View>

          {/* How it looks. */}
          <Text accessibilityRole="header" style={[styles.section, styles.sectionAfter]}>
            {t.format.upper(said.look)}
          </Text>
          <View style={styles.card}>
            {toggle(said.floating.title, said.floating.note, floating, miniFloating.set)}
            <View style={styles.rule} />
            {toggle(said.tint.title, said.tint.note, tint, miniTint.set)}
            <View style={styles.rule} />
            {toggle(said.leftHanded.title, said.leftHanded.note, leftHanded, miniLeftHanded.set)}
          </View>
        </View>
      </View>
    </SettingsPage>
  );
}
