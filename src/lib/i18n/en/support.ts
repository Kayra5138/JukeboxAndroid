/**
 * What the app says about reporting a problem and about newer versions of
 * itself: the report screen, the row that opens it, and the quiet word that
 * a new release is out. See `lib/support/`.
 *
 * Both are about the app itself rather than the music, and both say plainly
 * what does and does not leave the phone, which is the point of each.
 */
export const support = {
  /** Reporting a problem: see `app/report.tsx`. */
  report: {
    /** Settings tab, a row of its own above "First start": the title on one line, the note in two or three. */
    row: {
      title: 'Report a problem',
      note: 'Opens a GitHub issue with the details filled in. Nothing is sent until you send it.',
    },
    /** The screen's title, in the bar at the top. Short. */
    title: 'Report a problem',
    /** First on the screen, a paragraph. */
    intro:
      'Nothing leaves your phone from this screen. “Open GitHub” starts a new issue with the text below already filled in; you can read and change it there, and it is only sent if you send it.',
    /** Heading over the box of details, raised to capitals. A few words. */
    details: 'What goes into the issue',
    /** Under the box of details, one or two lines. */
    detailsNote: 'The version and the phone go into their own boxes on the form, and the rest into the last one. Your songs are never named.',
    /** The switch over the list of recent errors: a title on one line, its note in two or three. */
    errors: {
      title: 'Include recent errors',
      note:
        'Problems Jukebox noticed by itself, such as a download or a search that failed. Song names, addresses and file paths were taken out before they were kept.',
      /** In place of the list when it is empty. */
      none: 'No errors have been noted.',
      /** Under the list when some had to be left out of the link; Copy still has them all. */
      trimmed: 'The oldest errors are left out of the link to keep it short enough to open. Copy includes them all.',
    },
    /** The main button. Short: it shares a row with "Copy" when there is room. */
    open: 'Open GitHub',
    /** For a screen reader: what pressing it does. */
    openHint: 'Opens a new issue in your browser, filled in and not yet sent',
    /** The second button. One short word. */
    copy: 'Copy',
    /** Under the two buttons, one or two lines. */
    copyNote: 'No GitHub account? Copy puts the same text on the clipboard, to paste into an issue or a message.',
    /** Under the buttons for a moment after Copy. */
    copied: 'Copied',
    /** Under the buttons when no app could open the link. */
    openFailed: 'The link could not be opened. Copy the text and paste it into an issue instead.',
    /** Under the buttons on a build of the app that cannot use the clipboard. */
    copyFailed: 'This version of the app cannot use the clipboard. Select the text above and copy it by hand.',
  },

  /** A newer version of Jukebox: see `lib/support/update.ts`. */
  update: {
    /** Settings tab, a row under the version line: the title on one line, with the version in it. */
    available: (version: string) => `Jukebox ${version} is available`,
    /** Under that title, two or three lines. */
    note: 'If you installed with Obtainium, it will offer the update there. Otherwise, tap to open the release page and download it.',
    /** For a screen reader: what pressing the row does. */
    hint: 'Opens the release page in your browser',
    /** For a screen reader, on the Settings tab in the bar while the dot is on it: the tab's name, then the news. */
    tab: (settings: string) => `${settings}, an update is available`,
    /** Settings → Your data, under its own heading. */
    heading: 'Updates',
    /** The switch: a title on one line, its note in three or four. */
    check: {
      title: 'Look for a newer Jukebox',
      note: 'At most once a day, when you open the app, Jukebox asks GitHub which version is the latest. Nothing about you or your library is sent, and nothing is downloaded.',
    },
  },
};
