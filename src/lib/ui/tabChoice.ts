/**
 * The tabs that can be taken off the bar, and how the choice is written down.
 *
 * Library and Settings cannot: the one is what the app is, the other is the
 * only way back to this switch. The rest are for somebody who never looks at
 * them, and whose bar is the clearer for their going.
 */
export const OPTIONAL_TABS = ['lists', 'search', 'stats'] as const;
export type OptionalTab = (typeof OPTIONAL_TABS)[number];

const isOptional = (value: unknown): value is OptionalTab => (OPTIONAL_TABS as readonly unknown[]).includes(value);

/** The tabs left off, from the setting's words; anything unreadable leaves every tab on. */
export function hiddenFrom(words: string | null): Set<OptionalTab> {
  if (!words) return new Set();
  try {
    const value: unknown = JSON.parse(words);
    return new Set(Array.isArray(value) ? value.filter(isOptional) : []);
  } catch {
    return new Set();
  }
}

export function storedHidden(hidden: ReadonlySet<OptionalTab>): string {
  return JSON.stringify(OPTIONAL_TABS.filter((tab) => hidden.has(tab)));
}
