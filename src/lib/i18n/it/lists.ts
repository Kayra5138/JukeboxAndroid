import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

const tracks = (count: number) => `${format.number(count)} ${oneOrMany(count, 'brano', 'brani')}`;

export const lists: Strings['lists'] = {
  naming: {
    heading: 'Dai un nome alla lista',
    placeholder: 'Nome della lista',
    create: 'Crea',
  },

  screen: {
    newList: 'Nuova lista',
    fromTag: 'Da un tag',
    empty: 'Ancora niente. Una lista è un ordine scelto da te: l’unica cosa che i tag non possono contenere.',
    followingTag: (count, tag) => `${tracks(count)} · segue ${tag}`,
    fromListening: 'Dai tuoi ascolti',
    discover: 'Scopri',
    discoverHint: 'Musica che non hai, a partire da ciò che ascolti',

    tagSheet: {
      heading: 'Crea una lista da un tag',
      follows: 'Segue il tag',
      copy: 'Una copia',
      followsHint:
        'Sempre tutto ciò che ha il tag. Se in seguito aggiungi il tag a qualcosa, compare qui; niente può essere riordinato o rimosso.',
      copyHint:
        'Prende ciò che ha il tag in questo momento. Da lì in poi le due cose vanno per conto loro, e la lista puoi ordinarla come vuoi.',
      noTags: 'Ancora nessun tag. Prima cerca le informazioni di qualche brano.',
    },
  },

  auto: {
    mostPlayed: { name: 'Più ascoltati', hint: 'Ciò a cui continui a tornare' },
    recentlyFound: { name: 'Nuovi del mese', hint: 'Ascoltati per la prima volta da inizio mese' },
    forgotten: { name: 'Dimenticati', hint: 'Ascoltati tanto in passato, ma non negli ultimi sei mesi' },
    skipped: { name: 'Più saltati', hint: 'Quelli che continui a saltare' },
  },

  picker: {
    /* The lists below finish the sentence: "Aggiungi 3 brani a" … "Preferiti". */
    heading: (count) => `Aggiungi ${tracks(count)} a`,
    noLists: 'Ancora nessuna lista.',
    newList: 'Nuova lista…',
    already: (list) => `Già in ${list}`,
    added: (count, list) =>
      oneOrMany(count, `1 brano aggiunto a ${list}`, `${format.number(count)} brani aggiunti a ${list}`),
  },

  trackPicker: {
    heading: 'Aggiungi brani',
    search: 'Cerca nella libreria',
    alreadyHere: 'Già in questa lista',
    add: (count) => `Aggiungi ${tracks(count)}`,
  },

  list: {
    album: 'Album',
    artist: 'Artista',
    folder: 'Cartella',
    list: 'Lista',

    everythingTagged: (tag) => `Tutto ciò che ha il tag ${tag}, così com’è ora`,
    away: (count) =>
      oneOrMany(
        count,
        'Un altro brano al momento non è nella libreria',
        `Altri ${format.number(count)} brani al momento non sono nella libreria`
      ),

    addTracks: 'Aggiungi brani',
    cover: 'Copertina',
    deleteList: 'Elimina lista',

    albums: 'Album',
    tracks: 'Brani',
    opensAlbum: 'Apre l’album',

    empty: {
      editable: 'Ancora niente qui. Aggiungi brani qui sopra o inviali dalla libreria.',
      tag: 'Niente ha ancora questo tag. Aggiungilo a qualche brano e compariranno qui.',
      album: 'Questo album non è più nella libreria.',
      artist: 'Nella libreria non c’è più niente attribuito a questo artista.',
      folder: 'In questa cartella non c’è più niente.',
      auto: 'Ancora nessun brano corrisponde. Prima ascolta un po’ di musica.',
    },

    mightBelong: 'Potrebbero starci bene',
    mightBelongHint:
      'Scelti in base ai tag su cui la lista già si basa, pesati in modo che un tag raro conti più di uno che ha mezza libreria.',

    choosePicture: 'Scegli un’immagine…',
    firstFour: 'Usa le prime quattro copertine',

    renameHeading: 'Rinomina la lista',
    deleteQuestion: (name) => `Eliminare «${name}»?`,
    deleteHint: 'La lista viene eliminata. I brani restano sul telefono.',
  },

  files: {
    importFiles: 'Importa liste M3U…',
    exportAll: 'Esporta tutte le liste…',
    export: 'Esporta…',
    untitled: 'Lista importata',
    reading: 'Lettura delle liste…',

    conflict: {
      heading: (name) => `Esiste già una lista chiamata «${name}»`,
      hint: 'Il file può prenderne il posto, mantenendo la copertina, o entrare come lista a sé.',
      replace: 'Sostituiscila',
      keepBoth: (name) => `Aggiungi come «${name}»`,
      skip: 'Salta questo file',
    },

    result: {
      heading: 'Importato',
      imported: (name, found, total) =>
        `Lista ${name} importata: ${format.number(found)} su ${format.number(total)} ${oneOrMany(found, 'trovato', 'trovati')}`,
      repeated: (count) =>
        oneOrMany(
          count,
          'Un brano compariva più volte nel file; la lista lo contiene una volta sola.',
          `${tracks(count)} comparivano più volte nel file; la lista li contiene una volta sola.`
        ),
      showMissing: (count) => oneOrMany(count, 'Mostra quello non trovato', `Mostra i ${format.number(count)} non trovati`),
      hideMissing: 'Nascondi',
      reasons: {
        notFound: 'Niente nella libreria corrisponde',
        ambiguous: 'Corrisponde più di un brano',
        web: 'Un indirizzo web, non un file',
      },
      tooBig: (file) => `${file} è troppo grande per essere una lista.`,
      unreadable: (file) => `Impossibile leggere ${file} come lista.`,
      empty: (file) => `${file} è vuoto.`,
      skipped: (file) => `${file} è stato saltato.`,
      encoding: (encoding) => `Letto come ${encoding}`,
      open: 'Apri',
    },

    exportSheet: {
      heading: 'Esporta come lista M3U',
      headingAll: 'Esporta tutte le liste',
      phone: 'Percorsi del telefono',
      phoneHint:
        'Percorsi completi come /storage/emulated/0/Music/…, che gli altri lettori di questo telefono capiscono ovunque si trovi il file.',
      library: 'Dalla cartella della libreria',
      libraryHint:
        'Percorsi che partono dalla cartella della libreria, per un computer con la stessa musica. Metti il file in cima a quella cartella.',
      save: 'Salva…',
      chooseFolder: 'Scegli una cartella…',
      allHint:
        'Un file .m3u8 per ciascuna delle tue liste, nella cartella che scegli. Un file con lo stesso nome già presente viene sostituito.',
    },

    saved: (name) => `${name} salvata come lista M3U`,
    savedAll: (count, folder) =>
      oneOrMany(count, `1 lista salvata in ${folder}`, `${format.number(count)} liste salvate in ${folder}`),
    notSaved: (names) => `Non salvato: ${names}`,
    leftOut: (count) =>
      oneOrMany(
        count,
        '1 brano è stato escluso: ora non è nella cartella della libreria.',
        `${tracks(count)} sono stati esclusi: ora non sono nella cartella della libreria.`
      ),
    failed: (reason) => `Non ha funzionato: ${reason}`,
  },
};
