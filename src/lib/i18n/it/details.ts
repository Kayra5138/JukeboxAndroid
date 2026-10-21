import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

const files = (count: number) => `${format.number(count)} file`;

/** What a file's fields are called in a line that says which were written. */
const FIELD_NAMES: Record<string, string> = {
  title: 'titolo',
  artist: 'artista',
  album: 'album',
  albumArtist: 'artista dell’album',
  genre: 'genere',
  year: 'anno',
  track: 'numero di traccia',
  disc: 'numero di disco',
  cover: 'copertina',
};

function listed(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export const details: Strings['details'] = {
  screen: {
    tabs: { general: 'Generale', tags: 'Tag', lyrics: 'Testo' },
    missing:
      'Questo brano non è più nella libreria. Potrebbe essere stato eliminato, spostato o lasciato fuori dalla cartella che Jukebox legge.',
    goBack: 'Torna indietro',
  },

  lookUp: 'Cerca online',
  searchFailed: 'La ricerca non è andata a buon fine.',

  general: {
    fields: {
      title: 'Titolo',
      artist: 'Artista',
      album: 'Album',
      albumArtist: 'Artista dell’album',
      year: 'Anno di uscita',
      trackNumber: 'Numero di traccia',
      discNumber: 'Numero di disco',
    },
    notAYear: 'Questo non è un anno.',
    notAPlace: 'Un numero intero, da 1 in su.',

    chooseCoverLabel: 'Scegli una copertina dalla galleria',
    noCover: 'Nessuna copertina',
    chooseFromGallery: 'Scegli dalla galleria',
    removeCover: 'Rimuovi copertina',
    keepCover: 'Tieni quella che aveva',
    coverChosen: 'Copertina scelta. Salva per tenerla.',

    lookUpHint:
      'Cerca il titolo e l’artista così come sono scritti qui sotto e compila ciò che trova: nomi, album, anno, posizione nel disco e copertina.',
    nothingFound: 'Non è stato trovato niente per questo titolo e artista.',
    found: (sources, withCover) =>
      `Dati trovati su ${sources.join(' e ')}${withCover ? ', copertina inclusa' : ''}. Controllali, poi salva per tenerli.`,

    discard: 'Scarta le mie modifiche',
    saveHint:
      'Ciò che salvi qui viene considerato tuo: una nuova ricerca nella libreria lascerà stare questo brano invece di sovrascriverlo.',
    editGone: 'Le tue modifiche sono state annullate. Una ricerca può compilare di nuovo questi campi.',

    inFile: 'Nel file',
    writeLabel: 'Scrivi questi dettagli nel file',
    writeToFile: 'Scrivi nel file',
    saveFirst: 'Prima salva. Nel file viene scritto solo ciò che è stato salvato.',
    writeHint:
      'Scrive nel file stesso titolo, artista, album, anno, numero di traccia e di disco ' +
      'come li mostra la libreria, il primo tag come genere e una copertina salvata qui, ' +
      'dove altri lettori e altri dispositivi li troveranno. Android chiede conferma ' +
      'prima di modificare qualsiasi cosa. Tutto il resto del file rimane com’è, ' +
      'e il testo non viene scritto.',
    cannotWrite: 'Si può scrivere solo nei file MP3 e FLAC. I dettagli di questo restano nell’app.',
    nothingWritten: 'Non è stato scritto niente.',
    couldNotWrite: 'Impossibile scrivere nel file.',

    listening: 'Ascolto',
    timesPlayed: 'Riproduzioni',
    playedToEnd: 'Ascoltato fino alla fine',
    timeSpent: 'Tempo di ascolto',
    firstPlayed: 'Primo ascolto',
    lastPlayed: 'Ultimo ascolto',
    never: 'mai',
    listenedSeconds: (seconds) =>
      oneOrMany(seconds, '1 secondo', `${format.number(seconds)} secondi`),
    listenedMinutes: (minutes) =>
      oneOrMany(minutes, '1 minuto', `${format.number(minutes)} minuti`),
    listenedHours: (hours, minutes) => `${format.number(hours)} h ${minutes} min`,

    file: 'File',
    name: 'Nome',
    folder: 'Cartella',
    length: 'Durata',
    detailsFrom: 'Origine dei dettagli',
    unknown: 'sconosciuto',
    from: {
      notLookedUp: 'nessuna ricerca',
      yourEdit: 'modifica manuale',
      notFound: 'nessun risultato',
      lookup: 'ricerca online',
    },
  },

  tags: {
    lookUpHint:
      'Cerca i tag di questo brano. Quelli che hai scritto tu restano; quelli portati da una ricerca precedente vengono sostituiti da ciò che trova ora.',
    noneFound: 'Nessun tag trovato per questo brano.',
    found: (count, source) =>
      `${format.number(count)} tag da ${source}. Riordinali, poi salva per tenerli.`,
    saveHint:
      'Il primo tag è quello che conta come genere. Un tag scritto da te resta tuo: nessuna ricerca successiva lo rimuoverà.',
  },

  editor: {
    label: 'Tag',
    add: 'Aggiungi un tag',
    moveUp: (tag) => `Sposta in alto il tag ${tag}`,
    moveDown: (tag) => `Sposta in basso il tag ${tag}`,
    remove: (tag) => `Rimuovi il tag ${tag}`,
  },

  tagPrompt: {
    heading: (count) =>
      oneOrMany(count, 'Aggiungi un tag a 1 brano', `Aggiungi un tag a ${format.number(count)} brani`),
    placeholder: 'Tag',
  },

  lyrics: {
    lookUpHint:
      'Cerca il testo di questo brano come fa quando lo riproduci, e se lo trova sostituisce quello salvato.',
    nothingMatched: 'Niente corrisponde a questo brano. La ricerca qui sotto non esclude nulla.',
    foundAndSaved: 'Trovato e salvato.',
    nothingCameBack: 'Nessun risultato.',
    cleared: 'Cancellato. La prossima ricerca lo cercherà di nuovo.',
    notSeconds: 'Questo non è un numero di secondi.',

    stored: 'Testo salvato',
    none: 'Ancora nessuno',
    kept: (timed, byHand, lines) =>
      `${timed ? 'Sincronizzato' : 'Testo semplice'}, ${byHand ? 'scelto a mano' : 'da LRCLIB'}` +
      (lines > 0 ? ` · ${oneOrMany(lines, '1 riga', `${format.number(lines)} righe`)}` : ''),
    forget: 'Dimentica e cerca di nuovo',
    saveChanges: 'Salva modifiche',
    timedHint:
      'Ogni riga ha il suo tempo all’inizio. Cambia le parole ma lascia le parentesi, altrimenti la riga perde la sua posizione.',
    plainHint: 'Cambia quello che vuoi. Il testo salvato resta tuo e nessuna ricerca lo sostituisce.',

    timing: 'Sincronia',
    timingHint:
      'Sposta tutte le righe insieme. Usala quando le parole sono giuste ma arrivano in anticipo o in ritardo: apri il lettore e regola finché non coincidono, oppure tocca il numero e scrivilo. Uno spostamento positivo fa arrivare le parole più tardi.',
    earlier: (seconds) => `−${seconds} s`,
    later: (seconds) => `+${seconds} s`,
    shiftedEarlier: (written) => `−${written} s`,
    shiftedLater: (written) => `+${written} s`,
    noShift: 'nessuno spostamento',
    reset: 'Azzera',
    offsetHeading: 'Di quanto sono sfasate le parole?',
    offsetPlaceholder: 'Secondi, es. 1,5 o -0,75',
    typeOffset: 'Inserisci uno spostamento esatto',
    wordsField: 'Testo',

    byHand: 'Cerca a mano',
    byHandHint:
      'Qui non viene escluso niente, a differenza della ricerca automatica, che scarta tutto ciò che ha una durata diversa: per questo alcuni brani non trovano mai il loro testo.',
    queryPlaceholder: 'Artista e titolo',
    candidateTimed: 'sincronizzato',
    candidatePlain: 'semplice',

    paste: 'Incolla',
    pasteHint: 'Accetta un file LRC o testo semplice. Con i timestamp diventa un testo sincronizzato.',
    savePasted: 'Salva testo incollato',
  },

  library: {
    coversSaved: (count) =>
      oneOrMany(count, '1 copertina di album aggiunta.', `${format.number(count)} copertine di album aggiunte.`),
    stoppedOffline: (matched) =>
      `Nessuna risposta, quindi la ricerca si è fermata dopo ${format.number(matched)} ${oneOrMany(matched, 'brano trovato', 'brani trovati')}. Per gli altri brani non è stato scritto niente: sono ancora in attesa di essere cercati.`,
    serviceUnreachable: (service) =>
      `Impossibile raggiungere ${service}, quindi la ricerca è proseguita senza. Ciò che ne aveva bisogno è rimasto com’era e verrà ritentato la prossima volta.`,
    stoppedUnexpectedly: 'La ricerca si è interrotta inaspettatamente.',

    nothingAnswered: 'Nessuna risposta. Interruzione.',
    rateLimited: 'Uno dei servizi ha chiesto una pausa. Verrà interpellato di nuovo tra un minuto.',
    lookingUp: 'Ricerca in corso…',
    lookingUpProgress: (done, total) =>
      `Ricerca in corso… ${format.number(done)} di ${format.number(total)} ${oneOrMany(total, 'brano completato', 'brani completati')}`,
    lookingUpAlbum: (album, done, total) =>
      `Ricerca di «${album}» in corso… ${format.number(done)} di ${format.number(total)} ${oneOrMany(total, 'brano completato', 'brani completati')}`,
    soFar: (matched, covers) =>
      `Finora ${format.number(matched)} ${oneOrMany(matched, 'trovato', 'trovati')}, ${format.number(covers)} ${oneOrMany(covers, 'copertina', 'copertine')}`,
    stop: 'Ferma',
    lookupChannel: 'Ricerche di dati',

    selected: (count) => `${format.number(count)} ${oneOrMany(count, 'selezionato', 'selezionati')}`,
    summary: (matched, edited, notFound, untried) =>
      [
        `${format.number(matched)} ${oneOrMany(matched, 'trovato', 'trovati')}`,
        edited > 0 ? `${format.number(edited)} ${oneOrMany(edited, 'modificato', 'modificati')}` : null,
        `${format.number(notFound)} non ${oneOrMany(notFound, 'trovato', 'trovati')}`,
        `${format.number(untried)} da cercare`,
      ]
        .filter(Boolean)
        .join(' · '),
    reset: 'Azzera',
    lookUpMissing: 'Cerca mancanti',
    hint: 'Tocca un brano per correggerlo a mano. Trascina verso il basso sulle caselle per selezionarne una serie.',
    searchPlaceholder: 'Cerca tra questi brani',

    noGenre: 'nessun genere',
    noMatch: 'nessuna corrispondenza',
    notLookedUp: 'non ancora cercato',
    matchedSpoken: (artist, title) => `Trovato: ${artist} — ${title}`,
    manualSpoken: (artist, title) => `Impostato a mano: ${artist} — ${title}`,
  },

  selection: {
    more: 'Altro…',
    moreHint: 'Tutto quello che puoi fare con i brani selezionati',
    heading: (count) =>
      oneOrMany(count, '1 brano selezionato', `${format.number(count)} brani selezionati`),
    sections: { find: 'Cerca online', change: 'Modifica', other: 'Altro' },
    actions: {
      lookUp: {
        label: 'Cerca i dettagli online',
        hint: 'Dimentica ciò che era stato trovato per loro e li cerca di nuovo, copertine comprese. Le tue modifiche restano.',
      },
      covers: {
        label: 'Cerca le copertine online',
        hint: 'Solo copertine, per i brani che non ne hanno. Nient’altro viene cercato di nuovo, e una copertina che hai scelto o tolto resta com’è.',
      },
      lyrics: {
        label: 'Cerca i testi online',
        hint: 'Prima nei file e nei .lrc, poi su LRCLIB. I testi scelti da te restano.',
      },
      edit: {
        label: 'Modifica i dettagli insieme',
        hint: 'Artista, artista dell’album, album o anno, per tutti in una volta',
      },
      addTag: { label: 'Aggiungi un tag', hint: 'Un tag, aggiunto a tutti' },
      removeTag: { label: 'Togli un tag', hint: 'Uno dei loro tag, tolto da tutti' },
      cover: { label: 'Scegli una copertina', hint: 'Un’immagine dalla galleria, per tutti' },
      write: {
        label: 'Scrivi nei file',
        hint: 'Scrive nei file stessi i dettagli come li mostra la libreria. Android chiede prima.',
      },
      addToList: { label: 'Aggiungi a una lista', hint: 'Li mette in una delle tue liste' },
      reset: {
        label: 'Azzera',
        hint: 'Dimentica ciò che le ricerche hanno trovato per loro. Le tue modifiche restano.',
      },
      delete: { label: 'Elimina dal telefono', hint: 'Cancella i file. Android chiede prima.' },
    },
    busy: 'C’è già una ricerca in corso. Aspetta che finisca o fermala.',

    editHeading: (count) => oneOrMany(count, 'Modifica 1 brano', `Modifica ${format.number(count)} brani`),
    editHint:
      'Compila solo ciò che deve essere uguale per tutti. Una casella vuota lascia ogni brano com’è; per svuotare un campo su tutti, spunta l’opzione sotto. Titoli e numeri di traccia e di disco non vengono toccati.',
    keepEach: 'Ognuno mantiene il suo',
    empty: 'Vuoto',
    clearOn: { remove: 'Rimuovi da tutti', own: 'Usa l’artista di ogni file' },
    cleared: { remove: 'Verrà rimosso da tutti', own: 'L’artista di ogni file' },
    edited: (count) =>
      oneOrMany(
        count,
        'Salvato. Ora è una tua modifica e le ricerche non la toccano.',
        `Salvato per ${format.number(count)} brani. Ora sono modifiche tue e le ricerche non le toccano.`
      ),

    tagAdded: (tag, count) =>
      `«${tag}» ora è su ${format.number(count)} ${oneOrMany(count, 'brano', 'brani')}.`,
    removeTagHeading: (count) =>
      `Togli un tag da ${format.number(count)} ${oneOrMany(count, 'brano', 'brani')}`,
    tagOption: (tag, count) => `${tag} · ${format.number(count)}`,
    noTags: 'Nessuno di questi brani ha tag.',
    tagRemoved: (tag, count) =>
      `«${tag}» è stato tolto da ${format.number(count)} ${oneOrMany(count, 'brano', 'brani')}.`,

    resetQuestion: (count) =>
      oneOrMany(count, 'Azzerare 1 brano?', `Azzerare ${format.number(count)} brani?`),
    resetBody:
      'Ciò che le ricerche hanno trovato per loro viene dimenticato, e risultano come mai cercati. Le tue modifiche restano. Non si può annullare.',

    coversProgress: (done, total) =>
      `Ricerca delle copertine… ${format.number(done)} di ${format.number(total)} brani completati`,
    coversNone: 'Nessuna nuova copertina trovata.',
    lyricsProgress: (done, total) =>
      `Ricerca dei testi… ${format.number(done)} di ${format.number(total)} brani completati`,
    lyricsSoFar: (found) => `${format.number(found)} trovati finora`,
    lyricsFound: (found, wanted, had) =>
      [
        wanted > 0 ? `Testo trovato per ${format.number(found)} su ${format.number(wanted)}.` : null,
        had > 0 ? oneOrMany(had, '1 lo aveva già.', `${format.number(had)} lo avevano già.`) : null,
      ]
        .filter(Boolean)
        .join(' ') || 'Niente da cercare: i testi di questi brani li hai scelti tu.',
    lyricsOffline:
      'LRCLIB non è raggiungibile, quindi la ricerca si è fermata. Il resto si potrà riprovare più tardi.',
  },

  write: {
    heading: (count) => `Scrivere i dettagli in ${files(count)}?`,
    body: (count) =>
      `${oneOrMany(count, 'Verrà modificato 1 file', `Verranno modificati ${files(count)}`)}: per ognuno, titolo, ` +
      'artista, album, anno, numero di traccia e di disco, il primo tag come genere e la copertina ' +
      'salvata, così come li mostra la libreria, vengono scritti nel file stesso. Android ti chiederà ' +
      'di consentirlo. Tutto il resto del file rimane com’è.',
    noneHeading: 'Impossibile scrivere in questi file',
    noneBody: 'Si può scrivere solo nei file MP3 e FLAC, e non nel brano in riproduzione.',
    skipping: (otherKind, playing) => {
      const others = oneOrMany(
        otherKind,
        '1 file di un altro tipo verrà saltato',
        `${files(otherKind)} di un altro tipo verranno saltati`
      );
      return otherKind > 0 && playing
        ? `${others}, e verrà saltato anche il brano in riproduzione.`
        : otherKind > 0
          ? `${others}.`
          : 'Il brano in riproduzione verrà saltato.';
    },
    confirmLabel: (count) => `Scrivi i dettagli in ${files(count)}`,
    confirm: 'Scrivi',
    nothingWritten: 'Non è stato scritto niente.',
    couldNotStart: 'Impossibile avviare la scrittura.',

    writing: 'Scrittura nei file',
    progressLabel: (done, total) => `File scritti: ${format.number(done)} di ${format.number(total)}`,
    progress: (done, total) => `${format.number(done)} di ${format.number(total)}`,
    stopping: 'Si fermerà al termine di questo file.',
    keepOpen: 'Ogni file viene verificato prima di toccare l’originale. Tieni aperta l’app.',
    stopLabel: 'Ferma dopo il file in corso',
    stop: 'Ferma',
    stoppedShort: (count) =>
      oneOrMany(count, 'Interrotto: 1 file non è stato elaborato.', `Interrotto: ${files(count)} non sono stati elaborati.`),

    written: (changed) =>
      changed.length > 0
        ? `Campi scritti: ${listed(changed.map((name) => FIELD_NAMES[name] ?? name))}.`
        : 'Scritto.',
    unchanged: 'Contiene già tutto questo. Lasciato com’è.',
    skippedPlaying: 'Saltato: è in riproduzione. Riprova quando non lo è più.',
    skippedFormat: 'Saltato: si può scrivere solo nei file MP3 e FLAC.',
    failed: (reason) => `Non riuscito: ${reason}`,
    noReason: 'Impossibile scrivere. Il file non è stato toccato.',

    summary: (counts) => {
      const parts: string[] = [];
      if (counts.written > 0) {
        parts.push(oneOrMany(counts.written, 'Scritto 1 file.', `Scritti ${files(counts.written)}.`));
      }
      if (counts.unchanged > 0) {
        parts.push(oneOrMany(counts.unchanged, '1 file era già aggiornato.', `${files(counts.unchanged)} erano già aggiornati.`));
      }
      if (counts.skipped > 0) {
        parts.push(oneOrMany(counts.skipped, 'Saltato 1 file.', `Saltati ${files(counts.skipped)}.`));
      }
      if (counts.failed > 0) {
        parts.push(oneOrMany(counts.failed, '1 file non riuscito.', `${files(counts.failed)} non riusciti.`));
      }
      return parts.length > 0 ? parts.join(' ') : 'Niente da scrivere.';
    },
  },

  same: {
    note:
      'Sembrano la stessa canzone in due file diversi. Unendoli, tutto ciò che ha il primo file passa al secondo: ascolti, tag, testo e posizioni nelle liste. Tenendoli separati restano entrambi come sono, e non ti verrà più chiesto di questa coppia.',
    failed: (error) => `Operazione non riuscita; non è stato modificato niente. ${error}`,
    empty: 'Non resta niente da decidere.',
    from: 'Da',
    into: 'In',
    keepApart: 'Tieni separati',
    merge: 'Unisci',
    bulk: {
      mergeDelete: 'Unisci ed elimina il primo file',
      deleteToo: 'Elimina anche il primo file di ogni coppia',
      deleteNote: 'Android chiede conferma prima di eliminare qualcosa.',
      notDeleted: 'I file non sono stati eliminati.',
      deleted: (count) => oneOrMany(count, '1 file eliminato.', `${format.number(count)} file eliminati.`),
      choose: 'Scegli questa coppia',
      chosen: (count) => oneOrMany(count, '1 coppia scelta', `${format.number(count)} coppie scelte`),
      merge: (count) => `Unisci ${format.number(count)}`,
      keepApart: (count) => `Tieni separate ${format.number(count)}`,
      confirm: (count) =>
        oneOrMany(
          count,
          'Unire 1 coppia? Ascolti, tag, testo e posizioni nelle liste del primo file passano al secondo, e non si possono più separare.',
          `Unire ${format.number(count)} coppie? In ognuna, ascolti, tag, testo e posizioni nelle liste del primo file passano al secondo, e non si possono più separare.`
        ),
      done: (done, skipped) =>
        skipped > 0
          ? `${oneOrMany(done, '1 coppia risolta', `${format.number(done)} coppie risolte`)}; ${oneOrMany(skipped, '1 era già risolta', `${format.number(skipped)} erano già risolte`)} da un’altra risposta.`
          : oneOrMany(done, '1 coppia risolta.', `${format.number(done)} coppie risolte.`),
    },
    unknown: 'Sconosciuto',
    noFileName: 'Nome del file sconosciuto',
    holds: (side) => {
      const parts: string[] = [];
      if (side.listens > 0) {
        parts.push(oneOrMany(side.listens, '1 ascolto', `${format.number(side.listens)} ascolti`));
      }
      if (side.tags > 0) parts.push(oneOrMany(side.tags, '1 tag', `${format.number(side.tags)} tag`));
      if (side.lyrics) parts.push('testo');
      if (side.lists > 0) {
        parts.push(oneOrMany(side.lists, 'in 1 lista', `in ${format.number(side.lists)} liste`));
      }
      return parts.length > 0 ? parts.join(' · ') : 'Ancora niente';
    },
  },
};
