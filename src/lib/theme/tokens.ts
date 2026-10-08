import type { CustomSeeds } from './custom.ts';
import type { Strings } from '../i18n/languages.ts';

/**
 * What a theme has to answer: the colours, by what they are for.
 *
 * Named for the job and never for the shade, because the shade is the thing
 * that differs. A screen asks for "the page" and "words that matter less" and
 * gets whatever the theme in use calls those; it never asks whether the theme
 * is a dark one, and nothing about it has to change when a third is added.
 *
 * Getting lighter is getting nearer in every theme so far — the page furthest
 * back, a card on it, a chip on the card — which is the one rule about how
 * these relate that a new theme should keep, since screens lean on it.
 */
export type Palette = {
  /** The page: what a screen is drawn on. Also a field set into a sheet. */
  bg: string;
  /** The tab bar and anything else that is the app's frame rather than its content. */
  bar: string;
  /** A card, a sheet, a dialog, a text field, the now-playing bar: one step up from the page. */
  surface: string;
  /** Something sitting on a surface or the bar: a chip, a quiet button, the mark of the open tab, an empty cover. */
  surfaceRaised: string;
  /** Hairlines: the rule between rows, the edge of a bar. */
  border: string;
  /** A line or small shape that has to be seen: a grabber, a tick on a scale, a slider's track. */
  borderStrong: string;

  /** Words that are the point: titles, names, what was typed. Icons by default. */
  text: string;
  /** Words beside the point but meant to be read: a second button's label, a value. */
  textSecondary: string;
  /** The line under a title: an artist, an explanation, a status. */
  textMuted: string;
  /** Quieter still: a section heading, an aside under a card, a duration. The last level meant to be read. */
  textFaint: string;
  /** Not for reading: a placeholder, a chevron, something switched off, the outline of an empty checkbox. */
  textDisabled: string;

  /** The fill of the one button that matters, and of the chosen one among alternatives. */
  primary: string;
  /** What is written on `primary`. */
  onPrimary: string;

  /** The app's one colour: what is playing, what is on, what is selected. Readable as text on any background above. */
  accent: string;
  /** What is written or ticked on an `accent` fill. */
  onAccent: string;
  /** The accent held back, as a fill: the track of a switch that is on. */
  accentMuted: string;
  /** The accent as a wash behind content that keeps its own colours: a selected row. */
  accentSoft: string;

  /** Something went wrong, or will destroy something. As text. */
  danger: string;
  /** The wash behind a warning that `danger` is written on. */
  dangerSoft: string;
  /** It worked. As text. */
  success: string;
  /** The wash behind good news. */
  successSoft: string;
  /** Worth a second look, without being wrong. As text. */
  warning: string;

  /** What is drawn over the screen behind a dialog. */
  scrim: string;
  /** Laid over anything while a finger is on it; mostly transparent. */
  pressed: string;

  /** The track and the thumb of a switch that is off. On, they are `accentMuted` and `accent`. */
  switchTrack: string;
  switchThumb: string;

  /**
   * The chosen one of a few set side by side, where being chosen is a fill a
   * step up from the rest: a segment of a segmented control, the mark of the
   * open tab. In a theme that is a look it is `surfaceRaised`, which is what
   * these were before they had a name of their own; a theme may make it as
   * loud as it likes, since what is written on it is asked for too.
   */
  selected: string;
  /** What is written or drawn on `selected`. `text`, where `selected` is quiet. */
  onSelected: string;

  /**
   * The edge of something that is otherwise told from what it lies on by its
   * fill alone: a card, a sheet, a chip, a field.
   *
   * Nearly every theme tells them apart by the fill and wants no edge, and
   * says so by making this wholly transparent — which `outlined` takes to
   * mean no line at all, of no width, so that nothing is a pixel bigger for
   * it. A theme whose surfaces are the colour of its page draws one here, and
   * it is all that says where a card ends.
   */
  outline: string;
};

/**
 * The phone's own palette, as Android 12 and later make it from the wallpaper.
 *
 * Four of its tonal ramps, each thirteen colours from white to black in the
 * order the system numbers them: 0, 10, 50, 100, 200 and so on to 900, 1000.
 * Written as `#rrggbb` like everything else here, because a colour that
 * cannot be measured cannot be checked for whether it can be read.
 */
export type SystemPalette = {
  accent1: readonly string[];
  accent2: readonly string[];
  neutral1: readonly string[];
  neutral2: readonly string[];
};

/**
 * What a theme that is worked out is worked out from: the things about the
 * moment that a palette can depend on.
 *
 * Gathered in one place and handed to any theme that asks, so that a theme
 * says what it needs and how to turn it into colours and has no idea where it
 * came from. The next thing a theme might follow — the hour, the battery — is
 * a line here and somebody to keep it up to date.
 */
export type Surroundings = {
  /** Whether the phone is in its light mode or its dark one. */
  scheme: 'light' | 'dark';
  /** The colours of the cover of what is playing, dark to light; null with nothing playing or no cover. */
  cover: readonly string[] | null;
  /** Null before Android 12, and on a build from before the app could ask. */
  system: SystemPalette | null;
  /** The colours somebody chose for a theme of their own; null where none have been, and the theme is its default. */
  custom: CustomSeeds | null;
};

/**
 * The parts of the surroundings that have to be fetched, and so are only
 * fetched for a theme that says it wants them. `custom` is not fetched — it
 * is read with the choice of theme, before anything is drawn — but it is
 * asked for the same way, so that only the theme made from it is made again
 * when it changes.
 */
export type Need = 'cover' | 'system' | 'custom';

/**
 * Where a theme is put in the picker. `basic` is the two the app is by
 * default; `effects` is the ones that are more than their colours, whichever
 * way up they are.
 */
export type ThemeGroup = 'basic' | 'light' | 'dark' | 'effects' | 'special';

/** A theme's name: any line of the `themes` section that is not a heading or the word for following the phone. */
export type ThemeNameKey = Exclude<keyof Strings['themes'], 'system' | `${string}Group`>;

/**
 * A theme: a palette, and the little that has to be known about it besides.
 *
 * `base` is for the phone, not for screens. The status bar has to be told
 * whether to draw its clock light or dark, and that is the whole of what it is
 * for; a component that finds itself asking it in order to pick a colour wants
 * a token instead.
 */
export type Theme = {
  /** What is stored when this one is chosen. Never `'system'`. */
  id: string;
  /** Its name in the picker, as a key of the `themes` section of the string tables. */
  nameKey: ThemeNameKey;
  group: ThemeGroup;
  base: 'light' | 'dark';
  colours: Palette;
  /**
   * For a theme whose colours are not all known until the app is running.
   *
   * `base` and `colours` are then what it is until it has been worked out, and
   * what it falls back to when it cannot be. Nothing outside the registry asks
   * whether a theme has this: it is handed the theme already worked out, and
   * that is a palette like any other.
   */
  dynamic?: {
    /** What has to be fetched for it. A theme that only reads `scheme` needs nothing. */
    needs: readonly Need[];
    /**
     * Whether it can be offered at all on this phone. Not being offered is
     * not being broken: chosen anyway, it draws as `resolve` says.
     */
    available?: (around: Surroundings) => boolean;
    /** The colours for these surroundings, and which way up they are. Pure: the same answer for the same question. */
    resolve: (around: Surroundings) => { base: 'light' | 'dark'; colours: Palette };
  };
};
