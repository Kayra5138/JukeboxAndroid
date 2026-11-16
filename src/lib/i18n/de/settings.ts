import { format, NNBSP } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `Letzter Build: ${when}`,
  lastBuiltUnknown: 'Letzter Build: nach Installation der neuen APK verfügbar',

  sections: {
    look: 'Aussehen & Gefühl',
    sound: 'Klang',
    player: 'Player',
    tapes: 'Kassetten',
    library: 'Bibliothek',
    downloads: 'Downloads & Entdecken',
    data: 'Deine Daten',
    views: 'Bibliotheksansichten',
    experimental: 'Experimentell',
  },
  categories: {
    look: 'Design, Bewegung, Vibration und welche Ansichten die Bibliothek bietet.',
    sound: 'Equalizer und Effekte, Lautstärkeangleichung, Überblenden sowie Tempo und Tonhöhe.',
    player: 'Wie weit die Sprungtasten springen, was nach dem Ende der Warteschlange läuft und in welche Sprache Songtexte übersetzt werden.',
    tapes: 'Intelligentes Zurückspulen, wie weit die Sprungtasten einer Kassette springen, und Podcasts nur über WLAN laden.',
    library: 'Der Ordner mit deiner Musik, Tags und Cover sowie Dateien, die derselbe Song sein könnten.',
    waiting: (count) => `${format.number(count)} offen`,
    downloads: 'Die Download-Warteschlange und ihr schwebender Button, Entdecken und Updates für den YouTube-Downloader.',
    data: 'Alles sichern oder ein Backup einspielen, Update-Suche und ListenBrainz (experimentell).',
  },

  language: {
    title: 'Sprache',
    note: 'Die Sprache der App. Sie richtet sich nicht nach der des Geräts.',
  },
  theme: {
    title: 'Design',
    open: 'Farben, Glas oder ein eigenes.',
    note: 'System folgt der Hell/Dunkel-Einstellung des Geräts.',
    pair: {
      light: 'Im hellen Modus',
      dark: 'Im dunklen Modus',
      note: 'Die beiden Designs, zwischen denen System wechselt – so wie das Gerät.',
    },
    shuffle: {
      title: 'Jedes Mal ein anderes Design',
      on: 'An',
      toggle: 'Bei jedem Start der App zufällig eines wählen',
      note: 'Hake die Designs an, aus denen gewählt wird. Das gewählte bleibt bis zum nächsten Start der App, und du kannst es zwischendurch trotzdem von Hand ändern.',
      empty: 'Hake mindestens ein Design an, damit das etwas bewirkt.',
    },
  },
  customTheme: {
    open: 'Farben des eigenen Designs',
    openNote: 'Wähle einen Hintergrund und eine Akzentfarbe für das Design „Eigenes“. Alles andere wird daraus abgeleitet.',
    preview: 'Vorschau',
    background: 'Hintergrund',
    accent: 'Akzent',
    surface: 'Karten',
    automatic: 'Automatisch',
    automaticNote: 'Aus dem Hintergrund abgeleitet',
    presets: 'Farbvorschläge',
    hue: 'Farbton',
    saturation: 'Sättigung',
    lightness: 'Helligkeit',
    degrees: (value) => `${value}°`,
    percent: (value) => `${value}${NNBSP}%`,
    hex: 'Farbcode',
    nudged: (colour) => `Wird als ${colour} angezeigt, damit alles darauf lesbar bleibt.`,
    note:
      'Die Textfarben werden daraus abgeleitet, damit Text immer lesbar ist. Aus demselben Grund kann eine gewählte Farbe etwas heller oder dunkler ausfallen.',
    use: 'Dieses Design verwenden',
    reset: 'Zurücksetzen',
    sample: {
      title: 'Songtitel',
      line: 'Künstler · Album',
      chip: 'Zufällig',
      button: 'Abspielen',
    },
  },

  tags: { note: 'Titelinfos und Albumcover' },
  favoritesShown: { title: "Favoriten", note: "Eine Liste, die immer da ist, Neueste zuerst, gefüllt vom Herz im Player und von Zu Favoriten hinzufügen im Menü eines Titels. Aus sind alle drei verborgen, der Inhalt bleibt." },
  listButton: {
    title: 'Taste „Zur Liste“',
    note:
      'Eine Taste im Player, die den laufenden Song ohne Umweg über sein Menü zu einer deiner Listen hinzufügt.',
  },
  autoplaySizes: { title: 'Ähnliche Titel auf einmal', library: 'Aus deiner Bibliothek', fresh: 'Neu aus Discover', note: 'Wie viele bei jedem Auffüllen der Warteschlange hinzukommen, für „Mit ähnlichen Songs weiterspielen“ und für einen mit ähnlichen Titeln gespielten Song. Jeder neue Titel ist ein Download. Gemischt nimmt drei Viertel von beiden.' },
  tap: {
    title: 'Beim Antippen eines Titels',
    note: 'Was nach einem Titel läuft, den du unter Tracks oder in Suchergebnissen antippst.',
    sheetNote: 'Play und Shuffle über einem Album oder einer Liste, Shuffle all und Discover ändern sich dadurch nicht. Das Menü jedes Titels hat „Mit ähnlichen Titeln abspielen“ und „Nur diesen abspielen“ für einmal.',
    list: { label: 'Rest der Liste', note: 'Die Titel danach, in der angezeigten Reihenfolge.' },
    shuffled: { label: 'Rest der Liste, gemischt', note: 'Dieser zuerst, dann die anderen der Liste in zufälliger Reihenfolge.' },
    similar: { label: 'Ähnliche Titel', note: 'Dieser, dann eine Reihe ähnlicher Titel aus deiner Bibliothek oder aus Discover, wie du es wählst. Danach geht die Warteschlange weiter, wie „Mit ähnlichen Songs weiterspielen“ sagt.' },
    only: { label: 'Nur dieser Titel', note: 'Danach nichts, außer „Mit ähnlichen Songs weiterspielen“ fügt etwas hinzu.' },
    source: { title: 'Ähnliche Titel aus', note: 'Woher die ersten Titel nach einem angetippten kommen. Danach übernimmt „Mit ähnlichen Songs weiterspielen“.' },
    everywhere: { title: 'Auch in Alben und Listen', note: 'Auch beim Antippen auf der Seite eines Albums, einer Liste, eines Künstlers oder Ordners. Aus: Diese spielen in ihrer eigenen Reihenfolge.' },
  },
  autoplay: {
    title: 'Mit ähnlichen Songs weiterspielen',
    note: 'Kurz bevor die Warteschlange endet, werden Songs angehängt, die dem ähneln, was du gerade gehört hast.',
    sheetNote: 'Sie werden ein paar Songs vor dem Ende angehängt und laufen wie der Rest der Warteschlange weiter, auch bei gesperrtem Bildschirm. Nie, solange Wiederholen an ist.',
    off: {
      label: 'Aus',
      note: 'Es wird nichts angehängt. Die Musik endet mit der Warteschlange.',
    },
    library: {
      label: 'Aus deiner Bibliothek',
      note: 'Ausgewählt nach Tags, Künstlern und dem, was du zusammen hörst. Funktioniert offline.',
    },
    fresh: {
      label: 'Neue Songs',
      note: 'Songs, die du noch nicht hast, gefunden von Entdecken. Nutzt wie Entdecken das Netz und lädt von YouTube herunter; hält sich an dessen WLAN-Einstellung.',
    },
    mixed: {
      label: 'Gemischt',
      note: 'Zwei aus deiner Bibliothek, dann ein neuer Song. Die neuen nutzen wie Entdecken das Netz und YouTube-Downloads und halten sich an dessen WLAN-Einstellung.',
    },
  },
  downloads: {
    listen: { title: 'Angehörte, nicht behaltene Songs', note: 'So viele Tage nach dem Laden gelöscht, außer du behältst sie: mit dem Herz, in einer Liste oder über ihr Menü.', days: (days) => oneOrMany(days, '1 Tag', `${format.number(days)} Tage`)  },
    note: 'Was gerade heruntergeladen wird, was wartet und was fertig ist.',
    button: {
      title: 'Schwebender Download-Button',
      note: 'Ein runder Button über der App, solange etwas heruntergeladen wird und noch ein paar Minuten danach. Tippe darauf, um den Fortschritt zu sehen.',
    },
    check: {
      title: 'Nach neuerem YouTube-Downloader suchen',
      note: 'Höchstens einmal am Tag und nur, wenn du Downloads öffnest oder etwas herunterlädst, fragt Jukebox bei GitHub nach, welche yt-dlp-Version die neueste ist. Dabei wird nichts über dich oder deine Bibliothek gesendet, und nichts wird heruntergeladen, bevor du zustimmst.',
    },
  },
  discover: { note: 'Wie lang die Liste ist, wie oft sie neu erstellt wird und was abgelehnt wurde.' },
  /** What stands where the cover is in the player: Settings → Player. See `ui/coverLook.ts`. */
  /** Settings → Look & feel, under the theme: the row that opens how the player looks. */
  playerLook: { title: 'Player-Aussehen', open: 'Was anstelle des Covers steht und was sich zur Musik bewegt.' },
  coverLook: {
    songs: 'Songs',
    tapes: 'Tapes',
    cover: 'Cover',
    record: 'Schallplatte',
    cassette: 'Kassette',
    note: 'Was im Player anstelle des Covers steht. Eine Schallplatte dreht sich beim Abspielen; eine Kassette spult ihr Band im Lauf des Teils von einer Spule auf die andere. Mit „Weniger Bewegung“ stehen beide still.',
    tonearm: 'Tonarm',
    tonearmNote: 'Ein Tonarm über der Platte, dessen Nadel im Lauf des Songs vom Rand zum Etikett wandert.',
    motion: 'Zur Musik',
    none: 'Nichts',
    spectrum: 'Spektrum',
    ripple: 'Wellen',
    breathe: 'Atmen',
    scope: 'Oszilloskop',
    motionNote: 'Was sich darum zur Musik bewegt, im Takt mit dem, was du hörst, auch über Kopfhörer. Nur während der Wiedergabe und bei geöffnetem Player.',
    punch: 'Puls',
    spectrogram: 'Spektrogramm',
    sparks: 'Funken',
    aurora: 'Polarlicht',
    notes: {
      spectrum: 'Balken, wie laut jede Tonhöhe ist; Strahlen um eine Schallplatte.',
      ripple: 'Ringe, die bei jedem Schlag vom Rand ausgehen.',
      breathe: 'Wächst ein wenig mit der Musik, ein Leuchten dahinter.',
      punch: 'Springt bei jedem Schlag etwas größer und setzt sich wieder.',
      scope: 'Die Linie des Klangs selbst.',
      spectrogram: 'Die letzten Sekunden jeder Tonhöhe, vorbeiziehend.',
      sparks: 'Funken, die bei jedem Schlag von seinem Rand über den Player fliegen.',
      aurora: 'Wolken in den Farben des Covers hinter dem ganzen Player, jede wächst mit einem Teil des Klangs.',
    },
    beats: 'Im Takt vibrieren',
    beatsNote: 'Ein leichtes Klopfen bei jedem Schlag, solange der Player offen ist und Musik läuft. So leise, wie deine Vibrationseinstellungen es machen.',
  },
  still: {
    title: 'Weniger Bewegung',
    note:
      'Für Geräte, bei denen Animationen ruckeln. Der Player erscheint, statt hochzugleiten, und das Spiel leuchtet nicht mehr auf, wenn ein Leben gewonnen oder verloren wird. Die Tasten selbst fallen weiter – das ist das Spiel, keine Dekoration.',
  },
  scriptNames: { title: 'Namen in anderen Schriften', latin: 'Lateinisch', original: 'Original', note: 'Wenn eine Suche den Namen eines Titels in lateinischer Schrift und in seiner eigenen (Japanisch, Chinesisch, Koreanisch) gefunden hat, welchen die Bibliothek zeigt. Früher gesuchte Titel füllen sich bei der nächsten Suche.' },
  haptics: {
    title: "Vibration",
    open: "Wie viel die App unter dem Finger vibriert und wie stark.",
    mode: "Vibrieren",
    modes: { off: "Aus", essential: "Wesentlich", all: "Alles", custom: "Eigene" },
    modeNotes: {
      off: "Die App vibriert gar nicht.",
      essential: "Nur wo es am meisten sagt: ein langes Drücken, ob etwas geklappt hat, und das Spiel.",
      all: "Halten und Ziehen, Schalter und Auswahl, Stufen eines Reglers, Ergebnisse, die Tasten des Players und das Spiel.",
      custom: "Wähle unten, welche Momente vibrieren.",
    },
    strength: "Stärke",
    strengthNote: "Zu spüren beim Loslassen. Telefone, deren Motor sich nicht abstufen lässt, behalten ihre eigene Stärke.",
    groupsHeading: "Was vibriert",
    groups: {
      holds: { title: "Halten und Ziehen", note: "Ein langes Drücken, eine angehobene Zeile, ein Finger über die Kästchen." },
      choices: { title: "Schalter und Auswahl", note: "Schalter, die Reiter einer Auswahl, eine gewählte Option." },
      notches: { title: "Stufen und Schritte", note: "Normales Tempo, 0 dB, die Mitte eines Reglers, die Säulen eines Diagramms." },
      results: { title: "Ergebnisse", note: "Etwas hat geklappt oder nicht: gefunden, geschrieben, hinzugefügt, importiert." },
      player: { title: "Player-Tasten", note: "Wiedergabe, Überspringen, Wiederholen, das Herz, Tippen auf eine Liedzeile." },
      fun: { title: "Spiel und Spaß", note: "Die Tasten von Piano Tiles und mehr." },
    },
    phone: "Ist das Berührungsfeedback in den Einstellungen des Telefons aus, vibriert auch die App nicht.",
  },
  moreButton: {
    title: 'Drei Punkte in jeder Zeile',
    note:
      'Sie stehen am Ende jeder Titel- und Albumzeile und öffnen dasselbe Menü wie langes Drücken. Gedrückthalten funktioniert auch ohne sie.',
  },
  tabs: {
    title: 'Tabs',
    searchNote: 'Entdecken und YouTube-Downloads sind auf diesem Tab und verschwinden mit ihm.',
    aside: 'Bibliothek und Einstellungen sind immer da.',
    names: 'Namen unter den Symbolen',
    namesNote: 'Aus zeigt die Leiste nur ihre Symbole und ist etwas niedriger. Im Querformat immer.',
  },

  views: {
    notes: {
      tracks: 'Jeder Song, einer pro Zeile.',
      albums: 'Alben, zusammengestellt aus den Angaben in den Tags.',
      artists: 'Alle, denen ein Song zugeschrieben ist. Ein Song von zwei Künstlern steht bei beiden.',
      folders: 'Die Ordner, in denen die Dateien liegen, unterhalb des Bibliotheksordners.',
      tapes: 'Hörbücher, Podcasts und lange Aufnahmen aus dem Ordner Tapes im Bibliotheksordner, die dort weiterlaufen, wo du aufgehört hast.',
    },
    onlyHint: 'Die einzige noch aktive Ansicht, daher bleibt sie an',
    toggleHint: 'Blendet diese Ansicht in der Bibliothek ein oder aus',
    asideOne: 'Ist nur eine Ansicht an, zeigt die Bibliothek sie ohne Umschalter. Eine bleibt immer an.',
    asideMany: 'Der Umschalter der Bibliothek bietet die aktiven Ansichten an. Eine bleibt immer an.',
  },

  sameSong: {
    note: (count) =>
      oneOrMany(
        count,
        'Eine Datei, die wie ein Song aussieht, den du schon als andere Datei hattest. Ihr Verlauf bleibt getrennt, bis du entscheidest.',
        `${format.number(count)} Dateien, die wie Songs aussehen, die du schon als andere Datei hattest. Ihr Verlauf bleibt getrennt, bis du entscheidest.`
      ),
  },
  exportAll: {
    title: 'Alles exportieren',
    note:
      'Dein Hörverlauf, deine Listen, Tags, Songtexte und Einstellungen, die Podcasts, denen du folgst, und wo du in jeder Kassette bist und was du darin markiert hast, in einer Datei, deren Speicherort du wählst. Nicht die Musik selbst.',
    failed: 'Das Backup konnte nicht gespeichert werden.',
  },
  autoBackup: {
    title: 'Automatisch sichern',
    off: 'Dieselbe Datei wie bei „Alles exportieren“, von selbst jeden Tag oder jede Woche in einem Ordner deiner Wahl gespeichert.',
    folder: 'Ordner',
    folderUnnamed: 'Gewählter Ordner',
    chooseOther: 'Anderen Ordner wählen',
    lost: 'Jukebox kann diesen Ordner nicht mehr erreichen: Er wurde verschoben oder gelöscht, oder die Berechtigung wurde zurückgenommen. Wähle ihn erneut, damit weiter gesichert wird.',
    chooseAgain: 'Ordner erneut wählen',
    every: 'Wie oft',
    daily: 'Jeden Tag',
    weekly: 'Jede Woche',
    keep: 'Behaltene Backups',
    keepNote: (count) =>
      oneOrMany(
        count,
        'Nur das neueste Backup bleibt im Ordner, ältere werden gelöscht. Sonst wird im Ordner nichts angerührt.',
        `Die neuesten ${format.number(count)} Backups bleiben im Ordner, ältere werden gelöscht. Sonst wird im Ordner nichts angerührt.`
      ),
    last: (when) => `Letztes Backup: ${when}.`,
    never: 'Noch kein Backup erstellt.',
    failed: 'Das letzte Backup konnte nicht erstellt werden. Beim nächsten Mal wird es erneut versucht.',
    now: 'Jetzt sichern',
    made: 'Gesichert.',
  },
  importBackup: {
    title: 'Importieren',
    note: 'Ein Backup einspielen. Du siehst, was darin ist, und wirst gefragt, bevor sich etwas ändert.',
    failed: 'Der Import ist fehlgeschlagen.',
    refused: (reason) => `${reason} Auf diesem Gerät wurde nichts geändert.`,
  },

  playback: {
    title: 'Wiedergabe',
    note: (speed) => `Tempo und Tonhöhe · ${speed}×`,
  },
  equalizer: { note: 'Bänder, Bass, Surround und Lautheit' },
  effects: { note: 'Breite, Crossfeed, Rotation und Pegel' },
  /** The tape settings, apart from the music's: see `app/settings-tapes.tsx`. */
  tapes: {
    smartRewind: {
      title: 'Intelligentes Zurückspulen',
      note: 'Eine Kassette, die nach einer Weile wieder abgespielt wird, beginnt etwas vor der Stelle, an der sie aufgehört hat – je länger die Pause, desto weiter: drei Sekunden nach einer kurzen Pause, eine halbe Minute nach einem Tag. Aus, spielt sie genau dort weiter, wo sie stehen blieb.',
    },
    skipSilence: { title: 'Stille überspringen', note: 'Pausen im Gesprochenen werden übersprungen, eine Kassette läuft etwas kürzer. Musik wird nie verändert.' },
    voiceClarity: { title: 'Klarere Stimme', note: 'Brummen unter der Stimme wird abgesenkt und der Bereich, in dem Wörter unterschieden werden, leicht angehoben, über deinem Equalizer. Nur bei Kassetten.' },
    skipSponsors: { title: 'Sponsoren überspringen', note: 'In Kassetten von YouTube werden die von SponsorBlock-Hörern markierten Teile – Sponsorenhinweise, Eigenwerbung, Abo-Aufrufe – übersprungen.' },
    back: 'Zurückspringen',
    forward: 'Vorspringen',
    jumpNote: 'Wie weit die beiden Tasten neben Play bei einer Kassette springen, in Sekunden. Die Musik hat ihre eigene Einstellung unter Player.',
    podcasts: 'Podcasts',
    deletePlayed: {
      title: 'Gehörte Folgen löschen',
      off: 'Folgen der Podcasts, denen du folgst, bleiben nach dem Hören auf dem Telefon.',
      after: (days) => oneOrMany(days, 'Eine Folge eines Podcasts, dem du folgst, wird einen Tag nach dem Durchhören gelöscht, wenn die App sie geladen hat. Eine Folge mit Markierungen bleibt.', `Eine Folge eines Podcasts, dem du folgst, wird ${format.number(days)} Tage nach dem Durchhören gelöscht, wenn die App sie geladen hat. Eine Folge mit Markierungen bleibt.`),
    },
    /** The podcasts followed, as an OPML file: see `podcasts/opml.ts`. */
    opml: {
      heading: 'Podcasts umziehen',
      export: 'Gefolgte Podcasts speichern',
      exportNote: 'Als OPML-Datei, die andere Podcast-Apps lesen können.',
      import: 'Podcasts aus einer Datei folgen',
      importNote: 'Eine OPML-Datei aus einer anderen Podcast-App. Den Sendungen wird gefolgt, ohne dass von selbst etwas geladen wird; das schaltest du für jede auf ihrer eigenen Seite ein.',
      importing: (done, total) => `${format.number(done)} von ${format.number(total)} gelesen …`,
      imported: (followed, already, failed) => [oneOrMany(followed, '1 Podcast gefolgt.', `${format.number(followed)} Podcasts gefolgt.`), already > 0 ? `${format.number(already)} schon gefolgt.` : '', failed > 0 ? `${format.number(failed)} nicht lesbar.` : ''].filter(Boolean).join(' '),
      nothing: 'In dieser Datei sind keine Podcasts.',
      failed: 'Die Datei konnte nicht gelesen oder geschrieben werden.',
      none: 'Du folgst noch keinen Podcasts.',
      saved: (count) => oneOrMany(count, '1 Podcast gespeichert.', `${format.number(count)} Podcasts gespeichert.`),
    },
  },
  jump: {
    title: 'Sprungweite',
    note: 'Wie weit die beiden Tasten links und rechts von Play in einem Titel springen, in Sekunden.',
  },
  crossfade: { note: 'Wie ein Titel in den nächsten übergeht' },
  loudness: {
    title: 'Lautstärke angleichen',
    note:
      'Leise Titel werden lauter, laute leiser. Ein Album, das der Reihe nach läuft, behält seine eigene Dynamik.',
  },
  lyricsLanguage: {
    title: 'Songtexte übersetzen in',
    note:
      'Songtexte werden auf dem Gerät übersetzt. Jede Sprache außer Englisch läuft über Englisch und lädt beim ersten Mal ein zweites Modell herunter.',
  },
};
