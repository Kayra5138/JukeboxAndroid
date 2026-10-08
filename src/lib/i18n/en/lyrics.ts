/** The lyrics, and their translation. */
export const lyrics = {
  none: 'No lyrics found.',
  translating: 'Translating…',
  /** [seconds] is where in the song, already written out: `83.5`. */
  seekTo: (seconds: string) => `Seek to ${seconds} seconds`,

  /** Why there is no translation, when that is worth saying; see `useTranslation`. */
  translation: {
    romaji:
      'These are Japanese words in Latin letters, and no entry in the original writing was found to translate instead.',
    unsupported: 'No translation for this language.',
    unavailable: 'Translation is not available on this device.',
    misaligned: 'The translation did not line up.',
    failed: 'Translation failed.',
  },
};
