import { format } from './format.ts';
import { oneOrMany } from '../write.ts';

/**
 * Smart lists: a list of rules, whose songs are worked out each time it is
 * opened (`lists/smart.ts`). On the Lists tab, on its own page, and in the
 * editor its rules are written in.
 */
export const smart = {
  /** The button on the Lists tab that makes one, read out; and what the sign beside one says. */
  newList: 'New smart list',
  sign: 'Smart list',
  /** Under a smart list's name on the Lists tab: how many songs meet its rules now. */
  detail: (count: number) => `${format.number(count)} ${oneOrMany(count, 'song', 'songs')} · smart`,
  /** Under its name on its own page. */
  hint: 'The songs that meet its rules, as they stand',
  editRules: 'Edit rules',
  empty: 'No song meets these rules just now. Edit them, or listen and look again.',

  editor: {
    /** Over the editor, for a new list and for one being changed. */
    newTitle: 'New smart list',
    editTitle: 'Edit rules',
    name: 'Name',
    namePlaceholder: 'Smart list name',
    match: 'A song must meet',
    all: 'Every rule',
    any: 'Any rule',
    rules: 'Rules',
    noRules: 'No rules yet, so every song is in.',
    addRule: 'Add a rule',
    /** On the cross beside a rule, read out with its place: "Remove rule 2". */
    removeRule: (at: number) => `Remove rule ${format.number(at)}`,
    /** Over the sheet of fields; and the button that opens it, read out with the field it shows. */
    chooseField: 'What the rule asks about',
    asksAbout: (field: string) => `Asks about ${field}`,
    /** Beside a tag rule's box, to pick one of the tags there are. */
    chooseTag: 'Choose…',
    tagSheet: 'Choose a tag',
    noTags: 'No tags yet.',
    textPlaceholder: 'Type a name',
    tagPlaceholder: 'Type a tag',
    /** A rule's box or number, read out: what it asks about and how ("Artist contains"). */
    valueOf: (field: string, op: string) => `${field} ${op}`,
    /** The two ends of a `between`, read out, and the word between them on screen. */
    fromOf: (field: string) => `${field}, from`,
    toOf: (field: string) => `${field}, to`,
    and: 'and',
    limit: 'How many',
    limitOff: 'All of them',
    limitOn: 'At most',
    order: 'In order of',
    /** The live count under the rules. */
    matching: (count: number) =>
      oneOrMany(count, '1 song matches', `${format.number(count)} songs match`),
    /** The same, when a limit keeps fewer than match. */
    matchingKept: (count: number, kept: number) =>
      `${format.number(count)} ${oneOrMany(count, 'song matches', 'songs match')}; the list keeps ${format.number(kept)}`,
    save: 'Save',
    create: 'Create',
    /** Why the list cannot be saved yet. */
    problems: {
      name: 'Give the list a name.',
      text: 'Type what to look for.',
      value: 'That number is out of range.',
      range: 'The second number is smaller than the first.',
      rule: (at: number) => `Rule ${format.number(at)} is not finished.`,
    },
  },

  /** What a rule asks about, by the fields in `lists/smart.ts`. */
  fields: {
    tag: 'Tag',
    artist: 'Artist',
    albumArtist: 'Album artist',
    album: 'Album',
    genre: 'Genre',
    title: 'Title',
    year: 'Year',
    added: 'Added',
    plays: 'Times played',
    lastPlayed: 'Last played',
    skips: 'Times skipped',
    length: 'Length',
  },

  /** How a rule asks it. A number's words depend on what is counted, so they come in kinds. */
  ops: {
    is: 'is',
    isNot: 'is not',
    contains: 'contains',
    notContains: 'does not contain',
    between: 'between',
    year: { more: 'after', less: 'before' },
    count: { more: 'more than', less: 'fewer than' },
    length: { more: 'longer than', less: 'shorter than' },
    within: 'in the last',
    before: 'longer ago than',
    never: 'never',
  },

  /** A rule's number, said with what it counts. */
  units: {
    days: (count: number) => `${format.number(count)} ${oneOrMany(count, 'day', 'days')}`,
    minutes: (count: number) => `${format.number(count)} min`,
    times: (count: number) => `${format.number(count)} ${oneOrMany(count, 'time', 'times')}`,
    songs: (count: number) => `${format.number(count)} ${oneOrMany(count, 'song', 'songs')}`,
  },

  /** The orders a smart list can be in, by the ids in `lists/smart.ts`. */
  orders: {
    random: 'Random',
    mostPlayed: 'Most played',
    leastPlayed: 'Least played',
    newest: 'Newest added',
    oldest: 'Oldest added',
    title: 'Title',
  },
};
