import { format, NNBSP } from './format.ts';
import { oneOrMany } from '../write.ts';
import type { Strings } from '../en/index.ts';

export const search: Strings['search'] = {
  modes: {
    discover: 'Entdecken',
    download: 'Download',
    videos: 'Videos',
    playlists: 'Playlists',
  },

  tapes: {
    intro:
      'Hörbücher, Podcasts, Vorträge und lange Aufnahmen von YouTube, geladen in den Ordner Tapes deiner Bibliothek und dort fortgesetzt, wo du aufgehört hast. Suche oder füge einen Link zu einem Video oder einer Playlist ein – oder zu einem Kanal, um ihm zu folgen.',
    placeholder: { videos: 'Titel, Sendung oder YouTube-Link', playlist: 'Buch, Reihe oder Playlist-Link' },
    empty: { videos: 'Suche nach einem Buch, einer Sendung, einem Vortrag oder einer Vorlesung.', playlist: 'Suche eine Playlist, die als eine Kassette geladen wird: ein Buch in Teilen oder eine Staffel einer Sendung.' },
    download: 'Als Kassette laden',
    downloadBook: (count) => `Alle ${format.number(count)} als eine Kassette laden`,
    bookHint: 'Sie kommen in einen Ordner mit dem Namen der Liste, in ihrer Reihenfolge nummeriert, und laufen nacheinander.',
    added: (name) => `Unterwegs nach Tapes/${name}`,
    sources: { youtube: 'YouTube', podcasts: 'Folgen', books: 'Bücher', files: 'Telefon' },
    /** Books from the Internet Archive: see `books/archive.ts`, `BooksPane` and the book screen. */
    /** Files on the phone brought into the Tapes folder: see `FilesPane`. */
    files: {
      intro: 'Bücher, Aufnahmen und Vorträge, die schon auf deinem Telefon sind, werden in einen Ordner deiner Kassetten kopiert. Die gewählten Dateien bleiben, wo sie sind.',
      choose: 'Dateien wählen',
      chooseOther: 'Andere Dateien wählen',
      folder: 'Ordnername',
      folderPlaceholder: 'Wie das Buch oder die Aufnahme heißt',
      folderNote: 'Sie kommen unter diesem Namen in den Kassettenordner deiner Mediathek, in der Reihenfolge ihrer Nummern.',
      copy: (count) => oneOrMany(count, 'Zu Kassetten kopieren', `${format.number(count)} Dateien zu Kassetten kopieren`),
      chosen: (count) => oneOrMany(count, '1 Datei gewählt', `${format.number(count)} Dateien gewählt`),
      copied: (done, of) => done === of ? oneOrMany(done, 'Zu deinen Kassetten kopiert.', `${format.number(done)} Dateien zu deinen Kassetten kopiert.`) : `${format.number(done)} von ${format.number(of)} Dateien kopiert; der Rest war nicht lesbar.`,
      failed: 'Keine der Dateien konnte kopiert werden.',
      pickFailed: 'Die Dateien konnten nicht ausgewählt werden.',
      toTapes: 'Zu den Kassetten',
    },
    books: {
      intro: 'Gemeinfreie Bücher, von LibriVox-Freiwilligen vorgelesen und kostenlos im Internet Archive. Suche nach Titel oder Autor, oder füge die Adresse von etwas Hörbarem auf archive.org ein.',
      placeholder: 'Titel, Autor oder archive.org-Link',
      nothingFound: 'Keine Bücher gefunden.',
      searchFailed: 'Das Internet Archive konnte nicht durchsucht werden.',
      anyLanguage: 'Alle Sprachen',
      popular: 'Am meisten gehört',
      bookFailed: 'Dieses Buch konnte nicht aus dem Internet Archive gelesen werden.',
      stats: (parts, minutes, here) => `${oneOrMany(parts, '1 Teil', `${format.number(parts)} Teile`)} · ${minutes >= 60 ? `${format.number(Math.floor(minutes / 60))} Std. ${format.number(minutes % 60)} Min.` : `${format.number(minutes)} Min.`}${here > 0 ? ` · ${format.number(here)} auf dem Telefon` : ''}`,
      fetchAll: 'Ganzes Buch laden',
      fetchRest: (count) => oneOrMany(count, 'Letzten Teil laden', `Die übrigen ${format.number(count)} Teile laden`),
      size: (mb) => `Insgesamt etwa ${format.number(mb)} MB`,
      parts: (count) => oneOrMany(count, '1 Teil', `${format.number(count)} Teile`),
    },
    podcasts: {
      intro: 'Folge einem Podcast oder YouTube-Kanal, und neue Folgen kommen von selbst zu deinen Kassetten – oder öffne ihn und lade nur die Folgen, die du willst. Suche oder füge die Adresse eines Feeds oder Kanals ein.',
      /** Under the button on a show not followed: that its episodes can be had without following it. */
      withoutFollowing: 'Zum Hören musst du nicht folgen: Lade unten jede Folge. Wenn du folgst, kommen neue von selbst.',
      /** Where podcasts can be had from: said under the intro. */
      /** The title of a followed or followable show's own screen, a podcast or a YouTube channel. */
      showTitle: 'Sendung',
      sources: 'Woher: jede Sendung in Apples Podcast-Verzeichnis, das fast jeden Podcast mit öffentlichem Feed kennt, auch die meisten von Spotify; jede Feed-Adresse, ob von Anchor, Buzzsprout, Libsyn, Podbean, SoundCloud oder anderen; und YouTube-Kanäle.',
      placeholder: 'Podcast- oder Kanalname, oder ein Link',
      searchFailed: 'Die Podcast-Suche hat nicht geklappt. Prüfe deine Verbindung.',
      feedFailed: 'Der Feed dieses Podcasts konnte nicht gelesen werden.',
      notChannel: 'Das ist keine Adresse eines YouTube-Kanals, oder der Kanal wurde nicht gefunden.',
      channelsHeading: 'YouTube-Kanäle',
      podcastsHeading: 'Podcasts',
      subscribers: (count) => oneOrMany(count, '1 Abonnent', `${format.number(count)} Abonnenten`),
      channelsFailed: 'Auf YouTube konnte nicht nach Kanälen gesucht werden.',
      nothingFound: 'Keine Podcasts gefunden.',
      yours: 'Deine Podcasts',
      noneYet: 'Du folgst noch keinem Podcast.',
      wifiOnly: 'Neue Folgen nur im WLAN',
      wifiOnlyNote: 'Folgen der Podcasts, denen du folgst, werden nur im WLAN von selbst geladen. Jede Folge kannst du trotzdem von Hand laden.',
      follow: 'Folgen',
      following: 'Gefolgt',
      unfollow: 'Nicht mehr folgen',
      autoDownload: 'Neueste Folgen laden',
      autoDownloadNote: (keep) => oneOrMany(keep, 'Die neueste Folge bleibt geladen.', `Die neuesten ${format.number(keep)} Folgen bleiben geladen.`),
      keep: (count) => format.number(count),
      episodes: (count) => `Folgen · ${format.number(count)}`,
      noEpisodes: 'Dieser Feed hat keine Folgen mit einer Datei.',
      download: 'Laden',
      continue: 'Weiter',
      start: 'Starten',
      more: 'Mehr',
      less: 'Weniger',
      stats: (total, here) => `${format.number(total)} ${oneOrMany(total, 'Folge', 'Folgen')} · ${format.number(here)} auf dem Handy`,
      play: 'Abspielen',
      /** The episodes shown by when they came out: see `podcasts/when.ts`. */
      when: { label: 'Zeitraum', all: 'Alle', week: 'Letzte Woche', month: 'Letzter Monat', quarter: 'Letzte 3 Monate' },
      newest: 'Neueste zuerst',
      oldest: 'Älteste zuerst',
      noneThen: 'Keine Folgen aus dieser Zeit.',
      fetchNext: 'Nächste Folgen laden',
      fetchNextNote: (count) =>
        oneOrMany(count, 'Während du eine ältere Folge hörst, wird die nächste geladen, damit sie bereit ist, wenn diese endet.', `Während du eine ältere Folge hörst, werden die nächsten ${format.number(count)} geladen, damit jeweils die nächste bereit ist.`),
      line: (date, length) => [date, length].filter(Boolean).join(' · '),
    },
  },
  unavailable: {
    heading: 'YouTube braucht eine neue App-Version',
    body: 'Installiere die aktualisierte Android-Version, um Musik zu suchen und herunterzuladen. Deine Bibliothek ist weiterhin verfügbar.',
    downloads: 'Installiere eine neue Android-Version, um YouTube-Downloads zu aktivieren.',
  },

  intro: {
    videos: 'Durchsuche YouTube oder füge einen Videolink ein. Speichere den Ton in deiner Bibliothek.',
    playlist:
      'Suche nach einer Playlist oder füge ihren YouTube-Link ein. Öffne ein Ergebnis, um seine Titel anzusehen und herunterzuladen. Die ersten 500 Einträge der Playlist werden geprüft.',
  },
  inputLabel: {
    videos: 'YouTube durchsuchen oder Videolink einfügen',
    playlist: 'Playlist-Name oder YouTube-Link',
  },
  placeholder: {
    videos: 'Song, Künstler oder YouTube-Link',
    playlist: 'Playlist-Name oder YouTube-Link',
  },

  formats: { mp3: 'MP3', original: 'Original-Audio' },
  formatHint: {
    mp3: 'Wird nach dem Download in MP3 umgewandelt.',
    original: 'Behält nach Möglichkeit den Audiocodec der Quelle.',
  },

  searching: 'YouTube wird durchsucht…',
  results: (count) => `Ergebnisse · ${format.number(count)}`,
  empty: {
    none: 'Keine Ergebnisse. Versuch es mit einer anderen Suche oder einem anderen Link.',
    videos: 'Suche nach Song und Künstler, um die gewünschte Aufnahme zu finden.',
    playlist: 'Suche nach dem Namen einer Playlist oder füge einen Playlist-Link ein.',
  },

  playlist: 'Playlist',
  openPlaylist: 'Playlist öffnen',
  backToResults: 'Zurück zu den Ergebnissen',
  openPlaylistLabel: (title) => `Playlist ${title} öffnen`,
  downloadLabel: (title) => `${title} herunterladen`,
  download: { mp3: 'MP3 laden', original: 'Audio laden' },
  adding: 'Wird hinzugefügt…',

  addingPlaylist: 'Playlist wird hinzugefügt…',
  downloadListed: {
    mp3: 'Angezeigte Titel laden · MP3',
    original: 'Angezeigte Titel laden · Original-Audio',
  },
  listedHint:
    'Bereits heruntergeladene oder eingereihte Titel werden übersprungen. Private, gelöschte und Live-Videos sind möglicherweise nicht verfügbar.',
  listCreated: (name) => `Liste erstellt: ${name}. Heruntergeladene Titel erscheinen unter Listen.`,
  inLibrary: 'In deiner Bibliothek',
  alreadyHave: (count) =>
    oneOrMany(count, '1 Song war schon in deiner Bibliothek und wurde nicht erneut heruntergeladen.', `${format.number(count)} Songs waren schon in deiner Bibliothek und wurden nicht erneut heruntergeladen.`),
  unnamedPlaylist: 'YouTube-Playlist',

  jobLine: (status, mp3) => `${status} · ${mp3 ? 'MP3' : 'Original'}`,

  status: {
    finding: 'Wird auf YouTube gesucht',
    queued: 'Eingereiht',
    preparing: 'Wird vorbereitet…',
    downloading: (percent) => `Wird geladen · ${percent}${NNBSP}%`,
    converting: 'Audio wird umgewandelt…',
    saving: 'Wird zur Bibliothek hinzugefügt…',
    cancelling: 'Wird abgebrochen…',
    cancelled: 'Abgebrochen',
    failed: 'Download fehlgeschlagen',
    done: 'In der Bibliothek',
    missing: 'Datei entfernt',
  },

  failed: {
    search: 'Suche fehlgeschlagen. Bitte versuch es erneut.',
    queue: 'Download konnte nicht eingereiht werden.',
    queuePlaylist: 'Playlist konnte nicht eingereiht werden.',
    cancel: 'Download konnte nicht abgebrochen werden.',
    read: 'Downloads konnten nicht gelesen werden.',
    readReopen: 'Downloads konnten nicht gelesen werden. Bitte öffne die Suche erneut.',
  },

  errors: {
    playlistLink: 'Füge einen YouTube-Playlist-Link ein oder suche nach dem Namen der Playlist.',
    videoLink: 'Gib einen Songnamen oder einen gültigen YouTube-Videolink ein.',
    queueFull: 'Die Download-Warteschlange ist voll. Warte, bis einige Titel fertig sind, und versuch es dann erneut.',
    update: 'YouTube hat sich geändert, und der Downloader dieser Version kann es noch nicht lesen. Suche unter Downloads nach einem neueren oder aktualisiere Jukebox.',
    unavailable: 'Dieses Video oder diese Playlist ist nicht verfügbar. Versuch es mit einer anderen öffentlichen Playlist oder einer anderen Suche.',
    unreachable: 'YouTube ist nicht erreichbar. Prüfe deine Verbindung und versuch es erneut.',
    refused: 'YouTube konnte diese Anfrage nicht ausführen. Versuch es später erneut oder wähle ein anderes Ergebnis.',
  },
};
