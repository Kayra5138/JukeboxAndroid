import type { ReactNode } from 'react';
import { SPACE, TYPE, RADIUS } from '../lib/theme/measures';
import { StyleSheet, Text, View } from 'react-native';

import { About } from './About';
import { Image } from './Picture';
import { Pressable } from './Pressable';
import { makeStyles, useColours, usePressed } from '../lib/theme/index';

/**
 * The parts every sheet a long press opens is made of, so that they are one
 * look: what it is about at the top, with its picture; the most used of what
 * can be done across under that; and the rest in a list, each with a mark of
 * its own, the one that destroys something last and in red. What each does is
 * said to a screen reader and is not written under it.
 */

/** What can be drawn for an entry, in the colour it is given. */
export type MenuIcon = (props: { size: number; color: string }) => ReactNode;

/**
 * The top of the sheet. [picture] is left out where the thing has no picture
 * of its own; [accessory] goes at the end; [about], what the thing says of
 * itself, under all of it, its first lines and the rest a press away
 * (`About`): an episode's summary, which its row has no room for.
 */
export function MenuHeader({
  title,
  detail,
  picture,
  accessory,
  under,
  about,
}: {
  title: string;
  /** A line of words, or of words some of which lead somewhere (`NameLinks`). */
  detail?: ReactNode;
  picture?: string | null | false;
  accessory?: ReactNode;
  /** A line under the rest, for something the thing is in the middle of. */
  under?: ReactNode;
  about?: string | null;
}) {
  const styles = useStyles();
  const head = (
    <View style={styles.header}>
      {picture !== false ? (
        <View style={styles.cover}>
          {picture ? <Image source={{ uri: picture }} style={styles.coverPicture} contentFit="cover" transition={0} /> : null}
        </View>
      ) : null}
      <View style={styles.named}>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
        {under}
      </View>
      {accessory}
    </View>
  );
  if (!about) return head;
  return (
    <>
      {head}
      <View style={styles.about}>
        <About text={about} />
      </View>
    </>
  );
}

/** One of those across the top: a mark and a short name, the whole name said to a screen reader. */
export type QuickEntry = {
  key: string;
  icon: MenuIcon;
  short: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  onPress: () => void;
};

export function MenuQuick({ entries }: { entries: readonly QuickEntry[] }) {
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  if (entries.length === 0) return null;
  return (
    <View style={styles.quick}>
      {entries.map((entry) => {
        const Icon = entry.icon;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={entry.label}
            accessibilityHint={entry.hint}
            accessibilityState={{ disabled: entry.disabled }}
            android_ripple={pressed}
            disabled={entry.disabled}
            key={entry.key}
            style={[styles.quickEntry, entry.disabled && styles.off]}
            onPress={entry.onPress}>
            <Icon size={24} color={c.accent} />
            <Text style={styles.quickLabel} numberOfLines={2}>
              {entry.short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One of the list. */
export function MenuEntry({
  icon: Icon,
  label,
  hint,
  danger = false,
  disabled = false,
  onPress,
}: {
  icon: MenuIcon;
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      android_ripple={pressed}
      disabled={disabled}
      style={[styles.action, disabled && styles.off]}
      onPress={onPress}>
      <Icon size={22} color={danger ? c.danger : c.accent} />
      <Text style={danger ? styles.destructive : styles.actionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The sheet's top's room at its sides, which its words under it keep as well. */
const HEADER_SIDE = 20;

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingHorizontal: HEADER_SIDE, paddingTop: SPACE.l, paddingBottom: SPACE.m },
    // Under the name, at its margins, before what can be done.
    about: { paddingHorizontal: HEADER_SIDE, paddingBottom: SPACE.m },
    cover: { width: 48, height: 48, borderRadius: RADIUS.cover, overflow: 'hidden', backgroundColor: c.surfaceRaised },
    coverPicture: { width: 48, height: 48 },
    named: { flex: 1, gap: SPACE.xxs },
    title: { color: c.text, fontSize: TYPE.heading, fontWeight: '600' },
    detail: { color: c.textMuted, fontSize: TYPE.small },
    quick: {
      flexDirection: 'row',
      paddingHorizontal: SPACE.s,
      paddingBottom: SPACE.xs,
      marginBottom: SPACE.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    quickEntry: { flex: 1, alignItems: 'center', gap: SPACE.xs, paddingVertical: SPACE.s, paddingHorizontal: SPACE.xxs },
    quickLabel: { color: c.text, fontSize: TYPE.hint, textAlign: 'center' },
    action: { flexDirection: 'row', alignItems: 'center', gap: SPACE.l, paddingHorizontal: SPACE.l, paddingVertical: SPACE.m },
    actionLabel: { flex: 1, color: c.text, fontSize: TYPE.body },
    destructive: { flex: 1, color: c.danger, fontSize: TYPE.body },
    off: { opacity: 0.4 },
  })
);
