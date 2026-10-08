import { contrast, inkOn, mix, readableOn } from './colour.ts';
import type { Palette } from './tokens.ts';

/**
 * A palette made to keep the promises screens rely on, whatever it was made
 * from.
 *
 * A theme that is written down is checked by the test beside the registry,
 * once, before anybody sees it. One that is worked out from the phone's
 * wallpaper cannot be: the colours arrive when the app is running and nobody
 * chose them with this app in mind. So the same rules the test holds a
 * written theme to are applied here as corrections — every level of text
 * meant to be read clears `ratio` on everything it is written on, the fills
 * can be written on, and each level of text is no louder than the one before.
 *
 * Only lightness is moved, and only as far as it must be, so a palette that
 * already passes comes back as it went in and one that does not still looks
 * like the wallpaper it came from.
 *
 * [base] says which way up the palette is meant to be. It cannot be told
 * from the palette, since a palette in need of this may be the one whose
 * page and text came out the same grey.
 */
export function repaired(palette: Palette, base: 'light' | 'dark', ratio = 4.5): Palette {
  const c = { ...palette };

  /*
    The grounds first, because no text can be mended on a ground that nothing
    can be read on. Each has to leave room for the levels of text to step
    down in and all still clear the ratio, so it is held half as far again
    from the far end of the scale — white, for a dark theme — as the ratio
    asks of text. The darkest surface of the default dark theme clears that
    several times over; this is for a ramp whose "darkest" is a mid grey.
  */
  const farEnd = base === 'dark' ? '#ffffff' : '#000000';
  for (const ground of ['bg', 'bar', 'surface', 'surfaceRaised', 'accentSoft', 'dangerSoft', 'successSoft'] as const) {
    c[ground] = readableOn(c[ground], [farEnd], ratio * 1.5);
  }

  const grounds = [c.bg, c.bar, c.surface];
  const withChip = [...grounds, c.surfaceRaised];

  c.text = readableOn(c.text, withChip, ratio);
  c.textSecondary = readableOn(c.textSecondary, withChip, ratio);
  c.textMuted = readableOn(c.textMuted, grounds, ratio);
  c.textFaint = readableOn(c.textFaint, grounds, ratio);

  /*
    Quieter down the list, still. Lifting a faint level to where it can be
    read may carry it past the one above, and a caption louder than its title
    is a worse fault than two levels that look alike; so a level that has
    overtaken its neighbour becomes its neighbour.
  */
  const loudness = (colour: string) => contrast(colour, c.bg);
  if (loudness(c.textSecondary) > loudness(c.text)) c.textSecondary = c.text;
  if (loudness(c.textMuted) > loudness(c.textSecondary)) c.textMuted = c.textSecondary;
  if (loudness(c.textFaint) > loudness(c.textMuted)) c.textFaint = c.textMuted;
  if (loudness(c.textDisabled) > loudness(c.textFaint)) c.textDisabled = c.textFaint;

  c.accent = readableOn(c.accent, withChip, ratio);
  c.warning = readableOn(c.warning, grounds, ratio);
  c.danger = readableOn(c.danger, [...grounds, c.dangerSoft], ratio);
  c.success = readableOn(c.success, [...grounds, c.successSoft], ratio);

  /*
    The fill of the button that matters is as far from the page as text is,
    in every theme written down, and it is what lets the page's own colour be
    written on it. A fill that had drifted to the middle could be written on
    in nothing.
  */
  c.primary = readableOn(c.primary, withChip, ratio);

  // Whichever end of the palette can be read on the fill, when the one given cannot.
  if (contrast(c.onPrimary, c.primary) < ratio) c.onPrimary = inkOn(c.primary, c.bg, c.text);
  if (contrast(c.onAccent, c.accent) < ratio) c.onAccent = inkOn(c.accent, c.bg, c.text);

  // A wash too strong to write on is thinned towards the page until it is not.
  for (let step = 0; step < 10 && contrast(c.text, c.accentSoft) < ratio; step++) {
    c.accentSoft = mix(c.accentSoft, c.bg, 0.3);
  }

  return c;
}
