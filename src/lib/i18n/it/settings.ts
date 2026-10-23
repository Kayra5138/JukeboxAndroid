import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `Ultima build: ${when}`,
  lastBuiltUnknown: 'Ultima build: disponibile dopo aver installato il nuovo APK',

  sections: {
    look: 'Aspetto',
    sound: 'Audio',
    player: 'Lettore',
    library: 'Libreria',
    downloads: 'Download e Scopri',
    data: 'I tuoi dati',
    views: 'Viste della libreria',
    experimental: 'Sperimentale',
  },
  categories: {
    look: 'Il tema, gli album come scaffale, le animazioni e quali viste offre la libreria.',
    sound: 'Equalizzatore ed effetti, volume uniforme, dissolvenza incrociata, velocità e tonalità.',
    player: 'La durata dei salti avanti e indietro, cosa suona quando finisce la coda e la lingua in cui vengono tradotti i testi.',
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
  heart: { title: 'Cuore', note: 'Un cuore nel lettore. Non salva niente.' },
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
  moreButton: {
    title: 'Tre puntini su ogni riga',
    note:
      'Alla fine di ogni riga di brani, aprono lo stesso menu della pressione prolungata. Anche senza, basta tenere premuta una riga.',
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
      'Cronologia degli ascolti, liste, tag, testi e impostazioni, in un unico file da salvare dove vuoi. Non la musica.',
    failed: 'Impossibile salvare il backup.',
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
