/**
 * What each theme is called in the picker, by the key its descriptor names.
 * A new theme adds its name here, in every language, and nothing else.
 *
 * The lines ending in `Group` are not themes but the headings the picker puts
 * over them. `effectsNote` is the line under the glass ones' heading: why they cost more
 * than the rest. The two default themes and following the phone come first and
 * go without one.
 */
export const themes = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',

  pastel: 'Sweet pastel',
  sepia: 'Sepia',
  ice: 'Ice',
  mint: 'Mint',
  lavender: 'Lavender',
  peach: 'Peach',

  black: 'Pure black',
  midnight: 'Midnight blue',
  forest: 'Forest',
  sunset: 'Sunset',
  dusk: 'Dark pastel',
  plum: 'Plum',

  contrast: 'High contrast',
  cover: 'From the cover',
  material: 'System colours',
  custom: 'Custom',

  glass: 'Night glass',
  frost: 'Frosted glass',
  aero: 'Aero',
  aurora: 'Cover glass',
  auroraLight: 'Cover glass, light',
  sundown: 'Sundown glass',

  lightGroup: 'Light',
  darkGroup: 'Dark',
  effectsGroup: 'Glass and gloss',
  effectsNote: 'Live blur: more work than the flat themes.',
  specialGroup: 'Special',
};
