import Constants from 'expo-constants';
import { LEADING, SPACE, TYPE } from '../../../lib/theme/measures';
import { Note } from '../../../components/Note';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import JukeboxAudio from '../../../../modules/jukebox-audio';
import { SettingsPage, useRows, SwitchRow } from '../../../components/settings/rows';
import { useLanguage, useT } from '../../../lib/i18n/index';
import { useLibrary } from '../../../lib/library/useLibrary';
import { detailLines, errorLine, issueLink, phoneLine, reportText, stamp, type ReportFacts } from '../../../lib/support/report';
import { useErrorEntries } from '../../../lib/support/errorLogStore';
import { makeStyles, useTheme, useThemeChoice } from '../../../lib/theme/index';
import { useAnnounce } from '../../../lib/ui/announce';
import { haptic } from '../../../lib/ui/haptics';
import { downloads } from '../../../lib/youtube/native';
import { Button } from '../../../components/Button';

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
  const rows = useRows();
  const styles = useStyles();
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
      haptic('results', 'confirm');
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
        <SwitchRow
          title={said.errors.title}
          hint={said.errors.note}
          value={including}
          onChange={setIncluding}
        />
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
        <Button kind="primary" wide label={said.open} accessibilityHint={said.openHint} onPress={open} />
        <Button kind="secondary" wide label={said.copy} onPress={copy} />
      </View>
      <Text style={rows.aside}>{said.copyNote}</Text>
      {note ? (
        <Note tone={note.bad ? 'bad' : 'good'} style={rows.noteRoom}>
          {note.text}
        </Note>
      ) : null}
    </SettingsPage>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    intro: { color: c.textSecondary, fontSize: TYPE.small, lineHeight: LEADING.small, marginLeft: SPACE.xs, marginBottom: SPACE.xs },
    heading: { marginTop: SPACE.l },
    // As it will look in the issue, where it is a block of code: one character to a column.
    code: { color: c.text, fontFamily: 'monospace', fontSize: TYPE.hint, lineHeight: LEADING.hint },
    left: { color: c.textFaint },
    gap: { marginTop: SPACE.xl },
    // Side by side where they fit, one over the other where a large size of writing makes them too wide.
    buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s, marginTop: SPACE.l },
  })
);
