/**
 * What is left of a failure's message once everything in it that could say
 * something about the person is taken out.
 *
 * The error log exists to be read by somebody else — pasted into an issue,
 * or sent in a message — and the messages it is fed were written for a
 * developer's console: the extractor names the video it could not fetch,
 * the player names the file it could not open, a catalogue's refusal
 * carries the address that was asked, which has the song in it. Kept as
 * they came, a list of fifty failures is a list of what somebody listens to.
 *
 * So nothing is kept as it came. Whatever could be a name is replaced by a
 * placeholder before the line is written down, and the placeholder says
 * what kind of thing was there, which is usually all a bug report needs.
 * The rules lean towards losing too much: a message that has been made
 * useless is a question to ask, and one that has given somebody away cannot
 * be taken back.
 *
 * The rules, in the order they are applied:
 *
 *  0. Any name the app knows of — a title, artist or album in the library,
 *     the name of a video that was being fetched — is taken out wherever
 *     it stands and however it is written (`<…>`). The rules below find a
 *     name by how it is set off, in quotes or after a colon; this one finds
 *     it by being one, which catches "Some Artist - Some Song is
 *     unavailable", set off by nothing at all.
 *  1. Addresses — anything with a scheme (`https://…`, `content://…`,
 *     `file://…`) or beginning `www.` — become `<url>`.
 *  2. E-mail addresses become `<email>`.
 *  3. Anything in quotation marks of any kind — straight, curly, «», „“,
 *     「」, backticks — becomes `<…>`. An apostrophe inside a word is not a
 *     quotation mark.
 *  4. A word with a slash or a backslash in it is a path, and becomes
 *     `<path>`; "HTTP/1.1" is let through.
 *  5. A word that looks made rather than written — long, or a mixture of
 *     letters and digits, or eleven characters of mixed case the way a
 *     YouTube video's id is — is a token or an id, and becomes `<id>`.
 *  6. After the first colon that is followed by a space, everything is
 *     dropped (`<…>`) unless all of it is technical: codes in capitals with
 *     underscores, numbers, a few words such as HTTP. This is where a title
 *     goes in most messages: "Unable to extract: Some Artist – Some Song".
 *  7. Runs of spaces and line breaks become one space, and the whole is cut
 *     to {@link MESSAGE_LIMIT} characters.
 *
 * Nothing here knows about the phone, so it is tested on its own.
 */

/** How long a message may be once scrubbed. */
export const MESSAGE_LIMIT = 200;

const URL = /\b[a-z][a-z0-9+.-]*:\/\/\S*|\bwww\.\S+/gi;
const EMAIL = /[^\s@<>()"'`]+@[^\s@<>()"'`]+\.[a-z]{2,}/gi;

/**
 * Pairs of quotation marks, opening and closing. A straight single quote is
 * only taken as one where it begins a word and ends one, so that "can't"
 * and "it's" are left alone.
 */
const QUOTED: readonly RegExp[] = [
  /"[^"\n]*"/g,
  /“[^”\n]*”/g,
  /„[^“”\n]*[“”]/g,
  /‘[^’\n]*’/g,
  /«[^»\n]*»/g,
  /‹[^›\n]*›/g,
  /「[^」\n]*」/g,
  /『[^』\n]*』/g,
  /`[^`\n]*`/g,
  /(^|[^\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,
];

/** A placeholder this file put there, which the later rules are to leave as it is. */
const PLACEHOLDER = /^<(?:url|email|path|id|…)>[.,;:)\]]*$/;

/** The few words after a colon that say nothing about anybody. */
const TECHNICAL_WORDS = new Set(['HTTP', 'HTTPS', 'GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'OK', 'IO', 'SQL', 'SQLITE', 'JSON', 'NULL']);

function isPath(word: string): boolean {
  if (!/[\\/]/.test(word)) return false;
  return !/^HTTPS?\/\d(?:\.\d)?[.,;:)]*$/i.test(word);
}

/**
 * Whether a word looks generated: an id, a token, a hash, a video's id.
 *
 * A code in capitals with underscores (`ERR_YOUTUBE_REFUSED`) is not one,
 * nor is a plain number or a word with a digit at the end of it (`HTTP2`,
 * `utf8`) — those are the parts of a message worth keeping.
 */
function isMade(word: string): boolean {
  const bare = word.replace(/^[(\[{]+|[.,;:!?)\]}]+$/g, '');
  if (!/^[A-Za-z0-9_-]+$/.test(bare)) return false;
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(bare)) return false;
  if (/^\d+$/.test(bare)) return false;
  if (/^[A-Za-z]+\d{1,2}$/.test(bare)) return false;
  if (bare.length >= 24) return true;
  const letters = /[A-Za-z]/.test(bare);
  const digits = /\d/.test(bare);
  if (bare.length >= 8 && letters && digits) return true;
  /*
    A YouTube video's id: eleven characters, with - or _ inside, or in a
    mixture of capitals and small letters that no name is written in. Words
    joined the way code and brands join them — MusicBrainz, toQueueItem —
    are each a capital and then small letters, and are kept.
  */
  if (bare.length !== 11) return false;
  if (/\w[-_]\w/.test(bare)) return true;
  const mixed = /[a-z]/.test(bare) && /[A-Z]/.test(bare);
  return mixed && !/^(?:[A-Z]?[a-z]{2,})(?:[A-Z][a-z]{2,})*$/.test(bare);
}

function isTechnical(word: string): boolean {
  if (PLACEHOLDER.test(word)) return true;
  const bare = word.replace(/^[(\[{#]+|[.,;:!?)\]}]+$/g, '');
  if (!bare) return true;
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(bare)) return true;
  if (/^[\d.,:%x+-]+$/i.test(bare) && /\d/.test(bare)) return true;
  if (/^[-–—=|·]+$/.test(bare)) return true;
  return TECHNICAL_WORDS.has(bare.toUpperCase()) && bare === bare.toUpperCase();
}

/** Each word of [text] that [test] picks out, replaced by [placeholder]. */
function eachWord(text: string, test: (word: string) => boolean, placeholder: string): string {
  return text
    .split(/(\s+)/)
    .map((word) => (word.trim() && !PLACEHOLDER.test(word) && test(word) ? placeholder : word))
    .join('');
}

/** Rule 6: what follows the first colon, kept only where it is all codes and numbers. */
function afterColon(text: string): string {
  const colon = /:\s|：\s?/.exec(text);
  if (!colon) return text;
  const head = text.slice(0, colon.index + 1);
  const rest = text.slice(colon.index + colon[0].length).trim();
  if (!rest) return head;
  const words = rest.split(/\s+/);
  return words.every(isTechnical) ? `${head} ${rest}` : `${head} <…>`;
}

/** Names shorter than this are not looked for: two letters are in every sentence. */
const SHORTEST_NAME = 3;

/** Rule 0: every name in [names] that [text] holds, whatever its case, taken out. */
function withoutNames(text: string, names: readonly string[]): string {
  if (names.length === 0) return text;
  let lower = text.toLowerCase();
  // Longest first, so that a title holding an artist's name goes as a whole.
  const present = [...new Set(names.map((name) => name.replace(/\s+/g, ' ').trim().toLowerCase()))]
    .filter((name) => name.length >= SHORTEST_NAME && lower.includes(name))
    .sort((a, b) => b.length - a.length);
  for (const name of present) {
    let at = lower.indexOf(name);
    while (at >= 0) {
      text = `${text.slice(0, at)}<…>${text.slice(at + name.length)}`;
      lower = text.toLowerCase();
      at = lower.indexOf(name, at + 3);
    }
  }
  return text;
}

/**
 * [message] with everything that could be somebody's taken out: see above.
 * [names] are the ones the app knows of, for rule 0.
 */
export function scrub(message: unknown, names: readonly string[] = []): string {
  let text = typeof message === 'string' ? message : message == null ? '' : String(message);
  text = text.replace(/\s+/g, ' ');
  text = withoutNames(text, names);
  text = text.replace(URL, '<url>');
  text = text.replace(EMAIL, '<email>');
  for (const pattern of QUOTED) {
    text = text.replace(pattern, (whole, before?: string) => (typeof before === 'string' && pattern.flags.includes('u') ? `${before}<…>` : '<…>'));
  }
  text = eachWord(text, isPath, '<path>');
  text = eachWord(text, isMade, '<id>');
  text = afterColon(text);
  text = text.replace(/\s+/g, ' ').trim();
  // Cut by character and not by code unit: half an emoji is a lone surrogate, which no link can be made of.
  if (text.length > MESSAGE_LIMIT) text = `${Array.from(text).slice(0, MESSAGE_LIMIT - 1).join('').trimEnd()}…`;
  return text;
}
