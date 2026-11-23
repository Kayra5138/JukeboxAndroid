import Constants from 'expo-constants';
import { SPACE, TYPE } from '../lib/theme/measures';
import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';

import JukeboxAudio from '../../modules/jukebox-audio';
import { useLanguage, useT } from '../lib/i18n/index';
import { crashText, stamp, type Crash, type ReportFacts } from '../lib/support/report';
import { noteError, useErrorEntries } from '../lib/support/errorLogStore';
import { downloads } from '../lib/youtube/native';
import { makeStyles, page, useTheme, useThemeChoice } from '../lib/theme/index';

/**
 * Somewhere for a screen that threw while drawing to land.
 *
 * Without one React takes down everything it was drawing, and what is left is
 * the window's own background: a white screen with nothing on it and no way
 * out but closing the app. Music carries on underneath, because the player is
 * a service of its own, which makes it look more like a hang than a fault.
 *
 * A class because catching a render is still something only a class can do.
 *
 * Trying again draws the same tree from the top. Whatever threw may well throw
 * again — the message is left on screen so it can at least be read out to
 * somebody — but a good many faults belong to one moment's state, and those do
 * not survive being started over.
 */
type Fall = { error: Error | null; at: number; where: string | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, Fall> {
  state: Fall = { error: null, at: 0, where: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)), at: Date.now() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('A screen could not be drawn', error, info.componentStack);
    // For the report screen, scrubbed: see `support/errorLog.ts`.
    noteError('render', error);
    // Which components it was in, for the copy: React says it only here.
    this.setState({ where: info.componentStack ?? null });
  }

  render() {
    const { error, at, where } = this.state;
    if (!error) return this.props.children;

    const crash: Crash = {
      at,
      name: error.name,
      message: error.message,
      stack: typeof error.stack === 'string' ? error.stack : null,
      componentStack: where,
    };
    return <Fallen error={error} crash={crash} onRetry={() => this.setState({ error: null, where: null })} />;
  }
}

/**
 * What is shown in place of the screen that threw.
 *
 * A component of its own because the words and the colours are asked for with
 * hooks, and a class has none. Both are held outside React rather than in a
 * provider, so they can still be asked for out here, above every provider
 * there is.
 */
function Fallen({ error, crash, onRetry }: { error: Error; crash: Crash; onRetry: () => void }) {
  const t = useT();
  const styles = useStyles();
  const language = useLanguage();
  const choice = useThemeChoice();
  const theme = useTheme();
  const errors = useErrorEntries();
  const [copiedNow, setCopied] = useState<boolean | null>(null);

  /*
    Everything there is to know of it, onto the clipboard, for sending to
    whoever can look into it: what was thrown and where, which components it
    was in, the version, the build, the phone, and the errors before it. The
    same facts the report screen gathers, which cannot be reached from here.
  */
  const copy = () => {
    const text = crashText(factsNow(language, choice === 'system' ? `system → ${theme.id}` : choice), crash, errors);
    setCopied(copied(text));
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.body}>{t.common.drawFailed}</Text>
      {/* Whatever was thrown, as it was thrown: it is for reading out to
          somebody who can do something about it, not for the user. */}
      <Text style={styles.muted} numberOfLines={6}>
        {error.message}
      </Text>
      <Button kind="secondary" label={t.common.tryAgain} onPress={onRetry} />
      <Button kind="secondary" label={t.common.drawFailedCopy} onPress={copy} />
      {copiedNow != null ? (
        <Text style={styles.muted} accessibilityLiveRegion="polite">
          {copiedNow ? t.common.drawFailedCopied : t.common.drawFailedNotCopied}
        </Text>
      ) : null}
    </View>
  );
}

/** [text] onto the clipboard, answering whether it went. */
function copied(text: string): boolean {
  if (!JukeboxAudio.copyText) return false;
  try {
    JukeboxAudio.copyText(text);
    return true;
  } catch {
    return false;
  }
}

/** The facts the report screen gathers, gathered here: that screen cannot be reached from this one. */
function factsNow(language: string, theme: string): ReportFacts {
  const built = JukeboxAudio.buildTimestamp ? new Date(JukeboxAudio.buildTimestamp).getTime() : NaN;
  const phone = Platform.OS === 'android' ? Platform.constants : null;
  return {
    version: Constants.expoConfig?.version ?? null,
    built: Number.isFinite(built) ? stamp(built) : null,
    android: phone?.Release ?? null,
    maker: phone ? phone.Manufacturer || phone.Brand || null : null,
    model: phone?.Model ?? null,
    language,
    theme,
    tracks: null,
    downloads: downloads != null,
  };
}

// The library's own "could not load" screen, so the two failures look alike.
const useStyles = makeStyles((c) => StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.l,
    padding: SPACE.xl,
    ...page(c),
  },
  body: { color: c.text, fontSize: TYPE.heading, textAlign: 'center' },
  muted: { color: c.textMuted, fontSize: TYPE.small, textAlign: 'center' },
}));
