import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

/** The top of the sheet. [picture] is left out where the thing has no picture of its own; [accessory] goes at the end. */
export function MenuHeader({
  title,
  detail,
  picture,
  accessory,
  under,
}: {
  title: string;
  /** A line of words, or of words some of which lead somewhere (`NameLinks`). */
  detail?: ReactNode;
  picture?: string | null | false;
  accessory?: ReactNode;
  /** A line under the rest, for something the thing is in the middle of. */
  under?: ReactNode;
}) {
  const styles = useStyles();
  return (
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

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    cover: { width: 48, height: 48, borderRadius: 8, overflow: 'hidden', backgroundColor: c.surfaceRaised },
    coverPicture: { width: 48, height: 48 },
    named: { flex: 1, gap: 2 },
    title: { color: c.text, fontSize: 16, fontWeight: '600' },
    detail: { color: c.textMuted, fontSize: 13 },
    quick: {
      flexDirection: 'row',
      paddingHorizontal: 8,
      paddingBottom: 6,
      marginBottom: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    quickEntry: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 2 },
    quickLabel: { color: c.text, fontSize: 12, textAlign: 'center' },
    action: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 12 },
    actionLabel: { flex: 1, color: c.text, fontSize: 15 },
    destructive: { flex: 1, color: c.danger, fontSize: 15 },
    off: { opacity: 0.4 },
  })
);
