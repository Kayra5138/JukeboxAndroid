import { useCallback, useState } from 'react';
import { SPACE } from '../../../lib/theme/measures';
import { Note } from '../../../components/Note';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Busy } from '../../../components/Busy';
import { Text } from '../../../components/settings/Find';

import JukeboxAudio from '../../../../modules/jukebox-audio/index';

import { NumberStepper } from '../../../components/NumberStepper';
import { Pressable } from '../../../components/Pressable';
import { SettingsPage, useRows, SectionLabel } from '../../../components/settings/rows';
import { Switch } from '../../../components/Switch';
import { useT } from '../../../lib/i18n/index';
import { schedulePodcasts } from '../../../lib/podcasts/background';
import { cleanUpPlayed, deletePlayedDays, setDeletePlayedDays } from '../../../lib/podcasts/cleanup';
import { feedsInOpml, toOpml } from '../../../lib/podcasts/opml';
import { DELETE_DAYS_RANGE } from '../../../lib/podcasts/played';
import { followAll, podcastsWifiOnly, setPodcastsWifiOnly } from '../../../lib/podcasts/refresh';
import { subscriptions } from '../../../lib/podcasts/store';
import { sponsorsTurnedOn } from '../../../lib/tapes/extras';
import { setSmartRewind, setTapeFlag, setTapeJump, smartRewind, TAPE_JUMP_RANGE, tapeFlag, tapeJumps, type TapeFlag } from '../../../lib/tapes/settings';
import { useColours, usePressed } from '../../../lib/theme/index';
import { haptic } from '../../../lib/ui/haptics';

/** A week, for heard episodes kept a while after they were heard: long enough to go back to one. */
const DEFAULT_DELETE_DAYS = 7;

/**
 * The settings of tapes, apart from the music's: whether a tape goes back a
 * little on being played again, how far its jump buttons go; whether the
 * podcasts followed are fetched on Wi‑Fi only, whether their episodes go some
 * days after they are heard, and the list of them as an OPML file, written
 * for another app or read from one. Opened from the Settings tab and from the
 * tapes view, the same page from either.
 */
export default function TapeSettingsScreen() {
  const t = useT();
  const c = useColours();
  const styles = useRows();
  const said = t.settings.tapes;
  const [rewind, setRewind] = useState(smartRewind);
  const [flags, setFlags] = useState(() => ({
    skipSilence: tapeFlag('skipSilence'),
    voiceClarity: tapeFlag('voiceClarity'),
    skipSponsors: tapeFlag('skipSponsors'),
  }));
  const [jumps, setJumps] = useState(tapeJumps);
  const [wifiOnly, setWifiOnly] = useState(podcastsWifiOnly);
  const [deleteDays, setDeleteDays] = useState(deletePlayedDays);
  const pressed = usePressed();
  /** How the list of shows last went: being read in, read in, written, or why not. */
  const [opml, setOpml] = useState<Line | null>(null);

  const exportShows = () => void saveShows(said.opml).then(setOpml);
  const importShows = () =>
    void readShows(said.opml, (line) => setOpml({ line, busy: true })).then((done) => {
      if (done) setOpml(done);
    });

  // Read again on coming back: the Wi‑Fi switch is on the Add tapes screen too.
  useFocusEffect(useCallback(() => {
    setRewind(smartRewind());
    setJumps(tapeJumps());
    setWifiOnly(podcastsWifiOnly());
    setDeleteDays(deletePlayedDays());
    /*
      Heard episodes are deleted as the page is left, by however many days it
      was left at: not as the switch is turned on, which is at a week and on
      the way to the number wanted, and took what was heard eight days ago
      from somebody about to say thirty.
    */
    return () => {
      if (deletePlayedDays() != null) void cleanUpPlayed();
    };
  }, []));

  // One of a tape's switches, each a row of its own with what it does under it.
  const flagRow = (name: TapeFlag) => (
    <View style={styles.row}>
      <View style={styles.line}>
        <Text style={styles.title}>{said[name].title}</Text>
        <Switch
          value={flags[name]}
          accessibilityLabel={said[name].title}
          onValueChange={(on) => {
            setTapeFlag(name, on);
            if (name === 'skipSponsors' && on) sponsorsTurnedOn();
            setFlags((now) => ({ ...now, [name]: on }));
          }}
        />
      </View>
      <Text style={styles.muted}>{said[name].note}</Text>
    </View>
  );

  // The note under the second of the two, which it speaks of both.
  const jumpRow = (which: 'back' | 'forward', note?: string) => (
    <View style={styles.row}>
      <View style={styles.line}>
        <Text style={styles.title}>{said[which]}</Text>
        <NumberStepper
          name={said[which]}
          range={TAPE_JUMP_RANGE}
          value={jumps[which]}
          onChange={(seconds) => {
            setTapeJump(which, seconds);
            setJumps((now) => ({ ...now, [which]: seconds }));
          }}
        />
      </View>
      {note ? <Text style={styles.muted}>{note}</Text> : null}
    </View>
  );

  return (
    <SettingsPage>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{said.smartRewind.title}</Text>
            <Switch
              value={rewind}
              accessibilityLabel={said.smartRewind.title}
              onValueChange={(on) => {
                setSmartRewind(on);
                setRewind(on);
              }}
            />
          </View>
          <Text style={styles.muted}>{said.smartRewind.note}</Text>
        </View>
        <View style={styles.rule} />
        {flagRow('skipSponsors')}
        <View style={styles.rule} />
        {jumpRow('back')}
        <View style={styles.rule} />
        {jumpRow('forward', said.jumpNote)}
      </View>
      <SectionLabel>{said.podcasts}</SectionLabel>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{t.search.tapes.podcasts.wifiOnly}</Text>
            <Switch
              value={wifiOnly}
              accessibilityLabel={t.search.tapes.podcasts.wifiOnly}
              onValueChange={(on) => {
                setPodcastsWifiOnly(on);
                setWifiOnly(on);
              }}
            />
          </View>
          <Text style={styles.muted}>{t.search.tapes.podcasts.wifiOnlyNote}</Text>
        </View>
        <View style={styles.rule} />
        {/* Off unless set: a week once turned on, then any number of days up to a month. */}
        <View style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{said.deletePlayed.title}</Text>
            <Switch
              value={deleteDays != null}
              accessibilityLabel={said.deletePlayed.title}
              onValueChange={(on) => {
                const days = on ? DEFAULT_DELETE_DAYS : null;
                setDeletePlayedDays(days);
                setDeleteDays(days);
                void schedulePodcasts();
              }}
            />
          </View>
          {deleteDays != null ? (
            <NumberStepper
              name={said.deletePlayed.title}
              range={DELETE_DAYS_RANGE}
              value={deleteDays}
              onChange={(days) => {
                setDeletePlayedDays(days);
                setDeleteDays(days);
              }}
            />
          ) : null}
          <Text style={styles.muted}>{deleteDays != null ? said.deletePlayed.after(deleteDays) : said.deletePlayed.off}</Text>
        </View>
      </View>
      {/* The shows followed, to or from another app. */}
      <SectionLabel>{said.opml.heading}</SectionLabel>
      <View style={styles.card}>
        <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row} onPress={exportShows}>
          <Text style={styles.title}>{said.opml.export}</Text>
          <Text style={styles.muted}>{said.opml.exportNote}</Text>
        </Pressable>
        <View style={styles.rule} />
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          disabled={opml?.busy === true}
          style={styles.row}
          onPress={importShows}>
          <Text style={styles.title}>{said.opml.import}</Text>
          <Text style={styles.muted}>{said.opml.importNote}</Text>
        </Pressable>
      </View>
      {opml ? (
        <View style={layout.opmlLine}>
          {opml.busy ? <Busy size="small" color={c.textMuted} /> : null}
          <Note tone={opml.bad ? 'bad' : 'muted'} style={styles.noteRoom}>{opml.line}</Note>
        </View>
      ) : null}
      {/* Still being worked on, so at the foot of the page and off until turned on (`FLAG_DEFAULTS`). */}
      <SectionLabel>{t.settings.sections.experimental}</SectionLabel>
      <View style={styles.card}>
        {flagRow('skipSilence')}
        <View style={styles.rule} />
        {flagRow('voiceClarity')}
      </View>
    </SettingsPage>
  );
}

type Said = ReturnType<typeof useT>['settings']['tapes']['opml'];
type Line = { line: string; bad?: boolean; busy?: boolean };

/** The shows followed, written to a file of the user's choosing; null where they backed out. Never throws. */
async function saveShows(said: Said): Promise<Line | null> {
  const shows = subscriptions();
  if (shows.length === 0) return { line: said.none, bad: true };
  try {
    const saved = await JukeboxAudio.saveTextFileAsync?.('jukebox-podcasts.opml', 'text/x-opml', toOpml(shows));
    return saved ? { line: said.saved(shows.length) } : null;
  } catch (error) {
    console.warn('An OPML file could not be read or written', error);
    return { line: said.failed, bad: true };
  }
}

/** The shows of a file of the user's choosing, followed; null where they backed out. [onEach] says how far it has got. Never throws. */
async function readShows(said: Said, onEach: (line: string) => void): Promise<Line | null> {
  try {
    const picked = await JukeboxAudio.pickTextFileAsync?.();
    if (!picked) return null;
    const feeds = feedsInOpml(picked.text);
    if (feeds.length === 0) return { line: said.nothing, bad: true };
    const done = await followAll(feeds, (at, total) => onEach(said.importing(at, total)));
    haptic('results', 'confirm');
    return { line: said.imported(done.followed, done.already, done.failed), bad: done.followed === 0 && done.failed > 0 };
  } catch (error) {
    console.warn('An OPML file could not be read or written', error);
    return { line: said.failed, bad: true };
  }
}

const layout = StyleSheet.create({
  // A spinner beside the line while a list is read in, the line alone after.
  opmlLine: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
});
