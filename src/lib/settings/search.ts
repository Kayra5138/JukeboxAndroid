import type { Strings } from '../i18n/languages.ts';
import { foldForMatch } from '../metadata/text.ts';
import { SETTINGS_PAGES } from './searchIndex.ts';

/**
 * Finding a setting by any word it is shown with, on any page of Settings
 * however far in: its name, the line under it, its choices.
 *
 * Which words each page shows is worked out ahead from the pages' code
 * (`scripts/settings-index.mjs`, which writes `searchIndex.ts`) as places in
 * the strings, and read here in whatever language the app is in. A place
 * that ends `.*` stands for every word under it; any other stands for the
 * one word there, and for nothing where it turns out to be many (a branch
 * read by a key worked out as the page runs).
 */

/** A word found: the page it is on, the way there by the pages' names, and the word itself. */
export type SettingsHit = {
  page: string;
  /** The names of the pages on the way, Settings' own first, this page's last. */
  trail: readonly string[];
  text: string;
  /** Whether what was found is the page's own name, which opens the page and marks nothing on it. */
  isPage: boolean;
};

type PageWords = { page: string; trail: readonly string[]; title: string; texts: readonly string[] };

function placeIn(t: Strings, key: string): unknown {
  let at: unknown = t;
  for (const part of key.split('.')) {
    if (at == null || typeof at !== 'object') return undefined;
    at = (at as Record<string, unknown>)[part];
  }
  return at;
}

function wordsUnder(value: unknown, into: string[], depth = 0): void {
  if (typeof value === 'string') {
    if (value.trim()) into.push(value);
  } else if (value && typeof value === 'object' && depth < 4) {
    for (const inner of Object.values(value)) wordsUnder(inner, into, depth + 1);
  }
}

/** Each page's words in the language [t] is, worked out once for it. */
const worked = new WeakMap<Strings, readonly PageWords[]>();

function pagesIn(t: Strings): readonly PageWords[] {
  const known = worked.get(t);
  if (known) return known;
  const titles = new Map<string, string>();
  for (const entry of SETTINGS_PAGES) {
    const title = placeIn(t, entry.title);
    titles.set(entry.page, typeof title === 'string' ? title : entry.page);
  }
  const trailOf = (page: string | null): string[] => {
    const trail: string[] = [];
    for (let at = page; at; at = SETTINGS_PAGES.find((entry) => entry.page === at)?.parent ?? null) {
      trail.unshift(titles.get(at) ?? at);
    }
    return trail;
  };
  const pages = SETTINGS_PAGES.map((entry) => {
    const texts: string[] = [];
    for (const key of entry.keys) {
      if (key.endsWith('.*')) wordsUnder(placeIn(t, key.slice(0, -2)), texts);
      else {
        const value = placeIn(t, key);
        if (typeof value === 'string' && value.trim()) texts.push(value);
      }
    }
    return { page: entry.page, trail: trailOf(entry.page), title: titles.get(entry.page) ?? entry.page, texts: [...new Set(texts)] };
  });
  worked.set(t, pages);
  return pages;
}

/** As many as are worth reading through; a word in a hundred places wants another word with it. */
const AT_MOST = 60;

/**
 * Everything [query] finds, in the order it is likely wanted: pages by their
 * name first, then a name or a line that begins with what was typed, then
 * the shortest. Every word typed has to be found, in any order, without
 * regard to case or accents.
 */
export function searchSettings(t: Strings, query: string): SettingsHit[] {
  const words = foldForMatch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const found: (SettingsHit & { rank: number })[] = [];
  const seen = new Set<string>();
  const consider = (page: PageWords, text: string, isPage: boolean) => {
    const key = `${page.page}\u0000${text}`;
    if (seen.has(key)) return;
    const folded = foldForMatch(text);
    if (!words.every((word) => folded.includes(word))) return;
    seen.add(key);
    const rank = (isPage ? 0 : folded.startsWith(words[0]!) ? 1 : 2) * 10_000 + folded.length;
    found.push({ page: page.page, trail: page.trail, text, isPage, rank });
  };
  for (const page of pagesIn(t)) {
    consider(page, page.title, true);
    for (const text of page.texts) if (text !== page.title) consider(page, text, false);
  }
  return found
    .sort((a, b) => a.rank - b.rank)
    .slice(0, AT_MOST)
    .map(({ rank: _rank, ...hit }) => hit);
}

/** The pages to open, in order, to come to [page] from Settings itself. */
export function wayTo(page: string): string[] {
  const way: string[] = [];
  for (let at: string | null = page; at && at !== 'settings'; at = SETTINGS_PAGES.find((entry) => entry.page === at)?.parent ?? null) {
    way.unshift(at);
  }
  return way;
}
