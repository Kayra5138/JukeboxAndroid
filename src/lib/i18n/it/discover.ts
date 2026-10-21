import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

const n = format.number;

export const discover: Strings['discover'] = {
  panel: {
    heading: 'Pensato per il tuo prossimo ascolto',
    refresh: 'Aggiorna',
    updated: (date) => `Aggiornato il ${date}`,

    familiar: (because) => `Altro dai tuoi artisti · ${because}`,
    fresh: (because) => `Un nuovo artista · ${because}`,
  },

  header: {
    notYet: 'Ancora nessuna lista',
    about: 'Informazioni su Scopri',
    settings: 'Impostazioni di Scopri',
    findMore: 'Trova altro',
    dismiss: 'Ignora',
  },

  about: {
    heading: 'Informazioni su Scopri',
    what:
      'Canzoni che non hai ancora, scelte in base a ciò che hai ascoltato negli ultimi 30 giorni: altro dai tuoi artisti, e artisti vicini a loro.',
    source:
      'Ciò che ascolti viene letto su questo telefono. I suggerimenti arrivano da ListenBrainz e MusicBrainz, e l’audio di una canzone viene preso da YouTube quando deve essere riprodotta.',
    keep: '«Aggiungi alla libreria» salva la canzone nella tua libreria e la toglie dalla lista: ormai l’hai trovata.',
    exclude:
      '«Non questa canzone» la toglie dalla lista e non verrà più consigliata. Dal menu puoi dire lo stesso del suo artista.',
    room: 'In entrambi i casi un’altra canzone prende il suo posto. Trascina una riga di lato per fare lo stesso, o tienila premuta per altre opzioni.',
  },

  row: {
    keep: 'Aggiungi alla libreria',
    exclude: 'Non questa canzone',
    swipeKeep: 'Tieni',
    swipeExclude: 'Non questa',
    willPlay: 'Parte appena pronta',
    preview: 'Anteprima · la canzone sta arrivando',
    previewStop: 'Ferma l’anteprima. La canzone partirà comunque appena pronta',
    willKeep: 'In libreria appena pronta',
    keeping: 'Salvataggio nella libreria…',
    failed: 'Download non riuscito · tocca per riprovare',
    needsBuild: 'Serve l’app aggiornata',
    waitingWifi: 'In attesa del Wi-Fi · tocca per scaricare',
    percent: (percent) => `${n(percent)}%`,
    gettingReady: 'Download in corso',
    hint: 'Riproduce la canzone, scaricandola prima se necessario',
    nowPlaying: (title) => `In riproduzione: ${title}`,
    menu: 'Opzioni canzone',
  },

  menu: {
    play: { label: 'Riproduci', hint: 'Scaricata prima, se necessario' },
    keep: { label: 'Aggiungi alla libreria', hint: 'Diventa tua, e lascia questa lista' },
    exclude: { label: 'Non questa canzone', hint: 'Fuori dalla lista, e non verrà più consigliata' },
    neverArtist: {
      label: (artist) => `Mai più ${artist}`,
      hint: 'Niente di questo artista verrà più consigliato',
    },
    why: 'Perché questa canzone',
    seeds: (artists) => `Dai tuoi ascolti di ${artists}`,
    tags: (tags) => `Tag: ${tags}`,
    freshArtist: 'Un artista nuovo per la tua libreria',
  },

  empty: {
    building: 'Preparazione della tua lista…',
    none: 'Non c’è ancora una lista. Premi Aggiorna e Scopri ne creerà una da ciò che ascolti.',
    findingMore: 'Ricerca di altre canzoni…',
    short: (missing) =>
      missing === 1 ? '1 posto è vuoto.' : `${n(missing)} posti sono vuoti.`,
  },

  player: {
    kept: 'Salvata nella libreria',
  },

  preview: {
    label: 'Anteprima',
    note: 'La canzone intera parte appena è pronta',
    stop: 'Ferma l’anteprima',
  },

  settings: {
    heading: 'Scopri',
    title: 'Impostazioni di Scopri',
    count: 'Canzoni da scoprire',
    countNote: 'Metà da artisti che conosci, metà da artisti nuovi. Le canzoni salvate ed escluse vengono sostituite subito.',
    refresh: 'Aggiorna la lista',
    everyDays: (days) => `${n(days)} g`,
    manual: 'Manuale',
    refreshNote:
      'È Android a decidere quando può girare il lavoro in background. Un aggiornamento in ritardo parte anche quando riapri Jukebox. Le scoperte non salvate vengono sostituite; le canzoni in coda restano finché la riproduzione non ne ha più bisogno.',
    ready: 'Tieni pronte le prossime canzoni',
    readyNone: 'Nessuna',
    readyNote:
      'Scaricate in anticipo, così un tocco le fa partire subito: le prime della lista, o quelle dopo ciò che è in riproduzione. Con «Nessuna», una canzone viene scaricata quando la tocchi.',
    wifi: 'Tieni pronte le canzoni solo con Wi-Fi',
    wifiNote: 'Usa reti Wi-Fi non a consumo. Una canzone che tocchi viene scaricata con qualsiasi connessione disponibile.',
    preview: 'Riproduci un’anteprima mentre una canzone si scarica',
    previewNote:
      'Una canzone toccata che non è ancora pronta parte subito come anteprima di 30 secondi da Deezer, e la canzone intera subentra dall’inizio quando è arrivata. Un’anteprima non conta come ascolto.',
    nextList: 'La lista attuale resta com’è. La prossima verrà scelta così.',
    excluded: 'Canzoni escluse',
    noneExcluded: 'Nessuna canzone esclusa.',
    allowAgain: 'Consenti di nuovo',
    allowAgainLabel: (title) => `Consenti di nuovo ${title}`,
    unblock: 'Sblocca',
    unblockLabel: (artist) => `Sblocca ${artist}`,
    failed: 'Impossibile aggiornare le impostazioni di Scopri. Riprova.',
  },

  state: {
    idle: 'Tocca per scaricare e riprodurre',
    starting: 'Avvio…',
    waitingFind: 'In attesa di essere cercata',
    waitingDownload: 'In attesa del download',
    waitingRetry: 'Nuovo tentativo tra poco',
    finding: 'Ricerca della registrazione…',
    preparing: 'Avvio del download…',
    downloading: (percent) => `Download · ${n(percent)}%`,
    converting: 'Completamento…',
    saving: 'Quasi pronta…',
    ready: 'Pronta da riprodurre',
    playing: 'In riproduzione',
    willPlay: (doing) => `${doing} Parte appena pronta.`,
    preview: (doing) => `Anteprima in riproduzione. ${doing}`,
    willKeep: (doing) => `${doing} Verrà salvata nella libreria appena pronta.`,
    keeping: 'Salvataggio nella libreria…',
    waitingWifi: 'In attesa del Wi-Fi · tocca per scaricare ora',
  },

  failure: {
    generic: 'Questo download non è stato completato.',
    fileMissing: 'Il file non è più sul telefono.',
    noRecording: 'Non è stata trovata nessuna registrazione.',
    notASong: 'Il video trovato è una diretta, o è troppo lungo per essere la canzone.',
    stopped: 'Il download è stato interrotto.',
    needsBuild: 'Installa l’APK aggiornato per scaricare le canzoni di Scopri.',
    retry: (reason) => `${reason} Tocca per riprovare.`,
  },

  status: {
    building: 'Ricerca di canzoni…',
    filling: (known, total) => `Ricerca di canzoni · ${n(known)} di ${n(total)}`,
    findingOffline: 'Nessuna connessione. Il resto della lista verrà cercato quando ci sarà.',
    findingPaused: 'I download sono in pausa. Riprendili e il resto della lista verrà cercato.',
    findingLater: 'Alcune canzoni non si sono potute controllare in questo momento. Scopri riproverà più tardi.',
    buildingArtists: (done, total) =>
      `Ricerca di canzoni · ${n(done)} di ${n(total)} ${total === 1 ? 'artista' : 'artisti'}`,
    preparing: (ready, target) =>
      `Una nuova lista sta arrivando · ${n(ready)} di ${n(target)} ${target === 1 ? 'canzone pronta' : 'canzoni pronte'}.${ready > 0 ? ' Aggiorna di nuovo per vederla subito.' : ''}`,
    offline: 'Nessuna connessione. La tua lista resta; le nuove canzoni verranno cercate quando ci sarà.',
    offlineEmpty: 'Nessuna connessione. Scopri creerà la tua lista quando ci sarà.',
    noLibrary: 'Scopri parte dalla musica su questo telefono, e non ne ha ancora trovata.',
    noTaste:
      'Le tue canzoni non dicono di chi sono, quindi Scopri non ha nessuno da cui partire. Cerca le loro informazioni in Impostazioni → Libreria → Tag.',
    unreachable: 'Impossibile raggiungere i suggerimenti. La tua lista resta; riprova più tardi.',
    unreachableEmpty: 'Impossibile raggiungere i suggerimenti. Riprova più tardi.',
    exhausted: 'Non ci sono ancora abbastanza canzoni nuove. La tua lista resta com’è.',
    exhaustedEmpty: 'Ancora niente di nuovo da consigliare. Ascolta ancora un po’ e riprova.',
    timedOut: 'La ricerca di canzoni ha richiesto troppo tempo ed è stata interrotta. Riprova.',
    throttled: 'Scopri ha appena cercato. Riprova tra un minuto.',
    failed: 'Scopri non è riuscito a finire. Riprova.',
    waitingWifi: 'Le prossime canzoni verranno scaricate quando ci sarà il Wi-Fi. Tocca una canzone per scaricarla ora.',
    waitingConnection: 'Le prossime canzoni verranno scaricate quando ci sarà una connessione.',
    paused: 'I download sono in pausa. Riprendili per scaricare le canzoni.',
  },

  notice: {
    kept: (title) => `${title}: salvata nella libreria.`,
    excluded: (title) => `${title}: non verrà più consigliata.`,
    excludedArtist: (artist) => `${artist}: non verrà più consigliato.`,
    restored: (title) => `${title}: di nuovo nella lista.`,
    refreshed: 'Ecco la tua nuova lista.',
    keepFailed: (title) => `Impossibile salvare ${title} nella libreria. Riprova.`,
    wrongFile: (title) => `Il file di ${title} era un’altra canzone. Si cerca quella giusta da salvare.`,
    undo: 'Annulla',
  },

  engine: {
    needsTaste: 'Scopri non ha né un artista né un tag da cui partire.',
    nothingFetched:
      'Impossibile ottenere suggerimenti. La tua lista di Scopri attuale resta; riprova più tardi.',
  },

  taste: {
    popularity: 'Popolarità delle canzoni',
    popularityKnown: 'Famose',
    popularityAny: 'Indifferente',
    popularityDeep: 'Meno note',
    popularityNote:
      'Se Scopri preferisce artisti famosi e le loro canzoni più ascoltate, o artisti e canzoni che meno persone hanno scoperto. Con «Indifferente», un nuovo artista viene presentato con una delle sue canzoni più famose.',

    neverArtistLabel: (artist) => `Non consigliare più ${artist}`,
    blockedArtists: 'Artisti bloccati',
    noneBlockedArtists: 'Nessun artista bloccato.',
    blockedArtistsNote:
      'Escludere una canzone rende anche meno probabile il suo artista. Con tre canzoni escluse dello stesso artista, Scopri lo lascia fuori per sei mesi.',
  },

  why: {
    moreFrom: (artist) => `Altro di ${artist}`,
    becauseYouPlay: (artists) => `Perché ascolti ${artists}`,
    both: (first, second) => `${first} e ${second}`,
    like: (artist) => `Simile a ${artist}`,
    withGenre: (line, genre) => `${line} · ${genre}`,
    fromTags: (tags) => `Generi che ascolti: ${tags}`,
    unexplained: 'Scelta per te',
    veryNear: 'Molto vicina a ciò che ascolti',
    near: 'Vicina a ciò che ascolti',
    farther: 'Un passo più in là',
  },

  gathering: {
    around: (artist, done, total) =>
      `Esplorazione intorno a ${artist} · ${n(done)} di ${n(total)} ${total === 1 ? 'artista' : 'artisti'}`,
    artists: (done, total) => `${n(done)} di ${n(total)} ${total === 1 ? 'artista' : 'artisti'}`,
    naming: 'Identificazione delle canzoni…',
    offline: 'Nessuna connessione. Scopri cercherà nuove canzoni quando ci sarà.',
    throttled: 'Il servizio di suggerimenti ha chiesto a Scopri di rallentare. Riprova tra qualche minuto.',
    nothing: 'Questa volta non è stato trovato niente di nuovo. La tua lista di Scopri attuale resta; riprova più tardi.',
  },
};
