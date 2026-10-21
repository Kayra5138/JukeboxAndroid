import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, Switch, Text, View } from 'react-native';

import JukeboxAudio from '../../modules/jukebox-audio';
import { Pressable } from '../components/Pressable';
import { SettingsPage, useRows } from '../components/settings/rows';
import { useLanguage, useT } from '../lib/i18n/index';
import { useLibrary } from '../lib/library/useLibrary';
import { detailLines, errorLine, issueLink, phoneLine, reportText, stamp, type ReportFacts } from '../lib/support/report';
import { useErrorEntries } from '../lib/support/errorLogStore';
import { makeStyles, outlined, switchColours, useColours, usePressed, useTheme, useThemeChoice } from '../lib/theme/index';
import { useAnnounce } from '../lib/ui/announce';
import { downloads } from '../lib/youtube/native';

/**
 * Reporting a problem: everything that would go into an issue, in full,
 * before anything is done with it, and two ways of doing something with it.
 *
 * Nothing is sent from here, ever. "Open GitHub" hands the browser a link to
 * a new issue with the form filled in, which the person reads, changes, and
 * sends or does not; "Copy" puts the same text on the clipboard for whoever
 * has no account. What is shown is exactly what goes: the lines on screen
 * are made by the same functions as the link and the copy, in English, for
 * whoever answers.
 *
 * The facts are ones the app already has, and none of them is about the
 * music beyond how much of it there is.
 */
export default function ReportScreen() {
  const t = useT();
  const c = useColours();
  const rows = useRows();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.support.report;

  const language = useLanguage();
  const choice = useThemeChoice();
  const theme = useTheme();
  const library = useLibrary();
  const entries = useErrorEntries();
  const [including, setIncluding] = useState(true);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  useAnnounce(note?.text);

  const built = JukeboxAudio.buildTimestamp ? new Date(JukeboxAudio.buildTimestamp).getTime() : NaN;
  const phone = Platform.OS === 'android' ? Platform.constants : null;
  const facts: ReportFacts = {
    version: Constants.expoConfig?.version ?? null,
    built: Number.isFinite(built) ? stamp(built) : null,
    android: phone?.Release ?? null,
    maker: phone ? phone.Manufacturer || phone.Brand || null : null,
    model: phone?.Model ?? null,
    language,
    theme: choice === 'system' ? `system → ${theme.id}` : choice,
    tracks: library.kind === 'library' ? library.tracks.length : null,
    downloads: downloads != null,
  };
  const errors = including ? entries : null;
  const link = issueLink(facts, errors);
  // The two that go into boxes of their own on the form, and then what goes into the last one.
  const top = [`Version: ${facts.version ?? 'unknown'}`, `Phone: ${phoneLine(facts)}`, ...detailLines(facts)];

  const open = () => {
    setNote(null);
    Linking.openURL(link.url).catch(() => setNote({ text: said.openFailed, bad: true }));
  };
  const copy = () => {
    if (!JukeboxAudio.copyText) {
      setNote({ text: said.copyFailed, bad: true });
      return;
    }
    try {
      JukeboxAudio.copyText(reportText(facts, errors));
      setNote({ text: said.copied, bad: false });
    } catch {
      setNote({ text: said.copyFailed, bad: true });
    }
  };

  return (
    <SettingsPage>
      <Text style={styles.intro}>{said.intro}</Text>

      <Text style={[rows.section, styles.heading]}>{t.format.upper(said.details)}</Text>
      <View style={rows.card}>
        <View style={rows.row}>
          <Text style={styles.code} selectable>
            {top.join('\n')}
          </Text>
        </View>
      </View>
      <Text style={rows.aside}>{said.detailsNote}</Text>

      <View style={[rows.card, styles.gap]}>
        <View style={rows.row}>
          <View style={rows.line}>
            <Text style={rows.title}>{said.errors.title}</Text>
            <Switch
              value={including}
              accessibilityLabel={said.errors.title}
              onValueChange={setIncluding}
              {...switchColours(c, including)}
            />
          </View>
          <Text style={rows.muted}>{said.errors.note}</Text>
        </View>
        <View style={rows.rule} />
        <View style={rows.row}>
          {entries.length ? (
            /*
              Shown whether or not they are to go, so that what is being
              left out can be seen too; faint while it is.
            */
            <Text style={[styles.code, !including && styles.left]} selectable>
              {entries.map(errorLine).join('\n')}
            </Text>
          ) : (
            <Text style={rows.muted}>{said.errors.none}</Text>
          )}
        </View>
      </View>
      {link.left > 0 ? <Text style={rows.aside}>{said.errors.trimmed}</Text> : null}

      <View style={styles.buttons}>
        <Pressable
          android_ripple={pressed}
          accessibilityRole="link"
          accessibilityHint={said.openHint}
          style={styles.primary}
          onPress={open}>
          <Text style={styles.primaryLabel}>{said.open}</Text>
        </Pressable>
        <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.secondary} onPress={copy}>
          <Text style={styles.secondaryLabel}>{said.copy}</Text>
        </Pressable>
      </View>
      <Text style={rows.aside}>{said.copyNote}</Text>
      {note ? (
        <Text accessibilityRole={note.bad ? 'alert' : undefined} style={note.bad ? rows.noteBad : rows.note}>
          {note.text}
        </Text>
      ) : null}
    </SettingsPage>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    intro: { color: c.textSecondary, fontSize: 14, lineHeight: 20, marginLeft: 4, marginBottom: 4 },
    heading: { marginTop: 20 },
    // As it will look in the issue, where it is a block of code: one character to a column.
    code: { color: c.text, fontFamily: 'monospace', fontSize: 12.5, lineHeight: 19 },
    left: { color: c.textFaint },
    gap: { marginTop: 20 },
    // Side by side where they fit, one over the other where a large size of writing makes them too wide.
    buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
    primary: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      ...outlined(c, c.primary),
    },
    primaryLabel: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
    secondary: {
      backgroundColor: c.surfaceRaised,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      ...outlined(c),
    },
    secondaryLabel: { color: c.text, fontSize: 15 },
  })
);
