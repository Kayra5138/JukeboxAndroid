import { Link } from 'expo-router';
import { View } from 'react-native';
import { Text } from '../../../components/settings/Find';
import { Switch } from '../../../components/Switch';

import { Pressable } from '../../../components/Pressable';
import { Segmented } from '../../../components/Segmented';
import { SettingsPage, useRows, SwitchRow, LinkRow, SectionLabel, Chevron } from '../../../components/settings/rows';
import { useT } from '../../../lib/i18n/index';
import { withView } from '../../../lib/media/views';
import { setLibraryViews, useLibraryViews, viewOrder } from '../../../lib/ui/libraryViews';
import { tabOrder } from '../../../lib/ui/tabOrder';
import { OrderButtons } from '../../../components/settings/OrderButtons';
import { usePressed, useThemeChoice } from '../../../lib/theme/index';
import { themeOf } from '../../../lib/theme/registry';
import { useLandscape } from '../../../lib/ui/layout';
import { setMoreButtonShown, useMoreButtonShown } from '../../../lib/ui/moreButton';
import { useHaptics } from '../../../lib/ui/haptics';
import { OPTIONAL_TABS } from '../../../lib/ui/tabChoice';
import { setTabShown, useHiddenTabs } from '../../../lib/ui/tabs';
import { setTabLabelsShown, useTabLabelsShown } from '../../../lib/ui/tabLabels';
import { setScriptNames, useScriptNames } from '../../../lib/ui/scriptNames';
import { setScrollBarMode, useScrollBarMode } from '../../../lib/ui/scrollBar';
import { setUndoOffers, useUndoOffers } from '../../../lib/ui/undo';
import { setStillChosen, useStillChosen } from '../../../lib/ui/motion';
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
  /** Held where everything that holds still is watching, so it changes the moment it is turned. */
  const still = useStillChosen();
  /** Held where every row is watching, like the theme; switching it redraws them and this. */
  const dots = useMoreButtonShown();
  const writing = useScriptNames();
  const scrollBar = useScrollBarMode();
  const undoOffers = useUndoOffers();
  // The order of the views along the library's switch, and of the tabs along the bar: each row has its arrows.
  const viewsInOrder = viewOrder.useOrder();
  const tabsInOrder = tabOrder.useOrder();
  /** Held where the tab bar watches it, so a switch here changes the bar at once. */
  const hiddenTabs = useHiddenTabs();
  /** Held where the bar watches it, as the tabs are. */
  const tabNames = useTabLabelsShown();
  /** The ways of looking at the library that its switch offers. */
  const views = useLibraryViews();

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
            <LinkRow
              title={t.settings.theme.title}
              value={t.themes[themeNameKey]}
              hint={t.settings.theme.open}
              href="/themes"
            />
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
                    <Chevron />
                  </View>
                </View>
                <Text style={styles.muted}>{t.settings.playerLook.open}</Text>
              </Pressable>
            </Link>
            <View style={styles.rule} />
            <SwitchRow
              title={t.settings.still.title}
              hint={t.settings.still.note}
              value={still}
              onChange={setStillChosen}
            />
            <View style={styles.rule} />
            {/* Beside holding the decoration still, which is the nearest thing to it: how the app answers a touch. */}
            <LinkRow
              title={t.settings.haptics.title}
              value={t.settings.haptics.modes[haptics.mode]}
              hint={t.settings.haptics.open}
              href="/settings-haptics"
            />
            <View style={styles.rule} />
            <SwitchRow
              title={t.settings.moreButton.title}
              hint={t.settings.moreButton.note}
              value={dots}
              onChange={setMoreButtonShown}
            />
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
            <View style={styles.rule} />
            {/*
              The bar beside a long list: there all the while, there while the
              list moves, or never. Three choices across the row under the name,
              where their words have room.
            */}
            <View style={styles.row}>
              <Text style={styles.title}>{t.settings.scrollBar.title}</Text>
              <Segmented
                role="radio"
                variant="chips"
                size="compact"
                layout="fill"
                options={[
                  { value: 'always' as const, label: t.settings.scrollBar.always },
                  { value: 'moving' as const, label: t.settings.scrollBar.moving },
                  { value: 'never' as const, label: t.settings.scrollBar.never },
                ]}
                value={scrollBar}
                onChange={setScrollBarMode}
              />
              <Text style={styles.muted}>{t.settings.scrollBar.note}</Text>
            </View>
            <View style={styles.rule} />
            {/* Whether a song taken out of a list, let go or turned away is offered back for a moment: see `ui/undo.ts`. */}
            <SwitchRow
              title={t.settings.undoOffers.title}
              hint={t.settings.undoOffers.note}
              value={undoOffers}
              onChange={setUndoOffers}
            />
          </View>
        </View>

        <View style={styles.column}>
          {/*
            Which of its four shapes the library's switch offers.

            A switch each rather than a list to pick from, because they are not
            alternatives: the question for each is whether it earns a place on
            a row that gets more crowded with every one that does.
          */}
          <SectionLabel after={false}>{t.settings.sections.views}</SectionLabel>
          <View style={styles.card}>
            {viewsInOrder.map((view, index) => {
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
                      <View style={styles.choices}>
                        <OrderButtons
                          name={t.library.views[view]}
                          first={index === 0}
                          last={index === viewsInOrder.length - 1}
                          onMove={(by) => viewOrder.move(view, by)}
                        />
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
                        />
                      </View>
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
            {/* All five in the order of the bar, with their arrows; a switch on those that can be taken off it. */}
            {tabsInOrder.map((tab, index) => {
              const optional = (OPTIONAL_TABS as readonly string[]).includes(tab);
              const on = !hiddenTabs.has(tab as (typeof OPTIONAL_TABS)[number]);
              const name = t.nav[tab];
              return (
                <View key={tab}>
                  {index > 0 ? <View style={styles.rule} /> : null}
                  <View style={styles.row}>
                    <View style={styles.line}>
                      <Text style={styles.title}>{name}</Text>
                      <View style={styles.choices}>
                        <OrderButtons
                          name={name}
                          first={index === 0}
                          last={index === tabsInOrder.length - 1}
                          onMove={(by) => tabOrder.move(tab, by)}
                        />
                        {optional ? (
                          <Switch
                            accessibilityLabel={name}
                            value={on}
                            onValueChange={(wanted) => setTabShown(tab as (typeof OPTIONAL_TABS)[number], wanted)}
                          />
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.muted}>{t.settings.tabs.notes[tab]}</Text>
                  </View>
                </View>
              );
            })}
            <View style={styles.rule} />
            {/* Whether the tabs say their names under their icons. */}
            <SwitchRow
              title={t.settings.tabs.names}
              hint={t.settings.tabs.namesNote}
              value={tabNames}
              onChange={setTabLabelsShown}
            />
          </View>
          <Text style={styles.aside}>{t.settings.tabs.aside}</Text>
        </View>
      </View>
    </SettingsPage>
  );
}

