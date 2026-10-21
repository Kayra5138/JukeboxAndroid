import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const lists: Strings['lists'] = {
  naming: {
    heading: 'Liste benennen',
    placeholder: 'Name der Liste',
    create: 'Erstellen',
  },

  screen: {
    newList: 'Neue Liste',
    fromTag: 'Aus einem Tag',
    empty: 'Noch nichts hier. Eine Liste ist eine Reihenfolge, die du gewählt hast – genau das, was Tags nicht festhalten können.',
    followingTag: (count, tag) => `${format.number(count)} Titel · folgt ${tag}`,
    fromListening: 'Aus deinem Hörverhalten',
    discover: 'Entdecken',
    discoverHint: 'Musik, die du noch nicht hast – passend zu dem, was du hörst',

    tagSheet: {
      heading: 'Liste aus einem Tag erstellen',
      follows: 'Folgt dem Tag',
      copy: 'Eine Kopie',
      followsHint:
        'Immer alles, was den Tag trägt. Versiehst du später etwas mit dem Tag, erscheint es hier; nichts darin lässt sich umsortieren oder entfernen.',
      copyHint:
        'Übernimmt, was den Tag gerade trägt. Danach gehen beide getrennte Wege, und du kannst die Liste frei ordnen.',
      noTags: 'Noch keine Tags. Schlag zuerst ein paar Titel nach.',
    },
  },

  auto: {
    mostPlayed: { name: 'Meistgehört', hint: 'Worauf du immer wieder zurückkommst' },
    recentlyFound: { name: 'Neu diesen Monat', hint: 'Seit Monatsbeginn zum ersten Mal gehört' },
    forgotten: { name: 'Vergessen', hint: 'Früher oft gehört, seit einem halben Jahr nicht mehr' },
    skipped: { name: 'Oft übersprungen', hint: 'Was du immer wieder überspringst' },
  },

  picker: {
    /*
      German puts the verb last, so the lists below cannot finish this
      sentence the way they finish the English one. It is a whole heading
      instead, which the lists then answer.
    */
    heading: (count) => `${format.number(count)} Titel zu einer Liste hinzufügen`,
    noLists: 'Noch keine Listen.',
    newList: 'Neue Liste…',
    already: (list) => `Schon in ${list}`,
    added: (count, list) => `${format.number(count)} Titel zu ${list} hinzugefügt`,
  },

  trackPicker: {
    heading: 'Titel hinzufügen',
    search: 'Bibliothek durchsuchen',
    alreadyHere: 'Schon in dieser Liste',
    add: (count) => `${format.number(count)} Titel hinzufügen`,
  },

  list: {
    album: 'Album',
    artist: 'Künstler',
    folder: 'Ordner',
    list: 'Liste',

    everythingTagged: (tag) => `Alles mit dem Tag ${tag}, nach aktuellem Stand`,
    away: (count) =>
      oneOrMany(
        count,
        '1 weiterer Titel ist gerade nicht in der Bibliothek',
        `${format.number(count)} weitere Titel sind gerade nicht in der Bibliothek`
      ),

    addTracks: 'Titel hinzufügen',
    cover: 'Cover',
    deleteList: 'Liste löschen',

    albums: 'Alben',
    tracks: 'Titel',
    opensAlbum: 'Öffnet das Album',

    empty: {
      editable: 'Noch nichts hier. Füge oben Titel hinzu oder schick sie aus der Bibliothek hierher.',
      tag: 'Noch trägt nichts diesen Tag. Gib ihn ein paar Titeln, dann erscheinen sie hier.',
      album: 'Dieses Album ist nicht mehr in der Bibliothek.',
      artist: 'Nichts in der Bibliothek ist diesem Künstler noch zugeschrieben.',
      folder: 'In diesem Ordner ist nichts mehr.',
      auto: 'Noch passt nichts hierher. Hör erst ein paar Sachen.',
    },

    mightBelong: 'Könnte hierher passen',
    mightBelongHint:
      'Abgeleitet aus den Tags, auf die sich die Liste schon stützt – so gewichtet, dass ein seltener Tag mehr zählt als einer, den die halbe Bibliothek trägt.',

    choosePicture: 'Bild auswählen…',
    firstFour: 'Die ersten vier verwenden',

    renameHeading: 'Liste umbenennen',
    deleteQuestion: (name) => `„${name}“ löschen?`,
    deleteHint: 'Die Liste wird gelöscht. Die Titel bleiben auf dem Gerät.',
  },

  files: {
    importFiles: 'M3U-Dateien importieren…',
    exportAll: 'Alle Listen exportieren…',
    export: 'Exportieren…',
    untitled: 'Importierte Liste',
    reading: 'M3U-Dateien werden gelesen…',

    conflict: {
      heading: (name) => `Es gibt schon eine Liste namens „${name}“`,
      hint: 'Die Datei kann die Liste ersetzen, deren Cover dabei bleibt, oder als eigene Liste dazukommen.',
      replace: 'Ersetzen',
      keepBoth: (name) => `Als „${name}“ hinzufügen`,
      skip: 'Diese Datei überspringen',
    },

    result: {
      heading: 'Importiert',
      imported: (name, found, total) =>
        `Liste ${name} importiert: ${format.number(found)} von ${format.number(total)} gefunden`,
      repeated: (count) =>
        oneOrMany(
          count,
          'Ein Titel stand doppelt in der Datei; in der Liste steht er nur einmal.',
          `${format.number(count)} Titel standen mehrmals in der Datei; in der Liste steht jeder nur einmal.`
        ),
      showMissing: (count) => `Nicht gefundene zeigen (${format.number(count)})`,
      hideMissing: 'Ausblenden',
      reasons: {
        notFound: 'Nichts in der Bibliothek passt',
        ambiguous: 'Mehr als ein Titel passt',
        web: 'Eine Webadresse, keine Datei',
      },
      tooBig: (file) => `${file} ist zu groß für eine M3U-Datei.`,
      unreadable: (file) => `${file} konnte nicht als M3U-Datei gelesen werden.`,
      empty: (file) => `In ${file} steht nichts.`,
      skipped: (file) => `${file} wurde übersprungen.`,
      encoding: (encoding) => `Als ${encoding} gelesen`,
      open: 'Öffnen',
    },

    exportSheet: {
      heading: 'Als M3U-Datei exportieren',
      headingAll: 'Alle Listen exportieren',
      phone: 'Pfade auf dem Gerät',
      phoneHint:
        'Vollständige Pfade wie /storage/emulated/0/Music/…, die andere Player auf diesem Gerät verstehen, egal wo die Datei liegt.',
      library: 'Ab dem Bibliotheksordner',
      libraryHint:
        'Pfade, die im Bibliotheksordner beginnen, für einen Computer mit derselben Musik. Leg die Datei ganz oben in diesen Ordner.',
      save: 'Speichern…',
      chooseFolder: 'Ordner wählen…',
      allHint:
        'Eine .m3u8-Datei für jede deiner Listen, in einem Ordner deiner Wahl. Eine gleichnamige Datei dort wird ersetzt.',
    },

    saved: (name) => `${name} als M3U-Datei gespeichert`,
    savedAll: (count, folder) =>
      oneOrMany(count, `1 Liste in ${folder} gespeichert`, `${format.number(count)} Listen in ${folder} gespeichert`),
    notSaved: (names) => `Nicht gespeichert: ${names}`,
    leftOut: (count) =>
      oneOrMany(
        count,
        '1 Titel fehlt: Er liegt gerade nicht im Bibliotheksordner.',
        `${format.number(count)} Titel fehlen: Sie liegen gerade nicht im Bibliotheksordner.`
      ),
    failed: (reason) => `Das hat nicht geklappt: ${reason}`,
  },
};
