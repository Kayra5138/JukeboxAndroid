import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const sound: Strings['sound'] = {
  percent: (value) => `${format.number(value)}%`,

  effects: {
    failures: {
      unsupported: 'Installa la versione Android aggiornata per usare gli effetti.',
      unreadable: 'Impossibile leggere gli effetti. Restano disattivati finché non si riprova.',
      unsent: 'L’impostazione non è arrivata al lettore.',
    },
    title: 'Effetti',
    presets: {
      off: { name: 'Disattivato', hint: 'La registrazione così com’è' },
      mono: { name: 'Mono', hint: 'Uguale in entrambe le orecchie, per un solo auricolare' },
      wide: { name: 'Ampio', hint: 'I lati spinti verso l’esterno' },
      headphones: { name: 'Cuffie', hint: 'Porta fuori dalla testa i mix con panning estremo' },
      '8d': { name: '8D', hint: 'Il suono ti gira lentamente intorno' },
      karaoke: { name: 'Quasi karaoke', hint: 'Allontana il centro' },
    },
    voices: {
      off: { name: 'Disattivato', hint: 'Il disco così com’è' },
      robot: { name: 'Robot', hint: 'Modulato con un tono basso: metallico, come una campana' },
      vintage: { name: 'Vintage', hint: 'Meno bit, un clock più grezzo e gli acuti tagliati' },
      swirl: { name: 'Vortice', hint: 'Un lento ondeggiare, come un jet che passa sopra la testa' },
      chipmunk: { name: 'Scoiattolo', hint: 'Una quinta più in alto, con il tempo invariato' },
      squeak: { name: 'Più scoiattolo', hint: 'Un’ottava intera: non sembra più una voce' },
    },
    ownSettings: 'Impostazioni personali',
    howMuch: 'Intensità',
    voiceNote:
      'Ogni effetto voce mantiene le armoniche originali del disco e le modifica, così sotto resta la stessa canzone. Abbassa l’intensità per sentirla più com’è stata registrata.',

    stereo: 'Stereo',
    width: 'Ampiezza',
    mono: 'Mono',
    asRecorded: 'Come registrato',
    balance: 'Bilanciamento',
    centre: 'Centro',
    left: (percent) => `${percent}% a sinistra`,
    right: (percent) => `${percent}% a destra`,
    swap: { title: 'Inverti i canali', note: 'Il canale sinistro diventa il destro. Per un cavo collegato male.' },

    headphones: 'Cuffie',
    crossfeed: 'Crossfeed',
    crossfeedNote:
      'Un po’ di ciascun canale arriva all’orecchio opposto, in ritardo e attenuato, come succederebbe con le casse. Rende meno faticosi i vecchi mix con panning estremo. Con le casse non serve a niente.',

    rotation: 'Rotazione',
    depth: 'Profondità',
    turnTakes: 'Un giro dura',
    seconds: (count) => `${count} s`,
    rotationNote:
      'Il cosiddetto 8D: il suono ti gira lentamente intorno. Pensato per le cuffie: con una cassa è solo il volume che va e viene.',

    level: 'Livello',
    preamp: 'Preamplificazione',
    decibels: (value) => `${value > 0 ? '+' : ''}${format.decimal(value, 1)} dB`,
    levelNote:
      'Abbassala se l’allargamento o l’equalizzatore fanno gracchiare qualcosa: è il suono dei picchi più forti che restano senza spazio.',
  },

  transitions: {
    missing: 'Questa versione dell’app non ha ancora le transizioni.',
    title: 'Dissolvenza incrociata',
    about: 'Un brano continua a suonare mentre parte il successivo, così non si sente lo stacco.',
    betweenTracks: 'Tra un brano e l’altro',
    overlap: 'Sovrapposizione',
    overlapNote:
      'Quanta parte del brano in uscita viene coperta dal successivo. Con zero i brani finiscono normalmente.',
    albums: {
      title: 'Non separare gli album',
      note:
        'Nessuna dissolvenza tra brani consecutivi dello stesso album. Un disco dal vivo o un album mixato senza pause è fatto per avere quel passaggio.',
    },
    others: {
      manualMs: {
        label: 'Salto',
        hint:
          'Quando premi Successivo o Precedente. Meglio tenerla breve: un pulsante che risponde in ritardo sembra scollegato.',
      },
      pauseMs: {
        label: 'Pausa e ripresa',
        hint: 'Ammorbidisce l’arresto e la ripartenza.',
      },
      seekMs: {
        label: 'Spostamento',
        hint: 'Dopo aver trascinato la barra di avanzamento, che altrimenti atterra a metà forma d’onda e fa un clic.',
      },
    },
    equalPower: {
      title: 'Curva a potenza costante',
      note:
        'Due brani a metà volume, insieme, non suonano forti quanto uno solo a volume pieno. Questa curva mantiene il livello durante la sovrapposizione; quella lineare cala al centro.',
    },
    fewer: 'Meno impostazioni',
    more: 'Altre transizioni',
    reset: 'Ripristina predefiniti',
    seconds: (written) => `${written} s`,
  },

  equalizer: {
    missing: 'Questa versione dell’app non ha ancora l’equalizzatore.',
    title: 'Equalizzatore',
    attached: 'Agisce su ciò che è in riproduzione.',
    saved: 'Salvato, e applicato appena parte qualcosa.',
    carried:
      'Le impostazioni dell’equalizzatore del telefono sono state trasferite e conservate tra i preset come «Equalizzatore del telefono». È la stessa curva ricostruita con le bande di questo equalizzatore, che ora lascia spazio a ciò che amplifica, quindi potrebbe suonare un po’ più bassa di prima.',
    lost:
      'Non è stato possibile trasferire le impostazioni dell’equalizzatore del telefono: le sue bande non corrispondevano a frequenze precise. Questo equalizzatore parte da una curva piatta.',

    presets: 'Preset',
    saveAs: 'Salva come…',
    rename: 'Rinomina…',
    confirmDelete: (name) => `Eliminare «${name}»?`,
    importAutoEq: 'Importa da AutoEQ…',
    keptAs: (name) => `Salvato come «${name}».`,
    renamedTo: (name) => `Rinominato in «${name}».`,

    bands: 'Bande',
    noBands:
      'Nessuna banda, quindi piatto: la musica come è stata registrata. Aggiungine una, scegli un preset o importa una correzione per le tue cuffie.',
    addBand: 'Aggiungi una banda',
    full: (most) => `Non c’è spazio per più di ${most} bande.`,

    preamp: 'Preamplificazione',
    automatic: 'Automatica',
    byHand: 'Manuale',
    nothingBoosted: 'Niente è amplificato, quindi niente viene abbassato per fare spazio.',
    turnedDown: (by) =>
      `Tutto viene abbassato di ${by}, pari al massimo innalzamento della curva. È lo spazio che serve a un’amplificazione per non distorcere.`,
    typeIt: (now) => `Inserisci il valore · ${now}`,
    typePreamp: (now) => `Inserisci la preamplificazione, ora ${now}`,
    clipsAbove: (level) =>
      `Sopra ${level} i passaggi più forti possono distorcere, e si sentono gracchiare.`,
    lowEnough: 'Abbastanza bassa da non far distorcere niente di ciò che questa curva amplifica.',

    unbuilt:
      'Questa versione dell’app riproduce ancora attraverso l’equalizzatore del telefono, che questa schermata non imposta più. Le bande arriveranno con la prossima versione; i controlli qui sotto funzionano come prima.',

    tone: 'Tono',
    bassBoost: 'Potenziamento bassi',
    surround: 'Surround',
    loudness: 'Loudness',
    toneNote:
      'Questi tre sono effetti del telefono, applicati dopo le bande. Loudness alza una registrazione a basso volume senza toccarne il tono. Se spinto troppo distorce, e le parti forti si sentono gracchiare.',
    resetAll: 'Ripristina tutto',

    prompt: {
      keepCurveAs: 'Salva questa curva come',
      keepCorrectionAs: 'Salva questa correzione come',
      namePlaceholder: 'Un nome, per esempio le cuffie a cui serve',
      keep: 'Salva',
      aName: 'Un nome',
      set: 'Imposta',
      preampHint: (least, most) => `In decibel, da ${least} a ${most}.`,
      frequency: (band) => `Frequenza della banda ${band}`,
      frequencyHint: (least, most) =>
        `In hertz, da ${least} a ${most}. 1,2k vale 1200.`,
      gain: (band) => `Guadagno della banda ${band}`,
      gainHint: (most) => `In decibel, da -${most} a ${most}.`,
      q: (band) => `Q della banda ${band}`,
      qHint: (least, most) => `Da ${least} a ${most}.`,
    },
  },

  presets: {
    builtIn: {
      Flat: 'Piatto',
      'More bass': 'Più bassi',
      'Less boom': 'Meno rimbombo',
      Warm: 'Caldo',
      'Voices forward': 'Voci in primo piano',
      'More air': 'Più aria',
      'Quiet listening': 'Ascolto a basso volume',
    },
    myCurve: 'La mia curva',
  },

  band: {
    types: { peak: 'Picco', lowShelf: 'Shelf basso', highShelf: 'Shelf alto' },
    said: (band, type, frequency, gain, q) =>
      `Banda ${band}: ${type}, ${frequency}, ${gain}, Q ${q}`,
    closes: 'Chiude questa banda',
    opens: 'Apre questa banda per modificarla',
    kind: (band, type) => `Tipo della banda ${band}: ${type}`,
    frequency: 'Frequenza',
    gain: 'Guadagno',
    widthQ: 'Larghezza (Q)',
    cornerQ: 'Pendenza (Q)',
    peakHint: 'Un Q più alto è una banda più stretta: 1 è poco più di un’ottava, 10 una sola nota.',
    shelfHint:
      'Uno shelf alza o abbassa tutto ciò che sta da un lato della sua frequenza. Q indica quanto è netta la curva; il valore tipico è 0,7.',
    typeIt: 'Inserisci il valore',
    typeFrequency: (band, now) => `Inserisci la frequenza della banda ${band}, ora ${now}`,
    typeGain: (band, now) => `Inserisci il guadagno della banda ${band}, ora ${now}`,
    typeQ: (band, now) => `Inserisci il Q della banda ${band}, ora ${now}`,
    remove: (band) => `Rimuovi la banda ${band}`,
    removeThis: 'Rimuovi questa banda',
  },

  curve: {
    label: (said) => `Curva di risposta. ${said}`,
    flat: 'Piatta: niente viene alzato o abbassato.',
    highest: (level, near) => `Massimo ${level} intorno a ${near}.`,
    lowest: (level, near) => `Minimo ${level} intorno a ${near}.`,
    highestAndLowest: (high, highNear, low, lowNear) =>
      `Massimo ${high} intorno a ${highNear}, minimo ${low} intorno a ${lowNear}.`,
  },

  autoEq: {
    title: 'Importa da AutoEQ',
    about: 'Incolla il contenuto del file ParametricEQ.txt delle tue cuffie, oppure scegli il file.',
    textLabel: 'Il testo del file ParametricEQ',
    chooseFile: 'Scegli un file…',

    graphic:
      'Questo è il file GraphicEQ, che serve a un altro tipo di equalizzatore. Quello da usare è ParametricEQ.txt.',
    noneSupported: 'Nessuno dei filtri in questo testo è di un tipo supportato da questo equalizzatore.',
    noneFound:
      'In questo testo non sono stati trovati filtri. Una riga dovrebbe essere simile a «Filter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70».',
    imported: (count) => oneOrMany(count, '1 banda importata.', `${count} bande importate.`),
    leftOut: (count, room) =>
      oneOrMany(
        count,
        `Un’altra è stata esclusa: c’è spazio per ${room}.`,
        `Altre ${count} sono state escluse: c’è spazio per ${room}.`
      ),
    unsupported: (count) =>
      oneOrMany(
        count,
        '1 filtro era di un tipo che questo equalizzatore non ha ed è stato saltato.',
        `${count} filtri erano di un tipo che questo equalizzatore non ha e sono stati saltati.`
      ),
    adjusted: (count) =>
      oneOrMany(
        count,
        '1 era fuori dai valori ammessi per una banda ed è stato riportato entro i limiti.',
        `${count} erano fuori dai valori ammessi per una banda e sono stati riportati entro i limiti.`
      ),
  },
};
