import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { Pressable } from './Pressable';

import { TextPrompt } from './TextPrompt';
import { useT } from '../lib/i18n/index';
import {
  connectListenBrainz,
  disconnectListenBrainz,
  refreshScrobbling,
  sendPastListens,
  setSendingListens,
  stopPastListens,
  useScrobbling,
} from '../lib/scrobble/index';
import { makeStyles, outlined, outlinedClip, switchColours, useColours, usePressed } from '../lib/theme/index';

/** Said in words on the card as well, for anybody who would rather type it. */
const TOKEN_PAGE = 'https://listenbrainz.org/settings/';

/** The account's own page of what it has been sent, newest first. */
const listensPage = (user: string) => `https://listenbrainz.org/user/${encodeURIComponent(user)}/`;

/**
 * The ListenBrainz card in Settings.
 *
 * The only place in the app that asks for an account, so it is written to be
 * read by somebody who does not have one and does not want one: what it is,
 * that it is optional, and that nothing goes anywhere until two separate
 * things have been done here -- a token pasted, and sending switched on.
 *
 * The token is typed into the prompt and handed straight on. It is not kept
 * in this component, and once it has been accepted nothing on the card shows
 * it again: what is shown is whose it is, which is the part worth checking.
 */
export function ListenBrainzSettings({
  heading,
}: {
  /** The group this sits under on the page, said before its own name. */
  heading?: string;
} = {}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.listenbrainz;
  // Both, so that under "Experimental" the card still says what it is a card of.
  const titled = heading ? `${heading} · ${said.heading}` : said.heading;
  const state = useScrobbling();

  const [asking, setAsking] = useState(false);
  const [checking, setChecking] = useState(false);
  /** How the last attempt to connect went wrong, in words; null when it did not. */
  const [refused, setRefused] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Read as the screen comes into view and not while drawing: it counts over
  // the history, and what it finds may have changed while this was away.
  useFocusEffect(
    useCallback(() => {
      refreshScrobbling();
    }, [])
  );

  const connect = async (token: string) => {
    setAsking(false);
    setRefused(null);
    setChecking(true);
    try {
      if (!(await connectListenBrainz(token))) setRefused(said.connect.invalid);
    } catch (failure) {
      /*
        What kind of failure, and never the token: the errors raised on the
        way here name the service and a status and nothing else. Said in the
        log because "could not be reached" is shown for anything that goes
        wrong, and was once shown for a token with an invisible character in
        it, which no amount of looking at the network would have explained.
      */
      console.warn(
        'ListenBrainz could not be asked about a token:',
        failure instanceof Error ? `${failure.name}: ${failure.message}` : typeof failure
      );
      setRefused(said.connect.unreachable);
    }
    setChecking(false);
  };

  const prompt = (
    <TextPrompt
      visible={asking}
      heading={said.connect.promptHeading}
      hint={said.connect.promptHint}
      placeholder={said.connect.placeholder}
      confirmLabel={said.connect.confirm}
      // A token is a password in everything but name.
      secret
      onSubmit={(token) => void connect(token)}
      onClose={() => setAsking(false)}
    />
  );

  // Nothing is drawn until the first read has come back, rather than a card
  // that says "not connected" for a frame to somebody who is.
  if (!state) return null;
  const { connection, counts, running } = state;

  if (!connection.connected) {
    const revoked = connection.trouble === 'revoked';
    return (
      <View style={styles.section}>
        <Text style={styles.heading}>{t.format.upper(titled)}</Text>
        <View style={styles.card}>
          {revoked ? (
            <>
              <View style={styles.row}>
                <Text accessibilityRole="alert" style={styles.bad}>
                  {said.revoked(connection.user)}
                </Text>
              </View>
              <View style={styles.rule} />
            </>
          ) : null}
          <Pressable
            android_ripple={pressed}
            accessibilityRole="button"
            accessibilityState={{ busy: checking, disabled: checking }}
            disabled={checking}
            style={styles.row}
            onPress={() => setAsking(true)}>
            <View style={styles.line}>
              <Text style={styles.title}>{revoked ? said.newToken : said.connect.title}</Text>
              {checking ? <ActivityIndicator color={c.textMuted} /> : <Text style={styles.chevron}>›</Text>}
            </View>
            <Text style={styles.muted}>{checking ? said.connect.checking : said.connect.note}</Text>
            <Text style={styles.muted}>{said.connect.where}</Text>
          </Pressable>
          <View style={styles.rule} />
          <Pressable
            android_ripple={pressed}
            accessibilityRole="link"
            style={styles.row}
            onPress={() => void Linking.openURL(TOKEN_PAGE).catch(() => {})}>
            <Text style={styles.link}>{said.connect.openSite}</Text>
          </Pressable>
        </View>
        {refused ? (
          <Text accessibilityRole="alert" style={styles.noteBad}>
            {refused}
          </Text>
        ) : null}
        {prompt}
      </View>
    );
  }

  const waiting = counts.queued + counts.past;
  const trouble = connection.trouble && connection.trouble !== 'revoked' ? connection.trouble : null;
  // The one trouble with words of its own: what the service said goes into it.
  const troubleSaid =
    trouble === 'refused'
      ? said.refused(connection.user, connection.said)
      : trouble
        ? said.trouble[trouble]
        : null;
  const uploading = counts.past > 0;
  // Asking again is also how what was left out gets another go, so the button
  // is there for those even when everything else has been sent.
  const sendable = counts.untouched + counts.skipped > 0;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t.format.upper(titled)}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{said.connectedAs(connection.user ?? '')}</Text>
            {running ? <ActivityIndicator color={c.textMuted} /> : null}
          </View>
          {/*
            Only what there is to say. A queue that is empty and has never
            failed is the ordinary state and gets no line at all.
          */}
          {counts.queued > 0 ? (
            <Text style={styles.muted}>
              {running ? said.sendingNow(counts.queued) : said.waiting(counts.queued)}
            </Text>
          ) : null}
          {trouble && waiting > 0 ? (
            <Text accessibilityRole="alert" style={styles.bad}>
              {troubleSaid}
            </Text>
          ) : connection.lastSentAt ? (
            <Text style={styles.muted}>{said.lastSent(t.format.dateTime(new Date(connection.lastSentAt)))}</Text>
          ) : null}
        </View>
        <View style={styles.rule} />

        <View style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{said.sending.title}</Text>
            <Switch
              accessibilityLabel={said.sending.title}
              accessibilityHint={said.sending.hint}
              value={connection.sending}
              onValueChange={setSendingListens}
              {...switchColours(c, connection.sending)}
            />
          </View>
          <Text style={styles.muted}>{said.sending.note}</Text>
        </View>
        <View style={styles.rule} />

        <View style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{said.past.title}</Text>
            {uploading ? (
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityLabel={said.past.stopLabel}
                hitSlop={8}
                style={styles.action}
                onPress={stopPastListens}>
                <Text style={styles.actionText}>{said.past.stop}</Text>
              </Pressable>
            ) : sendable ? (
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityLabel={said.past.startLabel}
                hitSlop={8}
                style={styles.action}
                onPress={sendPastListens}>
                <Text style={styles.actionText}>{said.past.start}</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.muted}>
            {uploading
              ? said.past.progress(counts.past)
              : counts.untouched > 0
                ? said.past.unsent(counts.untouched)
                : counts.sent > 0
                  ? said.past.allSent
                  : said.past.nothing}
          </Text>
          {counts.skipped > 0 ? <Text style={styles.muted}>{said.past.leftOut(counts.skipped)}</Text> : null}
        </View>
        <View style={styles.rule} />

        {/*
          Asked in place rather than in a dialog over the screen. The question
          is about this card, the answer is two buttons, and what it will do
          is said in full where the row was.
        */}
        {confirming ? (
          <View style={styles.row}>
            <Text style={styles.title}>{said.disconnect.question(connection.user ?? '')}</Text>
            <Text style={styles.muted}>{said.disconnect.consequence}</Text>
            <View style={styles.answers}>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                hitSlop={8}
                style={styles.action}
                onPress={() => setConfirming(false)}>
                <Text style={styles.actionText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable
                android_ripple={pressed}
                accessibilityRole="button"
                hitSlop={8}
                style={[styles.action, styles.actionBad]}
                onPress={() => {
                  setConfirming(false);
                  setRefused(null);
                  disconnectListenBrainz();
                }}>
                <Text style={styles.actionBadText}>{said.disconnect.title}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable android_ripple={pressed} accessibilityRole="button" style={styles.row} onPress={() => setConfirming(true)}>
            <Text style={styles.danger}>{said.disconnect.title}</Text>
            <Text style={styles.muted}>{said.disconnect.note}</Text>
          </Pressable>
        )}
        {/*
          Where what was sent can be seen. The app has no way to show it — it
          only knows what it handed over — and the page that does is the
          account's own, on the service's site.
        */}
        {connection.user ? (
          <>
            <View style={styles.rule} />
            <Pressable
              android_ripple={pressed}
              accessibilityRole="link"
              style={styles.row}
              onPress={() =>
                void Linking.openURL(listensPage(connection.user ?? '')).catch(() => {})
              }>
              <Text style={styles.link}>{said.openListens}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      {prompt}
    </View>
  );
}

/*
  The same measures as the cards in `settings.tsx`, which this sits among.
  Repeated rather than shared because that screen's styles are its own, as the
  Discover card's are; a card that looked nearly like its neighbours would be
  worse than either.
*/
const useStyles = makeStyles((c) => StyleSheet.create({
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
  row: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28 },
  title: { color: c.text, fontSize: 15.5, flexShrink: 1 },
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
  bad: { color: c.danger, fontSize: 12.5, lineHeight: 18 },
  noteBad: { color: c.danger, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginLeft: 4 },
  chevron: { color: c.textDisabled, fontSize: 20, lineHeight: 22 },
  link: { color: c.accent, fontSize: 14 },
  danger: { color: c.danger, fontSize: 15.5 },

  /** A thing to press that belongs to its row, where a chevron would promise another screen. */
  action: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    ...outlined(c),
  },
  actionText: { color: c.textSecondary, fontSize: 13.5, fontWeight: '600' },
  actionBad: { backgroundColor: c.dangerSoft, ...outlined(c, c.danger) },
  actionBadText: { color: c.danger, fontSize: 13.5, fontWeight: '600' },
  answers: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
}));
