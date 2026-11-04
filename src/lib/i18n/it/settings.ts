import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `Ultima build: ${when}`,
  lastBuiltUnknown: 'Ultima build: disponibile dopo aver installato il nuovo APK',

  sections: {
    look: 'Aspetto e tatto',
    sound: 'Audio',
    player: 'Lettore',
    tapes: 'Cassette',
    library: 'Libreria',
    downloads: 'Download e Scopri',
    data: 'I tuoi dati',
    views: 'Viste della libreria',
    experimental: 'Sperimentale',
  },
  categories: {
    look: 'Il tema, gli album come scaffale, le animazioni, la vibrazione e quali viste offre la libreria.',
    sound: 'Equalizzatore ed effetti, volume uniforme, dissolvenza incrociata, velocità e tonalità.',
    player: 'La durata dei salti avanti e indietro, cosa suona quando finisce la coda e la lingua in cui vengono tradotti i testi.',
    tapes: 'Riavvolgimento intelligente, la durata dei salti di una cassetta e i podcast scaricati solo con il Wi‑Fi.',
    library: 'La cartella della tua musica, tag e copertine, e i file che potrebbero essere la stessa canzone.',
    waiting: (count) => `${format.number(count)} da decidere`,
    downloads: 'La coda dei download e il suo pulsante mobile, Scopri, e l’aggiornamento del downloader di YouTube.',
    data: 'Il backup di tutto o l’importazione di un backup, il controllo degli aggiornamenti e ListenBrainz (sperimentale).',
  },

  language: {
    title: 'Lingua',
    note: 'La lingua dell’app. Non segue quella del telefono.',
  },
  theme: {
    title: 'Tema',
    open: 'Colori, vetro o un tema tutto tuo.',
    note: '«Sistema» segue la modalità chiara o scura del telefono.',
    pair: {
      light: 'In modalità chiara',
      dark: 'In modalità scura',
      note: 'I due temi tra cui «Sistema» si alterna, come fa il telefono.',
    },
    shuffle: {
      title: 'Un tema diverso ogni volta',
      on: 'Attivato',
      toggle: 'Scegline uno a caso a ogni apertura dell’app',
      note: 'Spunta i temi tra cui scegliere. Quello scelto resta il tema fino alla prossima apertura dell’app, e nel frattempo puoi sempre cambiarlo a mano.',
      empty: 'Spunta almeno un tema perché questa opzione abbia effetto.',
    },
  },
  customTheme: {
    open: 'Colori del tema personalizzato',
    openNote: 'Scegli uno sfondo e un colore d’accento per il tema «Personalizzato». Tutto il resto viene ricavato da questi.',
    preview: 'Anteprima',
    background: 'Sfondo',
    accent: 'Accento',
    surface: 'Schede',
    automatic: 'Automatico',
    automaticNote: 'Ricavato dallo sfondo',
    presets: 'Colori suggeriti',
    hue: 'Tinta',
    saturation: 'Saturazione',
    lightness: 'Luminosità',
    degrees: (value) => `${value}°`,
    percent: (value) => `${value}%`,
    hex: 'Codice colore',
    nudged: (colour) => `Mostrato come ${colour}, così che tutto ciò che c’è sopra resti leggibile.`,
    note:
      'I colori del testo vengono ricavati da questi, così che sia sempre leggibile. Per lo stesso motivo un colore che scegli potrebbe essere reso un po’ più chiaro o più scuro.',
    use: 'Usa questo tema',
    reset: 'Ripristina',
    sample: {
      title: 'Titolo del brano',
      line: 'Artista · Album',
      chip: 'Casuale',
      button: 'Riproduci',
    },
  },

  tags: { note: 'Informazioni sui brani e copertine degli album' },
  rack: {
    title: 'Album come scaffale',
    note:
      'Tenendo il telefono in orizzontale, sfoglia le copertine invece di leggere un elenco. Tocca quella davanti per aprirla.',
  },
  favoritesShown: { title: "Preferiti", note: "Una lista sempre presente, i più recenti in alto, riempita da un cuore nel lettore e da Aggiungi ai Preferiti nel menu di un brano. Disattivati, i tre sono nascosti e il contenuto resta." },
  listButton: {
    title: 'Pulsante Aggiungi a una lista',
    note:
      'Un pulsante nel lettore che aggiunge il brano in riproduzione a una delle tue liste, senza passare dal suo menu.',
  },
  autoplaySizes: { title: 'Brani simili alla volta', library: 'Dalla tua libreria', fresh: 'Nuovi da Discover', note: 'Quanti ne vengono aggiunti a ogni riempimento della coda, per «Continua con canzoni simili» e per un brano riprodotto con brani simili. Ogni brano nuovo è un download. Misto prende tre quarti di ciascuno.' },
  tap: {
    title: 'Quando tocchi un brano',
    note: 'Cosa suona dopo un brano toccato in Tracks o nei risultati di ricerca.',
    sheetNote: 'Play e Shuffle sopra un album o una lista, Shuffle all e Discover non cambiano. Il menu di ogni brano ha «Riproduci con brani simili» e «Riproduci solo questo» per una volta.',
    list: { label: 'Il resto della lista', note: 'I brani successivi, nell’ordine mostrato.' },
    shuffled: { label: 'Il resto della lista, in ordine casuale', note: 'Prima questo, poi gli altri della lista a caso.' },
    similar: { label: 'Brani simili', note: 'Questo, poi un gruppo di brani simili dalla tua libreria o da Discover, come scegli. Dopo, la coda continua come dice «Continua con canzoni simili».' },
    only: { label: 'Solo quel brano', note: 'Niente dopo, a meno che «Continua con canzoni simili» ne aggiunga.' },
    source: { title: 'Brani simili da', note: 'Da dove arrivano i primi brani dopo quello toccato. Dopo, decide «Continua con canzoni simili».' },
    everywhere: { title: 'Anche in album e liste', note: 'Anche quando tocchi un brano nella pagina di un album, una lista, un artista o una cartella. Spento, suonano nel loro ordine.' },
  },
  autoplay: {
    title: 'Continua con canzoni simili',
    note: 'Quando la coda sta per finire, in fondo vengono aggiunte canzoni simili a quelle che stavi ascoltando.',
    sheetNote: 'Si aggiungono alcune canzoni prima della fine, così proseguono come il resto della coda, anche a schermo bloccato. Mai con la ripetizione attiva.',
    off: {
      label: 'Disattivato',
      note: 'Non viene aggiunto nulla. La musica si ferma alla fine della coda.',
    },
    library: {
      label: 'Dalla tua libreria',
      note: 'Scelte in base a tag, artisti e a ciò che ascolti insieme. Funziona offline.',
    },
    fresh: {
      label: 'Canzoni nuove',
      note: 'Canzoni che non hai ancora, trovate da Scopri. Usa la rete e scarica da YouTube come Scopri, e segue la sua impostazione del Wi-Fi.',
    },
    mixed: {
      label: 'Mix',
      note: 'Due dalla tua libreria, poi una nuova. Le nuove usano la rete e i download da YouTube come Scopri, e seguono la sua impostazione del Wi-Fi.',
    },
  },
  downloads: {
    listen: { title: 'Brani ascoltati e non tenuti', note: 'Eliminati dopo questi giorni dal download, a meno che non li tieni: con il cuore, in una lista o dal loro menu.', days: (days) => oneOrMany(days, '1 giorno', `${format.number(days)} giorni`)  },
    note: 'Cosa si sta scaricando, cosa è in attesa e cosa è finito.',
    button: {
      title: 'Pulsante mobile dei download',
      note: 'Un pulsante rotondo sopra l’app mentre c’è qualcosa in download, e per qualche minuto dopo. Toccalo per vedere a che punto è.',
    },
    check: {
      title: 'Cerca un downloader di YouTube più recente',
      note: 'Al massimo una volta al giorno, e solo quando apri Download o scarichi qualcosa, Jukebox chiede a GitHub qual è l’ultima versione di yt-dlp. Non viene inviato niente su di te o sulla tua libreria, e non viene scaricato niente finché non lo dici tu.',
    },
  },
  discover: { note: 'Quanto è lunga la lista, ogni quanto viene rifatta e cosa è stato scartato.' },
  still: {
    title: 'Riduci le animazioni',
    note:
      'Per un telefono che perde fotogrammi. Il lettore compare invece di salire, e il gioco smette di illuminarsi quando si vince o si perde una vita. I tasti continuano a cadere: quello è il gioco, non una decorazione.',
  },
  scriptNames: { title: 'Nomi in altre scritture', latin: 'Lettere latine', original: 'Originale', note: 'Se una ricerca ha trovato il nome di un brano in lettere latine e nella sua scrittura (giapponese, cinese, coreano), quale mostra la libreria. I brani cercati prima si completano alla prossima ricerca.' },
  haptics: {
    title: "Vibrazione",
    open: "Quanto vibra l’app sotto il dito, e con che forza.",
    mode: "Vibra",
    modes: { off: "No", essential: "L’essenziale", all: "Tutto", custom: "Su misura" },
    modeNotes: {
      off: "L’app non vibra mai.",
      essential: "Solo dove dice di più: una pressione lunga, se qualcosa ha funzionato o no, e il gioco.",
      all: "Pressioni lunghe e trascinamenti, interruttori e scelte, gli scatti di un cursore, risultati, i tasti del lettore e il gioco.",
      custom: "Scegli sotto quali momenti vibrano.",
    },
    strength: "Intensità",
    strengthNote: "Si sente quando lasci. I telefoni il cui motore non si regola mantengono la propria intensità.",
    groupsHeading: "Cosa vibra",
    groups: {
      holds: { title: "Premere e trascinare", note: "Una pressione lunga, una riga sollevata per spostarla, il dito sulle caselle." },
      choices: { title: "Interruttori e scelte", note: "Interruttori, le schede di una scelta, un’opzione scelta." },
      notches: { title: "Scatti e passi", note: "Velocità normale, 0 dB, il centro di un cursore, le colonne di un grafico." },
      results: { title: "Risultati", note: "Ciò che hai chiesto ha funzionato o no: trovato, scritto, aggiunto, importato." },
      player: { title: "Tasti del lettore", note: "Riproduci, salta, ripeti, il cuore, toccare una riga del testo." },
      fun: { title: "Gioco e divertimento", note: "I tasti di Piano Tiles, e altro." },
    },
    phone: "Se il feedback tattile è disattivato nelle impostazioni del telefono, nemmeno l’app vibra.",
  },
  moreButton: {
    title: 'Tre puntini su ogni riga',
    note:
      'Alla fine di ogni riga di brani e album, aprono lo stesso menu della pressione prolungata. Anche senza, basta tenere premuta una riga.',
  },
  tabs: {
    title: 'Schede',
    searchNote: 'Scopri e i download da YouTube sono in questa scheda e spariscono con lei.',
    aside: 'Libreria e Impostazioni ci sono sempre.',
  },

  views: {
    notes: {
      tracks: 'Ogni canzone, una per riga.',
      albums: 'Album, ricostruiti da ciò che dicono i tag.',
      artists: 'Tutti quelli a cui è attribuita una canzone. Una canzone di due artisti compare sotto entrambi.',
      folders: 'Le cartelle in cui sono conservati i file, dentro la cartella della libreria.',
      tapes: 'Audiolibri, podcast e registrazioni lunghe dalla cartella Tapes della libreria, che riprendono da dove li hai lasciati.',
    },
    onlyHint: 'È l’unica vista attiva, quindi non si può disattivare',
    toggleHint: 'Mostra o nasconde questa vista nella libreria',
    asideOne: 'Con una sola vista attiva, la libreria mostra quella e non ha selettore. Una resta sempre attiva.',
    asideMany: 'Il selettore della libreria offre quelle attive. Una resta sempre attiva.',
  },

  sameSong: {
    note: (count) =>
      oneOrMany(
        count,
        'Un file che sembra una canzone che avevi già sotto un altro file. La sua cronologia resta separata finché non decidi.',
        `${format.number(count)} file che sembrano canzoni che avevi già sotto un altro file. La loro cronologia resta separata finché non decidi.`
      ),
  },
  exportAll: {
    title: 'Esporta tutto',
    note:
      'Cronologia degli ascolti, liste, tag, testi e impostazioni, i podcast che segui e dove sei arrivato in ogni cassetta con i segni messi, in un unico file da salvare dove vuoi. Non la musica.',
    failed: 'Impossibile salvare il backup.',
  },
  autoBackup: {
    title: 'Backup automatico',
    off: 'Lo stesso file di «Esporta tutto», salvato da solo ogni giorno o ogni settimana in una cartella che scegli tu.',
    folder: 'Cartella',
    folderUnnamed: 'Cartella scelta',
    chooseOther: 'Scegli un’altra cartella',
    lost: 'Jukebox non riesce più a raggiungere questa cartella: è stata spostata o eliminata, oppure il permesso è stato revocato. Sceglila di nuovo per continuare i backup.',
    chooseAgain: 'Scegli di nuovo la cartella',
    every: 'Ogni quanto',
    daily: 'Ogni giorno',
    weekly: 'Ogni settimana',
    keep: 'Backup conservati',
    keepNote: (count) =>
      oneOrMany(
        count,
        'Nella cartella resta solo il più recente e i precedenti vengono eliminati. Nient’altro nella cartella viene toccato.',
        `Nella cartella restano i ${format.number(count)} più recenti e i precedenti vengono eliminati. Nient’altro nella cartella viene toccato.`
      ),
    last: (when) => `Ultimo backup: ${when}.`,
    never: 'Ancora nessun backup.',
    failed: 'Non è stato possibile fare l’ultimo backup. Si riproverà la prossima volta.',
    now: 'Fai il backup ora',
    made: 'Backup fatto.',
  },
  importBackup: {
    title: 'Importa',
    note: 'Importa un backup. Ti viene mostrato cosa contiene e ti viene chiesta conferma prima di cambiare qualsiasi cosa.',
    failed: 'Importazione non riuscita.',
    refused: (reason) => `${reason} Non è stato modificato niente su questo telefono.`,
  },

  playback: {
    title: 'Riproduzione',
    note: (speed) => `Velocità e tonalità · ${speed}×`,
  },
  equalizer: { note: 'Bande, bassi, surround e loudness' },
  effects: { note: 'Ampiezza, crossfeed, rotazione e livello' },
  /** The tape settings, apart from the music's: see `app/settings-tapes.tsx`. */
  tapes: {
    smartRewind: {
      title: 'Riavvolgimento intelligente',
      note: 'Una cassetta riprodotta di nuovo dopo un po’ riparte poco prima di dove era stata lasciata, tanto più indietro quanto più lunga è stata la pausa: tre secondi dopo una breve pausa, mezzo minuto dopo un giorno. Disattivato, riprende esattamente da dove si era fermata.',
    },
    skipSilence: { title: 'Salta i silenzi', note: 'Le pause nel parlato vengono saltate e la cassetta dura un po’ meno. La musica non viene mai toccata.' },
    voiceClarity: { title: 'Voce più chiara', note: 'Il rimbombo sotto la voce viene abbassato e la parte che distingue le parole un po’ alzata, sopra il tuo equalizzatore. Solo con le cassette.' },
    skipSponsors: { title: 'Salta gli sponsor', note: 'Nelle cassette da YouTube vengono saltate le parti segnate dagli ascoltatori di SponsorBlock: messaggi degli sponsor, autopromozione, inviti a iscriversi.' },
    back: 'Salta indietro',
    forward: 'Salta avanti',
    jumpNote: 'Di quanti secondi saltano i due pulsanti ai lati di play in una cassetta. La musica ha il suo, in Lettore.',
    podcasts: 'Podcast',
    deletePlayed: {
      title: 'Elimina gli episodi ascoltati',
      off: 'Gli episodi dei podcast che segui restano sul telefono dopo l’ascolto.',
      after: (days) => oneOrMany(days, 'Un episodio di un podcast che segui viene eliminato un giorno dopo averlo ascoltato fino in fondo, se l’app lo ha scaricato. Uno con segni resta.', `Un episodio di un podcast che segui viene eliminato ${format.number(days)} giorni dopo averlo ascoltato fino in fondo, se l’app lo ha scaricato. Uno con segni resta.`),
    },
    /** The podcasts followed, as an OPML file: see `podcasts/opml.ts`. */
    opml: {
      heading: 'Porta con te i podcast',
      export: 'Salva i podcast che segui',
      exportNote: 'Come file OPML, leggibile da altre app di podcast.',
      import: 'Segui podcast da un file',
      importNote: 'Un file OPML da un’altra app di podcast. I programmi vengono seguiti senza scaricare nulla da soli; attivalo per ciascuno nella sua schermata.',
      importing: (done, total) => `Lettura ${format.number(done)} di ${format.number(total)}…`,
      imported: (followed, already, failed) => [oneOrMany(followed, '1 podcast seguito.', `${format.number(followed)} podcast seguiti.`), already > 0 ? `${format.number(already)} erano già seguiti.` : '', failed > 0 ? `${format.number(failed)} non leggibili.` : ''].filter(Boolean).join(' '),
      nothing: 'In quel file non ci sono podcast.',
      failed: 'Impossibile leggere o scrivere il file.',
      none: 'Non segui ancora nessun podcast.',
      saved: (count) => oneOrMany(count, '1 podcast salvato.', `${format.number(count)} podcast salvati.`),
    },
  },
  jump: {
    title: 'Salta di',
    note: 'Di quanti secondi si spostano nel brano i due pulsanti ai lati di quello di riproduzione.',
  },
  crossfade: { note: 'Come un brano lascia il posto al successivo' },
  loudness: {
    title: 'Uniforma il volume',
    note:
      'I brani a basso volume vengono alzati e quelli forti abbassati. Un album ascoltato in ordine conserva le proprie differenze di volume.',
  },
  lyricsLanguage: {
    title: 'Traduci i testi in',
    note:
      'I testi vengono tradotti sul telefono. Qualsiasi lingua diversa dall’inglese passa per l’inglese e la prima volta scarica un secondo modello.',
  },
};
