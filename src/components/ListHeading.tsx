import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../lib/i18n/index';
import { formatDuration } from '../lib/stats/period';
import { makeStyles, usePressed } from '../lib/theme/index';
import type { Track } from '../lib/types';

/** The cover a list is headed by. Whoever hands one in draws it this size. */
export const LIST_COVER_SIZE = 96;

/**
 * What a list of tracks is headed by: the way back, its cover and name, how
 * much is in it, and the two ways of starting it.
 *
 * Its own component because a record is opened in two places — on the screen
 * every list opens on, and over the rack a sleeve was tapped in — and the
 * second is meant to be the first, not something like it. Whatever a screen
 * has besides goes in as children and is drawn under the buttons.
 *
 * It keeps nothing clear of the clock. Where it is drawn decides whether that
 * is needed, so the padding is whoever draws it's to give.
 */
export function ListHeading({
  onBack,
  cover,
  name,
  tracks,
  hint,
  note,
  onPlay,
  onShuffle,
  children,
}: {
  onBack: () => void;
  /** Handed in whole, because only some lists let theirs be pressed. */
  cover: ReactNode;
  name: string;
  /** Counted and timed here; nothing else about them is looked at. */
  tracks: Track[];
  hint: string | null;
  /** Something that just went wrong, said under the hint. */
  note?: ReactNode;
  onPlay: () => void;
  onShuffle: () => void;
  children?: ReactNode;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const total = tracks.reduce((sum, track) => sum + (track.durationSec ?? 0), 0);
  const nothing = tracks.length === 0;

  return (
    <>
      <Pressable
        android_ripple={pressed}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel={t.common.back}
        onPress={onBack}>
        <Text style={styles.backLabel}>{t.library.back}</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.identity}>
          {cover}
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={3}>
              {name}
            </Text>
            <Text style={styles.detail}>
              {t.common.tracks(tracks.length)}
              {total > 0 ? ` · ${formatDuration(total, t)}` : ''}
            </Text>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            {note}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            android_ripple={pressed}
            style={[styles.action, nothing && styles.actionOff]}
            disabled={nothing}
            onPress={onPlay}>
            <Text style={styles.actionLabel}>{t.common.play}</Text>
          </Pressable>
          <Pressable
            android_ripple={pressed}
            style={[styles.secondary, nothing && styles.actionOff]}
            disabled={nothing}
            onPress={onShuffle}>
            <Text style={styles.secondaryLabel}>{t.common.shuffle}</Text>
          </Pressable>
        </View>

        {children}
      </View>
    </>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  back: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 2 },
  backLabel: { color: c.accent, fontSize: 16 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, gap: 5 },
  identity: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  identityText: { flex: 1, minWidth: 0, gap: 5 },
  name: { color: c.text, fontSize: 22, fontWeight: '600' },
  detail: { color: c.textMuted, fontSize: 13 },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 10, paddingTop: 16 },
  action: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: c.primary,
    borderRadius: 11,
    paddingVertical: 12,
  },
  actionLabel: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  secondary: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 11,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  secondaryLabel: { color: c.text, fontSize: 15 },
  actionOff: { opacity: 0.35 },
}));
