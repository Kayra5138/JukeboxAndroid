import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OptionSheet } from '../../../components/OptionSheet';
import { Button } from '../../../components/Button';
import { PageNote } from '../../../components/Page';
import { ScreenState } from '../../../components/ScreenState';
import { SettingsPage, useRows } from '../../../components/settings/rows';
import { creditReader } from '../../../lib/db/credits';
import { playlists } from '../../../lib/db/playlists';
import { tagCounts } from '../../../lib/db/tags';
import { listMemberIds } from '../../../lib/lists/memberIds';
import { useT } from '../../../lib/i18n/index';
import { setAside, useSetAside } from '../../../lib/library/setAside';
import { SET_ASIDE_KINDS, setAsideIds, setAsideOf, type SetAsideKind } from '../../../lib/library/setAsideRule';
import { useLibraryTracks } from '../../../lib/library/useLibrary';
import { albumsOf } from '../../../lib/media/albums';
import { artistsOf } from '../../../lib/media/artists';
import { isTape } from '../../../lib/tapes/tape';
import { makeStyles } from '../../../lib/theme/index';
import { SPACE } from '../../../lib/theme/measures';
import { haptic } from '../../../lib/ui/haptics';

/**
 * Everything set aside, by kind, each with how many of the library's songs
 * it keeps out of Tracks and the shuffle and a button that brings it back;
 * and a tag to set aside, which nothing else on the app offers. Settings ›
 * Library opens it. See `library/setAside.ts`.
 */
export default function SetAsideScreen() {
  const t = useT();
  const said = t.library.setAside;
  const rows = useRows();
  const styles = useStyles();
  const rules = useSetAside();
  const library = useLibraryTracks();
  const music = useMemo(() => library.filter((track) => !isTape(track)), [library]);
  const [choosingTag, setChoosingTag] = useState(false);

  /*
    Each entry by what the screens call it, and how many songs it holds now:
    a record by its name and whose it is, an artist and a list by name, a folder
    by its path, a tag as it is, a song by its name and its artist. One no
    longer in the library is still listed, by what it was set aside as, so
    that it can be brought back.
  */
  const entries = useMemo(() => {
    const albums = rules.album.size > 0 ? albumsOf(music) : [];
    const artists = rules.artist.size > 0 ? artistsOf(music, creditReader(), t) : [];
    const lists = rules.list.size > 0 ? playlists() : [];
    const groups = {
      albums: () => albums,
      artists: () => artists,
      list: (key: string) => listMemberIds({ kind: 'list', id: Number(key) }, music)?.ids ?? [],
    };
    const byId = new Map(music.map((track) => [track.id, track]));
    return SET_ASIDE_KINDS.map((kind) => ({
      kind,
      rows: [...rules[kind]]
        .map((key) => {
          const songs = setAsideIds(music, setAsideOf([{ kind, key }]), groups).size;
          if (kind === 'album') {
            const album = albums.find((entry) => entry.key === key);
            return { key, name: album?.name ?? key, detail: [album?.artist, said.songs(songs)].filter(Boolean).join(' · ') };
          }
          if (kind === 'artist') return { key, name: artists.find((entry) => entry.key === key)?.name ?? key, detail: said.songs(songs) };
          if (kind === 'list') return { key, name: lists.find((entry) => String(entry.id) === key)?.name ?? key, detail: said.songs(songs) };
          if (kind === 'track') {
            const track = byId.get(key);
            return { key, name: track?.title ?? key, detail: track?.artist ?? '' };
          }
          return { key, name: key, detail: said.songs(songs) };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((group) => group.rows.length > 0);
  }, [music, rules, said, t]);

  // The tags there are to set aside: every one some song wears, but those set aside already.
  const tags = useMemo(
    () => (choosingTag ? tagCounts().filter((entry) => !rules.tag.has(entry.tag)) : []),
    [choosingTag, rules]
  );

  const bringBack = (kind: SetAsideKind, key: string) => {
    haptic('results', 'toggleOff');
    setAside(kind, key, false);
  };

  return (
    <SettingsPage>
      <PageNote>{said.note}</PageNote>
      {entries.length === 0 ? <ScreenState kind="empty" text={said.empty} /> : null}
      {entries.map((group, at) => (
        <View key={group.kind}>
          <Text style={[rows.section, at > 0 && rows.sectionAfter]}>{t.format.upper(said.kinds[group.kind])}</Text>
          <View style={rows.card}>
            {group.rows.map((entry, index) => (
              <View key={entry.key}>
                {index > 0 ? <View style={rows.rule} /> : null}
                <View style={rows.row}>
                  <View style={rows.line}>
                    <View style={styles.names}>
                      <Text style={rows.title} numberOfLines={2}>
                        {entry.name}
                      </Text>
                      {entry.detail ? (
                        <Text style={rows.muted} numberOfLines={1}>
                          {entry.detail}
                        </Text>
                      ) : null}
                    </View>
                    <Button
                      label={said.bringBack}
                      kind="outline"
                      size="small"
                      accessibilityLabel={said.bringBackSpoken(entry.name)}
                      onPress={() => bringBack(group.kind, entry.key)}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
      <Button
        label={said.addTag}
        kind="secondary"
        style={[styles.add, entries.length > 0 && rows.sectionAfter]}
        onPress={() => setChoosingTag(true)}
      />
      <OptionSheet
        page
        visible={choosingTag}
        heading={said.addTag}
        note={tags.length === 0 ? said.noTags : undefined}
        options={tags.map((entry) => ({ value: entry.tag, label: entry.tag, detail: said.songs(entry.trackCount) }))}
        chosen={''}
        onChoose={(tag) => {
          if (!tag) return;
          haptic('results', 'confirm');
          setAside('tag', tag, true);
        }}
        onClose={() => setChoosingTag(false)}
      />
    </SettingsPage>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({
  names: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  add: { alignSelf: 'flex-start' },
}));
