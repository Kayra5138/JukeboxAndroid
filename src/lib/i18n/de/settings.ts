import { format, NNBSP } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const settings: Strings['settings'] = {
  lastBuilt: (when) => `Letzter Build: ${when}`,
  lastBuiltUnknown: 'Letzter Build: nach Installation der neuen APK verfügbar',

  sections: {
    look: 'Aussehen',
    sound: 'Klang',
    player: 'Player',
    library: 'Bibliothek',
    downloads: 'Downloads & Entdecken',
    data: 'Deine Daten',
    views: 'Bibliotheksansichten',
    experimental: 'Experimentell',
  },
  categories: {
    look: 'Design, Alben als Regal, Bewegung und welche Ansichten die Bibliothek bietet.',
    sound: 'Equalizer und Effekte, Lautstärkeangleichung, Überblenden sowie Tempo und Tonhöhe.',
    player: 'Wie weit die Sprungtasten springen, was nach dem Ende der Warteschlange läuft und in welche Sprache Songtexte übersetzt werden.',
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
  rack: {
    title: 'Alben als Regal',
    note:
      'Halte das Gerät quer und blättere durch Plattenhüllen statt durch eine Liste. Tippe auf die vorderste, um sie zu öffnen.',
  },
  heart: { title: 'Herz', note: 'Ein Herz im Player. Es speichert nichts.' },
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
  still: {
    title: 'Weniger Bewegung',
    note:
      'Für Geräte, bei denen Animationen ruckeln. Der Player erscheint, statt hochzugleiten, und das Spiel leuchtet nicht mehr auf, wenn ein Leben gewonnen oder verloren wird. Die Tasten selbst fallen weiter – das ist das Spiel, keine Dekoration.',
  },
  moreButton: {
    title: 'Drei Punkte in jeder Zeile',
    note:
      'Sie stehen am Ende jeder Titelzeile und öffnen dasselbe Menü wie langes Drücken. Gedrückthalten funktioniert auch ohne sie.',
  },
  tabs: {
    title: 'Tabs',
    searchNote: 'Entdecken und YouTube-Downloads sind auf diesem Tab und verschwinden mit ihm.',
    aside: 'Bibliothek und Einstellungen sind immer da.',
  },

  views: {
    notes: {
      tracks: 'Jeder Song, einer pro Zeile.',
      albums: 'Alben, zusammengestellt aus den Angaben in den Tags.',
      artists: 'Alle, denen ein Song zugeschrieben ist. Ein Song von zwei Künstlern steht bei beiden.',
      folders: 'Die Ordner, in denen die Dateien liegen, unterhalb des Bibliotheksordners.',
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
      'Dein Hörverlauf, deine Listen, Tags, Songtexte und Einstellungen in einer Datei, deren Speicherort du wählst. Nicht die Musik selbst.',
    failed: 'Das Backup konnte nicht gespeichert werden.',
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
