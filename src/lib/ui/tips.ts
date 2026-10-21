/**
 * The few tips a newcomer is shown, once each, and who counts as a newcomer.
 *
 * Only for what somebody would otherwise never find. A held row has a menu, a
 * row pulled aside queues its song, the player has words and a sheet of its
 * own behind a gear, and Discover starts from the library before it knows
 * anybody: each of these is invisible until somebody stumbles on it, and the
 * README that explains them is not something a person who has just installed
 * a music player sits down to read.
 *
 * Nothing here reads the database or knows about React. It is handed a place
 * to keep what it decides and a way to count what has been listened to, so
 * that when a tip shows can be tested; `tipsStore.ts` is where the real
 * settings table is put behind it.
 */

/** The tips there are, by where each is shown. */
export const TIPS = ['library', 'player', 'discover'] as const;
export type Tip = (typeof TIPS)[number];

/**
 * Listens and skips together, at or above which somebody is taken to have used
 * the app already and is shown no tips.
 *
 * A handful. A newcomer plays a song or two while finding their feet, and the
 * decision is made once — on the first look, which for a new install is
 * before anything has been heard — so playing a few songs afterwards does not
 * take away tips that have not been read yet.
 */
export const USED_AFTER = 5;

/** What is kept, as the setting's words. */
export type TipsKept = {
  /** Whether tips are shown on this install at all. */
  on: boolean;
  /** The tips put away, each with its one tap. */
  seen: Tip[];
};

export type TipsDeps = {
  read(): string | null;
  write(words: string): void;
  /** How many plays and skips the history holds. Throws, and nobody is a newcomer. */
  listened(): number;
};

const isTip = (value: unknown): value is Tip => (TIPS as readonly unknown[]).includes(value);

/** The words as they were kept, or null where there are none or they cannot be read. */
export function parseTips(words: string | null): TipsKept | null {
  if (!words) return null;
  try {
    const value: unknown = JSON.parse(words);
    if (!value || typeof value !== 'object') return null;
    const { on, seen } = value as { on?: unknown; seen?: unknown };
    if (typeof on !== 'boolean') return null;
    return { on, seen: Array.isArray(seen) ? seen.filter(isTip) : [] };
  } catch {
    return null;
  }
}

/**
 * Whether this install shows tips, decided the first time anybody asks.
 *
 * Somebody with a history has been using the app, very likely for longer than
 * this file has existed, and a card telling them to hold a row would be
 * telling them what they do ten times a day. A history that cannot be read is
 * taken the same way: a tip missed is nothing, and a tip wrongly shown to
 * somebody who has used the app for a year is a small insult.
 */
export function decideTips(listened: () => number): TipsKept {
  let count: number;
  try {
    count = listened();
  } catch {
    count = USED_AFTER;
  }
  return { on: count < USED_AFTER, seen: [] };
}

export type Tips = {
  /** What is kept now, deciding it first if nobody has. */
  state(): TipsKept;
  shows(tip: Tip): boolean;
  /** Puts one away for good, or until {@link again}. */
  dismiss(tip: Tip): void;
  /** Every tip once more, for anybody, whatever was decided. */
  again(): void;
  subscribe(listener: () => void): () => void;
};

export function createTips(deps: TipsDeps): Tips {
  let held: TipsKept | null = null;
  const listeners = new Set<() => void>();

  const keep = (next: TipsKept) => {
    held = next;
    try {
      deps.write(JSON.stringify(next));
    } catch {
      // Held for this run of the app, and decided again on the next.
    }
    for (const listener of [...listeners]) listener();
  };

  const state = (): TipsKept => {
    if (held) return held;
    let words: string | null = null;
    try {
      words = deps.read();
    } catch {
      // As if nothing were kept.
    }
    const kept = parseTips(words);
    if (kept) {
      held = kept;
      return held;
    }
    // Written down at once, so the answer is the same on every later start.
    const decided = decideTips(deps.listened);
    held = decided;
    try {
      deps.write(JSON.stringify(decided));
    } catch {
      // See `keep`.
    }
    return held;
  };

  return {
    state,
    shows: (tip) => {
      const now = state();
      return now.on && !now.seen.includes(tip);
    },
    dismiss: (tip) => {
      const now = state();
      if (now.seen.includes(tip)) return;
      keep({ on: now.on, seen: [...now.seen, tip] });
    },
    again: () => keep({ on: true, seen: [] }),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
