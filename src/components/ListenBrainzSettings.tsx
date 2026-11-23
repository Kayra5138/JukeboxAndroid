import { useCallback, useState } from 'react';
import { LEADING, RADIUS, SPACE, TYPE, TOUCH } from '../lib/theme/measures';
import { Note } from './Note';
import { SwitchRow, Chevron } from './settings/rows';
import { openLink } from '../lib/ui/openLink';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Busy } from './Busy';
import { Text } from './settings/Find';
import { Button } from './Button';
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
import { makeStyles, outlinedClip, useColours, usePressed } from '../lib/theme/index';
import { useBack } from '../lib/ui/back';
import { haptic } from '../lib/ui/haptics';

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
  // Back answers the question no.
  useBack(confirming, () => setConfirming(false));

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
      if (await connectListenBrainz(token)) haptic('results', 'confirm');
      else {
        haptic('results', 'reject');
        setRefused(said.connect.invalid);
      }
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
      haptic('results', 'reject');
      setRefused(said.connect.unreachable);
    }
    setChecking(false);
  };

  const prompt = (
    <TextPrompt
      page
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
                <Note tone="bad">
                  {said.revoked(connection.user)}
                </Note>
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
              {checking ? <Busy color={c.textMuted} /> : <Chevron />}
            </View>
            <Text style={styles.muted}>{checking ? said.connect.checking : said.connect.note}</Text>
            <Text style={styles.muted}>{said.connect.where}</Text>
          </Pressable>
          <View style={styles.rule} />
          <Pressable
            android_ripple={pressed}
            accessibilityRole="link"
            style={styles.row}
            onPress={() => openLink(TOKEN_PAGE)}>
            <Text style={styles.link}>{said.connect.openSite}</Text>
          </Pressable>
        </View>
        {refused ? (
          <Note tone="bad" style={styles.noteBad}>
            {refused}
          </Note>
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
            {running ? <Busy color={c.textMuted} /> : null}
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
            <Note tone="bad">
              {troubleSaid}
            </Note>
          ) : connection.lastSentAt ? (
            <Text style={styles.muted}>{said.lastSent(t.format.dateTime(new Date(connection.lastSentAt)))}</Text>
          ) : null}
        </View>
        <View style={styles.rule} />

        <SwitchRow
          title={said.sending.title}
          hint={said.sending.note}
          value={connection.sending}
          onChange={setSendingListens}
          accessibilityHint={said.sending.hint}
        />
        <View style={styles.rule} />

        <View style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.title}>{said.past.title}</Text>
            {uploading ? (
              <Button size="small" kind="secondary" label={said.past.stop} accessibilityLabel={said.past.stopLabel} onPress={stopPastListens} />
            ) : sendable ? (
              <Button size="small" kind="secondary" label={said.past.start} accessibilityLabel={said.past.startLabel} onPress={sendPastListens} />
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
              <Button size="small" kind="secondary" label={t.common.cancel} onPress={() => setConfirming(false)} />
              <Button
                size="small"
                kind="danger"
                label={said.disconnect.title}
                onPress={() => {
                  setConfirming(false);
                  setRefused(null);
                  disconnectListenBrainz();
                }}
              />
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
                openLink(listensPage(connection.user ?? ''))
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
  The same measures as the cards of Settings, which this sits among.
  Repeated rather than shared because those styles are the pages' own, as the
  Discover card's are; a card that looked nearly like its neighbours would be
  worse than either.
*/
const useStyles = makeStyles((c) => StyleSheet.create({
  section: { marginTop: SPACE.xl },
  heading: {
    color: c.textFaint,
    fontSize: TYPE.label,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: SPACE.s,
    marginLeft: SPACE.xs,
  },
  card: { backgroundColor: c.surface, borderRadius: RADIUS.card, overflow: 'hidden', ...outlinedClip(c) },
  row: { paddingHorizontal: SPACE.l, paddingVertical: SPACE.m, gap: SPACE.xs },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: SPACE.l },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.m, minHeight: TOUCH.row },
  title: { color: c.text, fontSize: TYPE.body, flexShrink: 1 },
  muted: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
  noteBad: { marginTop: SPACE.s, marginLeft: SPACE.xs },
  link: { color: c.accent, fontSize: TYPE.small },
  danger: { color: c.danger, fontSize: TYPE.body },

  answers: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACE.s, marginTop: SPACE.s },
}));
