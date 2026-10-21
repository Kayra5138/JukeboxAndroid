import { comma, format, NNBSP } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

const files = (count: number) => `${format.number(count)} ${oneOrMany(count, 'Datei', 'Dateien')}`;
/* The verb after a count of files, which agrees with it. */
const is = (count: number) => oneOrMany(count, 'wird', 'werden');

const FIELD_NAMES: Record<string, string> = {
  title: 'Titel',
  artist: 'Künstler',
  album: 'Album',
  albumArtist: 'Albuminterpret',
  genre: 'Genre',
  year: 'Jahr',
  track: 'Titelnummer',
  disc: 'Disc-Nummer',
  cover: 'Cover',
};

function listed(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`;
}

export const details: Strings['details'] = {
  screen: {
    tabs: { general: 'Allgemein', tags: 'Tags', lyrics: 'Songtext' },
    missing:
      'Dieser Titel ist nicht mehr in der Bibliothek. Vielleicht wurde er gelöscht, verschoben oder liegt außerhalb des Ordners, den Jukebox liest.',
    goBack: 'Zurück',
  },

  lookUp: 'Nachschlagen',
  searchFailed: 'Die Suche hat nicht geklappt.',

  general: {
    fields: {
      title: 'Titel',
      artist: 'Künstler',
      album: 'Album',
      albumArtist: 'Albuminterpret',
      year: 'Erscheinungsjahr',
      trackNumber: 'Titelnummer',
      discNumber: 'Disc-Nummer',
    },
    notAYear: 'Das ist keine Jahreszahl.',
    notAPlace: 'Eine ganze Zahl ab 1.',

    chooseCoverLabel: 'Cover aus der Galerie wählen',
    noCover: 'Kein Cover',
    chooseFromGallery: 'Aus Galerie wählen',
    removeCover: 'Cover entfernen',
    keepCover: 'Bisheriges behalten',
    coverChosen: 'Cover gewählt. Speichere, um es zu behalten.',

    lookUpHint:
      'Sucht nach Titel und Künstler, wie sie unten stehen, und füllt aus, was gefunden wird: Namen, Album, Jahr, Position auf dem Album und Cover.',
    nothingFound: 'Für diesen Titel und Künstler wurde nichts gefunden.',
    found: (sources, withCover) =>
      `Gefunden bei ${sources.join(' und ')}${withCover ? ', samt Cover' : ''}. Prüfe es und speichere, um es zu behalten.`,

    discard: 'Meine Bearbeitung verwerfen',
    saveHint:
      'Was du hier speicherst, gilt als deins: Wird die Bibliothek erneut nachgeschlagen, bleibt dieser Titel unangetastet, statt überschrieben zu werden.',
    editGone: 'Deine Bearbeitung wurde verworfen. Nachschlagen kann die Felder wieder ausfüllen.',

    inFile: 'In der Datei',
    writeLabel: 'Diese Details in die Datei schreiben',
    writeToFile: 'In Datei schreiben',
    saveFirst: 'Speichere zuerst. Nur Gespeichertes wird in die Datei geschrieben.',
    writeHint:
      'Schreibt Titel, Künstler, Album, Jahr, Titel- und Disc-Nummer, wie die Bibliothek sie zeigt, ' +
      'den ersten Tag als Genre und ein hier gespeichertes Cover in die Datei selbst, wo andere ' +
      'Player und Geräte sie finden. Android fragt nach, bevor etwas geändert wird. Alles andere ' +
      'in der Datei bleibt, wie es ist, und Songtexte werden nicht geschrieben.',
    cannotWrite: 'Nur in MP3- und FLAC-Dateien kann geschrieben werden. Die Details dieser Datei bleiben in der App.',
    nothingWritten: 'Es wurde nichts geschrieben.',
    couldNotWrite: 'Das Schreiben ist fehlgeschlagen.',

    listening: 'Hörverlauf',
    timesPlayed: 'Wiedergaben',
    playedToEnd: 'Ganz gehört',
    timeSpent: 'Hörzeit',
    firstPlayed: 'Zuerst gehört',
    lastPlayed: 'Zuletzt gehört',
    never: 'nie',
    listenedSeconds: (seconds) =>
      oneOrMany(seconds, '1 Sekunde', `${format.number(seconds)} Sekunden`),
    listenedMinutes: (minutes) =>
      oneOrMany(minutes, '1 Minute', `${format.number(minutes)} Minuten`),
    listenedHours: (hours, minutes) => `${format.number(hours)} Std. ${minutes} Min.`,

    file: 'Datei',
    name: 'Name',
    folder: 'Ordner',
    length: 'Länge',
    detailsFrom: 'Herkunft der Details',
    unknown: 'unbekannt',
    from: {
      notLookedUp: 'nicht nachgeschlagen',
      yourEdit: 'deine Bearbeitung',
      notFound: 'nicht gefunden',
      lookup: 'Nachschlagen',
    },
  },

  tags: {
    lookUpHint:
      'Sucht nach Tags für diesen Titel. Die von dir eingegebenen bleiben; die aus einem früheren Nachschlagen werden durch die neuen Funde ersetzt.',
    noneFound: 'Für diesen Titel wurden keine Tags gefunden.',
    found: (count, source) =>
      `${format.number(count)} gefunden bei ${source}. Ordne sie an und speichere, um sie zu behalten.`,
    saveHint:
      'Der erste Tag zählt als Genre. Ein selbst eingegebener Tag gilt als deiner: Kein späteres Nachschlagen entfernt ihn.',
  },

  editor: {
    label: 'Tags',
    add: 'Tag hinzufügen',
    moveUp: (tag) => `${tag} nach oben verschieben`,
    moveDown: (tag) => `${tag} nach unten verschieben`,
    remove: (tag) => `${tag} entfernen`,
  },

  tagPrompt: {
    heading: (count) =>
      oneOrMany(count, 'Tag zu 1 Titel hinzufügen', `Tag zu ${format.number(count)} Titeln hinzufügen`),
    placeholder: 'Tag',
  },

  lyrics: {
    lookUpHint:
      'Sucht den Songtext zu diesem Titel so wie beim Abspielen und ersetzt den gespeicherten, falls einer gefunden wird.',
    nothingMatched: 'Nichts passte zu diesem Titel. Die Suche unten schließt nichts aus.',
    foundAndSaved: 'Gefunden und gespeichert.',
    nothingCameBack: 'Dazu wurde nichts gefunden.',
    cleared: 'Gelöscht. Das nächste Nachschlagen sucht erneut.',
    notSeconds: 'Das ist keine Sekundenangabe.',

    stored: 'Gespeichert',
    none: 'Noch keiner',
    kept: (timed, byHand, lines) =>
      `${timed ? 'Synchronisiert' : 'Nur Text'}, ${byHand ? 'manuell gewählt' : 'von LRCLIB'}` +
      (lines > 0 ? ` · ${oneOrMany(lines, '1 Zeile', `${format.number(lines)} Zeilen`)}` : ''),
    forget: 'Verwerfen und neu suchen',
    saveChanges: 'Änderungen speichern',
    timedHint:
      'Jede Zeile behält ihre Zeitangabe davor. Ändere die Wörter und lass die Klammern stehen, sonst verliert die Zeile ihren Platz.',
    plainHint: 'Ändere, was du willst. Gespeicherter Text gilt als deiner und wird durch kein Nachschlagen ersetzt.',

    timing: 'Timing',
    timingHint:
      'Verschiebt alle Zeilen auf einmal. Nutze das, wenn der Text stimmt, aber zu früh oder zu spät kommt – öffne den Player und justiere, bis es passt, oder tippe auf die Zahl und gib sie ein. Ein positiver Wert lässt den Text später erscheinen.',
    earlier: (seconds) => `−${comma(seconds)}${NNBSP}s`,
    later: (seconds) => `+${comma(seconds)}${NNBSP}s`,
    shiftedEarlier: (written) => `−${written}${NNBSP}s`,
    shiftedLater: (written) => `+${written}${NNBSP}s`,
    noShift: 'keine Verschiebung',
    reset: 'Zurücksetzen',
    offsetHeading: 'Wie weit liegt der Text daneben?',
    offsetPlaceholder: 'Sekunden, z. B. 1,5 oder -0,75',
    typeOffset: 'Genaue Verschiebung eingeben',
    wordsField: 'Songtext',

    byHand: 'Manuell suchen',
    byHandHint:
      'Hier wird nichts ausgeschlossen, anders als bei der automatischen Suche. Die lehnt alles ab, dessen Länge nicht passt – deshalb finden manche Titel nie ihren Text.',
    queryPlaceholder: 'Künstler und Titel',
    candidateTimed: 'synchron',
    candidatePlain: 'nur Text',

    paste: 'Einfügen',
    pasteHint: 'Nimmt eine LRC-Datei oder reinen Text. Mit Zeitstempeln wird er synchronisiert.',
    savePasted: 'Eingefügtes speichern',
  },

  library: {
    coversSaved: (count) => `${format.number(count)} Albumcover hinzugefügt.`,
    stoppedOffline: (matched) =>
      `Keine Antwort, deshalb wurde der Durchlauf nach ${format.number(matched)} ${oneOrMany(matched, 'Treffer', 'Treffern')} angehalten. Für den Rest wurde nichts geschrieben – diese Titel warten noch auf ihren Versuch.`,
    serviceUnreachable: (service) =>
      `${service} war nicht erreichbar, daher lief der Durchlauf ohne diesen Dienst weiter. Was ihn brauchte, blieb unverändert und wird beim nächsten Mal versucht.`,
    stoppedUnexpectedly: 'Das Nachschlagen wurde unerwartet beendet.',

    nothingAnswered: 'Keine Antwort. Wird beendet.',
    rateLimited: 'Einer der Dienste hat um eine Pause gebeten. Er wird in einer Minute erneut gefragt.',
    lookingUp: 'Wird nachgeschlagen…',
    lookingUpProgress: (done, total) =>
      `Wird nachgeschlagen… ${format.number(done)} von ${format.number(total)} ${oneOrMany(total, 'Titel', 'Titeln')} fertig`,
    lookingUpAlbum: (album, done, total) =>
      `„${album}“ wird nachgeschlagen… ${format.number(done)} von ${format.number(total)} ${oneOrMany(total, 'Titel', 'Titeln')} fertig`,
    soFar: (matched, covers) =>
      `Bisher ${format.number(matched)} zugeordnet, ${format.number(covers)} Cover`,
    stop: 'Stopp',
    lookupChannel: 'Suchen nach Angaben',

    selected: (count) => `${format.number(count)} ausgewählt`,
    summary: (matched, edited, notFound, untried) =>
      [
        `${format.number(matched)} zugeordnet`,
        edited > 0 ? `${format.number(edited)} bearbeitet` : null,
        `${format.number(notFound)} nicht gefunden`,
        `${format.number(untried)} nicht versucht`,
      ]
        .filter(Boolean)
        .join(' · '),
    reset: 'Zurücksetzen',
    lookUpMissing: 'Fehlende nachschlagen',
    hint: 'Tippe auf einen Titel, um ihn von Hand zu korrigieren. Zieh über die Kästchen nach unten, um mehrere auszuwählen.',
    searchPlaceholder: 'Diese Titel durchsuchen',

    noGenre: 'kein Genre',
    noMatch: 'kein Treffer',
    notLookedUp: 'noch nicht nachgeschlagen',
    matchedSpoken: (artist, title) => `Zugeordnet: ${artist} – ${title}`,
    manualSpoken: (artist, title) => `Von Hand eingetragen: ${artist} – ${title}`,
  },

  selection: {
    more: 'Mehr…',
    moreHint: 'Alles, was du mit den ausgewählten Titeln tun kannst',
    heading: (count) => `${format.number(count)} Titel ausgewählt`,
    sections: { find: 'Nachschlagen', change: 'Ändern', other: 'Weiteres' },
    actions: {
      lookUp: {
        label: 'Details nachschlagen',
        hint: 'Vergisst, was früher für sie gefunden wurde, und schlägt sie neu nach, Cover eingeschlossen. Deine eigenen Änderungen bleiben.',
      },
      covers: {
        label: 'Cover nachschlagen',
        hint: 'Nur Cover, für die Titel ohne eines. Sonst wird nichts neu nachgeschlagen, und ein Cover, das du gewählt oder entfernt hast, bleibt, wie es ist.',
      },
      lyrics: {
        label: 'Songtexte nachschlagen',
        hint: 'Zuerst aus den Dateien und .lrc-Dateien, dann von LRCLIB. Songtexte, die du gewählt hast, bleiben.',
      },
      edit: {
        label: 'Details gemeinsam bearbeiten',
        hint: 'Künstler, Albuminterpret, Album oder Jahr, für alle auf einmal',
      },
      addTag: { label: 'Tag hinzufügen', hint: 'Ein Tag, für alle' },
      removeTag: { label: 'Tag entfernen', hint: 'Eines ihrer Tags, bei allen entfernt' },
      cover: { label: 'Cover wählen', hint: 'Ein Bild aus deiner Galerie, für alle' },
      write: {
        label: 'In Dateien schreiben',
        hint: 'Schreibt die Details, wie die Bibliothek sie zeigt, in die Dateien selbst. Android fragt vorher.',
      },
      addToList: { label: 'Zur Liste hinzufügen', hint: 'Legt sie in eine deiner Listen' },
      reset: {
        label: 'Zurücksetzen',
        hint: 'Vergisst, was beim Nachschlagen für sie gefunden wurde. Deine eigenen Änderungen bleiben.',
      },
      delete: { label: 'Vom Gerät löschen', hint: 'Löscht die Dateien. Android fragt vorher.' },
    },
    busy: 'Es läuft schon ein Nachschlagen. Warte, bis es fertig ist, oder stopp es.',

    editHeading: (count) => `${format.number(count)} Titel bearbeiten`,
    editHint:
      'Füll nur aus, was bei allen gleich sein soll. Ein leeres Feld lässt jeden Titel, wie er ist; um ein Feld bei allen zu leeren, hak die Option darunter an. Namen, Titel- und Disc-Nummern bleiben unangetastet.',
    keepEach: 'Jeder behält seinen eigenen Wert',
    empty: 'Leer',
    clearOn: { remove: 'Bei allen entfernen', own: 'Künstler aus jeder Datei nehmen' },
    cleared: { remove: 'Wird bei allen entfernt', own: 'Künstler aus der jeweiligen Datei' },
    edited: (count) =>
      oneOrMany(
        count,
        'Gespeichert. Das ist jetzt deine Änderung, und Nachschlagen lässt sie in Ruhe.',
        `Für ${format.number(count)} Titel gespeichert. Das sind jetzt deine Änderungen, und Nachschlagen lässt sie in Ruhe.`
      ),

    tagAdded: (tag, count) =>
      `„${tag}“ ist jetzt bei ${format.number(count)} ${oneOrMany(count, 'Titel', 'Titeln')}.`,
    removeTagHeading: (count) =>
      `Tag von ${format.number(count)} ${oneOrMany(count, 'Titel', 'Titeln')} entfernen`,
    tagOption: (tag, count) => `${tag} · ${format.number(count)}`,
    noTags: 'Keiner dieser Titel hat ein Tag.',
    tagRemoved: (tag, count) =>
      `„${tag}“ wurde bei ${format.number(count)} ${oneOrMany(count, 'Titel', 'Titeln')} entfernt.`,

    resetQuestion: (count) => `${format.number(count)} Titel zurücksetzen?`,
    resetBody:
      'Was beim Nachschlagen für sie gefunden wurde, wird vergessen, und sie gelten als nicht nachgeschlagen. Deine eigenen Änderungen bleiben. Das lässt sich nicht rückgängig machen.',

    coversProgress: (done, total) =>
      `Cover werden gesucht… ${format.number(done)} von ${format.number(total)} Titeln fertig`,
    coversNone: 'Keine neuen Cover gefunden.',
    lyricsProgress: (done, total) =>
      `Songtexte werden gesucht… ${format.number(done)} von ${format.number(total)} Titeln fertig`,
    lyricsSoFar: (found) => `Bisher ${format.number(found)} gefunden`,
    lyricsFound: (found, wanted, had) =>
      [
        wanted > 0
          ? `Songtexte für ${format.number(found)} von ${format.number(wanted)} gefunden.`
          : null,
        had > 0 ? oneOrMany(had, '1 hatte schon einen.', `${format.number(had)} hatten schon einen.`) : null,
      ]
        .filter(Boolean)
        .join(' ') || 'Nichts zu suchen: Die Songtexte dieser Titel hast du selbst gewählt.',
    lyricsOffline:
      'LRCLIB war nicht erreichbar, deshalb wurde die Suche beendet. Den Rest kannst du später noch einmal versuchen.',
  },

  write: {
    heading: (count) => `Details in ${files(count)} schreiben?`,
    body: (count) =>
      `${files(count)} ${is(count)} geändert: Titel, Künstler, Album, Jahr, Titel- und Disc-Nummer, ` +
      'der erste Tag als Genre und das gespeicherte Cover, wie die Bibliothek sie jeweils zeigt, ' +
      'kommen in die Datei selbst. Android bittet dich, das zu erlauben. Alles andere in einer ' +
      'Datei bleibt, wie es ist.',
    noneHeading: 'In keine dieser Dateien kann geschrieben werden',
    noneBody: 'Schreiben geht nur in MP3- und FLAC-Dateien und nicht in den Titel, der gerade läuft.',
    skipping: (otherKind, playing) =>
      otherKind > 0 && playing
        ? `${files(otherKind)} anderen Typs ${is(otherKind)} übersprungen, ebenso der Titel, der gerade läuft.`
        : otherKind > 0
          ? `${files(otherKind)} anderen Typs ${is(otherKind)} übersprungen.`
          : 'Der Titel, der gerade läuft, wird übersprungen.',
    confirmLabel: (count) => `Details in ${files(count)} schreiben`,
    confirm: 'Schreiben',
    nothingWritten: 'Es wurde nichts geschrieben.',
    couldNotStart: 'Das ließ sich nicht starten.',

    writing: 'Wird in Dateien geschrieben',
    progressLabel: (done, total) => `${format.number(done)} von ${files(total)} geschrieben`,
    progress: (done, total) => `${format.number(done)} von ${format.number(total)}`,
    stopping: 'Wird nach dieser Datei angehalten.',
    keepOpen: 'Jede Datei wird geprüft, bevor das Original angetastet wird. Lass die App geöffnet.',
    stopLabel: 'Nach der Datei anhalten, die gerade geschrieben wird',
    stop: 'Stopp',
    stoppedShort: (count) => `Angehalten; ${files(count)} nicht versucht.`,

    written: (changed) =>
      changed.length > 0
        ? `Geschrieben: ${listed(changed.map((name) => FIELD_NAMES[name] ?? name))}.`
        : 'Geschrieben.',
    unchanged: 'Enthält das alles schon. Unverändert gelassen.',
    skippedPlaying: 'Übersprungen: Der Titel läuft gerade. Versuch es erneut, wenn er nicht mehr läuft.',
    skippedFormat: 'Übersprungen: Nur in MP3- und FLAC-Dateien kann geschrieben werden.',
    failed: (reason) => `Fehlgeschlagen: ${reason}`,
    noReason: 'Das Schreiben ist fehlgeschlagen. Die Datei wurde nicht angetastet.',

    summary: (counts) => {
      const parts: string[] = [];
      if (counts.written > 0) parts.push(`${files(counts.written)} geschrieben.`);
      if (counts.unchanged > 0) {
        parts.push(`${files(counts.unchanged)} ${oneOrMany(counts.unchanged, 'war', 'waren')} schon aktuell.`);
      }
      if (counts.skipped > 0) parts.push(`${files(counts.skipped)} übersprungen.`);
      if (counts.failed > 0) parts.push(`${files(counts.failed)} fehlgeschlagen.`);
      return parts.length > 0 ? parts.join(' ') : 'Nichts zu schreiben.';
    },
  },

  same: {
    note:
      'Diese sehen aus wie ein Song in zwei Dateien. Beim Zusammenführen wandert alles von der ersten Datei zur zweiten: Wiedergaben, Tags, Songtext und Plätze in Listen. „Getrennt lassen“ ändert an beiden nichts, und du wirst zu diesem Paar nicht mehr gefragt.',
    failed: (error) => `Das ging nicht, und es wurde nichts geändert. ${error}`,
    empty: 'Nichts mehr zu entscheiden.',
    from: 'Von',
    into: 'Nach',
    keepApart: 'Getrennt lassen',
    merge: 'Zusammenführen',
    bulk: {
      mergeDelete: 'Zusammenführen und erste Datei löschen',
      deleteToo: 'Auch die erste Datei jedes Paars löschen',
      deleteNote: 'Android fragt, bevor etwas gelöscht wird.',
      notDeleted: 'Die Dateien wurden nicht gelöscht.',
      deleted: (count) => oneOrMany(count, '1 Datei gelöscht.', `${format.number(count)} Dateien gelöscht.`),
      choose: 'Dieses Paar auswählen',
      chosen: (count) => oneOrMany(count, '1 Paar ausgewählt', `${format.number(count)} Paare ausgewählt`),
      merge: (count) => `${format.number(count)} zusammenführen`,
      keepApart: (count) => `${format.number(count)} getrennt lassen`,
      confirm: (count) =>
        oneOrMany(
          count,
          '1 Paar zusammenführen? Wiedergaben, Tags, Songtext und Listenplätze der ersten Datei gehen auf die zweite über und lassen sich nicht wieder trennen.',
          `${format.number(count)} Paare zusammenführen? Bei jedem Paar gehen Wiedergaben, Tags, Songtext und Listenplätze der ersten Datei auf die zweite über und lassen sich nicht wieder trennen.`
        ),
      done: (done, skipped) =>
        skipped > 0
          ? `${oneOrMany(done, '1 Paar beantwortet', `${format.number(done)} Paare beantwortet`)}; ${oneOrMany(skipped, '1 war', `${format.number(skipped)} waren`)} durch eine andere Antwort schon erledigt.`
          : oneOrMany(done, '1 Paar beantwortet.', `${format.number(done)} Paare beantwortet.`),
    },
    unknown: 'Unbekannt',
    noFileName: 'Dateiname unbekannt',
    holds: (side) => {
      const parts: string[] = [];
      if (side.listens > 0) {
        parts.push(oneOrMany(side.listens, '1 Wiedergabe', `${format.number(side.listens)} Wiedergaben`));
      }
      if (side.tags > 0) parts.push(oneOrMany(side.tags, '1 Tag', `${format.number(side.tags)} Tags`));
      if (side.lyrics) parts.push('Songtext');
      if (side.lists > 0) {
        parts.push(oneOrMany(side.lists, 'in 1 Liste', `in ${format.number(side.lists)} Listen`));
      }
      return parts.length > 0 ? parts.join(' · ') : 'Noch nichts';
    },
  },
};
