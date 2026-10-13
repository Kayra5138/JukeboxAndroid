import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from '../Pressable';
import { Sheet } from './Sheet';
import { whyLines } from './show';
import { useDiscoverActions, useDiscoverEntry, type DiscoverEntryView } from '../../lib/discover/DiscoverProvider';
import { useT } from '../../lib/i18n/index';
import { makeStyles, usePressed } from '../../lib/theme/index';

/**
 * Everything that can be done to one song of the list, from a long press on
 * its row, and everything there is to say about it.
 *
 * Not the track menu, though it is drawn to look like it. That one is for a
 * track of the library and most of what it offers goes by the library; a song
 * here may not even have a file yet. This has the four things that can be
 * done to a song of Discover's, and under its name what a row has no room
 * for: what it is doing, in a whole sentence, and why it was chosen, at
 * length.
 *
 * It follows the song while it is open, so a download that finishes behind
 * it is said as it happens, and it closes by itself if the song leaves the
 * list from under it.
 */
export function DiscoverMenu({ id, onClose }: { id: string | null; onClose: () => void }) {
  const entry = useDiscoverEntry(id ?? '');
  const gone = id !== null && !entry;
  useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);
  return (
    <Sheet visible={entry !== null} onClose={onClose}>
      {entry ? <Entries entry={entry} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Entries({ entry, onClose }: { entry: DiscoverEntryView; onClose: () => void }) {
  const { play, keep, exclude, excludeArtist } = useDiscoverActions();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.discover.menu;
  const { id } = entry;
  const bad = entry.state === 'failed';
  const then = (act: (id: string) => void) => () => {
    onClose();
    act(id);
  };

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {entry.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {entry.artist}
        </Text>
        {/* The state in full: the row said it with a mark. */}
        <Text accessibilityRole={bad ? 'alert' : undefined} style={bad ? styles.stateBad : styles.state}>
          {entry.said}
        </Text>
      </View>

      {entry.canPlay ? (
        <>
          <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.action} onPress={then(play)}>
            <Text style={styles.label}>{said.play.label}</Text>
            <Text style={styles.hint}>{said.play.hint}</Text>
          </Pressable>
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            disabled={entry.keeping}
            style={[styles.action, entry.keeping && styles.off]}
            onPress={then(keep)}>
            <Text style={styles.label}>{said.keep.label}</Text>
            <Text style={styles.hint}>{entry.keeping ? t.discover.row.keeping : said.keep.hint}</Text>
          </Pressable>
          <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.action} onPress={then(exclude)}>
            <Text style={styles.label}>{said.exclude.label}</Text>
            <Text style={styles.hint}>{said.exclude.hint}</Text>
          </Pressable>
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            style={styles.action}
            onPress={then(excludeArtist)}>
            <Text style={styles.destructive} numberOfLines={1}>
              {said.neverArtist.label(entry.artist)}
            </Text>
            <Text style={styles.hint}>{said.neverArtist.hint}</Text>
          </Pressable>
        </>
      ) : null}

      <View style={styles.why}>
        <Text style={styles.whyHeading}>{t.format.upper(said.why)}</Text>
        {whyLines(entry, t).map((line) => (
          <Text key={line} style={styles.whyLine}>
            {line}
          </Text>
        ))}
      </View>
    </>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  header: {
    gap: 3,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  title: { color: c.text, fontSize: 16, fontWeight: '600' },
  artist: { color: c.textMuted, fontSize: 13 },
  state: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  stateBad: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  action: { paddingHorizontal: 20, paddingVertical: 13, gap: 2 },
  off: { opacity: 0.45 },
  label: { color: c.text, fontSize: 15 },
  destructive: { color: c.danger, fontSize: 15 },
  hint: { color: c.textFaint, fontSize: 12 },
  why: {
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  whyHeading: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 2 },
  whyLine: { color: c.textSecondary, fontSize: 13.5, lineHeight: 19 },
}));
