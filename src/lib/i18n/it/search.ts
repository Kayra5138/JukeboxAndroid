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
  openPlaylistLabel: (title) => `Apri la playlist ${title}`,
  downloadLabel: (title) => `Scarica ${title}`,
  download: { mp3: 'Scarica MP3', original: 'Scarica audio' },
  adding: 'Aggiunta…',

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
