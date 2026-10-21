import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

/* "Token" is neuter here, as the Duden has it: das Token, es. */
export const listenbrainz: Strings['listenbrainz'] = {
  heading: 'ListenBrainz',

  connect: {
    title: 'ListenBrainz verbinden',
    note:
      'Optional. ListenBrainz kann öffentlich festhalten, was du hörst. Es wird nichts dorthin gesendet, bis du hier dein User-Token einfügst, und auch danach nichts, bis du das Senden einschaltest.',
    where: 'Dein User-Token findest du auf listenbrainz.org in den Einstellungen deines Kontos.',
    openSite: 'listenbrainz.org/settings öffnen',
    promptHeading: 'ListenBrainz-User-Token',
    promptHint:
      'Kopiere es von listenbrainz.org/settings und füge es hier ein. Es bleibt auf diesem Gerät und wird nicht in Backups gespeichert.',
    placeholder: 'User-Token',
    confirm: 'Verbinden',
    checking: 'Token wird geprüft…',
    invalid: 'ListenBrainz erkennt dieses Token nicht. Es wurde nichts gespeichert.',
    unreachable: 'ListenBrainz war nicht erreichbar, daher konnte das Token nicht geprüft werden. Es wurde nichts gespeichert.',
  },

  connectedAs: (user) => `Verbunden als ${user}`,
  revoked: (user) =>
    user
      ? `ListenBrainz akzeptiert das Token für ${user} nicht mehr, daher wird nichts gesendet. Füge ein neues ein, um weiterzumachen. Was noch wartet, bleibt erhalten.`
      : 'ListenBrainz akzeptiert das Token nicht mehr, daher wird nichts gesendet. Füge ein neues ein, um weiterzumachen. Was noch wartet, bleibt erhalten.',
  newToken: 'Neues Token einfügen',
  openListens: 'Deine Wiedergaben auf ListenBrainz ansehen',
  refused: (user, why) =>
    `ListenBrainz kennt das Token${user ? ` für ${user}` : ''}, nimmt dafür aber keine Wiedergaben an${
      why ? `. Die Antwort war: „${why}“` : '.'
    } Es wurde nichts gesendet, und das Token bleibt gespeichert. Sobald das auf ListenBrainz behoben ist, sende erneut.`,

  sending: {
    title: 'Gehörtes senden',
    note:
      'Ab jetzt wird jede Wiedergabe, die die App erfasst – alles über 30 Sekunden –, an dein ListenBrainz-Konto gesendet, mit Titel, Künstler und Album, wie sie hier angezeigt werden.',
    hint: 'Sendet neue Wiedergaben an ListenBrainz',
  },

  waiting: (count) =>
    oneOrMany(count, '1 Wiedergabe wartet auf das Senden', `${format.number(count)} Wiedergaben warten auf das Senden`),
  sendingNow: (count) =>
    oneOrMany(count, 'Wird gesendet · noch 1 Wiedergabe', `Wird gesendet · noch ${format.number(count)} Wiedergaben`),
  lastSent: (when) => `Zuletzt gesendet: ${when}`,
  trouble: {
    offline: 'ListenBrainz war nicht erreichbar. Was wartet, bleibt erhalten und wird später erneut versucht.',
    busy: 'ListenBrainz bittet um weniger Anfragen. Was wartet, bleibt erhalten und wird später erneut versucht.',
    server: 'ListenBrainz hat gerade Probleme. Was wartet, bleibt erhalten und wird später erneut versucht.',
    failed: 'Das Senden hat diesmal nicht geklappt. Was wartet, bleibt erhalten und wird später erneut versucht.',
  },

  past: {
    title: 'Frühere Wiedergaben senden',
    start: 'Senden',
    stop: 'Stopp',
    unsent: (count) =>
      oneOrMany(
        count,
        '1 Wiedergabe in deinem Verlauf wurde noch nicht gesendet. ListenBrainz ordnet sie dem Tag zu, an dem sie gehört wurde.',
        `${format.number(count)} Wiedergaben in deinem Verlauf wurden noch nicht gesendet. ListenBrainz ordnet jede dem Tag zu, an dem sie gehört wurde.`
      ),
    allSent: 'Dein ganzer Verlauf wurde gesendet.',
    nothing: 'Dein Verlauf ist noch leer.',
    progress: (count) =>
      oneOrMany(
        count,
        'Dein Verlauf wird gesendet · noch 1 Wiedergabe.',
        `Dein Verlauf wird gesendet · noch ${format.number(count)} Wiedergaben. Das läuft weiter, solange die App geöffnet ist, und macht dort weiter, wo es aufgehört hat.`
      ),
    leftOut: (count) =>
      oneOrMany(
        count,
        '1 Wiedergabe wurde ausgelassen: Sie hat keinen Künstler, oder ListenBrainz hat sie nicht angenommen. Gib dem Titel einen Künstler und sende erneut.',
        `${format.number(count)} Wiedergaben wurden ausgelassen: Sie haben keinen Künstler, oder ListenBrainz hat sie nicht angenommen. Gib den Titeln einen Künstler und sende erneut.`
      ),
    startLabel: 'Frühere Wiedergaben an ListenBrainz senden',
    stopLabel: 'Senden früherer Wiedergaben stoppen',
  },

  disconnect: {
    title: 'Trennen',
    note: 'Vergisst das Token und welche Wiedergaben gesendet wurden. Was schon auf ListenBrainz ist, wird nicht entfernt.',
    question: (user) => `Verbindung mit ${user} trennen?`,
    consequence:
      'Das Token wird vergessen, ebenso, was noch wartete und was gesendet wurde. Dein Verlauf auf diesem Gerät bleibt unberührt, und auf ListenBrainz wird nichts entfernt.',
  },
};
