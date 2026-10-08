import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/** The equalizer, the effects and the crossfade. */
export const sound = {
  /** What the sliders on all three screens read. */
  percent: (value: number) => `${format.number(value)}%`,

  /** The effects screen, and the chips for the same effects in the player; see `player/effects.ts`. */
  effects: {
    failures: {
      unsupported: 'Install the updated Android build to use effects.',
      unreadable: 'Could not read the effects. They are off until this is retried.',
      unsent: 'That setting did not reach the player.',
    },
    title: 'Effects',
    /** The ready-made settings, by their id. */
    presets: {
      off: { name: 'Off', hint: 'The recording as it is' },
      mono: { name: 'Mono', hint: 'Both ears the same — for one earbud' },
      wide: { name: 'Wide', hint: 'The sides pushed out' },
      headphones: { name: 'Headphones', hint: 'Takes hard-panned mixes out of your skull' },
      '8d': { name: '8D', hint: 'The sound turns slowly around you' },
      karaoke: { name: 'Karaoke-ish', hint: 'Pushes the middle away' },
    },
    /** The treatments of the voice, by their id. */
    voices: {
      off: { name: 'Off', hint: 'The record as it is' },
      robot: { name: 'Robot', hint: 'Rung against a low tone — metallic, bell-like' },
      vintage: { name: 'Vintage', hint: 'Fewer bits, a coarser clock, and the top taken off' },
      swirl: { name: 'Swirl', hint: 'A slow sweep, like a jet passing over' },
      chipmunk: { name: 'Chipmunk', hint: 'Up a fifth, and nothing moved in time' },
      squeak: { name: 'More chipmunk', hint: 'A whole octave, past being a voice' },
    },
    ownSettings: 'Your own settings',
    howMuch: 'How much',
    voiceNote:
      'Each of the voices keeps the record’s own harmonics and alters them, so the song stays the song underneath. Turn the amount down to hear more of it as recorded.',

    stereo: 'Stereo',
    width: 'Width',
    mono: 'Mono',
    asRecorded: 'As recorded',
    balance: 'Balance',
    centre: 'Centre',
    /** [percent] is how far over, `35`. */
    left: (percent: number) => `${percent}% left`,
    right: (percent: number) => `${percent}% right`,
    swap: { title: 'Swap channels', note: 'Left becomes right. For a miswired cable.' },

    headphones: 'Headphones',
    crossfeed: 'Crossfeed',
    crossfeedNote:
      'A little of each channel reaches the far ear, late and dull, the way it would from speakers. It takes the strain out of old hard-panned mixes. On speakers it does nothing worth having.',

    rotation: 'Rotation',
    depth: 'Depth',
    turnTakes: 'A turn takes',
    seconds: (count: number) => `${count}s`,
    rotationNote:
      'What people call 8D: the sound turns slowly around you. Meant for headphones — on a speaker it is just the volume wandering.',

    level: 'Level',
    preamp: 'Preamp',
    /** [value] is in decibels and may be negative. */
    decibels: (value: number) => `${value > 0 ? '+' : ''}${format.decimal(value, 1)} dB`,
    levelNote:
      'Turn this down if widening or the equalizer makes anything crackle: that is the sound of the loudest peaks running out of room.',
  },

  /** The crossfade screen. */
  transitions: {
    missing: 'This build of the app does not have transitions in it yet.',
    title: 'Crossfade',
    about: 'One track keeps playing while the next one starts, so there is no join to hear.',
    betweenTracks: 'Between tracks',
    overlap: 'Overlap',
    overlapNote:
      'How much of the outgoing track the next one plays over. Zero leaves tracks to end the ordinary way.',
    albums: {
      title: 'Keep albums together',
      note:
        'No crossfade between consecutive tracks of one album. A live record or anything mixed to run on is meant to have that join.',
    },
    /** The three other durations, by the setting each one is. */
    others: {
      manualMs: {
        label: 'Skipping',
        hint:
          'Next or previous, pressed. Keep it short — a button that answers late stops feeling connected.',
      },
      pauseMs: {
        label: 'Pause and resume',
        hint: 'Takes the edge off stopping, and off starting again.',
      },
      seekMs: {
        label: 'Seeking',
        hint: 'After dragging the progress bar, which otherwise lands mid-waveform and clicks.',
      },
    },
    equalPower: {
      title: 'Equal power curve',
      note:
        'Two tracks at half volume are not half as loud together. This curve holds the level across an overlap; the straight one sags in the middle.',
    },
    fewer: 'Fewer settings',
    more: 'Other transitions',
    reset: 'Reset to defaults',
    /** [written] is the figure, already in the language's own decimals: `2.5`. */
    seconds: (written: string) => `${written}s`,
  },

  /** The equalizer screen. */
  equalizer: {
    missing: 'This build of the app does not have the equalizer in it yet.',
    title: 'Equalizer',
    attached: 'Shaping what is playing now.',
    saved: 'Saved, and applied the moment something plays.',
    carried:
      "What was set on the phone's own equalizer has been brought across, and is kept under Presets as “Phone equalizer”. It is the same shape made from this equalizer's bands, and it now leaves itself room for what it boosts, so it may be a little quieter than it was.",
    lost:
      "What was set on the phone's own equalizer could not be brought across: its bands could not be matched to frequencies. This one starts flat.",

    presets: 'Presets',
    saveAs: 'Save as…',
    rename: 'Rename…',
    confirmDelete: (name: string) => `Delete “${name}”?`,
    importAutoEq: 'Import AutoEQ…',
    keptAs: (name: string) => `Kept as “${name}”.`,
    renamedTo: (name: string) => `Renamed to “${name}”.`,

    bands: 'Bands',
    noBands:
      'No bands, which is flat: the music as it was recorded. Add one, choose a preset, or import a correction for your headphones.',
    addBand: 'Add a band',
    full: (most: number) => `${most} bands is all there is room for.`,

    preamp: 'Preamp',
    automatic: 'Automatic',
    byHand: 'Set by hand',
    nothingBoosted: 'Nothing is boosted, so nothing is turned down to make room.',
    /** [by] is a level without its sign, `3.5 dB`. */
    turnedDown: (by: string) =>
      `Everything is turned down ${by}, which is as much as the curve's highest point turns anything up. That is the room a boost needs not to clip.`,
    typeIt: (now: string) => `Type it · ${now}`,
    typePreamp: (now: string) => `Type the preamp, now ${now}`,
    clipsAbove: (level: string) =>
      `Above ${level} the loudest passages can clip, which is heard as them breaking up.`,
    lowEnough: 'Low enough that nothing this curve boosts will clip.',

    unbuilt:
      "This build of the app still plays through the phone's own equalizer, which this screen no longer sets. The bands arrive with the next build; the controls below work as they did.",

    tone: 'Tone',
    bassBoost: 'Bass boost',
    surround: 'Surround',
    loudness: 'Loudness',
    toneNote:
      "These three are the phone's own effects, applied after the bands. Loudness lifts a quiet recording without touching the tone. Pushed far it will clip, which is heard as the loud parts breaking up.",
    resetAll: 'Reset everything',

    /** What the one prompt on the screen asks, for whichever thing it is asking. */
    prompt: {
      keepCurveAs: 'Keep this curve as',
      keepCorrectionAs: 'Keep this correction as',
      namePlaceholder: 'A name, such as the headphones it is for',
      keep: 'Keep',
      aName: 'A name',
      set: 'Set',
      preampHint: (least: number, most: number) => `In decibels, from ${least} to ${most}.`,
      frequency: (band: number) => `Band ${band} frequency`,
      frequencyHint: (least: number, most: number) =>
        `In hertz, from ${least} to ${most}. 1.2k is taken for 1200.`,
      gain: (band: number) => `Band ${band} gain`,
      gainHint: (most: number) => `In decibels, from -${most} to ${most}.`,
      q: (band: number) => `Band ${band} Q`,
      qHint: (least: number, most: number) => `From ${least} to ${most}.`,
    },
  },

  /** The curves that come with the app, by the name each is kept under; see `equalizer/presets.ts`. */
  presets: {
    builtIn: {
      Flat: 'Flat',
      'More bass': 'More bass',
      'Less boom': 'Less boom',
      Warm: 'Warm',
      'Voices forward': 'Voices forward',
      'More air': 'More air',
      'Quiet listening': 'Quiet listening',
    },
    /** What a curve saved with no name is called. */
    myCurve: 'My curve',
  },

  /** One band of the equalizer; see `BandEditor`. */
  band: {
    types: { peak: 'Peak', lowShelf: 'Low shelf', highShelf: 'High shelf' },
    /** Read out for a band: its number, then what it is. */
    said: (band: number, type: string, frequency: string, gain: string, q: string) =>
      `Band ${band}: ${type}, ${frequency}, ${gain}, Q ${q}`,
    closes: 'Closes this band',
    opens: 'Opens this band to change it',
    kind: (band: number, type: string) => `Band ${band} kind: ${type}`,
    frequency: 'Frequency',
    gain: 'Gain',
    widthQ: 'Width (Q)',
    cornerQ: 'Corner (Q)',
    peakHint: 'A higher Q is a narrower band: 1 is a little over an octave, 10 a single note.',
    shelfHint:
      'A shelf turns up or down everything on one side of its frequency. Q is how sharp the corner is; 0.7 is the usual.',
    typeIt: 'Type it',
    typeFrequency: (band: number, now: string) => `Type the frequency of band ${band}, now ${now}`,
    typeGain: (band: number, now: string) => `Type the gain of band ${band}, now ${now}`,
    typeQ: (band: number, now: string) => `Type the Q of band ${band}, now ${now}`,
    remove: (band: number) => `Remove band ${band}`,
    removeThis: 'Remove this band',
  },

  /** The picture of the curve, said for somebody who cannot see it; see `describeCurve`. */
  curve: {
    label: (said: string) => `Response curve. ${said}`,
    flat: 'Flat: nothing is turned up or down.',
    highest: (level: string, near: string) => `Highest ${level} near ${near}.`,
    lowest: (level: string, near: string) => `Lowest ${level} near ${near}.`,
    highestAndLowest: (high: string, highNear: string, low: string, lowNear: string) =>
      `Highest ${high} near ${highNear}, lowest ${low} near ${lowNear}.`,
  },

  /** Bringing in a headphone correction; see `ImportSheet` and `describeImport`. */
  autoEq: {
    title: 'Import from AutoEQ',
    about: "Paste the contents of a headphone's ParametricEQ.txt, or choose the file.",
    textLabel: 'The text of the ParametricEQ file',
    chooseFile: 'Choose a file…',

    graphic:
      'That is the GraphicEQ file, which is for a different kind of equalizer. The one to use is ParametricEQ.txt.',
    noneSupported: 'None of the filters in that text are of a kind this equalizer has.',
    noneFound:
      'No filters were found in that text. A line should look like "Filter 1: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70".',
    imported: (count: number) =>
      oneOrMany(count, '1 band imported.', `${count} bands imported.`),
    leftOut: (count: number, room: number) =>
      oneOrMany(
        count,
        `1 more was left out: there is room for ${room}.`,
        `${count} more were left out: there is room for ${room}.`
      ),
    unsupported: (count: number) =>
      oneOrMany(
        count,
        '1 filter was of a kind this equalizer has not got and was skipped.',
        `${count} filters were of a kind this equalizer has not got and were skipped.`
      ),
    adjusted: (count: number) =>
      oneOrMany(
        count,
        '1 was outside what a band can be set to and was brought inside it.',
        `${count} were outside what a band can be set to and were brought inside it.`
      ),
  },
};
