import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '../lib/i18n/index';
import { keepApart, mergeSongs, sameSongs, type Side, type Suggestion } from '../lib/identity/index';
import { makeStyles, outlined, outlinedClip, usePressed } from '../lib/theme/index';

/** Where the file is, as much of it as is known. One lost long ago has only a name. */
const whereabouts = (side: Side) => `${side.folder ?? ''}${side.filename ?? ''}`;

function File({ caption, side }: { caption: string; side: Side }) {
  const t = useT();
  const styles = useStyles();
  return (
    <View style={styles.side}>
      <Text style={styles.caption}>{t.format.upper(caption)}</Text>
      <Text style={styles.name} numberOfLines={2}>
        {side.title ?? side.filename ?? t.details.same.unknown}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {side.artist ?? t.common.unknownArtist}
      </Text>
      <Text style={styles.path} numberOfLines={2}>
        {whereabouts(side) || t.details.same.noFileName}
      </Text>
      <Text style={styles.holds}>{t.details.same.holds(side)}</Text>
    </View>
  );
}

/**
 * The pairs of files that might be one song, for somebody to say.
 *
 * Only the ones the app would not decide for itself. A file that is the same
 * to the byte as one that has gone is taken for it without a word; what is
 * listed here is everything short of that -- the same name at a different
 * size, a copy with a history of its own -- where being wrong would mix two
 * songs' listens together and there would be no telling them apart again.
 */
export default function SameSongsScreen() {
  // Sideways the cutout sits beside the screen, and a routed screen gets no
  // horizontal inset from the navigator.
  const insets = useSafeAreaInsets();
  const sides = { paddingLeft: insets.left, paddingRight: insets.right };
  const [pairs, setPairs] = useState<Suggestion[] | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.details.same;

  const load = useCallback(() => {
    try {
      setPairs(sameSongs());
    } catch (error) {
      setPairs([]);
      setTrouble(String(error));
    }
  }, []);

  useFocusEffect(load);

  /*
    Either answer is read back from the database rather than taken off the
    list by hand. Joining one pair can settle another -- the same old file
    asked about against two new ones -- and the list should say what is still
    in question, not what was a moment ago.
  */
  const answer = useCallback(
    (pair: Suggestion, join: boolean) => {
      setTrouble(null);
      try {
        if (join) mergeSongs(pair.from.id, pair.to.id);
        else keepApart(pair.from.id, pair.to.id);
      } catch (error) {
        // The write is all or nothing, so a failure here has changed nothing.
        setTrouble(said.failed(String(error)));
      }
      load();
    },
    [load, said]
  );

  if (pairs == null) return <View style={styles.screen} />;

  return (
    <View style={[styles.screen, sides]}>
      <FlatList
        data={pairs}
        keyExtractor={(pair) => `${pair.from.id}\u0000${pair.to.id}`}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.note}>{said.note}</Text>
            {trouble ? (
              <Text accessibilityRole="alert" style={styles.trouble}>
                {trouble}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>{said.empty}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <File caption={said.from} side={item.from} />
            <View style={styles.rule} />
            <File caption={said.into} side={item.to} />
            <View style={styles.rule} />
            <View style={styles.actions}>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                style={styles.button}
                onPress={() => answer(item, false)}>
                <Text style={styles.buttonLabel}>{said.keepApart}</Text>
              </Pressable>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                style={[styles.button, styles.buttonOn]}
                onPress={() => answer(item, true)}>
                <Text style={[styles.buttonLabel, styles.buttonLabelOn]}>{said.merge}</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  note: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  trouble: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  empty: { color: c.textFaint, fontSize: 14, textAlign: 'center', paddingVertical: 32 },

  card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },
  side: { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  caption: {
    color: c.textFaint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  name: { color: c.text, fontSize: 15.5 },
  artist: { color: c.textSecondary, fontSize: 13.5 },
  path: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  holds: { color: c.accent, fontSize: 12.5, marginTop: 2, fontVariant: ['tabular-nums'] },

  actions: { flexDirection: 'row', gap: 10, padding: 12 },
  button: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceRaised,
    borderRadius: 8,
    paddingHorizontal: 18,
    ...outlined(c),
  },
  buttonOn: { backgroundColor: c.primary, ...outlined(c, c.primary) },
  buttonLabel: { color: c.text, fontSize: 15 },
  buttonLabelOn: { color: c.onPrimary, fontWeight: '600' },
}));
