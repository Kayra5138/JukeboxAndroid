import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Pressable } from './Pressable';
import { useDiscoverSettings } from './discover/hooks';
import { useDiscoverActions } from '../lib/discover/DiscoverProvider';
import { scheduleDiscover } from '../lib/discover/background';
import { maintainDiscover } from '../lib/discover/engine';
import { blockedArtists, unblockArtist } from '../lib/discover/feedback';
import {
  POPULARITY_CHOICES,
  popularityOf,
  previewsOn,
  READY_CHOICES,
  type DiscoverSettings as Settings,
  type Popularity,
} from '../lib/discover/policy';
import { blockedSongs } from '../lib/discover/store';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, outlinedClip, switchColours, useColours, usePressed } from '../lib/theme/index';

/** What can be chosen, as the engine reads it: see `settingsFrom`, which takes nothing else. */
const COUNTS = [10, 20, 30, 40];
const REFRESH_DAYS = [0, 1, 3, 7, 14, 30];

const POPULARITY_LABEL = {
  known: 'popularityKnown',
  any: 'popularityAny',
  deep: 'popularityDeep',
} as const satisfies Record<Popularity, string>;

type BlockedSong = ReturnType<typeof blockedSongs>[number];
type BlockedArtist = ReturnType<typeof blockedArtists>[number];

/**
 * Discover's settings: how long the list is and how often it is made anew,
 * how many songs are fetched ahead and over what, which end of an artist's
 * songs to lean to, and who and what has been turned away.
 *
 * One card, drawn in two places: among the rest in Settings, under a
 * heading, and by itself on the screen the gear over the list opens, where
 * the screen's own title is the heading.
 *
 * Every choice takes at once and nothing here waits for it. Only the task
 * that runs with no screen has to be told, and that is the one thing on the
 * card that can fail.
 */
export function DiscoverSettings({ standalone = false }: { standalone?: boolean }) {
  const settings = useDiscoverSettings();
  const { configure, allowAgain } = useDiscoverActions();
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const [error, setError] = useState('');
  /*
    The two lists of what was turned away, read when one is opened and not
    kept up from anywhere: they change from this card and from the list, and
    the list is not on screen while this is.
  */
  const [songs, setSongs] = useState<BlockedSong[] | null>(null);
  const [artists, setArtists] = useState<BlockedArtist[] | null>(null);
  const said = t.discover.settings;
  const taste = t.discover.taste;
  const popularity = popularityOf(settings);

  const change = (patch: Partial<Settings>) => {
    setError('');
    configure({ ...settings, ...patch });
    scheduleDiscover().catch(() => setError(said.failed));
  };

  return (
    <View style={standalone ? undefined : styles.section}>
      {standalone ? null : <Text style={styles.heading}>{t.format.upper(said.heading)}</Text>}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title}>{said.count}</Text>
          <Choices
            options={COUNTS}
            chosen={settings.count}
            label={(count) => t.format.number(count)}
            onChoose={(count) => change({ count })}
          />
          <Text style={styles.muted}>{said.countNote}</Text>
        </View>

        <View style={styles.rule} />
        <View style={styles.row}>
          <Text style={styles.title}>{said.refresh}</Text>
          <Choices
            options={REFRESH_DAYS}
            chosen={settings.refreshDays}
            label={(days) => (days ? said.everyDays(days) : said.manual)}
            onChoose={(refreshDays) => change({ refreshDays })}
          />
          <Text style={styles.muted}>{said.refreshNote}</Text>
        </View>

        <View style={styles.rule} />
        <View style={styles.row}>
          <Text style={styles.title}>{said.ready}</Text>
          <Choices
            options={READY_CHOICES}
            chosen={settings.ready}
            label={(ready) => (ready ? t.format.number(ready) : said.readyNone)}
            onChoose={(ready) => change({ ready })}
          />
          <Text style={styles.muted}>{said.readyNote}</Text>
        </View>

        <View style={styles.rule} />
        {/*
          About the songs kept ready and nothing else, so with none kept it
          is a switch for something that is not happening: shown, and not
          live.
        */}
        <View style={settings.ready ? styles.row : styles.rowOff}>
          <View style={styles.line}>
            <Text style={styles.title}>{said.wifi}</Text>
            <Switch
              disabled={!settings.ready}
              accessibilityLabel={said.wifi}
              accessibilityState={{ disabled: !settings.ready, checked: settings.wifiOnly }}
              value={settings.wifiOnly}
              {...switchColours(c, settings.wifiOnly)}
              onValueChange={(wifiOnly) => change({ wifiOnly })}
            />
          </View>
          <Text style={styles.muted}>{said.wifiNote}</Text>
        </View>

        <View style={styles.rule} />
        {/* Something to hear in the seconds a tapped song takes to arrive. On unless somebody has said not. */}
        <View style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{said.preview}</Text>
            <Switch
              accessibilityLabel={said.preview}
              accessibilityState={{ checked: previewsOn(settings) }}
              value={previewsOn(settings)}
              {...switchColours(c, previewsOn(settings))}
              onValueChange={(preview) => change({ preview })}
            />
          </View>
          <Text style={styles.muted}>{said.previewNote}</Text>
        </View>

        <View style={styles.rule} />
        <View style={styles.row}>
          <Text style={styles.title}>{taste.popularity}</Text>
          <Choices
            options={POPULARITY_CHOICES}
            chosen={popularity}
            label={(choice) => taste[POPULARITY_LABEL[choice]]}
            onChoose={(choice) => change({ popularity: choice })}
          />
          <Text style={styles.muted}>{taste.popularityNote}</Text>
          {/*
            It decides which songs are looked for, and the ones on the list
            have been. A new list is not made for it: the one on show may be
            half listened through, and would be thrown away for a tap on a
            setting.
          */}
          <Text style={styles.muted}>{said.nextList}</Text>
        </View>

        <View style={styles.rule} />
        <Folded
          title={said.excluded}
          open={songs !== null}
          onToggle={() => setSongs(songs ? null : blockedSongs())}
          empty={songs?.length === 0 ? said.noneExcluded : null}>
          {songs?.map((song) => (
            <View key={song.id} style={styles.entry}>
              <View style={styles.names}>
                <Text style={styles.name} numberOfLines={1}>
                  {song.title}
                </Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {song.artist}
                </Text>
              </View>
              <Undo
                label={said.allowAgain}
                spoken={said.allowAgainLabel(song.title)}
                onPress={() => {
                  allowAgain(song.id);
                  setSongs(songs.filter((other) => other.id !== song.id));
                }}
              />
            </View>
          ))}
        </Folded>

        <View style={styles.rule} />
        <Folded
          title={taste.blockedArtists}
          note={taste.blockedArtistsNote}
          open={artists !== null}
          onToggle={() => setArtists(artists ? null : blockedArtists())}
          empty={artists?.length === 0 ? taste.noneBlockedArtists : null}>
          {artists?.map((artist) => (
            <View key={artist.id} style={styles.entry}>
              <Text style={[styles.name, styles.names]} numberOfLines={1}>
                {artist.artist}
              </Text>
              <Undo
                label={said.unblock}
                spoken={said.unblockLabel(artist.artist)}
                onPress={() => {
                  unblockArtist(artist.id);
                  setArtists(artists.filter((other) => other.id !== artist.id));
                  // Who is kept away is read by the engine when it looks things over, so it is asked to.
                  void maintainDiscover();
                }}
              />
            </View>
          ))}
        </Folded>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** A short row of alternatives, one of which is already the answer. */
function Choices<Value extends string | number>({
  options,
  chosen,
  label,
  onChoose,
}: {
  options: readonly Value[];
  chosen: Value;
  label: (value: Value) => string;
  onChoose: (value: Value) => void;
}) {
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <View accessibilityRole="radiogroup" style={styles.choices}>
      {options.map((option) => {
        const on = option === chosen;
        return (
          <Pressable
            android_ripple={pressed}
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            hitSlop={CHOICE_SLOP}
            style={on ? styles.choiceOn : styles.choice}
            onPress={() => onChoose(option)}>
            <Text style={on ? styles.choiceTextOn : styles.choiceText}>{label(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A row that opens onto a list of its own: closed it is one line, which is what it is most days. */
function Folded({
  title,
  note,
  open,
  onToggle,
  empty,
  children,
}: {
  title: string;
  note?: string;
  open: boolean;
  onToggle: () => void;
  /** What to say in place of a list with nothing on it. */
  empty: string | null;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <>
      <Pressable
        android_ripple={pressed}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.row}
        onPress={onToggle}>
        <View style={styles.line}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.chevron}>{open ? '⌄' : '›'}</Text>
        </View>
        {note ? <Text style={styles.muted}>{note}</Text> : null}
      </Pressable>
      {open ? (
        <View style={styles.list}>
          {empty ? <Text style={styles.muted}>{empty}</Text> : children}
        </View>
      ) : null}
    </>
  );
}

/** The way back for one thing on such a list. Said with its name to a screen reader, which hears twenty of them. */
function Undo({ label, spoken, onPress }: { label: string; spoken: string; onPress: () => void }) {
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <Pressable
      android_ripple={pressed}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      style={styles.undo}
      onPress={onPress}>
      <Text style={styles.undoLabel}>{label}</Text>
    </Pressable>
  );
}

/** The chips are drawn small, as in Settings; this much further out still counts. */
const CHOICE_SLOP = { top: 8, bottom: 8, left: 2, right: 2 };

const useStyles = makeStyles((c) => {
  const row = { paddingHorizontal: 16, paddingVertical: 14, gap: 8 };
  const choice = {
    minWidth: 40,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return StyleSheet.create({
    // As the other groups in Settings, which this stands among.
    section: { marginTop: 26 },
    heading: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginLeft: 4,
    },
    card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) },
    row,
    rowOff: { ...row, opacity: 0.45 },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },
    title: { color: c.text, fontSize: 15.5, flexShrink: 1 },
    muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
    chevron: { color: c.textDisabled, fontSize: 20, lineHeight: 22 },

    // Wrapping: six rhythms of refreshing do not fit one line of a phone.
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choice: { ...choice, backgroundColor: c.surfaceRaised, ...outlined(c) },
    choiceOn: { ...choice, backgroundColor: c.primary, ...outlined(c, c.primary) },
    choiceText: { color: c.textSecondary, fontSize: 13.5, fontVariant: ['tabular-nums'] },
    // Heavier as well as filled, so that it is not its colour alone that says which is chosen.
    choiceTextOn: { color: c.onPrimary, fontSize: 13.5, fontWeight: '600', fontVariant: ['tabular-nums'] },

    list: { paddingHorizontal: 16, paddingBottom: 12, gap: 2 },
    entry: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
    names: { flex: 1, minWidth: 0 },
    name: { color: c.text, fontSize: 14.5 },
    undo: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 8,
      justifyContent: 'center',
      backgroundColor: c.surfaceRaised,
      ...outlined(c),
    },
    undoLabel: { color: c.text, fontSize: 13 },

    error: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 4 },
  });
});
