/** The tiles game. */
export const tiles = {
  /**
   * The difficulties, by the id each is stored under. The ids are what is
   * kept between one game and the next and are never translated.
   */
  speeds: { easy: 'Easy', normal: 'Normal', hard: 'Hard', harder: 'Harder' },

  setup: {
    title: 'Play along',
    noTrack: 'Start a track and the keys are built from it.',
    making: 'Listening to the record…',
    missing: 'This one cannot be read.',
    /** What is about to be played and how much of it there is; no title is `This record`. */
    record: (title: string | null, keys: number) => `${title ?? 'This record'} — ${keys} keys`,
    latency:
      'Sound reaches a wireless headphone late. If the keys feel behind the music, move this until they agree.',
    earlier: '−20 ms',
    later: '+20 ms',
    offset: (ms: number) => `${ms} ms`,
    start: 'Play from the top',
    starting: 'Starting…',
  },

  pause: {
    title: 'Paused',
    resume: 'Continue',
    toMenu: 'Back to the menu',
  },

  ending: {
    clean: 'Clean run',
    won: 'You made it',
    over: 'Run over',
    lapse: 'A key got past you.',
    empty: 'That tap landed on nothing.',
    toTheEnd: 'All the way to the end of the record.',
    /** The line of figures under the score. [held] is left out when there were none. */
    figures: (hit: number, total: number, held: number, best: number, percent: number) =>
      `${hit} of ${total} keys${held > 0 ? ` · ${held} held` : ''} · best run of ${best} · ${percent}%`,
    again: 'Again',
  },
};
