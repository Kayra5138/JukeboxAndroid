import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Switch, Text, View } from 'react-native';

import { Pressable } from '../components/Pressable';
import { SettingsPage, useRows } from '../components/settings/rows';
import { readSetting, SETTINGS, writeSetting } from '../lib/db/index';
import { useT } from '../lib/i18n/index';
import { LIBRARY_VIEWS, storedViews, viewsFrom, withView, type LibraryView } from '../lib/media/views';
import { switchColours, useColours, usePressed, useThemeChoice } from '../lib/theme/index';
import { themeOf } from '../lib/theme/registry';
import { rackWanted, useLandscape } from '../lib/ui/layout';
import { setMoreButtonShown, useMoreButtonShown } from '../lib/ui/moreButton';
import { OPTIONAL_TABS } from '../lib/ui/tabChoice';
import { setTabShown, useHiddenTabs } from '../lib/ui/tabs';

/**
 * How the app looks: its theme, the rack of sleeves, how much of it moves,
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
  const landscape = useLandscape();
  /*
    What is chosen, to be named on the row that opens the themes. Not read on
    focus like the rest, because it is not this screen's to keep: it is held
    where everything that depends on it is watching, and changing it redraws
    the app — this screen with it — on the spot.
  */
  const themeChoice = useThemeChoice();
  const themeNameKey = themeChoice === 'system' ? 'system' : themeOf(themeChoice).nameKey;
  /*
    Read as the screen is first drawn as well as each time it is come back
    to. Starting from placeholders and correcting them a moment later drew
    the whole screen twice on the way in.
  */
  const [rack, setRack] = useState(() => rackWanted(true));
  const [still, setStill] = useState(() => readSetting(SETTINGS.reduceMotion) === 'true');
  /** Held where every row is watching, like the theme; switching it redraws them and this. */
  const dots = useMoreButtonShown();
  /** Held where the tab bar watches it, so a switch here changes the bar at once. */
  const hiddenTabs = useHiddenTabs();
  /** The ways of looking at the library that its switch offers. */
  const [views, setViews] = useState<LibraryView[]>(() => viewsFrom(readSetting(SETTINGS.libraryViews)));

  useFocusEffect(useCallback(() => {
    setStill(readSetting(SETTINGS.reduceMotion) === 'true');
    setRack(rackWanted(true));
    // The same list is a new array each time it is read, and is not news.
    const kept = viewsFrom(readSetting(SETTINGS.libraryViews));
    setViews((before) => (storedViews(before) === storedViews(kept) ? before : kept));
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
            {/*
              Sideways only, which is why it says so. The rack is records turned
              about a vertical axis and seen from the side; a tall frame has to
              stack that shape instead, and a pile of slabs is neither a shelf
              nor a faster way to find anything — so upright there is a list and
              nothing to choose.
            */}
            <View style={styles.row}>
              {/*
                The switch sits against the name, not against the whole entry.
                Centred on the pair it drifted down the middle of a paragraph
                three lines deep and looked unattached to anything.
              */}
              <View style={styles.line}>
                <Text style={styles.title}>{t.settings.rack.title}</Text>
                <Switch
                  // Named, for a screen reader, which otherwise says only "switch, off".
                  accessibilityLabel={t.settings.rack.title}
                  value={rack}
                  onValueChange={(on) => {
                    setRack(on);
                    writeSetting(SETTINGS.coverFlow, on ? 'true' : 'false');
                  }}
                  {...switchColours(c, rack)}
                />
              </View>
              <Text style={styles.muted}>{t.settings.rack.note}</Text>
            </View>
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
                          const next = withView(views, view, wanted);
                          setViews(next);
                          writeSetting(SETTINGS.libraryViews, storedViews(next));
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
          </View>
          <Text style={styles.aside}>{t.settings.tabs.aside}</Text>
        </View>
      </View>
    </SettingsPage>
  );
}
