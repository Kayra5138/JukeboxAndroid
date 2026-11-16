import { common } from './common.ts';
import { format, NNBSP } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const library: Strings['library'] = {
  views: {
    tracks: 'Titel',
    albums: 'Alben',
    artists: 'Künstler',
    folders: 'Ordner',
    tapes: 'Kassetten',
  },

  tapes: {
    left: (minutes) => `noch ${format.number(minutes)} Min.`,
    played: 'Gehört',
    heard: (heard, total) => `${format.number(heard)} / ${format.number(total)} Min.`,
    add: 'Kassetten hinzufügen',
    settings: 'Kassetten-Einstellungen',
    /** A followed show's arrow, which lays its episodes out under it and folds them away. */
    showEpisodes: 'Folgen zeigen',
    hideEpisodes: 'Folgen ausblenden',
    /** A tape's own details screen: see `app/tape.tsx`. */
    details: {
      title: 'Kassettendetails',
      listening: 'Hören',
      heard: 'Gehört',
      notBegun: 'Noch nicht begonnen',
      lastHeard: 'Zuletzt gehört',
      part: 'Teil',
      partOf: (at, of) => `${format.number(at)} von ${format.number(of)}`,
      speed: 'Tempo',
      marks: 'Markierungen',
      source: 'Quelle',
      from: 'Herkunft',
      kinds: { youtube: 'Ein YouTube-Video', playlist: 'Eine YouTube-Playlist', podcast: 'Eine Podcastfolge', book: 'Ein Buch von LibriVox', byHand: 'Von Hand in den Kassettenordner gelegt' },
      show: 'Sendung',
      book: 'Buch',
      channel: 'Kanal',
      list: 'Playlist',
      published: 'Erschienen',
      fetched: 'Geladen',
      chapters: 'Kapitel',
      skipped: 'Übersprungen',
      skippedUnknown: 'Wird beim nächsten Abspielen nachgesehen',
      skippedOff: 'In den Kassetten-Einstellungen aus',
      skippedTrouble: 'SponsorBlock war nicht erreichbar; beim nächsten Abspielen wird erneut gefragt',
      skippedNone: 'Nichts markiert',
      skippedSome: (count, seconds) => `${oneOrMany(count, '1 Teil', `${format.number(count)} Teile`)} · ${format.number(seconds)} s`,
      address: 'Adresse',
      listAddress: 'Adresse der Playlist',
      openSeries: 'Sendung öffnen',
      file: 'Datei',
      name: 'Name',
      folder: 'Ordner',
      format: 'Format',
      size: 'Größe',
      megabytes: (mb) => `${format.number(mb)} MB`,
      added: 'Aufs Telefon gekommen',
      missing: 'Diese Kassette ist nicht mehr in der Mediathek.',
    },
    seriesHeading: 'Gefolgt',
    singlesHeading: 'Kassetten',
    booksHeading: 'Bücher',
    /** The tapes view's filter: all of it, or one of its parts. */
    filter: { all: 'Alle', series: 'Gefolgt', books: 'Bücher', tapes: 'Kassetten' },
    seriesLine: (count, fresh) => `${format.number(count)} ${oneOrMany(count, 'Folge', 'Folgen')}${fresh > 0 ? ` · ${format.number(fresh)} neu` : ''}`,
    seriesNone: 'Noch keine Folgen geladen',
    /** A folder of several tapes as one row: how many parts, and how many of them not begun. */
    bookLine: (count, fresh) => `${format.number(count)} Teile${fresh > 0 ? ` · ${format.number(fresh)} nicht begonnen` : ''}`,
    count: (count) => `${format.number(count)} ${oneOrMany(count, 'Kassette', 'Kassetten')}`,
    /** Over the tapes view while tapes are being chosen. */
    selected: (count) => `${format.number(count)} ${oneOrMany(count, 'Kassette', 'Kassetten')} ausgewählt`,
    empty: (folder) => `Lege Hörbücher, Podcasts und lange Aufnahmen in einen Ordner namens Tapes in deinem Bibliotheksordner (${folder}). Sie erscheinen hier, laufen dort weiter, wo du aufgehört hast, und bleiben aus deiner Musik heraus.`,
    markPlayed: 'Als gehört markieren',
    markUnplayed: 'Als nicht gehört markieren',
  },

  nothingMatches: (query) => `Keine Treffer für „${query}“.`,
  noAlbums:
    'Noch keine Alben. Ein Album erscheint erst, wenn seine Titel nachgeschlagen wurden – der Ordner, in dem eine Datei liegt, ist kein Album.',
  back: '‹ Zurück',
  trackMenu: 'Titeloptionen',
  albumMenu: 'Albumoptionen',

  screen: {
    searchYouTube: (query: string) => `Auf YouTube nach „${query}“ suchen`,
    viewSwitch: 'Bibliotheksansicht',
    searchHints: {
      tracks: 'Titel, Künstler, Tags suchen',
      albums: 'Titel, Künstler, Tags suchen',
      artists: 'Künstler durchsuchen',
      folders: 'Ordner durchsuchen',
      tapes: 'Kassetten, Sendungen und Autoren suchen',
    },
    /*
      The small capitals over the order read "SORTIERT", and the order under
      them finishes it: it must fit a button 56 points wide.
    */
    sort: 'Sortiert',
    sortShort: { name: 'A–Z', added: 'Neueste', played: 'Gehört', colour: 'Farbe' },
    sortedBy: {
      name: 'Nach Name sortiert',
      added: 'Nach dem Hinzufügedatum sortiert',
      played: 'Nach der letzten Wiedergabe sortiert',
      colour: 'Nach der Farbe des Covers sortiert',
    },
    sortHint: 'Ändert die Reihenfolge der Bibliothek',
    lookSwitch: 'Wechselt zur anderen Darstellung dieser Ansicht',
    view: 'Ansicht',
    looks: { list: 'Liste', shelves: 'Regale', rack: 'Regal', map: 'Karte' },
    artistMap: { drawing: 'Die Karte wird gezeichnet…', shuffle: 'Ihre Songs zufällig abspielen', open: 'Öffnen', with: 'Mit', lasso: 'Künstler einkreisen und zufällig abspielen', lassoHint: 'Kreise die Künstler ein, die du mischen willst', lassoChosen: 'Eingekreist', putBackAll: 'Von Hand verschobene Künstler zurücksetzen', movedByHand: 'Von Hand verschoben', putBack: 'Zurücksetzen' },
    groupSortShort: { name: 'A–Z', tracks: 'Titel', played: 'Beliebt', added: 'Neueste' },
    groupSortedBy: {
      name: 'Nach Name sortiert',
      tracks: 'Nach Anzahl der Titel sortiert',
      played: 'Nach Häufigkeit der Wiedergabe sortiert',
      added: 'Nach zuletzt Hinzugefügtem sortiert',
    },

    selectTracks: 'Titel auswählen',
    stopSelecting: 'Auswahl beenden',
    selected: (count) => `${format.number(count)} Titel ausgewählt`,
    addToList: 'Zur Liste',
    addTag: 'Tag hinzufügen',
    writeToFiles: 'In Dateien schreiben',
    writeToFilesSpoken: 'Die Details der ausgewählten Titel in ihre Dateien schreiben',

    swipePlayNext: 'Als Nächstes',
    swipeQueue: 'Zur Warteschlange',
    queuedAll: (count) => `${common.tracks(count)} zur Warteschlange hinzugefügt`,

    needsAccess: 'Jukebox braucht Zugriff auf die Audiodateien auf diesem Gerät.',
    nothingIn: (folder) => `Nichts in ${folder}.`,
    shuffleAll: 'Alle zufällig',
    playsEverythingBelow: 'Jukebox spielt alles unterhalb dieses Ordners ab, Unterordner eingeschlossen.',
    chooseFolderInSettings: 'Wähle deinen Bibliotheksordner in den Einstellungen.',

    folders: (count) => `${format.number(count)} Ordner`,
    noFolders: 'Keiner dieser Titel gibt an, in welchem Ordner er liegt.',
    shuffleTag: (tag) => `„${tag}“ zufällig`,
  },

  row: {
    opensTracks: 'Öffnet die Titel',
    selectsTracks: 'Wählt alle Titel darin aus',
    select: 'Titel darin auswählen',
  },

  rack: {
    open: (album) => `${album} öffnen`,
    openHint: 'Zeigt die Titel des Albums',
    bringForward: 'Holt dieses Album nach vorn',
  },

  albumActions: {
    select: { label: 'Auswählen', hint: 'Die Titel des Albums und dann alles, was du noch antippst' },
    rest: {
      label: 'Rest des Albums finden',
      hint: 'Die Titel darauf, die du noch nicht hast',
    },
    lookUp: {
      label: 'Dieses Album nachschlagen',
      hint: 'Details und Cover, für das ganze Album auf einmal',
    },
    cover: {
      label: 'Albumcover wählen',
      hint: 'Ein Bild aus deiner Galerie, für jeden Titel darauf',
    },
    setAside: { label: 'Beiseitelegen', hint: 'Seine Titel nicht mehr in „Titel“ und in „Alles zufällig“' },
    bringBack: { label: 'Zurückholen', hint: 'Seine Titel wieder in „Titel“ und in der Zufallswiedergabe' },
  },

  albumTools: {
    lookingUp: (done, total) =>
      `Album wird nachgeschlagen… ${format.number(done)} von ${format.number(total)}`,
    stop: 'Nachschlagen stoppen',
    lookedUp: (found, covers) =>
      found === 0 && covers === 0
        ? 'Für dieses Album wurde nichts Neues gefunden.'
        : covers === 0
          ? `Details für ${common.tracks(found)} gefunden.`
          : found === 0
            ? `Cover für ${common.tracks(covers)} gefunden.`
            : `Details für ${common.tracks(found)} und Cover für ${common.tracks(covers)} gefunden.`,
    offline: 'Keine Antwort. Prüfe die Verbindung und versuch es noch einmal.',
    failed: 'Das Nachschlagen wurde unerwartet beendet.',
    coverChosen: (count) => `Das Cover gilt jetzt für ${common.tracks(count)}.`,
  },

  rest: {
    looking: 'Album wird nachgeschlagen…',
    release: (count, year) => (year ? `${common.tracks(count)}, ${year}` : common.tracks(count)),
    have: (have, total) => `Du hast ${format.number(have)} von ${format.number(total)}.`,
    complete: 'Du hast das ganze Album.',
    rivals: 'Mehrere Alben tragen diesen Namen. Zu diesem passen deine Titel am besten.',
    unsure:
      'Keiner deiner Titel wurde darauf erkannt, deshalb ist nichts angehakt. Prüfe zuerst, ob es das richtige Album ist.',
    disc: (disc) => `Disc ${format.number(disc)}`,
    ordered: (count) => `${format.number(count)} Titel in die Reihenfolge des Albums gebracht.`,
    undoOrder: 'Rückgängig',

    lookingTube: 'Suche auf YouTube…',
    readingTube: 'Album wird gelesen…',
    source: {
      musicbrainz: 'Titelliste von MusicBrainz',
      youtube: (playlist, channel) =>
        `Titelliste von YouTube: ${[playlist, channel].filter(Boolean).join(' · ')}`,
    },
    other: { youtube: 'Stattdessen auf YouTube suchen', musicbrainz: 'Stattdessen MusicBrainz verwenden' },
    onTrust:
      'Aus dem gleichnamigen Album auf YouTube übernommen. Du hast zu wenige seiner Titel, um es abzugleichen – sieh es dir also vor dem Download genau an.',
    tubeNotFound: 'Keine Playlist auf YouTube ließ sich als dieses Album bestätigen.',

    ticks: 'Zum Download angehakt',
    waiting: 'In der Warteschlange',
    searching: 'Wird auf YouTube gesucht…',
    noMatch: 'Keine passende Aufnahme gefunden',
    searchFailed: 'Die Suche ist fehlgeschlagen',
    byHand: 'Manuell suchen',
    byHandLabel: (title) => `Manuell nach ${title} suchen`,

    download: (count) => `${format.number(count)} Titel herunterladen`,
    nothingTicked: 'Hake die Titel an, die du herunterladen willst',
    stop: 'Suche beenden',

    failed: {
      unnamed:
        'Dieses Album kann nicht nachgeschlagen werden. Es braucht einen Namen und einen Künstler, den die meisten seiner Titel gemeinsam haben.',
      notFound: 'MusicBrainz kennt kein Album dieses Namens von diesem Künstler.',
      offline: 'MusicBrainz ist nicht erreichbar. Prüfe deine Verbindung und versuch es erneut.',
      throttled: 'MusicBrainz bittet um eine Pause. Warte eine Minute und versuch es erneut.',
      failed: 'Das Album konnte nicht nachgeschlagen werden.',
      gone: 'Dieses Album ist nicht mehr in der Bibliothek.',
      neither:
        'Dieses Album wurde nicht gefunden. MusicBrainz führt es nicht, und keine Playlist auf YouTube ließ sich als dieses Album bestätigen.',
      tube: 'YouTube konnte nicht nach dem Album gefragt werden.',
      tooOld: 'Diese Jukebox-Version kann keine Alben auf YouTube nachschlagen. Installiere eine neuere Android-Version.',
    },
  },

  menu: {
    quickNext: 'Als Nächstes',
    quickQueue: 'Warteschlange',
    quickList: 'Liste',
    playNext: { label: 'Als Nächstes spielen', hint: 'Direkt nach dem aktuellen Titel' },
    keepListened: { label: 'In der Mediathek behalten', hint: 'Wird mit seinem Verlauf in deine Mediathek kopiert' },
    addToQueue: { label: common.addToQueue, hint: 'Ans Ende' },
    playSimilar: { label: 'Mit ähnlichen Titeln abspielen', hint: 'Dieser, dann eine Reihe ähnlicher Titel' },
    playOnly: { label: 'Nur diesen abspielen', hint: 'Die Warteschlange ist nur dieser Titel' },
    playFromStart: { label: 'Von vorn abspielen', hint: 'Die gemerkte Stelle wird vergessen' },
    series: { label: 'Sendung öffnen', hint: 'Ihre Folgen und wie neue geladen werden' },
    tapeFolder: { label: 'Ordner öffnen', hint: 'Alles andere im selben Ordner' },
    tapeDetails: { label: 'Details ansehen', hint: 'Wie weit du bist, woher sie stammt, und die Datei' },
    share: { label: 'Teilen', hint: 'Als Ton gesendet: ein Chat spielt ihn direkt ab' },
    shareFile: { label: 'Als Datei teilen', hint: 'Als die Datei selbst gesendet: ein Chat behält sie als Dokument' },
    album: { label: 'Zum Album', hint: 'Der Rest des Albums, in Reihenfolge' },
    addToPlaylist: { label: 'Zu einer Liste hinzufügen', hint: 'Eine deiner Listen oder eine neue' },
    setAside: { label: 'Beiseitelegen', hint: 'Nicht mehr in „Titel“ und in „Alles zufällig“' },
    bringBack: { label: 'Zurückholen', hint: 'Wieder in „Titel“ und in der Zufallswiedergabe' },
    asideWith: { label: 'Mit anderen beiseitegelegt', hint: 'Mit Album, Künstler, Ordner oder Tag: unter „Beiseitegelegt“ zurückholen' },
    favoriteAdd: { label: "Zu Favoriten hinzufügen", hint: "Die Liste, die das Herz füllt, Neueste zuerst" },
    favoriteRemove: { label: "Aus Favoriten entfernen", hint: "Aus der Liste, die das Herz füllt" },
    tiles: { label: 'Piano Tiles spielen', hint: 'Tasten fallen im Takt dieses Titels' },
    details: {
      label: 'Details ansehen & bearbeiten',
      hint: 'Namen, Cover, Tags und Songtext, jeweils zum Nachschlagen',
    },
    delete: { label: 'Vom Gerät löschen', hint: 'Löscht die Datei selbst, nicht nur diese Zeile' },
  },

  folders: {
    needsAccess:
      'Jukebox braucht Zugriff auf die Audiodateien auf diesem Gerät, bevor Ordner angezeigt werden können.',
    note: 'Jukebox spielt alles unterhalb des gewählten Ordners ab, Unterordner eingeschlossen. Mit einem Unterordner lässt du Klingeltöne und Spiele-Sounds außen vor.',
    everything: (path) => `${path}  (alles)`,
  },

  leftOut: {
    title: 'Ausgenommene Ordner',
    none: 'Keine. Schalte Ordner mit Sprachnachrichten, Aufnahmen oder Klingeltönen aus.',
    some: (count) => `${format.number(count)} Ordner aus der Bibliothek ausgenommen`,
    note: 'Ein ausgeschalteter Ordner bleibt mitsamt allen Ordnern darin außen vor. Gelöscht wird nichts: Wiedergaben, Tags und Plätze in deinen Listen bleiben erhalten und sind wieder da, sobald du ihn einschaltest.',
    within: 'Mit dem übergeordneten Ordner ausgenommen',
    spoken: (path, count) => `${path}, ${format.number(count)} Titel`,
    hint: 'An: Der Ordner gehört zur Bibliothek. Aus: Er bleibt außen vor.',
    empty: (root) => `In ${root} gibt es keine Ordner mit Musik.`,
  },

  setAside: {
    title: 'Beiseitegelegt',
    none: 'Nichts. Lege ein Album, einen Künstler oder einen Titel beiseite, den du nicht in „Titel“ und in der Zufallswiedergabe haben willst.',
    some: (count) => `${format.number(count)} ${oneOrMany(count, 'Titel', 'Titel')} beiseitegelegt`,
    note: 'Ein beiseitegelegter Titel bleibt aus „Titel“, aus „Alles zufällig“ und aus den Titeln heraus, die gewählt werden, damit die Musik weiterläuft. Er bleibt in seinem Album, bei seinem Künstler und in seinem Ordner, in deinen Listen und in der Suche, und spielt, wenn eines davon gespielt wird. Nichts wird gelöscht.',
    empty: 'Nichts ist beiseitegelegt. Halte ein Album oder einen Titel gedrückt oder öffne einen Künstler oder Ordner, um ihn beiseitezulegen.',
    kinds: { album: 'Alben', artist: 'Künstler', list: 'Listen', folder: 'Ordner', tag: 'Tags', track: 'Titel' },
    songs: (count) => `${format.number(count)} ${oneOrMany(count, 'Titel', 'Titel')}`,
    bringBack: 'Zurückholen',
    bringBackSpoken: (name) => `${name} zurückholen`,
    addTag: 'Tag beiseitelegen',
    noTags: 'Es gibt keine weiteren Tags zum Beiseitelegen.',
    album: { set: 'Album beiseitelegen', back: 'Album zurückholen' },
    artist: { set: 'Künstler beiseitelegen', back: 'Künstler zurückholen' },
    list: { set: 'Liste beiseitelegen', back: 'Liste zurückholen' },
    folder: { set: 'Ordner beiseitelegen', back: 'Ordner zurückholen' },
  },

  shortFiles: {
    title: 'Kurze Dateien ausblenden',
    note: 'Blendet Sprachnachrichten, Klingeltöne und Benachrichtigungstöne anhand ihrer Länge aus. Gelöscht wird nichts.',
    under: (seconds) => `Unter ${format.number(seconds)}${NNBSP}s`,
    shorterThan: (seconds) => `Kürzer als ${format.number(seconds)} Sekunden`,
  },

  autoWrite: {
    heading: "In den Dateien",
    edits: { title: "Gespeichertes in die Datei schreiben", note: "Wenn du die Details eines Titels speicherst, einzeln oder für mehrere zugleich, kommen sie auch in die Datei, wie mit In Datei schreiben. Android fragt zuerst bei Dateien, die Jukebox nicht selbst heruntergeladen hat." },
    lookups: { title: "Gefundenes in die Datei schreiben", note: "Bei einem Titel, den eine Suche gefunden und du nicht bearbeitet hast, werden die Details in die Datei geschrieben. Downloads von Jukebox sofort, auch im Hintergrund. Andere Dateien warten und werden beim nächsten Öffnen der App zusammen erfragt. Ein laufender Titel wartet bis zum nächsten Mal." },
  },
  copies: {
    title: 'Kopien desselben Songs',
    some: (count) =>
      oneOrMany(count, '1 Song ist mehrfach in deiner Bibliothek', `${format.number(count)} Songs sind mehrfach in deiner Bibliothek`),
    review: 'Ansehen',
    reviewHint: 'Öffnet die Kopien, um zu wählen, welche bleibt',
    note: 'Diese Dateien sehen aus wie eine Aufnahme, die mehrmals gespeichert wurde: gleicher Name oder gleicher Interpret und Titel, und die Länge weicht höchstens zwei Sekunden ab. Von jedem Song bleibt eine Kopie. Bevor die anderen gelöscht werden, wandern ihre Wiedergaben, Tags, Songtexte und Plätze in Listen zu ihr.',
    empty: 'Kein Song ist mehrfach in deiner Bibliothek.',
    cleanAll: (count) => `Alle ${format.number(count)} aufräumen`,
    confirmAll: (files, songs) =>
      `${oneOrMany(files, '1 Datei', `${format.number(files)} Dateien`)} löschen? Von ${oneOrMany(songs, '1 Song', `jedem der ${format.number(songs)} Songs`)} bleibt eine Kopie, und Wiedergaben, Tags, Songtexte und Listenplätze jeder gelöschten Datei wandern vorher zu ihr. Android fragt noch einmal, bevor etwas gelöscht wird.`,
    confirm: (files) => `${oneOrMany(files, '1 Datei', `${format.number(files)} Dateien`)} löschen`,
    deleteOthers: (count) =>
      oneOrMany(count, 'Die andere Kopie löschen', `Die anderen ${format.number(count)} Kopien löschen`),
    different: 'Das sind verschiedene Songs',
    choose: 'Welche Kopie bleibt',
    keepHint: 'Behält diese Kopie und löscht die anderen',
    keeps: 'Bleibt',
    goes: 'Wird gelöscht',
    why: {
      listens: 'Vorgeschlagen, weil sie die meisten Wiedergaben hat.',
      described: 'Vorgeschlagen, weil sie Details oder ein Cover hat.',
      folder: 'Vorgeschlagen, weil sie im Bibliotheksordner liegt.',
      larger: 'Vorgeschlagen, weil sie die größere Datei ist.',
      older: 'Vorgeschlagen, weil sie die ältere Datei ist.',
      alike: 'Die Kopien sind gleich; egal, welche bleibt.',
    },
    yourChoice: 'Es bleibt die Kopie, die du gewählt hast.',
    holds: (copy) => {
      const parts = [
        copy.listens > 0
          ? oneOrMany(copy.listens, '1 Wiedergabe', `${format.number(copy.listens)} Wiedergaben`)
          : 'keine Wiedergaben',
      ];
      if (copy.described) parts.push('Details');
      if (copy.cover) parts.push('Cover');
      if (copy.outside) parts.push('außerhalb des Bibliotheksordners');
      return parts.join(' · ');
    },
    deleted: (count) => oneOrMany(count, '1 Datei gelöscht.', `${format.number(count)} Dateien gelöscht.`),
    notDeleted: 'Die Dateien wurden nicht gelöscht. Ihre Wiedergaben und der Rest liegen jetzt bei der Kopie, die bleibt.',
    failed: (error) => `Ein Teil des Verlaufs ließ sich nicht verschieben; diese Dateien wurden nicht angerührt. ${error}`,
  },

  wrong: {
    title: 'Downloads, die der falsche Song sein könnten',
    some: (count) =>
      oneOrMany(count, '1 Download könnte ein anderer Song sein, als sein Name sagt', `${format.number(count)} Downloads könnten andere Songs sein, als ihre Namen sagen`),
    review: 'Ansehen',
    reviewHint: 'Öffnet diese Downloads, um jeden richtigzustellen',
    note: 'Jeder davon wurde als ein bestimmter Song heruntergeladen und bekam dessen Namen, aber das Video, aus dem er stammt, heißt anders – es könnte also ein anderer Song sein. Spiel ihn ab, um es zu hören, und gib ihm dann den Namen des Videos, lösch ihn oder bestätige, dass er stimmt. Nichts ändert sich, bevor du wählst.',
    empty: 'Kein Download sieht nach dem falschen Song aus.',
    filedAs: 'Gespeichert als',
    videoWas: 'Das Video hieß',
    facts: (length, listens) =>
      `${length} · ${listens > 0 ? oneOrMany(listens, '1 Wiedergabe', `${format.number(listens)} Wiedergaben`) : 'keine Wiedergaben'}`,
    playHint: 'Spielt diese Datei ab',
    rename: 'So nennen, wie er heißt',
    delete: 'Löschen',
    right: 'Stimmt so',
    sheetNote: 'Aus dem Titel des Videos übernommen. Ändere ihn, wenn er nicht ganz stimmt. Er wird als deine eigene Bearbeitung gespeichert, die kein Nachschlagen überschreibt.',
    titleField: 'Titel',
    artistField: 'Künstler',
    renamed: (title) => `Umbenannt in „${title}“.`,
    deleted: 'Gelöscht.',
    notDeleted: 'Die Datei wurde nicht gelöscht.',
    keptRight: 'Bleibt, wie er ist. Du wirst nicht noch einmal gefragt.',
    failed: (error) => `Das ging nicht. ${error}`,
  },

  shuffle: {
    menu: 'Zufallswiedergabe',
    everything: 'Alle Songs',
    change: 'Ändern, was die Taste abspielt …',
    heading: 'Die Zufallstaste spielt',
    note: 'Halte die Taste gedrückt, um einmalig etwas anderes zufällig abzuspielen. Widget und Auto spielen dasselbe.',
    labelHeading: 'Auf der Zufallstaste steht',
    label: { name: 'Der Name dessen, was sie spielt', words: 'Eigener Text', icon: 'Nichts, nur das Symbol' },
    wordsHeading: 'Text auf der Zufallstaste',
    wordsPlaceholder: 'Zufällig',
    spoken: (name) => `Zufällig: ${name}`,
  },
};
