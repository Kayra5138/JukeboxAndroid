import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const library: Strings['library'] = {
  views: {
    tracks: 'Brani',
    albums: 'Album',
    artists: 'Artisti',
    folders: 'Cartelle',
  },

  nothingMatches: (query) => `Nessun risultato per «${query}».`,
  noAlbums:
    'Ancora nessun album. Un album compare solo dopo che sono state cercate le informazioni dei suoi brani: la cartella in cui si trova un file non è un album.',
  back: '‹ Indietro',
  trackMenu: 'Opzioni brano',
  albumMenu: 'Opzioni album',

  screen: {
    viewSwitch: 'Vista della libreria',
    searchHints: {
      tracks: 'Cerca titoli, artisti e tag',
      albums: 'Cerca titoli, artisti e tag',
      artists: 'Cerca artisti',
      folders: 'Cerca cartelle',
    },
    /* The order has to fit a button 56 points wide: kept to seven letters at most. */
    sort: 'Ordine',
    sortShort: { name: 'A–Z', added: 'Nuovi', played: 'Ascolti' },
    sortedBy: {
      name: 'Ordinati per nome',
      added: 'Ordinati per data di aggiunta',
      played: 'Ordinati per ultimo ascolto',
    },
    sortHint: 'Cambia l’ordine della libreria',
    groupSortShort: { name: 'A–Z', tracks: 'Brani', played: 'Ascolti', added: 'Nuovi' },
    groupSortedBy: {
      name: 'Ordinati per nome',
      tracks: 'Ordinati per numero di brani',
      played: 'Ordinati per quanto vengono ascoltati',
      added: 'Ordinati per aggiunte più recenti',
    },

    selectTracks: 'Seleziona brani',
    stopSelecting: 'Termina selezione',
    selected: (count) =>
      oneOrMany(count, '1 brano selezionato', `${format.number(count)} brani selezionati`),
    addToList: 'Aggiungi a lista',
    addTag: 'Aggiungi tag',
    writeToFiles: 'Scrivi nei file',
    writeToFilesSpoken: 'Scrivi i dettagli dei brani selezionati nei rispettivi file',

    swipePlayNext: 'Riproduci dopo',
    swipeQueue: 'Accoda',
    queuedAll: (count) =>
      oneOrMany(count, '1 brano aggiunto alla coda', `${format.number(count)} brani aggiunti alla coda`),

    needsAccess: 'Jukebox ha bisogno di accedere all’audio su questo dispositivo.',
    nothingIn: (folder) => `Niente in ${folder}.`,
    shuffleAll: 'Mescola tutto',
    playsEverythingBelow: 'Jukebox riproduce tutto ciò che si trova in quella cartella, sottocartelle comprese.',
    chooseFolderInSettings: 'Scegli la cartella della libreria nelle Impostazioni.',

    folders: (count) => `${format.number(count)} ${oneOrMany(count, 'cartella', 'cartelle')}`,
    noFolders: 'Nessuno di questi brani indica in quale cartella si trova.',
    shuffleTag: (tag) => `Mescola «${tag}»`,
  },

  row: {
    opensTracks: 'Apre i suoi brani',
    selectsTracks: 'Seleziona tutti i suoi brani',
    select: 'Seleziona i suoi brani',
  },

  rack: {
    open: (album) => `Apri ${album}`,
    openHint: 'Mostra i brani dell’album',
    bringForward: 'Porta questo album in primo piano',
  },

  albumActions: {
    select: { label: 'Seleziona', hint: 'I suoi brani, e poi qualunque altra cosa tocchi' },
    rest: {
      label: 'Trova il resto dell’album',
      hint: 'I brani dell’album che non hai ancora',
    },
    lookUp: {
      label: 'Cerca l’album online',
      hint: 'Dettagli e copertina, cercati per l’album intero',
    },
    cover: {
      label: 'Scegli la copertina dell’album',
      hint: 'Un’immagine dalla galleria, per ogni suo brano',
    },
  },

  albumTools: {
    lookingUp: (done, total) =>
      `Ricerca dell’album… ${format.number(done)} di ${format.number(total)}`,
    stop: 'Ferma la ricerca',
    lookedUp: (found, covers) =>
      found === 0 && covers === 0
        ? 'Non è stato trovato niente di nuovo per questo album.'
        : covers === 0
          ? `Trovati i dettagli di ${common.tracks(found)}.`
          : found === 0
            ? `Trovata la copertina per ${common.tracks(covers)}.`
            : `Trovati i dettagli di ${common.tracks(found)} e la copertina per ${common.tracks(covers)}.`,
    offline: 'Nessuna risposta. Controlla la connessione e riprova.',
    failed: 'La ricerca si è interrotta inaspettatamente.',
    coverChosen: (count) => `Copertina applicata a ${common.tracks(count)}.`,
  },

  rest: {
    looking: 'Ricerca dell’album…',
    release: (count, year) => (year ? `${common.tracks(count)}, ${year}` : common.tracks(count)),
    have: (have, total) => `Ne hai ${format.number(have)} su ${format.number(total)}.`,
    complete: 'Hai l’album completo.',
    rivals: 'Più di un album ha questo nome. Questo è quello a cui i tuoi brani corrispondono meglio.',
    unsure:
      'Nessuno dei tuoi brani è stato riconosciuto in questo album, quindi nessuno è spuntato. Prima controlla che sia l’album giusto.',
    disc: (disc) => `Disco ${format.number(disc)}`,
    ordered: (count) =>
      oneOrMany(
        count,
        '1 brano messo nell’ordine dell’album.',
        `${format.number(count)} brani messi nell’ordine dell’album.`
      ),
    undoOrder: 'Annulla',

    lookingTube: 'Ricerca su YouTube…',
    readingTube: 'Lettura dell’album…',
    source: {
      musicbrainz: 'Elenco dei brani da MusicBrainz',
      youtube: (playlist, channel) =>
        `Elenco dei brani da YouTube: ${[playlist, channel].filter(Boolean).join(' · ')}`,
    },
    other: { youtube: 'Cerca invece su YouTube', musicbrainz: 'Usa invece MusicBrainz' },
    onTrust:
      'Preso dall’album di YouTube con questo nome. Hai troppo pochi dei suoi brani per verificarlo, quindi controllalo prima di scaricare.',
    tubeNotFound: 'Nessuna playlist di YouTube corrisponde con certezza a questo album.',

    ticks: 'Spuntato per il download',
    waiting: 'In attesa del suo turno',
    searching: 'Ricerca su YouTube…',
    noMatch: 'Nessuna registrazione corrispondente trovata',
    searchFailed: 'La ricerca non è andata a buon fine',
    byHand: 'Cerca a mano',
    byHandLabel: (title) => `Cerca ${title} a mano`,

    download: (count) => `Scarica ${common.tracks(count)}`,
    nothingTicked: 'Spunta i brani da scaricare',
    stop: 'Interrompi ricerca',

    failed: {
      unnamed:
        'Impossibile cercare questo album. Serve un nome e un artista su cui concordi la maggior parte dei suoi brani.',
      notFound: 'MusicBrainz non ha nessun album di questo artista con questo nome.',
      offline: 'Impossibile raggiungere MusicBrainz. Controlla la connessione e riprova.',
      throttled: 'MusicBrainz ha chiesto di rallentare. Aspetta un minuto e riprova.',
      failed: 'Impossibile cercare l’album.',
      gone: 'Questo album non è più nella libreria.',
      neither:
        'Questo album non è stato trovato. MusicBrainz non lo elenca, e nessuna playlist di YouTube corrisponde con certezza a questo album.',
      tube: 'Impossibile chiedere l’album a YouTube.',
      tooOld: 'Questa versione di Jukebox non può cercare album su YouTube. Installa una versione Android più recente.',
    },
  },

  menu: {
    playNext: { label: 'Riproduci dopo', hint: 'Subito dopo il brano in corso' },
    addToQueue: { label: common.addToQueue, hint: 'In fondo' },
    playSimilar: { label: 'Riproduci con brani simili', hint: 'Questo, poi un gruppo di brani simili' },
    playOnly: { label: 'Riproduci solo questo', hint: 'La coda è solo questo brano' },
    album: { label: 'Vai all’album', hint: 'Il resto del disco, in ordine' },
    addToPlaylist: { label: 'Aggiungi a una lista', hint: 'Una delle tue liste, o una nuova' },
    tiles: { label: 'Gioca a Piano Tiles', hint: 'Tasti che cadono a tempo con questo brano' },
    details: {
      label: 'Vedi e modifica dettagli',
      hint: 'Nomi, copertina, tag e testo, ognuno con la sua ricerca',
    },
    delete: { label: 'Elimina dal telefono', hint: 'Cancella il file stesso, non solo questa riga' },
  },

  folders: {
    needsAccess:
      'Jukebox ha bisogno di accedere all’audio su questo dispositivo prima di poter elencare le cartelle.',
    note: 'Jukebox riproduce tutto ciò che si trova nella cartella che scegli, sottocartelle comprese. Scegliere una sottocartella è il modo per escludere suonerie e audio dei giochi.',
    everything: (path) => `${path}  (tutto)`,
  },

  leftOut: {
    title: 'Cartelle escluse',
    none: 'Nessuna. Disattiva le cartelle di messaggi vocali, registrazioni o suonerie.',
    some: (count) =>
      oneOrMany(count, '1 cartella esclusa dalla libreria', `${format.number(count)} cartelle escluse dalla libreria`),
    note: 'Una cartella disattivata resta fuori dalla libreria, insieme a tutte le cartelle che contiene. Non viene eliminato nulla: ascolti, tag e posizioni nelle tue liste restano e tornano quando la riattivi.',
    within: 'Esclusa insieme alla cartella che la contiene',
    spoken: (path, count) => `${path}, ${oneOrMany(count, '1 brano', `${format.number(count)} brani`)}`,
    hint: 'Attivata, la cartella è nella libreria; disattivata, ne resta fuori',
    empty: (root) => `In ${root} non ci sono cartelle con musica.`,
  },

  shortFiles: {
    title: 'Nascondi file brevi',
    note: 'Esclude messaggi vocali, suonerie e suoni di notifica in base alla durata. Non viene eliminato nulla.',
    under: (seconds) => `Sotto i ${format.number(seconds)} s`,
    shorterThan: (seconds) => `Meno di ${format.number(seconds)} secondi`,
  },

  copies: {
    title: 'Copie della stessa canzone',
    some: (count) =>
      oneOrMany(count, '1 canzone compare più volte nella tua libreria', `${format.number(count)} canzoni compaiono più volte nella tua libreria`),
    review: 'Controlla',
    reviewHint: 'Apre le copie per scegliere quale tenere',
    note: 'Questi file sembrano la stessa registrazione salvata più volte: stesso nome, oppure stesso artista e titolo, e la stessa durata con al massimo due secondi di differenza. Di ognuna si tiene una copia. Prima di eliminare le altre, i loro ascolti, tag, testi e posizioni nelle liste passano a quella.',
    empty: 'Nessuna canzone compare più volte nella tua libreria.',
    cleanAll: (count) => `Pulisci tutte (${format.number(count)})`,
    confirmAll: (files, songs) =>
      `Eliminare ${format.number(files)} file? Di ${oneOrMany(songs, 'questa canzone', `ognuna delle ${format.number(songs)} canzoni`)} si tiene una copia, e ascolti, tag, testi e posizioni nelle liste di ogni file eliminato passano prima a quella. Android chiede di nuovo conferma prima di eliminare qualcosa.`,
    confirm: (files) => `Elimina ${format.number(files)} file`,
    deleteOthers: (count) =>
      oneOrMany(count, 'Elimina l’altra copia', `Elimina le altre ${format.number(count)} copie`),
    different: 'Sono canzoni diverse',
    choose: 'Quale copia tenere',
    keepHint: 'Tiene questa copia ed elimina le altre',
    keeps: 'Resta',
    goes: 'Da eliminare',
    why: {
      listens: 'Suggerita perché ha più ascolti.',
      described: 'Suggerita perché ha dettagli o una copertina.',
      folder: 'Suggerita perché è nella cartella della libreria.',
      larger: 'Suggerita perché è il file più grande.',
      older: 'Suggerita perché è il file più vecchio.',
      alike: 'Le copie sono uguali: va bene una qualsiasi.',
    },
    yourChoice: 'Resta la copia che hai scelto.',
    holds: (copy) => {
      const parts = [
        copy.listens > 0 ? oneOrMany(copy.listens, '1 ascolto', `${format.number(copy.listens)} ascolti`) : 'nessun ascolto',
      ];
      if (copy.described) parts.push('dettagli');
      if (copy.cover) parts.push('copertina');
      if (copy.outside) parts.push('fuori dalla cartella della libreria');
      return parts.join(' · ');
    },
    deleted: (count) => oneOrMany(count, '1 file eliminato.', `${format.number(count)} file eliminati.`),
    notDeleted: 'I file non sono stati eliminati. I loro ascolti e il resto ora sono sulla copia che resta.',
    failed: (error) => `Una parte della cronologia non si è potuta spostare, e quei file non sono stati toccati. ${error}`,
  },

  wrong: {
    title: 'Download che potrebbero essere la canzone sbagliata',
    some: (count) =>
      oneOrMany(count, '1 download potrebbe essere una canzone diversa da quella che dice il suo nome', `${format.number(count)} download potrebbero essere canzoni diverse da quelle che dicono i loro nomi`),
    review: 'Controlla',
    reviewHint: 'Apre quei download per correggerli uno per uno',
    note: 'Ognuno è stato scaricato come una canzone e ne ha preso il nome, ma il video da cui viene si chiama in un altro modo, quindi potrebbe essere un’altra canzone. Riproducilo per sentire quale sia, poi dagli il nome del video, eliminalo o conferma che è giusto. Non cambia nulla finché non scegli.',
    empty: 'Nessun download sembra la canzone sbagliata.',
    filedAs: 'Salvato come',
    videoWas: 'Il video era',
    facts: (length, listens) =>
      `${length} · ${listens > 0 ? oneOrMany(listens, '1 ascolto', `${format.number(listens)} ascolti`) : 'nessun ascolto'}`,
    playHint: 'Riproduce questo file',
    rename: 'Dagli il suo vero nome',
    delete: 'Elimina',
    right: 'È giusto',
    sheetNote: 'Preso dal titolo del video. Cambialo se non è del tutto giusto. Viene salvato come tua modifica manuale, che nessuna ricerca sovrascrive.',
    titleField: 'Titolo',
    artistField: 'Artista',
    renamed: (title) => `Rinominato in «${title}».`,
    deleted: 'Eliminato.',
    notDeleted: 'Il file non è stato eliminato.',
    keptRight: 'Resta com’è. Non verrà chiesto di nuovo.',
    failed: (error) => `Non è stato possibile. ${error}`,
  },
};
