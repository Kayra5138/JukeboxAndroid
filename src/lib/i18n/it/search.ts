import { format } from './format.ts';
import { oneOrMany } from '../write.ts';
import type { Strings } from '../en/index.ts';

export const search: Strings['search'] = {
  modes: {
    discover: 'Scopri',
    download: 'Scarica',
    videos: 'Video',
    playlists: 'Playlist',
  },

  tapes: {
    intro:
      'Audiolibri, podcast, conferenze e registrazioni lunghe da YouTube, scaricati nella cartella Tapes della tua libreria e ripresi da dove li hai lasciati. Cerca, o incolla il link di un video o di una playlist, o quello di un canale per seguirlo.',
    placeholder: { videos: 'Titolo, programma o link YouTube', playlist: 'Libro, serie o link della playlist' },
    empty: { videos: 'Cerca un libro, un programma, una conferenza o una lezione.', playlist: 'Cerca una playlist da scaricare come un’unica cassetta: un libro in parti o una stagione di un programma.' },
    download: 'Scarica come cassetta',
    downloadBook: (count) => `Scarica tutti i ${format.number(count)} come un’unica cassetta`,
    bookHint: 'Finiscono in una cartella con il nome della lista, numerati nel suo ordine, e si susseguono.',
    added: (name) => `In arrivo in Tapes/${name}`,
    sources: { youtube: 'YouTube', podcasts: 'Segui', books: 'Libri', files: 'Telefono' },
    /** Books from the Internet Archive: see `books/archive.ts`, `BooksPane` and the book screen. */
    /** Files on the phone brought into the Tapes folder: see `FilesPane`. */
    files: {
      intro: 'Libri, registrazioni e conferenze già sul telefono, copiati in una cartella delle tue cassette. I file scelti restano dove sono.',
      choose: 'Scegli file',
      chooseOther: 'Scegli altri file',
      folder: 'Nome della cartella',
      folderPlaceholder: 'Come si chiama il libro o la registrazione',
      folderNote: 'Vanno nella cartella Cassette della tua libreria con questo nome, nell’ordine dei loro numeri.',
      copy: (count) => oneOrMany(count, 'Copia nelle cassette', `Copia ${format.number(count)} file nelle cassette`),
      chosen: (count) => oneOrMany(count, '1 file scelto', `${format.number(count)} file scelti`),
      copied: (done, of) => done === of ? oneOrMany(done, 'Copiato nelle tue cassette.', `${format.number(done)} file copiati nelle tue cassette.`) : `Copiati ${format.number(done)} file su ${format.number(of)}; gli altri non si potevano leggere.`,
      failed: 'Nessun file è stato copiato.',
      pickFailed: 'Impossibile scegliere i file.',
      toTapes: 'Vai alle cassette',
    },
    books: {
      intro: 'Libri di pubblico dominio letti ad alta voce dai volontari di LibriVox e conservati gratis nell’Internet Archive. Cerca per titolo o autore, o incolla l’indirizzo di qualcosa da ascoltare su archive.org.',
      placeholder: 'Titolo, autore o link archive.org',
      nothingFound: 'Nessun libro trovato.',
      searchFailed: 'Impossibile cercare nell’Internet Archive.',
      anyLanguage: 'Tutte le lingue',
      popular: 'I più ascoltati',
      bookFailed: 'Impossibile leggere questo libro dall’Internet Archive.',
      stats: (parts, minutes, here) => `${oneOrMany(parts, '1 parte', `${format.number(parts)} parti`)} · ${minutes >= 60 ? `${format.number(Math.floor(minutes / 60))} h ${format.number(minutes % 60)} min` : `${format.number(minutes)} min`}${here > 0 ? ` · ${format.number(here)} sul telefono` : ''}`,
      fetchAll: 'Scarica tutto il libro',
      fetchRest: (count) => oneOrMany(count, 'Scarica l’ultima parte', `Scarica le altre ${format.number(count)} parti`),
      size: (mb) => `Circa ${format.number(mb)} MB in tutto`,
      parts: (count) => oneOrMany(count, '1 parte', `${format.number(count)} parti`),
    },
    podcasts: {
      intro: 'Segui un podcast o un canale YouTube e i nuovi episodi arrivano da soli nelle tue cassette, oppure aprilo e scarica solo gli episodi che vuoi. Cerca, o incolla l’indirizzo di un feed o di un canale.',
      /** Under the button on a show not followed: that its episodes can be had without following it. */
      withoutFollowing: 'Non serve seguirlo per ascoltare: scarica qui sotto l’episodio che vuoi. Se lo segui, i nuovi arrivano da soli.',
      /** Where podcasts can be had from: said under the intro. */
      /** The title of a followed or followable show's own screen, a podcast or a YouTube channel. */
      showTitle: 'Programma',
      sources: 'Da dove: ogni programma della directory dei podcast di Apple, che ha quasi tutti i podcast con un feed pubblico, compresi gran parte di quelli su Spotify; qualunque indirizzo di feed, da Anchor, Buzzsprout, Libsyn, Podbean, SoundCloud e altri; e i canali YouTube.',
      placeholder: 'Nome del podcast o del canale, o un link',
      searchFailed: 'Impossibile cercare podcast. Controlla la connessione.',
      feedFailed: 'Impossibile leggere il feed di questo podcast.',
      notChannel: 'Non è l’indirizzo di un canale YouTube, oppure il canale non è stato trovato.',
      channelsHeading: 'Canali YouTube',
      podcastsHeading: 'Podcast',
      subscribers: (count) => oneOrMany(count, '1 iscritto', `${format.number(count)} iscritti`),
      channelsFailed: 'Impossibile cercare canali su YouTube.',
      nothingFound: 'Nessun podcast trovato.',
      yours: 'I tuoi podcast',
      noneYet: 'Non segui ancora nessun podcast.',
      wifiOnly: 'Nuovi episodi solo con Wi‑Fi',
      wifiOnlyNote: 'Gli episodi dei podcast che segui si scaricano da soli solo con il Wi‑Fi. Puoi comunque scaricare a mano qualsiasi episodio.',
      follow: 'Segui',
      following: 'Seguito',
      unfollow: 'Smetti di seguire',
      autoDownload: 'Scarica gli episodi più recenti',
      autoDownloadNote: (keep) => oneOrMany(keep, 'L’episodio più recente resta scaricato.', `I ${format.number(keep)} episodi più recenti restano scaricati.`),
      keep: (count) => format.number(count),
      episodes: (count) => `Episodi · ${format.number(count)}`,
      noEpisodes: 'Questo feed non ha episodi con un file.',
      download: 'Scarica',
      continue: 'Riprendi',
      start: 'Inizia',
      more: 'Altro',
      less: 'Meno',
      stats: (total, here) => `${format.number(total)} ${oneOrMany(total, 'episodio', 'episodi')} · ${format.number(here)} sul telefono`,
      play: 'Riproduci',
      /** The episodes shown by when they came out: see `podcasts/when.ts`. */
      when: { label: 'Periodo', all: 'Tutti', week: 'Ultima settimana', month: 'Ultimo mese', quarter: 'Ultimi 3 mesi' },
      newest: 'Prima i più recenti',
      oldest: 'Prima i più vecchi',
      noneThen: 'Nessun episodio di questo periodo.',
      fetchNext: 'Scarica gli episodi successivi',
      fetchNextNote: (count) =>
        oneOrMany(count, 'Mentre ascolti un episodio vecchio, viene scaricato quello dopo, così è pronto quando questo finisce.', `Mentre ascolti un episodio vecchio, vengono scaricati i ${format.number(count)} successivi, così il prossimo è pronto alla fine di ciascuno.`),
      line: (date, length) => [date, length].filter(Boolean).join(' · '),
    },
  },
  unavailable: {
    heading: 'YouTube richiede una nuova versione dell’app',
    body: 'Installa la versione Android aggiornata per cercare e scaricare musica. La tua libreria è ancora disponibile.',
    downloads: 'Installa una nuova versione Android per attivare i download da YouTube.',
  },

  intro: {
    videos: 'Cerca su YouTube o incolla il link di un video. Salva l’audio nella tua libreria.',
    playlist:
      'Cerca una playlist o incolla il suo link di YouTube. Apri un risultato per vedere in anteprima e scaricare i suoi brani. Vengono controllati i primi 500 elementi della playlist.',
  },
  inputLabel: {
    videos: 'Cerca su YouTube o incolla il link di un video',
    playlist: 'Nome della playlist o link di YouTube',
  },
  placeholder: {
    videos: 'Canzone, artista o link di YouTube',
    playlist: 'Nome della playlist o link di YouTube',
  },

  formats: { mp3: 'MP3', original: 'Audio originale' },
  formatHint: {
    mp3: 'Convertito in MP3 dopo il download.',
    original: 'Mantiene il codec audio di origine quando possibile.',
  },

  searching: 'Ricerca su YouTube…',
  results: (count) => `Risultati · ${format.number(count)}`,
  empty: {
    none: 'Nessun risultato. Prova un’altra ricerca o un altro link.',
    videos: 'Cerca per canzone e artista per trovare la registrazione che vuoi.',
    playlist: 'Cerca per nome della playlist o incolla il link di una playlist.',
  },

  playlist: 'Playlist',
  openPlaylist: 'Apri playlist',
  backToResults: 'Torna ai risultati',
  openPlaylistLabel: (title) => `Apri la playlist ${title}`,
  downloadLabel: (title) => `Scarica ${title}`,
  download: { mp3: 'Scarica MP3', original: 'Scarica audio' },
  adding: 'Aggiunta…',
  listen: 'Ascolta',
  listenLabel: (title) => `Ascolta ${title} senza tenerlo`,
  readying: 'Preparazione…',
  listenDrop: 'Non tenere',

  addingPlaylist: 'Aggiunta della playlist…',
  downloadListed: {
    mp3: 'Scarica i brani elencati · MP3',
    original: 'Scarica i brani elencati · Audio originale',
  },
  listedHint:
    'I brani già scaricati o in coda vengono saltati. I video privati, eliminati e le dirette potrebbero non essere disponibili.',
  listCreated: (name) => `Lista creata: ${name}. I brani scaricati compariranno in Liste.`,
  inLibrary: 'Nella tua libreria',
  alreadyHave: (count) =>
    oneOrMany(count, '1 brano era già nella tua libreria e non è stato scaricato di nuovo.', `${format.number(count)} brani erano già nella tua libreria e non sono stati scaricati di nuovo.`),
  unnamedPlaylist: 'Playlist di YouTube',

  jobLine: (status, mp3) => `${status} · ${mp3 ? 'MP3' : 'Originale'}`,

  status: {
    finding: 'Ricerca su YouTube',
    queued: 'In coda',
    preparing: 'Preparazione…',
    downloading: (percent) => `Download · ${percent}%`,
    converting: 'Conversione audio…',
    saving: 'Aggiunta alla libreria…',
    cancelling: 'Annullamento…',
    cancelled: 'Annullato',
    failed: 'Download non riuscito',
    done: 'Nella libreria',
    listened: 'Pronto, non tenuto',
    missing: 'File rimosso',
  },

  failed: {
    search: 'Ricerca non riuscita. Riprova.',
    queue: 'Impossibile mettere in coda il download.',
    queuePlaylist: 'Impossibile mettere in coda la playlist.',
    cancel: 'Impossibile annullare il download.',
    read: 'Impossibile leggere i download.',
    readReopen: 'Impossibile leggere i download. Riapri Cerca.',
  },

  errors: {
    playlistLink: 'Incolla il link di una playlist di YouTube o cerca per nome della playlist.',
    videoLink: 'Inserisci il nome di una canzone o un link valido a un video di YouTube.',
    queueFull: 'La coda dei download è piena. Attendi che alcuni brani finiscano, poi riprova.',
    update: 'YouTube è cambiato e il downloader di questa versione non riesce ancora a leggerlo. Cerca una versione più recente in Download o aggiorna Jukebox.',
    unavailable: 'Questo video o questa playlist non è disponibile. Prova un’altra playlist pubblica o un’altra ricerca.',
    unreachable: 'Impossibile raggiungere YouTube. Controlla la connessione e riprova.',
    refused: 'YouTube non è riuscito a completare la richiesta. Riprova più tardi o scegli un altro risultato.',
  },
};
