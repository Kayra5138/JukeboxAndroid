import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

const n = format.number;

export const downloads: Strings['downloads'] = {
  short: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `In pausa · ${n(waiting)} in attesa` : 'In pausa';
    if (underWay > 0 && waiting > 0) return `${n(underWay)} in download, ${n(waiting)} in attesa`;
    if (underWay > 0) return `${n(underWay)} in download`;
    return waiting > 0 ? `${n(waiting)} in attesa` : '';
  },
  state: (underWay, waiting, paused) => {
    if (paused) return waiting > 0 ? `In pausa, ${n(waiting)} in attesa` : 'In pausa';
    if (underWay > 0 && waiting > 0) return `Download di ${n(underWay)} in corso, ${n(waiting)} in attesa`;
    if (underWay > 0) return `Download di ${n(underWay)} in corso`;
    return waiting > 0 ? `${n(waiting)} in attesa` : 'Nessun download in corso';
  },
  pausedNote: 'Non viene avviato niente di nuovo finché non riprendi. Ciò che è già in download viene completato.',
  automaticNote: (count) =>
    count === 1
      ? 'Un download è automatico: l’ha chiesto Scopri. Attende che non ci sia nient’altro in download.'
      : `${n(count)} download sono automatici: li ha chiesti Scopri. Attendono che non ci sia nient’altro in download.`,

  pause: 'Pausa',
  resume: 'Riprendi',
  cancelAll: 'Annulla tutto',
  cancelAllQuestion: 'Annullare tutti i download?',
  cancelAllHint: 'Tutto ciò che è in attesa o in download viene annullato. Ciò che è già nella tua libreria resta.',
  keep: 'Non annullare',

  sections: { now: 'In corso', next: 'In coda', history: 'Cronologia' },
  clear: 'Svuota',
  clearLabel: 'Svuota la cronologia dei download',

  source: {
    discover: 'Scopri',
    search: 'Cerca',
    album: (name) => `Album: ${name}`,
    playlist: (name) => `Playlist: ${name}`,
  },
  automatic: 'Automatico · attende gli altri',
  retrying: (why) => (why ? `Nuovo tentativo · ${why}` : 'Nuovo tentativo'),

  doNext: 'Scarica per primo',
  doNextLabel: (title) => `Scarica ${title} per primo`,
  cancelLabel: (title) => `Annulla ${title}`,
  retryLabel: (title) => `Riprova ${title}`,
  moveUp: 'Sposta su',
  moveDown: 'Sposta giù',

  empty: {
    heading: 'Ancora nessun download',
    body: 'Ciò che scarichi da Cerca, da Scopri o per completare un album viene elencato qui, insieme a ciò che attende il suo turno.',
  },
  unavailable: 'Installa una nuova versione Android per scaricare musica.',
  readFailed: 'Impossibile leggere i download.',

  extractor: {
    heading: 'Downloader di YouTube',
    version: (version) => `yt-dlp ${version}`,
    current: 'Aggiornato',
    available: (version) => `È disponibile la versione ${version}`,
    unchecked: 'Non è ancora stata cercata una versione più recente',
    checked: (days) =>
      days === 0 ? 'controllato oggi' : days === 1 ? 'controllato ieri' : `controllato ${n(days)} giorni fa`,
    check: 'Cerca aggiornamenti',
    checking: 'Controllo…',
    update: 'Aggiorna',
    waiting: 'In attesa che finisca il download in corso…',
    downloading: (version, percent) => `Download della versione ${version} · ${n(percent)}%`,
    trying: 'Prova della nuova versione…',
    restoring: 'Ripristino della versione fornita con Jukebox…',
    updated: (version) => `Ora alla versione ${version}. I download non riusciti si possono riprovare.`,
    restore: (version) => `Torna alla versione ${version}, fornita con Jukebox`,
    checkFailed: 'Impossibile cercare aggiornamenti.',
    trouble: {
      network: 'Impossibile raggiungere GitHub. Controlla la connessione e riprova.',
      answer: 'GitHub non ha risposto con una release. Riprova più tardi.',
      checksum: 'Il file arrivato non è quello indicato dalla release. Non è stato modificato niente.',
      broken: 'La nuova versione non funziona su questo telefono. Quella che avevi è ancora al suo posto.',
      failed: 'Impossibile aggiornare. La versione che avevi è ancora al suo posto.',
    },
    rowUpdate: 'Aggiorna',
    rowCheck: 'Controlla',
    rowUpdateLabel: (title) => `Aggiorna il downloader di YouTube per riprovare ${title}`,
    rowCheckLabel: (title) => `Cerca un downloader di YouTube più recente per riprovare ${title}`,
  },

  button: {
    label: (state) => (state ? `Download: ${state}` : 'Download'),
    finished: 'completati',
    heading: 'Download',
    idle: 'Nessun download in corso',
    paused: 'In pausa',
    allDone: 'Tutti completati',
    waiting: (count) => `${n(count)} in attesa`,
    done: (count) => `${n(count)} ${count === 1 ? 'completato' : 'completati'}`,
    failed: (count) => `${n(count)} ${count === 1 ? 'non riuscito' : 'non riusciti'}`,
    open: 'Apri i download',
  },
};
