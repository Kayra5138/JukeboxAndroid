import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, usePressed } from '../lib/theme/index';

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
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('A screen could not be drawn', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return <Fallen error={error} onRetry={() => this.setState({ error: null })} />;
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
function Fallen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();

  return (
    <View style={styles.screen}>
      <Text style={styles.body}>{t.common.drawFailed}</Text>
      {/* Whatever was thrown, as it was thrown: it is for reading out to
          somebody who can do something about it, not for the user. */}
      <Text style={styles.muted} numberOfLines={6}>
        {error.message}
      </Text>
      <Pressable android_ripple={pressed} style={styles.button} accessibilityRole="button" onPress={onRetry}>
        <Text style={styles.buttonLabel}>{t.common.tryAgain}</Text>
      </Pressable>
    </View>
  );
}

// The library's own "could not load" screen, so the two failures look alike.
const useStyles = makeStyles((c) => StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: c.bg,
  },
  body: { color: c.text, fontSize: 16, textAlign: 'center' },
  muted: { color: c.textMuted, fontSize: 14, textAlign: 'center' },
  button: { backgroundColor: c.surfaceRaised, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, ...outlined(c) },
  buttonLabel: { color: c.text, fontSize: 15 },
}));
