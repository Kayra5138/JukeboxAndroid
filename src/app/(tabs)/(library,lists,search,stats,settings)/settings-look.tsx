import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Switch } from '../../../components/Switch';

import { Pressable } from '../../../components/Pressable';
import { Segmented } from '../../../components/Segmented';
import { SettingsPage, useRows } from '../../../components/settings/rows';
import { readSetting, SETTINGS, writeSetting } from '../../../lib/db/index';
import { useT } from '../../../lib/i18n/index';
import { LIBRARY_VIEWS, withView } from '../../../lib/media/views';
import { setLibraryViews, useLibraryViews } from '../../../lib/ui/libraryViews';
import { switchColours, useColours, usePressed, useThemeChoice } from '../../../lib/theme/index';
import { themeOf } from '../../../lib/theme/registry';
import { useLandscape } from '../../../lib/ui/layout';
import { setMoreButtonShown, useMoreButtonShown } from '../../../lib/ui/moreButton';
import { useHaptics } from '../../../lib/ui/haptics';
import { OPTIONAL_TABS } from '../../../lib/ui/tabChoice';
import { setTabShown, useHiddenTabs } from '../../../lib/ui/tabs';
import { setTabLabelsShown, useTabLabelsShown } from '../../../lib/ui/tabLabels';
import { setScriptNames, useScriptNames } from '../../../lib/ui/scriptNames';
import { refreshLibrary } from '../../../lib/library/index';
import { useCoverMotion, useSongLook } from '../../../lib/ui/coverLook';

/**
 * How the app looks: its theme, how much of it moves,
 * and which of its shapes the library offers.
 *
 * First of the pages Settings opens, being the one most often gone to. The
 * rows are the ones that were on the Settings tab, as they were.
 */
export default function LookSettingsScreen() {
  const t = useT();
  const c = useColours();
  const styles = useRows();
  const pressed = usePressed();
  const haptics = useHaptics();
  const landscape = useLandscape();
  /*
    What is chosen, to be named on the row that opens the themes. Not read on
    focus like the rest, because it is not this screen's to keep: it is held
    where everything that depends on it is watching, and changing it redraws
    the app — this screen with it — on the spot.
  */
  const themeChoice = useThemeChoice();
  const themeNameKey = themeChoice === 'system' ? 'system' : themeOf(themeChoice).nameKey;
  // What the player shows where the cover is, and what moves with the music, to be named on its row.
  const songLook = useSongLook();
  const coverMotion = useCoverMotion();
  /*
    Read as the screen is first drawn as well as each time it is come back
    to. Starting from placeholders and correcting them a moment later drew
    the whole screen twice on the way in.
  */
  const [still, setStill] = useState(() => readSetting(SETTINGS.reduceMotion) === 'true');
  /** Held where every row is watching, like the theme; switching it redraws them and this. */
  const dots = useMoreButtonShown();
  const writing = useScriptNames();
  /** Held where the tab bar watches it, so a switch here changes the bar at once. */
  const hiddenTabs = useHiddenTabs();
  /** Held where the bar watches it, as the tabs are. */
  const tabNames = useTabLabelsShown();
  /** The ways of looking at the library that its switch offers. */
  const views = useLibraryViews();

  useFocusEffect(useCallback(() => {
    setStill(readSetting(SETTINGS.reduceMotion) === 'true');
  }, []));

  return (
    <SettingsPage>
      {/*
        Two groups, beside each other where there is width for it: the page
        is the longest of the six, and sideways one column of it is a long
        way down.
      */}
      <View style={[styles.columns, landscape && styles.columnsWide]}>
        <View style={styles.column}>
          <View style={styles.card}>
            {/*
              A row that opens the themes, and no longer the themes
              themselves. There are two dozen of them, each with a picture,
              and laid out here they were most of this screen: everything
              else in Settings was found by scrolling past them.
            */}
            <Link href="/themes" asChild>
              <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.settings.theme.title}</Text>
                  <View style={styles.choices}>
                    <Text style={styles.value} numberOfLines={1}>
                      {t.themes[themeNameKey]}
                    </Text>
                    <Text style={styles.chevron} importantForAccessibility="no">›</Text>
                  </View>
                </View>
                <Text style={styles.muted}>{t.settings.theme.open}</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            {/* How the player looks, beside the theme: its own page, as the themes are. */}
            <Link href="/player-look" asChild>
              <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.settings.playerLook.title}</Text>
                  <View style={styles.choices}>
                    <Text style={styles.value} numberOfLines={1}>
                      {coverMotion === 'none'
                        ? t.settings.coverLook[songLook]
                        : `${t.settings.coverLook[songLook]} · ${t.settings.coverLook[coverMotion]}`}
                    </Text>
                    <Text style={styles.chevron} importantForAccessibility="no">›</Text>
                  </View>
                </View>
                <Text style={styles.muted}>{t.settings.playerLook.open}</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            <View style={styles.row}>
              <View style={styles.line}>
                <Text style={styles.title}>{t.settings.still.title}</Text>
                <Switch
                  accessibilityLabel={t.settings.still.title}
                  value={still}
                  onValueChange={(on) => {
                    setStill(on);
                    writeSetting(SETTINGS.reduceMotion, on ? 'true' : 'false');
                  }}
                  {...switchColours(c, still)}
                />
              </View>
              <Text style={styles.muted}>{t.settings.still.note}</Text>
            </View>
            <View style={styles.rule} />
            {/* Beside holding the decoration still, which is the nearest thing to it: how the app answers a touch. */}
            <Link href="/settings-haptics" asChild>
              <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row}>
                <View style={styles.line}>
                  <Text style={styles.title}>{t.settings.haptics.title}</Text>
                  <View style={styles.choices}>
                    <Text style={styles.value} numberOfLines={1}>
                      {t.settings.haptics.modes[haptics.mode]}
                    </Text>
                    <Text style={styles.chevron} importantForAccessibility="no">›</Text>
                  </View>
                </View>
                <Text style={styles.muted}>{t.settings.haptics.open}</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            <View style={styles.row}>
              <View style={styles.line}>
                <Text style={styles.title}>{t.settings.moreButton.title}</Text>
                <Switch
                  accessibilityLabel={t.settings.moreButton.title}
                  value={dots}
                  onValueChange={setMoreButtonShown}
                  {...switchColours(c, dots)}
                />
              </View>
              <Text style={styles.muted}>{t.settings.moreButton.note}</Text>
            </View>
            <View style={styles.rule} />
            {/*
              Which writing a song's name is shown in, where a lookup found it
              in two. Two choices, as the jump buttons' steps are laid out.
            */}
            <View style={styles.row}>
              <View style={styles.line}>
                <Text style={styles.title}>{t.settings.scriptNames.title}</Text>
                <Segmented
                  role="radio"
                  variant="chips"
                  size="compact"
                  options={[
                    { value: 'latin' as const, label: t.settings.scriptNames.latin },
                    { value: 'original' as const, label: t.settings.scriptNames.original },
                  ]}
                  value={writing}
                  onChange={(next) => {
                    setScriptNames(next);
                    // The library reads its names again, in the writing just chosen.
                    void refreshLibrary();
                  }}
                />
              </View>
              <Text style={styles.muted}>{t.settings.scriptNames.note}</Text>
            </View>
          </View>
        </View>

        <View style={styles.column}>
          {/*
            Which of its four shapes the library's switch offers.

            A switch each rather than a list to pick from, because they are not
            alternatives: the question for each is whether it earns a place on
            a row that gets more crowded with every one that does.
          */}
          <Text accessibilityRole="header" style={styles.section}>{t.format.upper(t.settings.sections.views)}</Text>
          <View style={styles.card}>
            {LIBRARY_VIEWS.map((view, index) => {
              const on = views.includes(view);
              /*
                The last one left on cannot be turned off, and says so by not
                moving. `withView` would refuse anyway; held still here so the
                switch is not seen to flick over and back, which reads as the
                app having failed to do what it was asked.
              */
              const only = on && views.length === 1;
              return (
                <View key={view}>
                  {index > 0 ? <View style={styles.rule} /> : null}
                  <View style={styles.row}>
                    <View style={styles.line}>
                      <Text style={styles.title}>{t.library.views[view]}</Text>
                      <Switch
                        accessibilityLabel={t.library.views[view]}
                        accessibilityHint={
                          only ? t.settings.views.onlyHint : t.settings.views.toggleHint
                        }
                        value={on}
                        disabled={only}
                        onValueChange={(wanted) => {
                          setLibraryViews(withView(views, view, wanted));
                        }}
                        {...switchColours(c, on)}
                      />
                    </View>
                    <Text style={styles.muted}>{t.settings.views.notes[view]}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={styles.aside}>
            {views.length === 1 ? t.settings.views.asideOne : t.settings.views.asideMany}
          </Text>

          {/* The tabs that can be taken off the bar: see `ui/tabChoice.ts`. */}
          <Text accessibilityRole="header" style={[styles.section, styles.sectionAfter]}>
            {t.format.upper(t.settings.tabs.title)}
          </Text>
          <View style={styles.card}>
            {OPTIONAL_TABS.map((tab, index) => {
              const on = !hiddenTabs.has(tab);
              const name = t.nav[tab];
              return (
                <View key={tab}>
                  {index > 0 ? <View style={styles.rule} /> : null}
                  <View style={styles.row}>
                    <View style={styles.line}>
                      <Text style={styles.title}>{name}</Text>
                      <Switch
                        accessibilityLabel={name}
                        value={on}
                        onValueChange={(wanted) => setTabShown(tab, wanted)}
                        {...switchColours(c, on)}
                      />
                    </View>
                    {tab === 'search' ? <Text style={styles.muted}>{t.settings.tabs.searchNote}</Text> : null}
                  </View>
                </View>
              );
            })}
            <View style={styles.rule} />
            {/* Whether the tabs say their names under their icons. */}
            <View style={styles.row}>
              <View style={styles.line}>
                <Text style={styles.title}>{t.settings.tabs.names}</Text>
                <Switch
                  accessibilityLabel={t.settings.tabs.names}
                  value={tabNames}
                  onValueChange={setTabLabelsShown}
                  {...switchColours(c, tabNames)}
                />
              </View>
              <Text style={styles.muted}>{t.settings.tabs.namesNote}</Text>
            </View>
          </View>
          <Text style={styles.aside}>{t.settings.tabs.aside}</Text>
        </View>
      </View>
    </SettingsPage>
  );
}

