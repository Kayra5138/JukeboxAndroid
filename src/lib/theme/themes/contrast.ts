import type { Theme } from '../tokens.ts';

/**
 * High contrast: for being able to read it, and for nothing else.
 *
 * Not a look. The other themes each spend some legibility on a mood; this
 * one has no mood to spend it on. So:
 *
 * There is no faint text. The levels of text still step down, because
 * screens lean on a caption being quieter than its title, but the quietest
 * one meant to be read is 8:1 or better on anything it is written on, where
 * the others stop at 4.5:1; the test holds everything here to 7:1, WCAG's
 * AAA. Even what is "not for reading" — a placeholder, a switched-off row —
 * clears the ordinary 4.5:1, since somebody who needs this theme still needs
 * to know what a field is for.
 *
 * Lines can be seen. In every other theme a hairline is a hint a shade from
 * what it lies on; here it is a mid grey at 4:1 or better against any
 * surface, and so is the stronger line. That is how one thing is told from
 * the next: by its edge. The stronger line is not white, as it once was, nor
 * even the lighter of the two, because it is also what a bar is drawn in
 * before it is filled — how far a song has got, how much of a download has
 * come, the rail of a slider — and the fill is the colour of words or the
 * accent. White on white was a bar that never moved. So it is the one grey
 * that is 3:1 from the black under it and from both of the things laid on it.
 *
 * So a card is the page with a line round it. Everything that is a surface —
 * a card, a sheet, a field — is as black as the page, which leaves the whole
 * of white-on-black for what is written on it, and `outline` is where it
 * ends. The one grey left is `surfaceRaised`: a chip is outlined like the
 * rest, but an empty cover or a row lifted to be dragged draws no edge, and
 * would be a hole in the screen with no fill of its own.
 *
 * What is chosen is filled with the accent and written on in black. A
 * selected segment that was a slightly lighter grey than its neighbours was
 * a thing to look for; a yellow one among black ones is not. Where a chip is
 * on in the held-back accent instead, that is dark enough to write on in
 * white at 7:1, and the screen rings it in the accent itself.
 *
 * A finger on something shows. The wash laid over what is pressed is a grey
 * and not a white, and strong: 3:1 against the black it is mostly laid on,
 * and still a darkening that can be seen on a button filled white or yellow,
 * where a white wash would be nothing at all.
 *
 * Good, bad and doubtful differ in how light they are as well as in hue:
 * green the lightest, then amber, then red, so that somebody to whom red and
 * green are one colour still has something to go on. It is not much. The
 * tokens are only colours, and a mark or a word beside the colour is the
 * real answer; that is for the screens to give.
 *
 * The accent is yellow because yellow on black is the most a colour can
 * contrast and still be a colour.
 */
export const contrast: Theme = {
  id: 'contrast',
  nameKey: 'contrast',
  group: 'special',
  base: 'dark',
  colours: {
    bg: '#000000',
    bar: '#000000',
    surface: '#000000',
    surfaceRaised: '#2e2e2e',
    border: '#8c8c8c',
    borderStrong: '#787878',

    text: '#ffffff',
    textSecondary: '#f0f0f0',
    textMuted: '#e0e0e0',
    textFaint: '#d0d0d0',
    textDisabled: '#a8a8a8',

    primary: '#ffffff',
    onPrimary: '#000000',

    accent: '#ffd400',
    onAccent: '#000000',
    accentMuted: '#665500',
    accentSoft: '#332a00',

    danger: '#ffa8a1',
    dangerSoft: '#3d0000',
    success: '#7dff9b',
    successSoft: '#003314',
    warning: '#ffc76b',

    scrim: '#000000e6',
    pressed: '#808080b8',

    switchTrack: '#636363',
    switchThumb: '#ffffff',

    selected: '#ffd400',
    onSelected: '#000000',

    outline: '#bdbdbd',
  },
};
