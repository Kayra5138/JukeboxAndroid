import { canonicalLabel, foldForMatch } from '../metadata/text.ts';

/**
 * Smart lists: a name and a few rules, and the songs that meet them.
 *
 * Nothing about the songs is written down. The rules are kept with the list
 * (`playlists.rules`, as the JSON [writeSmartRules] makes), and the songs are
 * worked out from the library and the history every time the list is opened,
 * so a song added this morning or played for the sixth time an hour ago is in
 * or out of it as the rules say now. All of that working out is here, with
 * nothing of the database or the screen in it: what it is given is the songs,
 * what was listened to, the rules and the time, and what it answers is the
 * ids of the songs that belong, in the list's order.
 */

/** What a rule asks about. */
export type SmartField =
  | 'tag'
  | 'artist'
  | 'albumArtist'
  | 'album'
  | 'genre'
  | 'title'
  | 'year'
  | 'added'
  | 'plays'
  | 'lastPlayed'
  | 'skips'
  | 'length';

/**
 * How a rule asks it.
 *
 * - Words (`is`, `isNot`, `contains`, `notContains`) for the fields that are
 *   names, and the first two for a tag, which a song carries or does not.
 * - `more`, `less` and `between` for a number: a year (after, before), how
 *   many times a song was played or skipped, how many minutes it runs.
 *   `between` takes both ends in.
 * - `within`, `before` and `never` for a day: added or last played in the
 *   last so many days, more than so many days ago, or, for a play, never.
 */
export type SmartOp =
  | 'is'
  | 'isNot'
  | 'contains'
  | 'notContains'
  | 'more'
  | 'less'
  | 'between'
  | 'within'
  | 'before'
  | 'never';

/**
 * One rule. Flat rather than a shape for each field, so that changing what a
 * rule asks about in the editor keeps whatever was typed in it: `text` is read
 * by the fields that are words, `value` and `to` by the rest, and whichever
 * the field does not read is left alone.
 */
export type SmartRule = {
  field: SmartField;
  op: SmartOp;
  text: string;
  /** A year, a count, minutes or days, by the field. */
  value: number;
  /** The other end, for `between`. */
  to: number;
};

/** Which order a smart list is in, and so which of its songs a limit keeps. */
export type SmartOrder = 'random' | 'mostPlayed' | 'leastPlayed' | 'newest' | 'oldest' | 'title';

export type SmartRules = {
  /** Whether a song has to meet every rule, or one of them is enough. */
  match: 'all' | 'any';
  rules: SmartRule[];
  /** How many songs at most, or null for every one that qualifies. */
  limit: number | null;
  order: SmartOrder;
};

/** What a song has to say for itself to be asked about. A library track is one. */
export type SmartTrack = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  albumArtist?: string | null;
  genre: string | null;
  year: number | null;
  tags: readonly string[];
  addedAt: number | null;
  durationSec: number;
};

/** What was listened to, by song id. A song absent from a map was never played, or never skipped. */
export type SmartStats = {
  plays: ReadonlyMap<string, number>;
  lastPlayed: ReadonlyMap<string, number>;
  skips: ReadonlyMap<string, number>;
};

/** In the order the editor offers them. */
export const SMART_FIELDS: readonly SmartField[] = [
  'tag',
  'artist',
  'albumArtist',
  'album',
  'genre',
  'title',
  'year',
  'added',
  'plays',
  'lastPlayed',
  'skips',
  'length',
];

export const SMART_ORDERS: readonly SmartOrder[] = ['random', 'mostPlayed', 'leastPlayed', 'newest', 'oldest', 'title'];

const WORDS: readonly SmartOp[] = ['is', 'isNot', 'contains', 'notContains'];
const NUMBERS: readonly SmartOp[] = ['more', 'less', 'between'];

/** The ways each field can be asked about, the first being the one a new rule starts with. */
export function opsFor(field: SmartField): readonly SmartOp[] {
  switch (field) {
    case 'tag':
      return ['is', 'isNot'];
    case 'artist':
    case 'albumArtist':
    case 'album':
    case 'genre':
    case 'title':
      return WORDS;
    case 'year':
    case 'plays':
    case 'skips':
    case 'length':
      return NUMBERS;
    case 'added':
      return ['within', 'before'];
    case 'lastPlayed':
      return ['within', 'before', 'never'];
  }
}

/** Whether [field] is answered in words rather than in a number. */
export function asksWords(field: SmartField): boolean {
  return opsFor(field).includes('is');
}

/**
 * The numbers a field's value may be, and where a new rule starts.
 *
 * A year from the first records to well past now; counts and minutes from
 * nought, since "played more than nought times" is a question worth asking
 * (though "fewer than nought" is not, and is refused); days from one, since
 * nought days is no time at all.
 */
export function rangeOf(field: SmartField): { min: number; max: number; start: number } {
  switch (field) {
    case 'year':
      return { min: 1000, max: 3000, start: 2000 };
    case 'plays':
      return { min: 0, max: 100_000, start: 5 };
    case 'skips':
      return { min: 0, max: 100_000, start: 2 };
    case 'length':
      return { min: 0, max: 1_000, start: 5 };
    case 'added':
    case 'lastPlayed':
      return { min: 1, max: 36_500, start: 30 };
    default:
      return { min: 0, max: 0, start: 0 };
  }
}

/** A rule as the editor adds one: the field's first way of asking, and its starting number. */
export function newRule(field: SmartField = 'tag'): SmartRule {
  const range = rangeOf(field);
  return { field, op: opsFor(field)[0]!, text: '', value: range.start, to: range.start };
}

/**
 * [rule] asking about [field] instead, keeping what was typed where the new
 * field reads the same thing: words stay words, and a number that is outside
 * the new field's range goes back to where that field starts.
 */
export function withField(rule: SmartRule, field: SmartField): SmartRule {
  if (field === rule.field) return rule;
  const range = rangeOf(field);
  const fits = (value: number) => (Number.isInteger(value) && value >= range.min && value <= range.max ? value : range.start);
  const ops = opsFor(field);
  return {
    field,
    op: ops.includes(rule.op) ? rule.op : ops[0]!,
    text: rule.text,
    value: fits(rule.value),
    to: fits(rule.to),
  };
}

/** Why [rule] cannot be asked yet, or null when it can. */
export type RuleProblem = 'text' | 'value' | 'range' | 'op';

export function ruleProblem(rule: SmartRule): RuleProblem | null {
  if (!SMART_FIELDS.includes(rule.field) || !opsFor(rule.field).includes(rule.op)) return 'op';
  // Folded as it will be matched, so that a word of nothing but punctuation is not taken for one.
  if (rule.field === 'tag') return canonicalLabel(rule.text) === '' ? 'text' : null;
  if (asksWords(rule.field)) return foldForMatch(rule.text) === '' ? 'text' : null;
  if (rule.op === 'never') return null;
  const range = rangeOf(rule.field);
  const fits = (value: number) => Number.isInteger(value) && value >= range.min && value <= range.max;
  if (!fits(rule.value)) return 'value';
  if (rule.op === 'between') {
    if (!fits(rule.to)) return 'value';
    if (rule.to < rule.value) return 'range';
  }
  // Fewer than nought is nothing anything could be.
  if (rule.op === 'less' && rule.value <= 0) return 'value';
  return null;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** A smart list's rules as a new one starts: every song, until a rule is added, in title order. */
export function emptyRules(): SmartRules {
  return { match: 'all', rules: [], limit: null, order: 'title' };
}

/** How many songs a limit may be. */
export const LIMIT_RANGE = { min: 1, max: 10_000 } as const;

/** Where a limit starts when it is turned on. */
export const LIMIT_START = 50;

/** The rules as they are kept in `playlists.rules`. */
export function writeSmartRules(rules: SmartRules): string {
  return JSON.stringify({
    v: 1,
    match: rules.match,
    rules: rules.rules.map(({ field, op, text, value, to }) => ({ field, op, text: text.trim(), value, to })),
    limit: rules.limit,
    order: rules.order,
  });
}

/**
 * The rules kept in `playlists.rules`, read back.
 *
 * Whatever is there is taken as far as it can be: a rule this version does not
 * know, or one that cannot be asked, is left out rather than refusing the
 * whole list, and a missing or unknown order, match or limit is the one a new
 * list starts with. A list whose rules were lost altogether is every song,
 * which is what a list of no rules is, and can be given rules again.
 */
export function readSmartRules(json: string | null | undefined): SmartRules {
  const empty = emptyRules();
  if (!json) return empty;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return empty;
  }
  if (!raw || typeof raw !== 'object') return empty;
  const data = raw as Record<string, unknown>;
  const rules: SmartRule[] = [];
  for (const entry of Array.isArray(data.rules) ? data.rules : []) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const field = item.field as SmartField;
    if (!SMART_FIELDS.includes(field)) continue;
    const op = item.op as SmartOp;
    // A number is needed only where one is asked; elsewhere it is kept for the field the rule may be changed to.
    const start = asksWords(field) || op === 'never' ? rangeOf(field).start : NaN;
    const value = typeof item.value === 'number' ? item.value : start;
    const rule: SmartRule = {
      field,
      op,
      text: typeof item.text === 'string' ? item.text : '',
      value,
      // A rule with no other end needs none, and is given its first.
      to: typeof item.to === 'number' ? item.to : value,
    };
    if (ruleProblem(rule) == null) rules.push(rule);
  }
  const limit = data.limit;
  return {
    match: data.match === 'any' ? 'any' : 'all',
    rules,
    limit:
      typeof limit === 'number' && Number.isInteger(limit) && limit >= LIMIT_RANGE.min && limit <= LIMIT_RANGE.max
        ? limit
        : null,
    order: SMART_ORDERS.includes(data.order as SmartOrder) ? (data.order as SmartOrder) : empty.order,
  };
}

/** Whether [track] meets [rule], which can be asked. */
function meets(track: SmartTrack, rule: SmartRule, stats: SmartStats, now: number): boolean {
  switch (rule.field) {
    case 'tag': {
      const wanted = canonicalLabel(rule.text);
      const has = track.tags.some((tag) => canonicalLabel(tag) === wanted);
      return rule.op === 'is' ? has : !has;
    }
    case 'artist':
      return words(track.artist, rule);
    case 'albumArtist':
      return words(track.albumArtist ?? null, rule);
    case 'album':
      return words(track.album, rule);
    case 'genre':
      return words(track.genre, rule);
    case 'title':
      return words(track.title, rule);
    // A song that does not say its year, or how long it runs, is in no rule
    // about either: it is neither before 1990 nor after it.
    case 'year':
      return track.year != null && number(track.year, rule);
    case 'length':
      return track.durationSec > 0 && number(track.durationSec / 60, rule, true);
    case 'plays':
      return number(stats.plays.get(track.id) ?? 0, rule);
    case 'skips':
      return number(stats.skips.get(track.id) ?? 0, rule);
    // A song the phone will not date was added at no time anybody can ask about.
    case 'added':
      return track.addedAt != null && age(track.addedAt, rule, now);
    case 'lastPlayed': {
      const last = stats.lastPlayed.get(track.id);
      if (rule.op === 'never') return last == null;
      // More than thirty days ago is a play that long ago: a song never played is asked for with Never.
      return last != null && age(last, rule, now);
    }
  }
}

/**
 * A name against the words of a rule, each folded the way the app matches
 * names elsewhere: case, accents and the dotted and dotless i of Turkish do not
 * count, and nor does punctuation. A song that names nobody is not anybody, and
 * so is in every `isNot` and `notContains`.
 */
function words(value: string | null, rule: SmartRule): boolean {
  const have = value ? foldForMatch(value) : '';
  const wanted = foldForMatch(rule.text);
  switch (rule.op) {
    case 'is':
      return have !== '' && have === wanted;
    case 'isNot':
      return have !== wanted;
    case 'contains':
      return have !== '' && have.includes(wanted);
    case 'notContains':
      return !(have !== '' && have.includes(wanted));
    default:
      return false;
  }
}

/**
 * A number against a rule's. [ends] counts a length in minutes as inside a
 * `between` up to the end of its last minute, so that between 3 and 4 minutes
 * takes in a song of 4:30 as somebody reading "4" on the player would expect.
 */
function number(have: number, rule: SmartRule, ends = false): boolean {
  switch (rule.op) {
    case 'more':
      return have > rule.value;
    case 'less':
      return have < rule.value;
    case 'between':
      return have >= rule.value && (ends ? have < rule.to + 1 : have <= rule.to);
    default:
      return false;
  }
}

function age(at: number, rule: SmartRule, now: number): boolean {
  const since = now - rule.value * DAY_MS;
  return rule.op === 'within' ? at >= since : at < since;
}

/**
 * The songs among [tracks] that [rules] let in, as ids, in the list's order
 * and as many as its limit allows.
 *
 * A rule that cannot be asked yet — a word not typed, a range the wrong way
 * round — asks nothing, so that the editor's count can be read while a rule is
 * still being written. With no rule left to ask, every song is in: a smart
 * list of no rules is the library, in its order, up to its limit.
 *
 * [random] is the shuffle's coin, given so that a test can fix it.
 */
export function smartListIds(
  tracks: readonly SmartTrack[],
  rules: SmartRules,
  stats: SmartStats,
  now: number,
  random: () => number = Math.random
): string[] {
  const asked = rules.rules.filter((rule) => ruleProblem(rule) == null);
  const found = tracks.filter((track) => {
    if (asked.length === 0) return true;
    return rules.match === 'all'
      ? asked.every((rule) => meets(track, rule, stats, now))
      : asked.some((rule) => meets(track, rule, stats, now));
  });
  const ordered = inOrder(found, rules.order, stats, random);
  const ids = ordered.map((track) => track.id);
  return rules.limit != null ? ids.slice(0, rules.limit) : ids;
}

/** How many songs [rules] let in, before any limit: what the editor counts. */
export function smartListMatches(
  tracks: readonly SmartTrack[],
  rules: SmartRules,
  stats: SmartStats,
  now: number
): number {
  return smartListIds(tracks, { ...rules, limit: null, order: 'title' }, stats, now).length;
}

const byTitle = (a: SmartTrack, b: SmartTrack) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * [tracks] in [order]. Ties are broken by title, so that two songs played as
 * often as each other stand in the same order every time the list is opened,
 * and a limit cuts it in the same place.
 */
function inOrder(tracks: SmartTrack[], order: SmartOrder, stats: SmartStats, random: () => number): SmartTrack[] {
  const plays = (track: SmartTrack) => stats.plays.get(track.id) ?? 0;
  // A song the phone will not date stands after every dated one, whichever way round.
  const added = (track: SmartTrack) => track.addedAt;
  switch (order) {
    case 'random': {
      const shuffled = [...tracks];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
      }
      return shuffled;
    }
    case 'mostPlayed':
      return [...tracks].sort((a, b) => plays(b) - plays(a) || byTitle(a, b));
    case 'leastPlayed':
      return [...tracks].sort((a, b) => plays(a) - plays(b) || byTitle(a, b));
    case 'newest':
    case 'oldest':
      return [...tracks].sort((a, b) => {
        const one = added(a);
        const two = added(b);
        if (one == null || two == null) return one == null && two == null ? byTitle(a, b) : one == null ? 1 : -1;
        return (order === 'newest' ? two - one : one - two) || byTitle(a, b);
      });
    case 'title':
      return [...tracks].sort(byTitle);
  }
}
