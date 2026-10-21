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
