import { format } from './format.ts';

/**
 * What the app says to somebody who has just installed it: the first start's
 * setup, which somebody updating is shown the newer screens of, the
 * library's one offer to look its files up, and the few tips.
 *
 * Kept together and apart from the screens they appear on, so that the whole
 * of the welcome can be read, and translated, in one place.
 */
export const welcome = {
  /** The first screen of the first start, over everything: see `ui/welcome.ts`. Shown in the language being picked. */
  language: {
    heading: 'Choose your language',
    /** Under the heading: that the choice is not for good. */
    note: 'It can be changed at any time under Settings.',
    go: 'Continue',
    /** Under the list, and under the language sheet in Settings: who made the translations. */
    made:
      'Jukebox is made by one person. Apart from English, its languages were translated by AI and have not yet been checked by anyone who speaks them. If something reads wrong, please say so on GitHub.',
  },

  /**
   * The rest of the first start, after the language: how the app looks,
   * Discover, and what plays when the queue runs out. See `ui/welcome.ts`.
   */
  setup: {
    /** Over the heading: how far along the setup is. */
    step: (at: number, of: number) =>
      `Step ${format.number(at)} of ${format.number(of)}`,
    /** At the top: puts the setup away, leaving whatever has not been chosen as it is. */
    skip: 'Skip',
    /** For a screen reader: what skipping does. */
    skipHint: 'Leaves the rest as it is and opens Jukebox',
    back: 'Back',
    next: 'Continue',
    /** On the last screen's button. */
    done: 'Done',
    /** Over the first screen somebody updating sees: they chose a language long ago. */
    update:
      'A few settings, new in this version. You can change them any time in Settings.',
    look: {
      heading: 'Choose a look',
      note: 'Tap one to try it.',
      /** Under the few themes offered here. */
      more:
        'More themes, and which two to use when following the phone, are in Settings → Look.',
    },
    discover: {
      heading: 'Discover',
      /** What Discover is, in a sentence, for somebody who has not opened it. */
      note:
        'Discover finds songs you do not have yet, by the artists in your library and others like them, and downloads them from YouTube as you play them.',
      /** Under the few of its settings asked here. */
      more:
        'How long the list is, how often it is made anew and more are in Discover settings.',
    },
  },

  /** The card over the library on its first start with music in it. See `metadata/offer.ts`. */
  offer: {
    heading: 'Find covers and details?',
    body: (count: number) =>
      `${format.number(count)} of your songs have not been looked up yet. Jukebox can find their covers, artists and albums in MusicBrainz and Apple’s iTunes catalogue.`,
    privacy:
      'Only the names of the songs are sent to those two, and nothing else. It runs in the background while you listen, and can be done later from Settings → Library → Tags.',
    accept: 'Find them',
    decline: 'Not now',
  },

  /** One line under the library's own while the lookup runs, whoever began it. */
  progress: {
    starting: 'Finding covers and details…',
    counting: (done: number, total: number) =>
      `Finding covers and details · ${format.number(done)} of ${format.number(total)}`,
    /** The same, while one album is being looked up as a whole. */
    album: (album: string, done: number, total: number) =>
      `Looking up “${album}” · ${format.number(done)} of ${format.number(total)}`,
    /** The same, while covers alone are being looked for. */
    covers: (done: number, total: number) =>
      `Finding covers · ${format.number(done)} of ${format.number(total)}`,
    /** The same, while lyrics are being looked for. */
    lyrics: (done: number, total: number) =>
      `Finding lyrics · ${format.number(done)} of ${format.number(total)}`,
    /** For a screen reader: what pressing the line does. */
    hint: 'Opens the Tags screen, where the lookup can be followed and stopped',
  },

  /** The tips, each shown once, on the screen it is about. See `ui/tips.ts`. */
  tips: {
    library:
      'Hold a song for its menu: add it to a list, edit its details, or play it as piano tiles. Pull a song right to play it next, or left to add it to the queue.',
    player:
      'Under the controls, the lyrics button shows the words as the song plays, and once they are up the button that appears beside it translates them. The gear holds speed and pitch, effects and the sleep timer.',
    discover:
      'Discover finds songs you do not have yet. Until you have listened for a while it starts from the artists you have the most songs by, and it learns from what you play.',
    /** The one button on a tip. */
    dismiss: 'Got it',
    dismissHint: 'Puts this tip away for good',
  },

  /** Last on the Settings tab: the first start again, its setup, offer and tips. */
  settings: {
    title: 'First start',
    note:
      'Shows Jukebox as it was on the day it was installed: the first settings, the offer to find covers, and the tips. Your music, lists and settings are left as they are.',
    again: 'Show again',
  },

  /** Under what Discover is, on its sheet: why a new install gets a list at all. */
  discoverEarly:
    'With little played yet, Discover starts from the artists you have the most songs by, and learns from what you play.',
};
