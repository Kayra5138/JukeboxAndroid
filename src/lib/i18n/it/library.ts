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
    tapes: 'Cassette',
  },

  tapes: {
    left: (minutes) => `${format.number(minutes)} min rimasti`,
    played: 'Ascoltato',
    heard: (heard, total) => `${format.number(heard)} / ${format.number(total)} min`,
    add: 'Aggiungi cassette',
    settings: 'Impostazioni cassette',
    /** A followed show's arrow, which lays its episodes out under it and folds them away. */
    showEpisodes: 'Mostra episodi',
    hideEpisodes: 'Nascondi episodi',
    /** A tape's own details screen: see `app/tape.tsx`. */
    details: {
      title: 'Dettagli della cassetta',
      listening: 'Ascolto',
      heard: 'Ascoltato',
      notBegun: 'Non ancora iniziata',
      lastHeard: 'Ultimo ascolto',
      part: 'Parte',
      partOf: (at, of) => `${format.number(at)} di ${format.number(of)}`,
      speed: 'Velocità',
      marks: 'Segnalibri',
      source: 'Origine',
      from: 'Provenienza',
      kinds: { youtube: 'Un video di YouTube', playlist: 'Una playlist di YouTube', podcast: 'Un episodio di podcast', book: 'Un libro di LibriVox', byHand: 'Messa a mano nella cartella Cassette' },
      show: 'Programma',
      book: 'Libro',
      channel: 'Canale',
      list: 'Playlist',
      published: 'Uscito',
      fetched: 'Scaricata',
      chapters: 'Capitoli',
      skipped: 'Parti saltate',
      skippedUnknown: 'Si controlla al prossimo ascolto',
      skippedOff: 'Disattivato nelle impostazioni delle cassette',
      skippedTrouble: 'SponsorBlock non raggiungibile; si riprova al prossimo ascolto',
      skippedNone: 'Nulla di segnato',
      skippedSome: (count, seconds) => `${oneOrMany(count, '1 parte', `${format.number(count)} parti`)} · ${format.number(seconds)} s`,
      address: 'Indirizzo',
      listAddress: 'Indirizzo della playlist',
      openSeries: 'Apri il programma',
      file: 'File',
      name: 'Nome',
      folder: 'Cartella',
      format: 'Formato',
      size: 'Dimensione',
      megabytes: (mb) => `${format.number(mb)} MB`,
      added: 'Arrivata sul telefono',
      missing: 'Questa cassetta non è più nella libreria.',
    },
    seriesHeading: 'Seguiti',
    singlesHeading: 'Cassette',
    booksHeading: 'Libri',
    /** The tapes view's filter: all of it, or one of its parts. */
    filter: { all: 'Tutto', series: 'Seguiti', books: 'Libri', tapes: 'Cassette' },
    seriesLine: (count, fresh) => `${format.number(count)} ${oneOrMany(count, 'episodio', 'episodi')}${fresh > 0 ? ` · ${format.number(fresh)} ${oneOrMany(fresh, 'nuovo', 'nuovi')}` : ''}`,
    seriesNone: 'Nessun episodio scaricato finora',
    /** A folder of several tapes as one row: how many parts, and how many of them not begun. */
    bookLine: (count, fresh) => `${format.number(count)} parti${fresh > 0 ? ` · ${format.number(fresh)} non iniziate` : ''}`,
    count: (count) => `${format.number(count)} ${oneOrMany(count, 'cassetta', 'cassette')}`,
    /** Over the tapes view while tapes are being chosen. */
    selected: (count) => oneOrMany(count, '1 cassetta selezionata', `${format.number(count)} cassette selezionate`),
    empty: (folder) => `Metti audiolibri, podcast e registrazioni lunghe in una cartella chiamata Tapes dentro la cartella della libreria (${folder}). Compaiono qui, riprendono da dove li hai lasciati e restano fuori dalla tua musica.`,
    markPlayed: 'Segna come ascoltato',
    markUnplayed: 'Segna come non ascoltato',
  },

  nothingMatches: (query) => `Nessun risultato per «${query}».`,
  noAlbums:
    'Ancora nessun album. Un album compare solo dopo che sono state cercate le informazioni dei suoi brani: la cartella in cui si trova un file non è un album.',
  back: '‹ Indietro',
  trackMenu: 'Opzioni brano',
  albumMenu: 'Opzioni album',

  screen: {
    searchYouTube: (query: string) => `Cerca «${query}» su YouTube`,
    viewSwitch: 'Vista della libreria',
    searchHints: {
      tracks: 'Cerca titoli, artisti e tag',
      albums: 'Cerca titoli, artisti e tag',
      artists: 'Cerca artisti',
      folders: 'Cerca cartelle',
      tapes: 'Cerca cassette, programmi e autori',
    },
    /* The order has to fit a button 56 points wide: kept to seven letters at most. */
    sort: 'Ordine',
    sortShort: { name: 'A–Z', added: 'Nuovi', played: 'Ascolti', colour: 'Colore' },
    sortedBy: {
      name: 'Ordinati per nome',
      added: 'Ordinati per data di aggiunta',
      played: 'Ordinati per ultimo ascolto',
      colour: 'Ordinato per colore della copertina',
    },
    sortHint: 'Cambia l’ordine della libreria',
    lookSwitch: 'Passa all’altra visualizzazione di questa vista',
    view: 'Vista',
    looks: { list: 'Elenco', shelves: 'Scaffali', rack: 'Scaffale', map: 'Mappa' },
    shelf: { added: 'Aggiunti di recente', around: (hour: string) => `Verso le ${hour}`, repeat: 'In loop questo mese', while: 'Non ascoltati da un po’', never: 'Mai ascoltati', all: 'Tutti i brani', play: (name: string) => `Riproduci ${name}`, shuffle: (name: string) => `Riproduci ${name} in ordine casuale`, queue: (name: string) => `Aggiungi ${name} alla coda` },
    artistMap: { drawing: 'Disegno la mappa…', shuffle: 'Riproduci i brani in ordine casuale', open: 'Apri', with: 'Con', lasso: 'Cerchia gli artisti per mescolarli', lassoHint: 'Cerchia gli artisti da mescolare', lassoChosen: 'Cerchiati', putBackAll: 'Rimetti a posto gli artisti spostati a mano', movedByHand: 'Spostati a mano', putBack: 'Rimetti' },
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
    setAside: { label: 'Metti da parte', hint: 'I suoi brani fuori da Brani e dalla riproduzione casuale di tutto' },
    bringBack: { label: 'Riporta', hint: 'I suoi brani di nuovo in Brani e nella riproduzione casuale' },
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
    quickNext: 'Dopo',
    quickQueue: 'Coda',
    quickList: 'Lista',
    playNext: { label: 'Riproduci dopo', hint: 'Subito dopo il brano in corso' },
    keepListened: { label: 'Tieni nella libreria', hint: 'Copiato nella tua libreria, con la sua cronologia' },
    addToQueue: { label: common.addToQueue, hint: 'In fondo' },
    playSimilar: { label: 'Riproduci con brani simili', hint: 'Questo, poi un gruppo di brani simili' },
    playOnly: { label: 'Riproduci solo questo', hint: 'La coda è solo questo brano' },
    playFromStart: { label: 'Riproduci dall’inizio', hint: 'Il punto in cui eri rimasto viene dimenticato' },
    series: { label: 'Apri il programma', hint: 'I suoi episodi e come vengono scaricati i nuovi' },
    tapeFolder: { label: 'Apri la sua cartella', hint: 'Tutto il resto della sua cartella' },
    tapeDetails: { label: 'Vedi dettagli', hint: 'A che punto sei, da dove viene e il file' },
    share: { label: 'Condividi', hint: 'Inviato come audio: una chat lo riproduce lì' },
    shareFile: { label: 'Condividi come file', hint: 'Inviato come file: una chat lo tiene come documento' },
    album: { label: 'Vai all’album', hint: 'Il resto del disco, in ordine' },
    addToPlaylist: { label: 'Aggiungi a una lista', hint: 'Una delle tue liste, o una nuova' },
    setAside: { label: 'Metti da parte', hint: 'Fuori da Brani e dalla riproduzione casuale di tutto' },
    bringBack: { label: 'Riporta', hint: 'Di nuovo in Brani e nella riproduzione casuale' },
    asideWith: { label: 'Messo da parte con altri', hint: 'Con il suo album, artista, cartella o un tag: si riporta da Messi da parte' },
    favoriteAdd: { label: "Aggiungi ai Preferiti", hint: "La lista che riempie il cuore, i più recenti in alto" },
    favoriteRemove: { label: "Togli dai Preferiti", hint: "Fuori dalla lista che riempie il cuore" },
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

  setAside: {
    title: 'Messi da parte',
    none: 'Niente. Metti da parte un album, un artista o un brano che non vuoi in Brani né nella riproduzione casuale.',
    some: (count) => oneOrMany(count, '1 brano messo da parte', `${format.number(count)} brani messi da parte`),
    note: 'Un brano messo da parte resta fuori da Brani, dalla riproduzione casuale di tutto e dai brani scelti per continuare la musica. Resta nel suo album, con il suo artista e nella sua cartella, nelle tue liste e nella ricerca, e suona quando si riproduce uno di questi. Non viene eliminato nulla.',
    empty: 'Non c’è niente da parte. Tieni premuto un album o un brano, o apri un artista o una cartella, per metterlo da parte.',
    kinds: { album: 'Album', artist: 'Artisti', list: 'Liste', folder: 'Cartelle', tag: 'Tag', track: 'Brani' },
    songs: (count) => oneOrMany(count, '1 brano', `${format.number(count)} brani`),
    bringBack: 'Riporta',
    bringBackSpoken: (name) => `Riporta ${name}`,
    addTag: 'Metti da parte un tag',
    noTags: 'Non ci sono altri tag da mettere da parte.',
    album: { set: 'Metti da parte questo album', back: 'Riporta questo album' },
    artist: { set: 'Metti da parte questo artista', back: 'Riporta questo artista' },
    list: { set: 'Metti da parte questa lista', back: 'Riporta questa lista' },
    folder: { set: 'Metti da parte questa cartella', back: 'Riporta questa cartella' },
  },

  shortFiles: {
    title: 'Nascondi file brevi',
    note: 'Esclude messaggi vocali, suonerie e suoni di notifica in base alla durata. Non viene eliminato nulla.',
    under: (seconds) => `Sotto i ${format.number(seconds)} s`,
    shorterThan: (seconds) => `Meno di ${format.number(seconds)} secondi`,
  },

  autoWrite: {
    heading: "Nei file",
    edits: { title: "Scrivi nel file ciò che salvo", note: "Quando salvi i dettagli di un brano, da solo o insieme ad altri, finiscono anche nel file, come con Scrivi nel file. Android chiede prima per i file che Jukebox non ha scaricato." },
    lookups: { title: "Scrivi nel file ciò che trovano le ricerche", note: "I dettagli di un brano trovato da una ricerca, e che non hai modificato, vengono scritti nel file. I download di Jukebox subito, anche in background. Gli altri file aspettano e vengono chiesti insieme alla prossima apertura dell’app. Un brano in riproduzione aspetta la volta successiva." },
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

  shuffle: {
    menu: 'Casuale',
    everything: 'Tutti i brani',
    change: 'Cambia cosa riproduce il pulsante…',
    heading: 'Il pulsante casuale riproduce',
    note: 'Tieni premuto il pulsante per mescolare qualcos’altro una volta sola. Il widget e l’auto riproducono lo stesso.',
    labelHeading: 'Sul pulsante casuale c’è scritto',
    label: { name: 'Il nome di ciò che riproduce', words: 'Un testo tuo', icon: 'Niente, solo l’icona' },
    wordsHeading: 'Testo del pulsante casuale',
    wordsPlaceholder: 'Casuale',
    spoken: (name) => `Casuale: ${name}`,
  },
};
