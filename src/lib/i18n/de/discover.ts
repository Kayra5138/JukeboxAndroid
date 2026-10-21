import { format, NNBSP } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

/* "Von 12 Künstlern": the dative plural takes an -n that the singular does not. */
const ofArtists = (done: number, total: number) =>
  `${format.number(done)} von ${format.number(total)} ${oneOrMany(total, 'Künstler', 'Künstlern')}`;

export const discover: Strings['discover'] = {
  panel: {
    heading: 'Für dich zusammengestellt',
    refresh: 'Aktualisieren',
    updated: (date) => `Aktualisiert am ${date}`,

    familiar: (because) => `Mehr von deinen Künstlern · ${because}`,
    fresh: (because) => `Neuer Künstler · ${because}`,
  },

  header: {
    notYet: 'Noch keine Liste',
    about: 'Über Entdecken',
    settings: 'Entdecken-Einstellungen',
    findMore: 'Mehr finden',
    dismiss: 'Ausblenden',
  },

  about: {
    heading: 'Über Entdecken',
    what:
      'Songs, die du noch nicht hast, ausgewählt nach dem, was du in den letzten 30 Tagen gehört hast: mehr von deinen Künstlern und von Künstlern, die ihnen nahestehen.',
    source:
      'Was du hörst, wird auf diesem Gerät ausgewertet. Die Vorschläge kommen von ListenBrainz und MusicBrainz, und der Ton eines Songs wird von YouTube geholt, wenn er abgespielt werden soll.',
    keep: '„Behalten“ legt einen Song in deine Bibliothek. Er verlässt die Liste – er wurde ja gefunden.',
    exclude:
      '„Nicht diesen Song“ nimmt ihn von der Liste, und er wird nicht wieder empfohlen. Über das Menü geht das auch für seinen Künstler.',
    room: 'So oder so rückt ein anderer Song nach. Zieh eine Zeile zur Seite, um dasselbe zu tun, oder halte sie gedrückt für mehr.',
  },

  row: {
    keep: 'In Bibliothek behalten',
    exclude: 'Nicht diesen Song',
    swipeKeep: 'Behalten',
    swipeExclude: 'Ablehnen',
    willPlay: 'Spielt, sobald bereit',
    preview: 'Vorschau · der Song ist unterwegs',
    previewStop: 'Stoppt die Vorschau. Der Song spielt trotzdem, sobald er bereit ist',
    willKeep: 'In die Bibliothek, sobald bereit',
    keeping: 'Wird in der Bibliothek gespeichert…',
    failed: 'Download fehlgeschlagen · zum Wiederholen tippen',
    needsBuild: 'Braucht die aktualisierte App',
    waitingWifi: 'Wartet auf WLAN · zum Herunterladen tippen',
    percent: (percent) => `${format.number(percent)}${NNBSP}%`,
    gettingReady: 'Wird heruntergeladen',
    hint: 'Spielt den Song ab und lädt ihn vorher herunter, falls nötig',
    nowPlaying: (title) => `${title} läuft`,
    menu: 'Song-Optionen',
  },

  menu: {
    play: { label: 'Abspielen', hint: 'Vorher heruntergeladen, falls nötig' },
    keep: { label: 'In Bibliothek behalten', hint: 'Gehört dir und verschwindet von dieser Liste' },
    exclude: { label: 'Nicht diesen Song', hint: 'Weg von der Liste und nicht wieder empfohlen' },
    neverArtist: {
      label: (artist) => `Nie wieder ${artist}`,
      hint: 'Nichts von diesem Künstler wird wieder empfohlen',
    },
    why: 'Warum dieser Song',
    seeds: (artists) => `Weil du ${artists} hörst`,
    tags: (tags) => `Tags: ${tags}`,
    freshArtist: 'Ein Künstler, der neu in deiner Bibliothek ist',
  },

  empty: {
    building: 'Deine Liste wird zusammengestellt…',
    none: 'Noch keine Liste. Tippe auf „Aktualisieren“, dann erstellt Entdecken eine aus dem, was du hörst.',
    findingMore: 'Weitere Songs werden gesucht…',
    short: (missing) =>
      `${format.number(missing)} ${missing === 1 ? 'Platz ist' : 'Plätze sind'} leer.`,
  },

  player: {
    kept: 'In Bibliothek gespeichert',
  },

  preview: {
    label: 'Vorschau',
    note: 'Der ganze Song startet, sobald er bereit ist',
    stop: 'Vorschau stoppen',
  },

  settings: {
    heading: 'Entdecken',
    title: 'Entdecken-Einstellungen',
    count: 'Anzahl der Songs',
    countNote: 'Halb bekannte Künstler, halb neue. Gespeicherte und abgelehnte Songs werden sofort ersetzt.',
    refresh: 'Liste aktualisieren',
    everyDays: (days) => `${format.number(days)} Tg.`,
    manual: 'Manuell',
    refreshNote:
      'Android entscheidet, wann Hintergrundaufgaben laufen dürfen. Eine überfällige Aktualisierung läuft auch, wenn du Jukebox wieder öffnest. Nicht gespeicherte Entdeckungen werden ersetzt; eingereihte Songs bleiben, bis die Wiedergabe sie nicht mehr braucht.',
    ready: 'Nächste Songs bereithalten',
    readyNone: 'Keine',
    readyNote:
      'Vorab heruntergeladen, damit ein Tippen sofort abspielt: die ersten der Liste oder die nach dem, was gerade läuft. Bei „Keine“ wird ein Song erst geladen, wenn du ihn antippst.',
    wifi: 'Songs nur über WLAN bereithalten',
    wifiNote: 'Nutzt WLAN ohne Volumenbegrenzung. Ein angetippter Song wird über jede verfügbare Verbindung geladen.',
    preview: 'Vorschau abspielen, während ein Song lädt',
    previewNote:
      'Ein angetippter Song, der noch nicht bereit ist, startet sofort als 30-Sekunden-Vorschau von Deezer, und der ganze Song übernimmt von Anfang an, sobald er da ist. Eine Vorschau zählt nicht als Wiedergabe.',
    nextList: 'Deine aktuelle Liste bleibt, wie sie ist. Die nächste wird so ausgewählt.',
    excluded: 'Abgelehnte Songs',
    noneExcluded: 'Keine abgelehnten Songs.',
    allowAgain: 'Wieder zulassen',
    allowAgainLabel: (title) => `${title} wieder zulassen`,
    unblock: 'Entsperren',
    unblockLabel: (artist) => `${artist} entsperren`,
    failed: 'Die Entdecken-Einstellungen konnten nicht gespeichert werden. Bitte versuch es erneut.',
  },

  state: {
    idle: 'Zum Herunterladen und Abspielen tippen',
    starting: 'Startet…',
    waitingFind: 'Wartet auf die Suche',
    waitingDownload: 'Wartet auf den Download',
    waitingRetry: 'Gleich neuer Versuch',
    finding: 'Aufnahme wird gesucht…',
    preparing: 'Download startet…',
    downloading: (percent) => `Wird geladen · ${format.number(percent)}${NNBSP}%`,
    converting: 'Wird fertiggestellt…',
    saving: 'Fast fertig…',
    ready: 'Bereit zum Abspielen',
    playing: 'Läuft',
    willPlay: (doing) => `${doing} Spielt, sobald bereit.`,
    preview: (doing) => `Vorschau läuft. ${doing}`,
    willKeep: (doing) => `${doing} Wird in der Bibliothek gespeichert, sobald bereit.`,
    keeping: 'Wird in der Bibliothek gespeichert…',
    waitingWifi: 'Wartet auf WLAN · tippen, um jetzt herunterzuladen',
  },

  failure: {
    generic: 'Dieser Download konnte nicht abgeschlossen werden.',
    fileMissing: 'Die Datei ist nicht mehr auf dem Gerät.',
    noRecording: 'Davon wurde keine Aufnahme gefunden.',
    notASong: 'Das gefundene Video ist ein Livestream oder viel zu lang für diesen Song.',
    stopped: 'Der Download wurde gestoppt.',
    needsBuild: 'Installiere die aktualisierte APK, um Songs aus Entdecken herunterzuladen.',
    retry: (reason) => `${reason} Zum Wiederholen tippen.`,
  },

  status: {
    building: 'Songs werden gesucht…',
    filling: (known, total) => `Songs werden gesucht · ${format.number(known)} von ${format.number(total)}`,
    findingOffline: 'Keine Verbindung. Der Rest der Liste wird gesucht, sobald wieder eine besteht.',
    findingPaused: 'Downloads sind pausiert. Setze sie fort, dann wird der Rest der Liste gesucht.',
    findingLater: 'Einige Songs ließen sich gerade nicht prüfen. Entdecken versucht es später erneut.',
    buildingArtists: (done, total) => `Songs werden gesucht · ${ofArtists(done, total)}`,
    preparing: (ready, target) =>
      `Eine neue Liste ist unterwegs · ${format.number(ready)} von ${format.number(target)} ${oneOrMany(target, 'Song', 'Songs')} bereit.${ready > 0 ? ' Aktualisiere erneut, um sie jetzt zu sehen.' : ''}`,
    offline: 'Keine Verbindung. Deine Liste bleibt; neue Songs werden gesucht, sobald wieder eine besteht.',
    offlineEmpty: 'Keine Verbindung. Entdecken erstellt deine Liste, sobald wieder eine besteht.',
    noLibrary: 'Entdecken geht von der Musik auf diesem Gerät aus und hat noch keine gefunden.',
    noTaste:
      'Deine Songs geben nicht an, von wem sie sind, daher hat Entdecken keinen Ausgangspunkt. Schlag ihre Details unter Einstellungen → Bibliothek → Tags nach.',
    unreachable: 'Die Empfehlungen waren nicht erreichbar. Deine Liste bleibt; bitte versuch es später erneut.',
    unreachableEmpty: 'Die Empfehlungen waren nicht erreichbar. Bitte versuch es später erneut.',
    exhausted: 'Es gibt noch nicht genug neue Songs. Deine Liste bleibt, wie sie ist.',
    exhaustedEmpty: 'Noch nichts Neues zu empfehlen. Hör noch etwas mehr und versuch es dann erneut.',
    timedOut: 'Die Suche nach Songs hat zu lange gedauert und wurde abgebrochen. Bitte versuch es erneut.',
    throttled: 'Entdecken hat gerade erst gesucht. Versuch es in einer Minute erneut.',
    failed: 'Entdecken konnte nicht abschließen. Bitte versuch es erneut.',
    waitingWifi: 'Die nächsten Songs werden heruntergeladen, sobald WLAN verfügbar ist. Tippe auf einen Song, um ihn jetzt zu laden.',
    waitingConnection: 'Die nächsten Songs werden heruntergeladen, sobald eine Verbindung besteht.',
    paused: 'Downloads sind pausiert. Setze sie fort, um Songs zu laden.',
  },

  notice: {
    kept: (title) => `${title} in der Bibliothek gespeichert.`,
    excluded: (title) => `${title} wird nicht mehr empfohlen.`,
    excludedArtist: (artist) => `${artist} wird nicht mehr empfohlen.`,
    restored: (title) => `${title} ist wieder auf der Liste.`,
    refreshed: 'Hier ist deine neue Liste.',
    keepFailed: (title) => `${title} konnte nicht in der Bibliothek gespeichert werden. Bitte versuch es erneut.`,
    wrongFile: (title) => `Die Datei für ${title} war ein anderer Song. Der richtige wird gesucht und dann gespeichert.`,
    undo: 'Rückgängig',
  },

  engine: {
    needsTaste: 'Entdecken hat keinen Künstler und keinen Tag als Ausgangspunkt.',
    nothingFetched:
      'Es konnten keine Empfehlungen abgerufen werden. Deine aktuelle Entdecken-Liste bleibt; bitte versuch es später erneut.',
  },

  taste: {
    popularity: 'Bekanntheit der Songs',
    popularityKnown: 'Bekannt',
    popularityAny: 'Beliebig',
    popularityDeep: 'Geheimtipps',
    popularityNote:
      'Ob Entdecken eher zu bekannten Künstlern und ihren meistgehörten Songs tendiert oder zu Künstlern und Songs, die weniger Leute kennen. Bei „Beliebig“ wird ein neuer Künstler mit einem seiner bekanntesten Songs vorgestellt.',

    neverArtistLabel: (artist) => `${artist} nie wieder empfehlen`,
    blockedArtists: 'Gesperrte Künstler',
    noneBlockedArtists: 'Keine gesperrten Künstler.',
    blockedArtistsNote:
      'Wenn du einen Song ablehnst, wird auch sein Künstler seltener vorgeschlagen. Nach drei abgelehnten Songs eines Künstlers lässt Entdecken ihn für sechs Monate weg.',
  },

  why: {
    moreFrom: (artist) => `Mehr von ${artist}`,
    becauseYouPlay: (artists) => `Weil du ${artists} hörst`,
    both: (first, second) => `${first} und ${second}`,
    like: (artist) => `Ähnlich wie ${artist}`,
    withGenre: (line, genre) => `${line} · ${genre}`,
    fromTags: (tags) => `Weil du ${tags} hörst`,
    unexplained: 'Für dich ausgewählt',
    veryNear: 'Ganz nah an dem, was du hörst',
    near: 'Nah an dem, was du hörst',
    farther: 'Ein Schritt weiter weg',
  },

  gathering: {
    around: (artist, done, total) => `Rund um ${artist} · ${ofArtists(done, total)}`,
    artists: (done, total) => ofArtists(done, total),
    naming: 'Songs werden identifiziert…',
    offline: 'Keine Verbindung. Entdecken sucht nach neuen Songs, sobald wieder eine besteht.',
    throttled: 'Der Empfehlungsdienst bittet Entdecken, langsamer zu machen. Bitte versuch es in ein paar Minuten erneut.',
    nothing: 'Diesmal wurde nichts Neues gefunden. Deine aktuelle Entdecken-Liste bleibt; bitte versuch es später erneut.',
  },
};
