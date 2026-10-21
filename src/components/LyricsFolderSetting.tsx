import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Pressable } from './Pressable';
import { useT } from '../lib/i18n/index';
import { readLyricsFolders, writeLyricsFolders } from '../lib/lyrics/device';
import type { LyricsFolder } from '../lib/lyrics/local';
import { lyricsNative } from '../lib/lyrics/native';
import { makeStyles, switchColours, useColours, usePressed } from '../lib/theme/index';

/**
 * A row of the player's settings: whether `.lrc` files beside the songs are
 * read, and from which folders.
 *
 * The switch is the folders. Turning it on is picking one, with the system's
 * folder picker — Android gives an app no other way to read a text file it did
 * not make, short of all of storage — and backing out of the picker leaves it
 * off. Turning it off gives every folder back. Another folder is for a library
 * kept in more than one place: on the phone and on a card, say.
 *
 * Not drawn at all on a build without the native side of it, where there is
 * nothing for it to switch.
 */
export function LyricsFolderSetting() {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.lyrics.folders;
  const [folders, setFolders] = useState<LyricsFolder[]>([]);
  const [elsewhere, setElsewhere] = useState(false);

  /*
    Held to what the system still grants, each time the page opens. The list
    in the setting can say more than the grants do — restored from a backup
    made on another phone, where these folders were somebody else's to give —
    and a folder the app cannot read is not one to show as being read.
  */
  useEffect(() => {
    const kept = readLyricsFolders();
    setFolders(kept);
    if (!lyricsNative || kept.length === 0) return;
    let cancelled = false;
    void lyricsNative
      .grantedFoldersAsync(kept.map((folder) => folder.uri))
      .then((granted) => {
        if (cancelled) return;
        const held = kept.filter((folder) => granted.includes(folder.uri));
        if (held.length !== kept.length) writeLyricsFolders(held);
        setFolders(held);
      })
      .catch(() => {
        // Left as the setting says; the next read checks again anyway.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!lyricsNative) return null;
  const native = lyricsNative;

  const keep = (next: LyricsFolder[]) => {
    writeLyricsFolders(next);
    setFolders(next);
  };

  const add = async () => {
    setElsewhere(false);
    const picked = await native.pickFolderAsync().catch(() => null);
    if (!picked) return;
    if (picked.status === 'elsewhere') {
      setElsewhere(true);
      return;
    }
    const current = readLyricsFolders();
    if (current.some((folder) => folder.uri === picked.uri)) return;
    keep([...current, { uri: picked.uri, label: picked.label }]);
  };

  const remove = (gone: LyricsFolder) => {
    void native.releaseFolderAsync(gone.uri).catch(() => {});
    keep(readLyricsFolders().filter((folder) => folder.uri !== gone.uri));
  };

  const on = folders.length > 0;

  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <Text style={styles.title}>{said.title}</Text>
        <Switch
          value={on}
          accessibilityLabel={said.title}
          onValueChange={(wanted) => {
            if (wanted) void add();
            else for (const folder of folders) remove(folder);
          }}
          {...switchColours(c, on)}
        />
      </View>
      <Text style={styles.muted}>{said.note}</Text>
      {folders.map((folder) => (
        <View key={folder.uri} style={styles.folder}>
          <Text style={styles.folderName} numberOfLines={1}>
            {folder.label}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={said.removeLabel(folder.label)}
            android_ripple={pressed}
            hitSlop={8}
            onPress={() => remove(folder)}>
            <Text style={styles.link}>{said.remove}</Text>
          </Pressable>
        </View>
      ))}
      {on ? (
        <Pressable
          accessibilityRole="button"
          android_ripple={pressed}
          style={styles.addRow}
          onPress={() => void add()}>
          <Text style={styles.link}>{said.add}</Text>
        </Pressable>
      ) : null}
      {elsewhere ? <Text style={styles.bad}>{said.elsewhere}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },
    title: { color: c.text, fontSize: 15.5, flexShrink: 1 },
    muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
    folder: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 32,
      marginTop: 4,
    },
    folderName: { color: c.textSecondary, fontSize: 14, flexShrink: 1 },
    link: { color: c.accent, fontSize: 13.5 },
    addRow: { alignSelf: 'flex-start', paddingVertical: 6 },
    bad: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  })
);
