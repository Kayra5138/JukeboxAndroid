import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const welcome: Strings['welcome'] = {
  language: {
    heading: 'Scegli la lingua',
    note: 'Puoi cambiarla quando vuoi in Impostazioni.',
    go: 'Continua',
    made:
      'Jukebox è sviluppato da una sola persona. A parte l’inglese, le lingue sono state tradotte da un’IA e non sono ancora state controllate da madrelingua. Se qualcosa suona strano, segnalalo su GitHub.',
  },

  setup: {
    step: (at: number, of: number) =>
      `Passo ${format.number(at)} di ${format.number(of)}`,
    skip: 'Salta',
    skipHint: 'Lascia il resto com’è e apre Jukebox',
    back: 'Indietro',
    next: 'Continua',
    done: 'Fatto',
    update:
      'Alcune impostazioni, nuove in questa versione. Puoi cambiarle quando vuoi in Impostazioni.',
    look: {
      heading: 'Scegli un aspetto',
      note: 'Toccane uno per provarlo.',
      more:
        'Altri temi, e quali due usare quando si segue il sistema, sono in Impostazioni → Aspetto.',
    },
    discover: {
      heading: 'Scopri',
      note:
        'Scopri trova canzoni che non hai ancora, degli artisti della tua libreria e di altri simili, e le scarica da YouTube quando le ascolti.',
      more:
        'La lunghezza della lista, ogni quanto viene rinnovata e altro sono in Impostazioni di Scopri.',
    },
  },

  offer: {
    heading: 'Cercare copertine e dettagli?',
    body: (count) =>
      `${
        count === 1
          ? 'Una delle tue canzoni non è ancora stata cercata.'
          : `${format.number(count)} delle tue canzoni non sono ancora state cercate.`
      } Jukebox può trovarne copertine, artisti e album su MusicBrainz e nel catalogo iTunes di Apple.`,
    privacy:
      'A questi due servizi vengono inviati solo i nomi delle canzoni, nient’altro. La ricerca avviene in background mentre ascolti, e puoi farla anche più tardi da Impostazioni → Libreria → Tag.',
    accept: 'Cerca',
    decline: 'Non ora',
  },

  progress: {
    starting: 'Ricerca di copertine e dettagli…',
    counting: (done, total) =>
      `Ricerca di copertine e dettagli · ${format.number(done)} di ${format.number(total)}`,
    album: (album, done, total) =>
      `Ricerca di «${album}» · ${format.number(done)} di ${format.number(total)}`,
    covers: (done, total) =>
      `Ricerca di copertine · ${format.number(done)} di ${format.number(total)}`,
    lyrics: (done, total) =>
      `Ricerca di testi · ${format.number(done)} di ${format.number(total)}`,
    hint: 'Apre la schermata Tag, dove puoi seguire e interrompere la ricerca',
  },

  tips: {
    library:
      'Tieni premuta una canzone per il suo menu: aggiungila a una lista, modificane i dettagli o suonala come Piano Tiles. Trascina una canzone a destra per riprodurla dopo, o a sinistra per aggiungerla alla coda.',
    player:
      'Sotto i comandi, il pulsante del testo mostra le parole mentre la canzone suona e, quando sono visibili, il pulsante che compare accanto le traduce. L’ingranaggio contiene velocità e tonalità, effetti e timer di spegnimento.',
    discover:
      'Scopri trova canzoni che non hai ancora. Finché non avrai ascoltato per un po’, parte dagli artisti di cui hai più canzoni, e impara da ciò che ascolti.',
    dismiss: 'Ho capito',
    dismissHint: 'Nasconde questo suggerimento per sempre',
  },

  settings: {
    title: 'Primo avvio',
    note:
      'Mostra Jukebox com’era il giorno dell’installazione: le prime impostazioni, la proposta di cercare le copertine e i suggerimenti. La tua musica, le liste e le impostazioni restano come sono.',
    again: 'Rivedi',
  },

  discoverEarly:
    'Con pochi ascolti finora, Scopri parte dagli artisti di cui hai più canzoni, e impara da ciò che ascolti.',
};
