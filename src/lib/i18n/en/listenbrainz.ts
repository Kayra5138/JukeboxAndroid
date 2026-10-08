import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/** The ListenBrainz card in Settings: the one thing in the app that needs an account. */
export const listenbrainz = {
  /** The service's own name, which no language changes. */
  heading: 'ListenBrainz',

  connect: {
    title: 'Connect ListenBrainz',
    note:
      'Optional. ListenBrainz can keep a public record of what you listen to. Nothing is sent to it until you paste your user token here, and nothing after that until you switch sending on.',
    where: 'Your user token is on listenbrainz.org, in your account’s settings.',
    openSite: 'Open listenbrainz.org/settings',
    promptHeading: 'ListenBrainz user token',
    promptHint:
      'Copy it from listenbrainz.org/settings and paste it here. It stays on this phone and is left out of backups.',
    placeholder: 'User token',
    confirm: 'Connect',
    checking: 'Checking the token…',
    invalid: 'ListenBrainz does not recognise that token. Nothing was saved.',
    unreachable: 'ListenBrainz could not be reached, so the token could not be checked. Nothing was saved.',
  },

  /** [user] is the account name as ListenBrainz gave it. */
  connectedAs: (user: string) => `Connected as ${user}`,
  revoked: (user: string | null) =>
    user
      ? `ListenBrainz no longer accepts the token for ${user}, so nothing is being sent. Paste a new one to carry on. What was waiting is kept.`
      : 'ListenBrainz no longer accepts the token, so nothing is being sent. Paste a new one to carry on. What was waiting is kept.',
  newToken: 'Paste a new token',
  openListens: 'See your listens on ListenBrainz',
  /**
   * [why] is the service's own sentence, in English as it sent it, or null.
   * The token is fine; it is the account that listens are not taken for.
   */
  refused: (user: string | null, why: string | null) =>
    `ListenBrainz knows the token${user ? ` for ${user}` : ''} but would not take any listens for it${
      why ? `. It said: “${why}”` : '.'
    } Nothing was sent and the token is kept. Once that is put right on ListenBrainz, send again.`,

  sending: {
    title: 'Send what I listen to',
    note:
      'From now on, every listen the app records — anything past 30 seconds — is sent to your ListenBrainz account, under the title, artist and album shown here.',
    hint: 'Sends new listens to ListenBrainz',
  },

  waiting: (count: number) =>
    oneOrMany(count, '1 listen waiting to be sent', `${format.number(count)} listens waiting to be sent`),
  sendingNow: (count: number) =>
    oneOrMany(count, 'Sending · 1 listen to go', `Sending · ${format.number(count)} listens to go`),
  /** [when] is a date and a time of day. */
  lastSent: (when: string) => `Last sent ${when}`,
  trouble: {
    offline: 'ListenBrainz could not be reached. What is waiting is kept and tried again later.',
    busy: 'ListenBrainz asked for fewer requests. What is waiting is kept and tried again later.',
    server: 'ListenBrainz is having trouble. What is waiting is kept and tried again later.',
    failed: 'Sending did not work this time. What is waiting is kept and tried again later.',
  },

  past: {
    title: 'Send past listens',
    start: 'Send',
    stop: 'Stop',
    unsent: (count: number) =>
      oneOrMany(
        count,
        '1 listen in your history has not been sent. ListenBrainz files it under the day it was heard.',
        `${format.number(count)} listens in your history have not been sent. ListenBrainz files each under the day it was heard.`
      ),
    allSent: 'Everything in your history has been sent.',
    nothing: 'There is nothing in your history yet.',
    progress: (count: number) =>
      oneOrMany(
        count,
        'Sending your history · 1 listen to go.',
        `Sending your history · ${format.number(count)} listens to go. It carries on while the app is open, and picks up where it left off.`
      ),
    leftOut: (count: number) =>
      oneOrMany(
        count,
        '1 listen was left out: it has no artist, or ListenBrainz would not take it. Give the track an artist and send again.',
        `${format.number(count)} listens were left out: they have no artist, or ListenBrainz would not take them. Give the tracks an artist and send again.`
      ),
    startLabel: 'Send past listens to ListenBrainz',
    stopLabel: 'Stop sending past listens',
  },

  disconnect: {
    title: 'Disconnect',
    note: 'Forgets the token and which listens were sent. Nothing already on ListenBrainz is removed.',
    question: (user: string) => `Disconnect from ${user}?`,
    consequence:
      'The token is forgotten, and so is what was waiting and what was sent. Your history on this phone is not touched, and nothing on ListenBrainz is removed.',
  },
};
