import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const listenbrainz: Strings['listenbrainz'] = {
  heading: 'ListenBrainz',

  connect: {
    title: 'Collega ListenBrainz',
    note:
      'Facoltativo. ListenBrainz può tenere un registro pubblico di ciò che ascolti. Non gli viene inviato niente finché non incolli qui il tuo token utente, e niente neanche dopo finché non attivi l’invio.',
    where: 'Il tuo token utente si trova su listenbrainz.org, nelle impostazioni del tuo account.',
    openSite: 'Apri listenbrainz.org/settings',
    promptHeading: 'Token utente di ListenBrainz',
    promptHint:
      'Copialo da listenbrainz.org/settings e incollalo qui. Resta su questo telefono e non viene incluso nei backup.',
    placeholder: 'Token utente',
    confirm: 'Collega',
    checking: 'Verifica del token…',
    invalid: 'ListenBrainz non riconosce questo token. Non è stato salvato niente.',
    unreachable: 'Impossibile raggiungere ListenBrainz, quindi il token non è stato verificato. Non è stato salvato niente.',
  },

  connectedAs: (user) => `Account collegato: ${user}`,
  revoked: (user) =>
    user
      ? `ListenBrainz non accetta più il token di ${user}, quindi non viene inviato niente. Incollane uno nuovo per continuare. Ciò che era in attesa viene conservato.`
      : 'ListenBrainz non accetta più il token, quindi non viene inviato niente. Incollane uno nuovo per continuare. Ciò che era in attesa viene conservato.',
  newToken: 'Incolla un nuovo token',
  openListens: 'Vedi i tuoi ascolti su ListenBrainz',
  refused: (user, why) =>
    `ListenBrainz riconosce il token${user ? ` di ${user}` : ''} ma non ha accettato nessun ascolto${
      why ? `. Ha risposto: «${why}»` : ''
    }. Non è stato inviato niente e il token viene conservato. Quando il problema sarà risolto su ListenBrainz, invia di nuovo.`,

  sending: {
    title: 'Invia ciò che ascolto',
    note:
      'Da ora in poi, ogni ascolto registrato dall’app (qualsiasi cosa oltre i 30 secondi) viene inviato al tuo account ListenBrainz, con il titolo, l’artista e l’album mostrati qui.',
    hint: 'Invia i nuovi ascolti a ListenBrainz',
  },

  waiting: (count) =>
    oneOrMany(count, '1 ascolto in attesa di invio', `${format.number(count)} ascolti in attesa di invio`),
  sendingNow: (count) =>
    oneOrMany(count, 'Invio in corso · manca 1 ascolto', `Invio in corso · mancano ${format.number(count)} ascolti`),
  lastSent: (when) => `Ultimo invio: ${when}`,
  trouble: {
    offline: 'Impossibile raggiungere ListenBrainz. Ciò che è in attesa viene conservato e ritentato più tardi.',
    busy: 'ListenBrainz ha chiesto di ridurre le richieste. Ciò che è in attesa viene conservato e ritentato più tardi.',
    server: 'ListenBrainz ha dei problemi. Ciò che è in attesa viene conservato e ritentato più tardi.',
    failed: 'L’invio non è riuscito questa volta. Ciò che è in attesa viene conservato e ritentato più tardi.',
  },

  past: {
    title: 'Invia gli ascolti passati',
    start: 'Invia',
    stop: 'Ferma',
    unsent: (count) =>
      oneOrMany(
        count,
        '1 ascolto della tua cronologia non è stato inviato. ListenBrainz lo registra nel giorno in cui è stato ascoltato.',
        `${format.number(count)} ascolti della tua cronologia non sono stati inviati. ListenBrainz registra ciascuno nel giorno in cui è stato ascoltato.`
      ),
    allSent: 'Tutta la tua cronologia è stata inviata.',
    nothing: 'La tua cronologia è ancora vuota.',
    progress: (count) =>
      oneOrMany(
        count,
        'Invio della cronologia · manca 1 ascolto.',
        `Invio della cronologia · mancano ${format.number(count)} ascolti. Continua finché l’app è aperta, e riprende da dove si era fermato.`
      ),
    leftOut: (count) =>
      oneOrMany(
        count,
        '1 ascolto è stato escluso: non ha un artista, oppure ListenBrainz non l’ha accettato. Assegna un artista al brano e invia di nuovo.',
        `${format.number(count)} ascolti sono stati esclusi: non hanno un artista, oppure ListenBrainz non li ha accettati. Assegna un artista ai brani e invia di nuovo.`
      ),
    startLabel: 'Invia gli ascolti passati a ListenBrainz',
    stopLabel: 'Interrompi l’invio degli ascolti passati',
  },

  disconnect: {
    title: 'Scollega',
    note: 'Dimentica il token e quali ascolti sono stati inviati. Niente di ciò che è già su ListenBrainz viene rimosso.',
    question: (user) => `Scollegare l’account ${user}?`,
    consequence:
      'Il token viene dimenticato, insieme a ciò che era in attesa e a ciò che è stato inviato. La cronologia su questo telefono non viene toccata, e niente viene rimosso da ListenBrainz.',
  },
};
