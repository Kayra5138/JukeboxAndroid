import type { Strings } from '../en/index.ts';

export const support: Strings['support'] = {
  report: {
    row: {
      title: 'Segnala un problema',
      note: 'Apre una segnalazione su GitHub con i dettagli già compilati. Non viene inviato nulla finché non sei tu a inviarla.',
    },
    title: 'Segnala un problema',
    intro:
      'Da questa schermata non esce nulla dal tuo telefono. «Apri GitHub» crea una nuova segnalazione con il testo qui sotto già inserito; lì puoi leggerlo e modificarlo, e viene inviata solo se la invii tu.',
    details: 'Cosa va nella segnalazione',
    detailsNote: 'La versione e il telefono vanno nei rispettivi campi del modulo, il resto nell’ultimo. Le tue canzoni non vengono mai nominate.',
    errors: {
      title: 'Includi gli errori recenti',
      note:
        'Problemi rilevati da Jukebox in automatico, come un download o una ricerca non riusciti. Nomi delle canzoni, indirizzi e percorsi dei file sono stati rimossi prima del salvataggio.',
      none: 'Nessun errore registrato.',
      trimmed: 'Gli errori più vecchi restano fuori dal link perché sia abbastanza corto da aprirsi. «Copia» li include tutti.',
    },
    open: 'Apri GitHub',
    openHint: 'Apre nel browser una nuova segnalazione, compilata e non ancora inviata',
    copy: 'Copia',
    copyNote: 'Non hai un account GitHub? «Copia» mette lo stesso testo negli appunti, da incollare in una segnalazione o in un messaggio.',
    copied: 'Copiato',
    openFailed: 'Non è stato possibile aprire il link. Copia il testo e incollalo in una segnalazione.',
    copyFailed: 'Questa versione dell’app non può usare gli appunti. Seleziona il testo qui sopra e copialo a mano.',
  },

  update: {
    available: (version) => `È disponibile Jukebox ${version}`,
    note: 'Se l’hai installata con Obtainium, ti proporrà l’aggiornamento lì. Altrimenti tocca qui per aprire la pagina della versione e scaricarla.',
    hint: 'Apre la pagina della versione nel browser',
    tab: (settings) => `${settings}, è disponibile un aggiornamento`,
    heading: 'Aggiornamenti',
    check: {
      title: 'Cerca una nuova versione di Jukebox',
      note: 'Al massimo una volta al giorno, quando apri l’app, Jukebox chiede a GitHub qual è l’ultima versione. Non viene inviato nulla su di te o sulla tua libreria, e non viene scaricato nulla.',
    },
  },
};
