import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { AccessibilityInfo, BackHandler, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Choices } from '../DiscoverSettings';
import { Pressable } from '../Pressable';
import { useDiscoverSettings } from '../discover/hooks';
import { scheduleDiscover } from '../../lib/discover/background';
import { useDiscoverActions } from '../../lib/discover/DiscoverProvider';
import { previewsOn, READY_CHOICES, type DiscoverSettings } from '../../lib/discover/policy';
import { chooseLanguage, LANGUAGES, tryLanguage, useLanguage, useT, type Language } from '../../lib/i18n/index';
import { AUTOPLAY_MODES } from '../../lib/player/autoplay/plan';
import { setAutoplayMode, useAutoplayMode } from '../../lib/player/autoplay/setting';
import {
  makeStyles,
  outlined,
  outlinedClip,
  page,
  switchColours,
  useColours,
  usePressed,
  type ThemeChoice,
} from '../../lib/theme/index';
import { ThemePicker } from '../../lib/theme/ThemePicker';
import { languageForLocale, type SetupStep } from '../../lib/ui/welcome';
import { finishWelcome, welcomeSteps } from '../../lib/ui/welcomeStore';

/**
 * The themes the first start offers: following the phone, which is what the
 * app does unless told otherwise, and two of each kind — light, dark, glass —
 * with the wallpaper's colours where the phone has them to give. Enough to
 * see that there is a choice and what sort; the other dozen are a row away
 * in Settings, and a first start is no place to page through all of them.
 */
const SETUP_THEMES: readonly ThemeChoice[] = [
  'system',
  'light',
  'dark',
  'pastel',
  'sepia',
  'black',
  'midnight',
  'glass',
  'frost',
  'material',
];

/**
 * The first start: a few screens over everything else, before anything else
 * is asked, for what is worth choosing on the first day — the language, the
 * look, how Discover uses the network, and what plays when the queue runs
 * out. Which of them are shown, and why, is `ui/welcome.ts`'s to say: all of
 * them to a new install and to whoever asked for them again from Settings,
 * and to somebody updating only those added since they last saw any, under a
 * line saying that they are new.
 *
 * Every choice is made where Settings makes it, through the same stores, and
 * takes at once: the theme changes under the finger, and Settings shows it
 * afterwards. The one exception is the language, which is tried as it is
 * picked and kept only once the setup is put away, as it always was: closed
 * before that, the app starts as it would have and asks again.
 *
 * Skipping puts the whole thing away and leaves whatever has not been
 * chosen as it is, which is how the app comes; nothing on these screens has
 * to be answered.
 */
export function Setup() {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const language = useLanguage();
  // Read once, as it opens: finishing changes what the store says, and the screens shown must not change with it.
  const [{ kind, steps }] = useState(welcomeSteps);
  const [at, setAt] = useState(0);
  const heading = useRef<Text>(null);
  const said = t.welcome.setup;
  const step: SetupStep | undefined = steps[at];
  const last = at >= steps.length - 1;

  // The phone's own language, on a new install; asked for again, whatever the app speaks now.
  useEffect(() => {
    if (kind !== 'new') return;
    const found = languageForLocale(deviceLocale(), LANGUAGES.map((entry) => entry.id));
    if (found) tryLanguage(found);
  }, [kind]);

  const finish = () => {
    // Kept only now, and only by whoever was shown the choice: see above.
    if (steps.includes('language')) chooseLanguage(language);
    finishWelcome();
    // Back to where the tour begins: the library, with its offer and its tip.
    if (kind === 'again') router.navigate('/');
  };

  const next = () => (last ? finish() : setAt(at + 1));

  /*
    Back is the screen before. On the first, a new install has nowhere behind
    it to go but out of the app, which is not an answer, and it does nothing;
    anybody else has the app behind it, and it is the same as skipping.
  */
  const back = () => {
    if (at > 0) setAt(at - 1);
    else if (kind !== 'new') finish();
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  });

  /*
    A screen reader is taken to each screen's heading as it comes, which
    says where it is; left where it was, it would be on a button whose
    screen has gone. A moment late, so that the heading is laid out.
  */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus');
    }, 120);
    return () => clearTimeout(timer);
  }, [at]);

  // Nothing to show, which the store should never say: put away at once, rather than a screen with no way past it.
  useEffect(() => {
    if (!step) finishWelcome();
  }, [step]);
  if (!step) return null;

  const title = {
    language: t.welcome.language.heading,
    look: said.look.heading,
    discover: said.discover.heading,
    autoplay: t.settings.autoplay.title,
  }[step];
  const counted = steps.length > 1 ? said.step(at + 1, steps.length) : null;

  return (
    <View
      style={styles.screen}
      accessibilityViewIsModal
      importantForAccessibility="yes">
      {/* Keyed by the screen, so that each starts at its top rather than where the last was scrolled to. */}
      <ScrollView
        key={step}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: 16 },
        ]}>
        <View style={styles.column}>
          <View style={styles.top}>
            <Text style={styles.brand}>Jukebox</Text>
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              accessibilityHint={said.skipHint}
              hitSlop={SKIP_SLOP}
              style={styles.skip}
              onPress={finish}>
              <Text style={styles.skipLabel}>{said.skip}</Text>
            </Pressable>
          </View>
          {counted ? <Text style={styles.counted} importantForAccessibility="no">{counted}</Text> : null}
          {/*
            Somebody updating has chosen a language and has a library, and
            is shown these unasked: said once, over the first, why they are
            here and that nothing has to be decided now.
          */}
          {kind === 'update' && at === 0 ? <Text style={styles.update}>{said.update}</Text> : null}
          <Text
            ref={heading}
            accessibilityRole="header"
            accessibilityLabel={counted ? `${title}, ${counted}` : title}
            style={styles.heading}>
            {title}
          </Text>
          {step === 'language' ? <LanguageStep /> : null}
          {step === 'look' ? <LookStep /> : null}
          {step === 'discover' ? <DiscoverStep /> : null}
          {step === 'autoplay' ? <AutoplayStep /> : null}
        </View>
      </ScrollView>
      {/*
        Under the scroller and not at the end of what is scrolled: ten
        languages with a note under them are taller than a small phone, and
        the one thing everybody has to press was below the fold.
      */}
      <View style={[styles.foot, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.buttons}>
          {at > 0 ? (
            <Pressable
              android_ripple={pressed}
              accessibilityRole="button"
              style={styles.back}
              onPress={back}>
              <Text style={styles.backLabel}>{said.back}</Text>
            </Pressable>
          ) : null}
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            style={styles.button}
            onPress={next}>
            <Text style={styles.buttonLabel}>
              {last ? said.done : step === 'language' ? t.welcome.language.go : said.next}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * Which language the app is to speak.
 *
 * Each language is written in itself, and picking one turns the whole screen
 * into it on the spot, the heading and the button included: somebody who
 * cannot read English finds their own language in the list, and is then
 * asked to go on in it. On a new install the one the phone speaks is picked
 * already, so for most people it is one press.
 */
function LanguageStep() {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const language = useLanguage();
  return (
    <>
      <Text style={styles.note}>{t.welcome.language.note}</Text>
      <View style={styles.card} accessibilityRole="radiogroup">
        {LANGUAGES.map((entry, at) => {
          const on = entry.id === language;
          return (
            <View key={entry.id}>
              {at > 0 ? <View style={styles.rule} /> : null}
              <Pressable
                android_ripple={pressed}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLanguage={entry.id}
                style={styles.option}
                onPress={() => tryLanguage(entry.id as Language)}>
                <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                  {entry.name}
                </Text>
                {on ? <Text style={styles.tick} importantForAccessibility="no">✓</Text> : null}
              </Pressable>
            </View>
          );
        })}
      </View>
      {/*
        Said plainly, in the language just picked: the translations are a
        machine's, and nobody who speaks them has read them yet.
      */}
      <Text style={styles.small}>{t.welcome.language.made}</Text>
    </>
  );
}

/** A handful of themes, each a picture of itself, chosen as they are tapped: the app behind the setup changes too. */
function LookStep() {
  const t = useT();
  const styles = useStyles();
  return (
    <>
      <Text style={styles.note}>{t.welcome.setup.look.note}</Text>
      <View style={styles.pickerCard}>
        <ThemePicker only={SETUP_THEMES} />
      </View>
      <Text style={styles.small}>{t.welcome.setup.look.more}</Text>
    </>
  );
}

/**
 * What Discover is, in a sentence, and the three of its settings that decide
 * what it does with the network unasked: how many songs it fetches ahead,
 * over which connection, and whether a tap plays a preview from Deezer.
 * Discover has no switch of its own: it does nothing until its tab is
 * opened, and with none kept ready it fetches only what is tapped.
 *
 * Changed as the Discover settings screen changes them, the task that runs
 * without a screen included.
 */
function DiscoverStep() {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const settings = useDiscoverSettings();
  const { configure } = useDiscoverActions();
  const [error, setError] = useState('');
  const said = t.discover.settings;

  const change = (patch: Partial<DiscoverSettings>) => {
    setError('');
    configure({ ...settings, ...patch });
    scheduleDiscover().catch(() => setError(said.failed));
  };

  return (
    <>
      <Text style={styles.note}>{t.welcome.setup.discover.note}</Text>
      <View style={styles.card}>
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
        {/* About the songs kept ready and nothing else, so with none kept it is shown, and not live. */}
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
      </View>
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Text style={styles.small}>{t.welcome.setup.discover.more}</Text>
    </>
  );
}

/**
 * What plays when the queue is about to run out, in the words Settings →
 * Player uses for it, each choice with its line: two of them use the network
 * and YouTube, and that is somebody's to know before they choose.
 */
function AutoplayStep() {
  const t = useT();
  const styles = useStyles();
  const mode = useAutoplayMode();
  const said = t.settings.autoplay;
  return (
    <>
      <Text style={styles.note}>{said.note}</Text>
      <View style={styles.card} accessibilityRole="radiogroup">
        {AUTOPLAY_MODES.map((value, at) => (
          <View key={value}>
            {at > 0 ? <View style={styles.rule} /> : null}
            <Choice on={value === mode} label={said[value].label} detail={said[value].note} onPress={() => setAutoplayMode(value)} />
          </View>
        ))}
      </View>
      <Text style={styles.small}>{said.sheetNote}</Text>
    </>
  );
}

/** One of a list of answers, with a line under it, ticked when it is the one. */
function Choice({ on, label, detail, onPress }: { on: boolean; label: string; detail: string; onPress: () => void }) {
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <Pressable
      android_ripple={pressed}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={styles.option}
      onPress={onPress}>
      <View style={styles.optionText}>
        <Text style={[styles.answer, on && styles.labelOn]}>{label}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      {on ? <Text style={styles.tick} importantForAccessibility="no">✓</Text> : null}
    </Pressable>
  );
}

/** The phone's locale, as its engine has it; null where it will not say. */
function deviceLocale(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? null;
  } catch {
    return null;
  }
}

/** Skip is drawn as a word; this much round it still counts. */
const SKIP_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

const useStyles = makeStyles((c) => {
  const row = { paddingHorizontal: 16, paddingVertical: 14, gap: 8 };
  const pill = {
    minHeight: 52,
    borderRadius: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
  };
  return StyleSheet.create({
    screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, ...page(c) },
    content: { flexGrow: 1, paddingHorizontal: 20, alignItems: 'center' },
    foot: { paddingHorizontal: 20, paddingTop: 12, alignItems: 'center' },
    // A phone's width at most: sideways, a list as wide as the screen is hard to read across.
    column: { width: '100%', maxWidth: 480 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 36 },
    brand: { color: c.textFaint, fontSize: 15, fontWeight: '600', letterSpacing: 0.4 },
    skip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center' },
    skipLabel: { color: c.accent, fontSize: 15, fontWeight: '600' },
    counted: { color: c.textFaint, fontSize: 13, marginTop: 10 },
    update: {
      color: c.text,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: c.surface,
      ...outlined(c),
    },
    heading: { color: c.text, fontSize: 28, fontWeight: '600', letterSpacing: -0.4, marginTop: 8 },
    note: { color: c.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 20 },
    card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) },
    pickerCard: { backgroundColor: c.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, ...outlinedClip(c) },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 52,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    optionText: { flex: 1, minWidth: 0, gap: 3 },
    label: { flex: 1, minWidth: 0, color: c.text, fontSize: 16 },
    answer: { color: c.text, fontSize: 16 },
    labelOn: { fontWeight: '600' },
    tick: { color: c.accent, fontSize: 17, fontWeight: '600' },
    row,
    rowOff: { ...row, opacity: 0.45 },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },
    title: { color: c.text, fontSize: 15.5, flexShrink: 1 },
    muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
    small: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginTop: 12, marginHorizontal: 4 },
    error: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 4 },
    buttons: { width: '100%', maxWidth: 480, flexDirection: 'row', gap: 10 },
    back: { ...pill, backgroundColor: c.surfaceRaised, ...outlined(c) },
    backLabel: { color: c.text, fontSize: 16, fontWeight: '600' },
    button: { ...pill, flex: 1, backgroundColor: c.primary, ...outlined(c, c.primary) },
    buttonLabel: { color: c.onPrimary, fontSize: 16, fontWeight: '600' },
  });
});
